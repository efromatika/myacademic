// ============================================================
// app.js - Controller utama Academic Planner
// ============================================================

const GRADE_WEIGHTS = { A: 4.0, AB: 3.5, B: 3.0, BC: 2.5, C: 2.0, D: 1.0, E: 0.0 };
const COURSE_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316",
  "#eab308","#22c55e","#10b981","#14b8a6","#06b6d4","#3b82f6"
];

const App = (() => {
  let courses = [];
  let dataset = [];
  let editingId = null;
  let currentPage = "dashboard";
  let filterSemester = "all";
  let searchQuery = "";

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    setupNav();
    setupEventListeners();
    applyTheme();
    updateOnlineStatus();
    window.addEventListener("online", () => { UI.updateOnlineStatus(); syncData(); });
    window.addEventListener("offline", UI.updateOnlineStatus);

    // Load from cache first for instant display
    courses = Storage.loadCourses();
    dataset = Storage.loadDataset();
    renderCurrentPage();

    // Then fetch fresh data
    await syncData();
  }

  // ============================================================
  // SYNC
  // ============================================================
  async function syncData() {
    if (!navigator.onLine) {
      UI.toast("Mode offline — menggunakan data cache", "warning");
      return;
    }
    UI.showLoading("Sinkronisasi data...");
    try {
      const [coursesRes, datasetRes] = await Promise.all([
        Api.getCourses(),
        Api.getDataset()
      ]);
      if (coursesRes.success) {
        courses = coursesRes.data;
        Storage.saveCourses(courses);
      }
      if (datasetRes.success) {
        dataset = datasetRes.data;
        Storage.saveDataset(dataset);
      }
      Storage.saveLastSync();
      updateLastSyncTime();
      renderCurrentPage();
      UI.toast("Data berhasil disinkronkan", "success");
    } catch (err) {
      UI.toast("Gagal sinkronisasi — menggunakan cache", "error");
      courses = Storage.loadCourses();
      dataset = Storage.loadDataset();
      renderCurrentPage();
    } finally {
      UI.hideLoading();
    }
  }

  function updateLastSyncTime() {
    const ts = Storage.loadLastSync();
    const el = document.getElementById("last-sync");
    if (el && ts) {
      const d = new Date(ts);
      el.textContent = `Terakhir sync: ${d.toLocaleTimeString("id-ID")}`;
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function setupNav() {
    document.querySelectorAll("[data-page]").forEach(el => {
      el.addEventListener("click", () => navigateTo(el.dataset.page));
    });
  }

  function navigateTo(page) {
    currentPage = page;
    UI.setActiveNav(page);
    UI.showPage(page);
    renderCurrentPage();
    // Close sidebar on mobile
    document.getElementById("sidebar")?.classList.add("-translate-x-full");
  }

  function renderCurrentPage() {
    if (currentPage === "dashboard") renderDashboard();
    else if (currentPage === "courses") renderCourses();
    else if (currentPage === "schedule") renderSchedule();
    else if (currentPage === "rekap") renderRekap();
    else if (currentPage === "statistics") renderStatistics();
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderDashboard() {
    const stats = calcStats();
    UI.updateStats(stats);
    renderRecentCourses();
    renderConflictWarning(stats.conflictPairs);
  }

  function calcStats() {
    const settings = Storage.loadSettings();
    const activeSem = settings.activeSemester;
    const semCourses = courses.filter(c => c.Semester?.toString() === activeSem?.toString());

    let totalMutu = 0, totalSKS = 0;
    let allMutu = 0, allSKS = 0;

    semCourses.forEach(c => {
      const w = GRADE_WEIGHTS[c.Nilai];
      if (w !== undefined) { totalMutu += w * Number(c.SKS || 0); totalSKS += Number(c.SKS || 0); }
    });
    courses.forEach(c => {
      const w = GRADE_WEIGHTS[c.Nilai];
      if (w !== undefined) { allMutu += w * Number(c.SKS || 0); allSKS += Number(c.SKS || 0); }
    });

    const conflictPairs = Scheduler.findConflicts(courses);
    return {
      totalMK: courses.length,
      totalSKS: courses.reduce((s, c) => s + Number(c.SKS || 0), 0),
      ips: totalSKS > 0 ? totalMutu / totalSKS : 0,
      ipk: allSKS > 0 ? allMutu / allSKS : 0,
      bentrok: conflictPairs.length,
      conflictPairs,
    };
  }

  function renderRecentCourses() {
    const el = document.getElementById("recent-courses");
    if (!el) return;
    const recent = [...courses].slice(-4).reverse();
    if (recent.length === 0) {
      el.innerHTML = `<p class="text-slate-400 text-sm text-center py-4">Belum ada mata kuliah. Tambahkan sekarang!</p>`;
      return;
    }
    el.innerHTML = recent.map(c => `
      <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.Warna || '#6366f1'}"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${c.Nama}</p>
          <p class="text-xs text-slate-400">Sem ${c.Semester} · ${c.SKS} SKS</p>
        </div>
        <span class="text-xs font-semibold px-2 py-1 rounded-lg ${gradeColorClass(c.Nilai)}">${c.Nilai || '-'}</span>
      </div>`).join("");
  }

  function renderConflictWarning(pairs) {
    const el = document.getElementById("conflict-warning");
    if (!el) return;
    if (pairs.length === 0) {
      el.innerHTML = `<div class="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm"><span>✅</span><span>Tidak ada bentrok jadwal</span></div>`;
    } else {
      el.innerHTML = `<div class="space-y-2">
        <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium"><span>⚠️</span><span>${pairs.length} bentrok terdeteksi</span></div>
        ${pairs.slice(0, 3).map(([a, b]) => `
          <div class="text-xs text-slate-500 dark:text-slate-400 pl-6">${a.Nama} ↔ ${b.Nama} (${a.Hari})</div>`).join("")}
      </div>`;
    }
  }

  function gradeColorClass(nilai) {
    const map = { A:"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", AB:"bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400", B:"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", BC:"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", C:"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", D:"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", E:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    return map[nilai] || "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
  }

  // ============================================================
  // COURSES
  // ============================================================
  function renderCourses() {
    let filtered = courses;
    if (filterSemester !== "all") filtered = filtered.filter(c => c.Semester?.toString() === filterSemester);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.Nama?.toLowerCase().includes(q) ||
        c.Kode?.toLowerCase().includes(q) ||
        c.Dosen?.toLowerCase().includes(q)
      );
    }

    const el = document.getElementById("courses-list");
    if (!el) return;

    if (filtered.length === 0) {
      el.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400">
        <div class="text-4xl mb-3">📚</div>
        <p class="font-medium">Belum ada mata kuliah</p>
        <p class="text-sm">Klik + untuk menambahkan mata kuliah</p>
      </div>`;
      return;
    }

    el.innerHTML = filtered.map(c => `
      <div class="course-card glass-card rounded-2xl p-4 hover:shadow-lg transition-all duration-200 border-l-4" style="border-color:${c.Warna || '#6366f1'}">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-mono text-indigo-500 dark:text-indigo-400">${c.Kode}</p>
            <h3 class="font-semibold text-slate-800 dark:text-white truncate">${c.Nama}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded-lg ml-2 flex-shrink-0 ${gradeColorClass(c.Nilai)}">${c.Nilai || '–'}</span>
        </div>
        <div class="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <span>📅 Sem ${c.Semester}</span>
          <span>📊 ${c.SKS} SKS</span>
          ${c.Hari ? `<span>⏰ ${c.Hari}</span>` : ""}
          ${c.Mulai ? `<span>🕐 ${c.Mulai}–${c.Selesai}</span>` : ""}
          ${c.Ruang ? `<span>🏛️ ${c.Ruang}</span>` : ""}
          ${c.Dosen ? `<span class="col-span-2 truncate">👤 ${c.Dosen}</span>` : ""}
        </div>
        <div class="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button class="btn-edit flex-1 text-xs py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors" data-id="${c.ID}">✏️ Edit</button>
          <button class="btn-delete text-xs py-1.5 px-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" data-id="${c.ID}">🗑️</button>
        </div>
      </div>`).join("");

    el.querySelectorAll(".btn-edit").forEach(btn =>
      btn.addEventListener("click", () => openEditModal(btn.dataset.id))
    );
    el.querySelectorAll(".btn-delete").forEach(btn =>
      btn.addEventListener("click", () => deleteCourse(btn.dataset.id))
    );

    // Update semester filter options
    updateSemesterFilter();
  }

  function updateSemesterFilter() {
    const semesters = [...new Set(courses.map(c => c.Semester))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    const sel = document.getElementById("filter-semester");
    if (!sel) return;
    sel.innerHTML = `<option value="all">Semua Semester</option>` +
      semesters.map(s => `<option value="${s}" ${filterSemester === s ? "selected" : ""}>Semester ${s}</option>`).join("");
  }

  // ============================================================
  // SCHEDULE
  // ============================================================
  function renderSchedule() {
    Scheduler.renderGrid(
      "schedule-container",
      courses,
      id => openEditModal(id),
      id => deleteCourse(id)
    );
  }

  // ============================================================
  // REKAP
  // ============================================================
  function renderRekap() {
    const el = document.getElementById("rekap-container");
    if (!el) return;

    const semesterMap = {};
    courses.forEach(c => {
      const sem = c.Semester || "?";
      if (!semesterMap[sem]) semesterMap[sem] = [];
      semesterMap[sem].push(c);
    });

    const sems = Object.keys(semesterMap).sort((a, b) => Number(a) - Number(b));
    let allMutu = 0, allSKS = 0;

    const semCards = sems.map(sem => {
      const sc = semesterMap[sem];
      let mutu = 0, sks = 0;
      sc.forEach(c => {
        const w = GRADE_WEIGHTS[c.Nilai];
        if (w !== undefined) { mutu += w * Number(c.SKS || 0); sks += Number(c.SKS || 0); }
      });
      const ips = sks > 0 ? mutu / sks : 0;
      allMutu += mutu; allSKS += sks;

      const rows = sc.map(c => `
        <tr class="border-b border-slate-100 dark:border-slate-700">
          <td class="py-2 text-sm font-mono text-indigo-500">${c.Kode}</td>
          <td class="py-2 text-sm text-slate-700 dark:text-slate-200">${c.Nama}</td>
          <td class="py-2 text-sm text-center">${c.SKS}</td>
          <td class="py-2 text-sm text-center"><span class="font-semibold ${gradeColorClass(c.Nilai)} px-2 py-0.5 rounded">${c.Nilai || '–'}</span></td>
          <td class="py-2 text-sm text-center text-slate-500">${c.Nilai && GRADE_WEIGHTS[c.Nilai] !== undefined ? (GRADE_WEIGHTS[c.Nilai] * Number(c.SKS)).toFixed(1) : '–'}</td>
        </tr>`).join("");

      return `
        <div class="glass-card rounded-2xl overflow-hidden mb-4">
          <div class="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-100 dark:border-slate-700">
            <h3 class="font-bold text-slate-800 dark:text-white">Semester ${sem}</h3>
            <div class="text-right">
              <span class="text-xs text-slate-500 dark:text-slate-400">IPS</span>
              <span class="ml-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">${ips.toFixed(2)}</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full px-4">
              <thead>
                <tr class="text-xs text-slate-400 uppercase tracking-wide">
                  <th class="px-4 py-2 text-left">Kode</th>
                  <th class="px-4 py-2 text-left">Nama</th>
                  <th class="px-4 py-2 text-center">SKS</th>
                  <th class="px-4 py-2 text-center">Nilai</th>
                  <th class="px-4 py-2 text-center">Mutu</th>
                </tr>
              </thead>
              <tbody class="px-4">${rows}</tbody>
            </table>
          </div>
          <div class="flex justify-between text-sm px-4 py-3 bg-slate-50 dark:bg-slate-800/50 font-medium">
            <span class="text-slate-600 dark:text-slate-300">Total: ${sks} SKS · ${mutu.toFixed(1)} Mutu</span>
            <span class="text-indigo-600 dark:text-indigo-400">IPS ${ips.toFixed(2)}</span>
          </div>
        </div>`;
    }).join("");

    const ipk = allSKS > 0 ? allMutu / allSKS : 0;
    el.innerHTML = `
      <div class="glass-card rounded-2xl p-5 mb-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <p class="text-sm opacity-80 mb-1">IPK Keseluruhan</p>
        <p class="text-4xl font-bold">${ipk.toFixed(2)}</p>
        <p class="text-sm opacity-80 mt-1">Total ${allSKS} SKS · ${allMutu.toFixed(1)} Mutu</p>
      </div>
      ${semCards || '<p class="text-slate-400 text-center py-8">Belum ada data rekap</p>'}`;
  }

  // ============================================================
  // STATISTICS
  // ============================================================
  function renderStatistics() {
    setTimeout(() => Charts.renderAll(courses), 50);
  }

  // ============================================================
  // COURSE CRUD
  // ============================================================
  function openAddModal() {
    editingId = null;
    document.getElementById("modal-title").textContent = "Tambah Mata Kuliah";
    document.getElementById("course-form").reset();
    document.getElementById("color-picker").value = COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
    UI.openModal("course-modal");
  }

  function openEditModal(id) {
    const course = courses.find(c => c.ID?.toString() === id?.toString());
    if (!course) return;
    editingId = id;
    document.getElementById("modal-title").textContent = "Edit Mata Kuliah";
    fillForm(course);
    UI.openModal("course-modal");
  }

  function fillForm(course) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set("f-semester", course.Semester);
    set("f-kode", course.Kode);
    set("f-nama", course.Nama);
    set("f-sks", course.SKS);
    set("f-nilai", course.Nilai);
    set("f-hari", course.Hari);
    set("f-mulai", course.Mulai);
    set("f-selesai", course.Selesai);
    set("f-ruang", course.Ruang);
    set("f-dosen", course.Dosen);
    set("color-picker", course.Warna || "#6366f1");
  }

  function getFormData() {
    const get = id => document.getElementById(id)?.value?.trim() || "";
    return {
      Semester: get("f-semester"),
      Kode: get("f-kode"),
      Nama: get("f-nama"),
      SKS: Number(get("f-sks")) || 0,
      Nilai: get("f-nilai"),
      Hari: get("f-hari"),
      Mulai: get("f-mulai"),
      Selesai: get("f-selesai"),
      Ruang: get("f-ruang"),
      Dosen: get("f-dosen"),
      Warna: get("color-picker") || "#6366f1",
    };
  }

  async function saveCourse() {
    const data = getFormData();
    if (!data.Nama || !data.Semester || !data.SKS) {
      UI.toast("Semester, Nama, dan SKS wajib diisi", "warning"); return;
    }
    UI.showLoading(editingId ? "Menyimpan perubahan..." : "Menambahkan mata kuliah...");
    try {
      let res;
      if (editingId) {
        res = await Api.updateCourse(editingId, data);
        if (res.success) {
          const idx = courses.findIndex(c => c.ID?.toString() === editingId?.toString());
          if (idx >= 0) courses[idx] = { ...courses[idx], ...data };
        }
      } else {
        res = await Api.addCourse(data);
        if (res.success) {
          courses.push({ ID: res.id, ...data });
        }
      }
      if (res.success) {
        Storage.saveCourses(courses);
        UI.closeModal("course-modal");
        renderCurrentPage();
        UI.toast(editingId ? "Mata kuliah diperbarui" : "Mata kuliah ditambahkan", "success");
      } else {
        UI.toast(res.message || "Gagal menyimpan", "error");
      }
    } catch (err) {
      UI.toast("Gagal terhubung ke server", "error");
    } finally {
      UI.hideLoading();
    }
  }

  async function updateCourse(id, data) {
    UI.showLoading("Memperbarui jadwal...");
    try {
      const res = await Api.updateCourse(id, data);
      if (res.success) {
        const idx = courses.findIndex(c => c.ID?.toString() === id?.toString());
        if (idx >= 0) courses[idx] = { ...courses[idx], ...data };
        Storage.saveCourses(courses);
        renderSchedule();
        UI.toast("Jadwal diperbarui", "success");
      }
    } catch { UI.toast("Gagal memperbarui jadwal", "error"); }
    finally { UI.hideLoading(); }
  }

  async function deleteCourse(id) {
    const course = courses.find(c => c.ID?.toString() === id?.toString());
    const ok = await UI.confirm(`Hapus "${course?.Nama}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!ok) return;
    UI.showLoading("Menghapus...");
    try {
      const res = await Api.deleteCourse(id);
      if (res.success) {
        courses = courses.filter(c => c.ID?.toString() !== id?.toString());
        Storage.saveCourses(courses);
        renderCurrentPage();
        UI.toast("Mata kuliah dihapus", "success");
      } else {
        UI.toast(res.message || "Gagal menghapus", "error");
      }
    } catch { UI.toast("Gagal terhubung ke server", "error"); }
    finally { UI.hideLoading(); }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  function setupEventListeners() {
    // FAB / Add button
    document.getElementById("btn-add-fab")?.addEventListener("click", openAddModal);
    document.getElementById("btn-add-course")?.addEventListener("click", openAddModal);

    // Form save
    document.getElementById("btn-save-course")?.addEventListener("click", saveCourse);

    // Sync
    document.getElementById("btn-sync")?.addEventListener("click", syncData);

    // Modal close
    document.querySelectorAll("[data-close-modal]").forEach(btn =>
      btn.addEventListener("click", () => UI.closeModal(btn.dataset.closeModal))
    );
    document.querySelectorAll(".modal-backdrop").forEach(backdrop =>
      backdrop.addEventListener("click", e => { if (e.target === backdrop) UI.closeAllModals(); })
    );

    // Search
    document.getElementById("search-input")?.addEventListener("input", e => {
      searchQuery = e.target.value;
      renderCourses();
    });

    // Filter semester
    document.getElementById("filter-semester")?.addEventListener("change", e => {
      filterSemester = e.target.value;
      renderCourses();
    });

    // Dark mode toggle
    document.getElementById("btn-theme")?.addEventListener("click", toggleTheme);

    // Sidebar mobile toggle
    document.getElementById("btn-menu")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.toggle("-translate-x-full");
    });

    // Autocomplete dari dataset
    document.getElementById("f-nama")?.addEventListener("input", e => {
      handleAutocomplete(e.target.value);
    });

    // Active semester setting
    document.getElementById("active-semester")?.addEventListener("change", e => {
      const s = Storage.loadSettings();
      s.activeSemester = e.target.value;
      Storage.saveSettings(s);
      renderDashboard();
    });

    // Color presets
    document.querySelectorAll(".color-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("color-picker").value = btn.dataset.color;
      });
    });

    // Enter on form
    document.getElementById("course-form")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        saveCourse();
      }
    });
  }

  function handleAutocomplete(query) {
    const dropdown = document.getElementById("autocomplete-dropdown");
    if (!dropdown || !query) { dropdown.classList.add("hidden"); return; }
    const results = dataset.filter(d =>
      d.Nama?.toLowerCase().includes(query.toLowerCase()) ||
      d.Kode?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 6);
    if (results.length === 0) { dropdown.classList.add("hidden"); return; }
    dropdown.innerHTML = results.map(d =>
      `<div class="autocomplete-item px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer text-sm" data-kode="${d.Kode}" data-nama="${d.Nama}" data-sks="${d.SKS}">
        <span class="font-mono text-indigo-500 text-xs">${d.Kode}</span>
        <span class="ml-2 text-slate-700 dark:text-slate-200">${d.Nama}</span>
        <span class="ml-1 text-slate-400 text-xs">(${d.SKS} SKS)</span>
      </div>`
    ).join("");
    dropdown.classList.remove("hidden");
    dropdown.querySelectorAll(".autocomplete-item").forEach(item => {
      item.addEventListener("click", () => {
        document.getElementById("f-kode").value = item.dataset.kode;
        document.getElementById("f-nama").value = item.dataset.nama;
        document.getElementById("f-sks").value = item.dataset.sks;
        dropdown.classList.add("hidden");
      });
    });
    document.addEventListener("click", e => {
      if (!dropdown.contains(e.target) && e.target.id !== "f-nama") {
        dropdown.classList.add("hidden");
      }
    }, { once: true });
  }

  // ============================================================
  // THEME
  // ============================================================
  function applyTheme() {
    const s = Storage.loadSettings();
    if (s.darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    updateThemeIcon(s.darkMode);
  }

  function toggleTheme() {
    const s = Storage.loadSettings();
    s.darkMode = !s.darkMode;
    Storage.saveSettings(s);
    applyTheme();
    Charts.renderAll(courses);
  }

  function updateThemeIcon(dark) {
    const btn = document.getElementById("btn-theme");
    if (btn) btn.innerHTML = dark
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  function updateOnlineStatus() { UI.updateOnlineStatus(); }

  return { init, syncData, updateCourse, courses: () => courses };
})();

document.getElementById("f-sks").addEventListener("change", e => {
  const sks = Number(e.target.value);
  const jadwal2 = document.getElementById("jadwal2-section");
  const btnAdd  = document.getElementById("btn-add-jadwal2");
  if (sks >= 4) {
    jadwal2.classList.remove("hidden");
    btnAdd.classList.add("hidden");
  } else {
    jadwal2.classList.add("hidden");
    btnAdd.classList.remove("hidden");
  }
});

document.addEventListener("DOMContentLoaded", App.init);
