// ============================================================
// app.js - Controller utama Academic Planner
// ============================================================

const GRADE_WEIGHTS = { A:4.0, AB:3.5, B:3.0, BC:2.5, C:2.0, D:1.0, E:0.0 };

const COURSE_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316",
  "#eab308","#0ea5e9","#14b8a6","#3b82f6","#a855f7"
];

const EXTRA_COLORS = {
  Praktikum:       "#10b981",
  Tutorial:        "#f59e0b",
  "Kelas Tambahan":"#06b6d4",
};

// ============================================================
// STATE
// ============================================================
const App = (() => {
  let courses     = [];
  let extraEvents = [];
  let dataset     = [];
  let editingId   = null;        // ID MK yang sedang diedit
  let editingExtraId = null;     // ID Extra yang sedang diedit
  let currentPage = "dashboard";
  let filterSemester = "all";
  let searchQuery    = "";

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    setupNav();
    setupEventListeners();
    applyTheme();
    UI.updateOnlineStatus();
    window.addEventListener("online",  () => { UI.updateOnlineStatus(); syncData(); });
    window.addEventListener("offline", UI.updateOnlineStatus);

    // Tampilkan cache dulu, lalu fetch terbaru
    courses     = Storage.loadCourses();
    extraEvents = Storage.loadExtraEvents();
    dataset     = Storage.loadDataset();
    renderCurrentPage();
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
      const [cRes, evRes, dsRes] = await Promise.all([
        Api.getCourses(),
        Api.getExtraEvents(),
        Api.getDataset(),
      ]);
      if (cRes.success)  { courses     = cRes.data;  Storage.saveCourses(courses); }
      if (evRes.success) { extraEvents = evRes.data;  Storage.saveExtraEvents(extraEvents); }
      if (dsRes.success) { dataset     = dsRes.data;  Storage.saveDataset(dataset); }
      Storage.saveLastSync();
      updateLastSyncTime();
      renderCurrentPage();
      UI.toast("Data berhasil disinkronkan ✓", "success");
    } catch {
      UI.toast("Gagal sinkronisasi — menggunakan cache", "error");
      courses     = Storage.loadCourses();
      extraEvents = Storage.loadExtraEvents();
      dataset     = Storage.loadDataset();
      renderCurrentPage();
    } finally {
      UI.hideLoading();
    }
  }

  function updateLastSyncTime() {
    const ts = Storage.loadLastSync();
    const el = document.getElementById("last-sync");
    if (el && ts) el.textContent = `Sync: ${new Date(ts).toLocaleTimeString("id-ID")}`;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function setupNav() {
    document.querySelectorAll("[data-page]").forEach(el =>
      el.addEventListener("click", () => navigateTo(el.dataset.page))
    );
  }

  function navigateTo(page) {
    currentPage = page;
    UI.setActiveNav(page);
    UI.showPage(page);
    renderCurrentPage();
    document.getElementById("sidebar")?.classList.add("-translate-x-full");
  }

  function renderCurrentPage() {
    if      (currentPage === "dashboard")  renderDashboard();
    else if (currentPage === "courses")    renderCourses();
    else if (currentPage === "schedule")   renderSchedule();
    else if (currentPage === "rekap")      renderRekap();
    else if (currentPage === "statistics") renderStatistics();
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderDashboard() {
    const stats = calcStats();
    UI.updateStats(stats);
    renderRecentCourses();
    renderConflictWarning(stats.conflictIds);
  }

  function calcStats() {
    const s         = Storage.loadSettings();
    const semCourses = courses.filter(c => c.Semester?.toString() === s.activeSemester?.toString());

    let semMutu = 0, semSKS = 0, allMutu = 0, allSKS = 0;
    semCourses.forEach(c => {
      const w = GRADE_WEIGHTS[c.Nilai];
      if (w !== undefined) { semMutu += w * Number(c.SKS||0); semSKS += Number(c.SKS||0); }
    });
    courses.forEach(c => {
      const w = GRADE_WEIGHTS[c.Nilai];
      if (w !== undefined) { allMutu += w * Number(c.SKS||0); allSKS += Number(c.SKS||0); }
    });

    const conflictIds = Scheduler.findConflicts(courses, extraEvents);

    return {
      totalMK:  courses.length,
      totalSKS: courses.reduce((s,c) => s + Number(c.SKS||0), 0),
      ips:      semSKS > 0 ? semMutu / semSKS : 0,
      ipk:      allSKS > 0 ? allMutu / allSKS : 0,
      bentrok:  conflictIds.size,
      conflictIds,
    };
  }

  function renderRecentCourses() {
    const el = document.getElementById("recent-courses");
    if (!el) return;
    const recent = [...courses].slice(-4).reverse();
    if (!recent.length) {
      el.innerHTML = `<p class="text-slate-400 text-sm text-center py-4">Belum ada mata kuliah.</p>`;
      return;
    }
    el.innerHTML = recent.map(c => `
      <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.Warna||"#6366f1"}"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${c.Nama}</p>
          <p class="text-xs text-slate-400">Sem ${c.Semester} · ${c.SKS} SKS</p>
        </div>
        <span class="text-xs font-semibold px-2 py-1 rounded-lg ${gradeColorClass(c.Nilai)}">${c.Nilai||"–"}</span>
      </div>`).join("");
  }

  function renderConflictWarning(conflictIds) {
    const el = document.getElementById("conflict-warning");
    if (!el) return;
    if (!conflictIds.size) {
      el.innerHTML = `<div class="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm"><span>✅</span><span>Tidak ada bentrok jadwal</span></div>`;
    } else {
      el.innerHTML = `<div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
        <span>⚠️</span><span>${conflictIds.size} slot bentrok terdeteksi — cek halaman Jadwal</span></div>`;
    }
  }

  function gradeColorClass(n) {
    const m = { A:"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", AB:"bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400", B:"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", BC:"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", C:"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", D:"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", E:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    return m[n] || "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
  }

  // ============================================================
  // COURSES PAGE
  // ============================================================
  function renderCourses() {
    let filtered = courses;
    if (filterSemester !== "all") filtered = filtered.filter(c => c.Semester?.toString() === filterSemester);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.Nama?.toLowerCase().includes(q) || c.Kode?.toLowerCase().includes(q) || c.Dosen?.toLowerCase().includes(q)
      );
    }

    const el = document.getElementById("courses-list");
    if (!el) return;

    if (!filtered.length) {
      el.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400">
        <div class="text-4xl mb-3">📚</div><p class="font-medium">Belum ada mata kuliah</p>
        <p class="text-sm">Klik + untuk menambahkan</p></div>`;
    } else {
      el.innerHTML = filtered.map(c => buildCourseCard(c)).join("");
      el.querySelectorAll(".btn-edit").forEach(btn   => btn.addEventListener("click", () => openEditCourseModal(btn.dataset.id)));
      el.querySelectorAll(".btn-delete").forEach(btn => btn.addEventListener("click", () => deleteCourse(btn.dataset.id)));
    }

    // Render daftar jadwal extra di bawah cards MK
    renderExtraList();
    updateSemesterFilter();
  }

  function buildCourseCard(c) {
    const jadwal1 = c.Hari  ? `<span>⏰ ${c.Hari} ${c.Mulai}–${c.Selesai}</span>` : "";
    const jadwal2 = c.Hari2 ? `<span>⏰ ${c.Hari2} ${c.Mulai2}–${c.Selesai2} <em class="text-indigo-400">(J2)</em></span>` : "";
    return `
      <div class="course-card glass-card rounded-2xl p-4 hover:shadow-lg transition-all duration-200 border-l-4" style="border-color:${c.Warna||"#6366f1"}">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-mono text-indigo-500 dark:text-indigo-400">${c.Kode||""}</p>
            <h3 class="font-semibold text-slate-800 dark:text-white truncate">${c.Nama}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded-lg ml-2 flex-shrink-0 ${gradeColorClass(c.Nilai)}">${c.Nilai||"–"}</span>
        </div>
        <div class="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <span>📅 Sem ${c.Semester}</span>
          <span>📊 ${c.SKS} SKS</span>
          ${jadwal1}${jadwal2}
          ${c.Ruang  ? `<span>🏛️ ${c.Ruang}</span>`  : ""}
          ${c.Dosen  ? `<span class="col-span-2 truncate">👤 ${c.Dosen}</span>` : ""}
        </div>
        <div class="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button class="btn-edit flex-1 text-xs py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-100 transition-colors" data-id="${c.ID}">✏️ Edit</button>
          <button class="btn-delete text-xs py-1.5 px-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 transition-colors" data-id="${c.ID}">🗑️</button>
        </div>
      </div>`;
  }

  // ── Jadwal Extra list di halaman Courses ─────────────────
  function renderExtraList() {
    const el = document.getElementById("extra-events-list");
    if (!el) return;

    el.innerHTML = extraEvents.length === 0
      ? `<p class="text-slate-400 text-sm text-center py-4">Belum ada jadwal tambahan.</p>`
      : extraEvents.map(ev => {
          const mk = courses.find(c => c.ID?.toString() === ev.MKId?.toString());
          return `
            <div class="flex items-center gap-3 p-3 glass-card rounded-xl mb-2">
              <div class="w-3 h-10 rounded-full flex-shrink-0" style="background:${ev.Warna||"#10b981"}"></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:${ev.Warna||"#10b981"}20;color:${ev.Warna||"#10b981"}">${ev.Tipe}</span>
                  ${mk ? `<span class="text-xs text-slate-400 truncate">${mk.Kode}</span>` : ""}
                </div>
                <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${ev.Label||ev.Nama}</p>
                <p class="text-xs text-slate-400">${ev.Hari} ${ev.Mulai}–${ev.Selesai}${ev.Ruang ? " · "+ev.Ruang : ""}</p>
              </div>
              <div class="flex gap-1">
                <button class="btn-edit-extra p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" data-id="${ev.ID}">✏️</button>
                <button class="btn-del-extra p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" data-id="${ev.ID}">🗑️</button>
              </div>
            </div>`;
        }).join("");

    el.querySelectorAll(".btn-edit-extra").forEach(btn => btn.addEventListener("click", () => openEditExtraModal(btn.dataset.id)));
    el.querySelectorAll(".btn-del-extra").forEach(btn  => btn.addEventListener("click", () => deleteExtraEvent(btn.dataset.id)));
  }

  function updateSemesterFilter() {
    const sems = [...new Set(courses.map(c => c.Semester))].filter(Boolean).sort((a,b) => Number(a)-Number(b));
    const sel  = document.getElementById("filter-semester");
    if (!sel) return;
    sel.innerHTML = `<option value="all">Semua Semester</option>` +
      sems.map(s => `<option value="${s}" ${filterSemester===s?"selected":""}>${s}</option>`).join("");
  }

  // ============================================================
  // SCHEDULE PAGE
  // ============================================================
  function renderSchedule() {
    Scheduler.renderGrid("schedule-container", courses, extraEvents, {
      onEditCourse:  id => openEditCourseModal(id),
      onDeleteCourse: id => deleteCourse(id),
      onEditExtra:   id => openEditExtraModal(id),
      onDeleteExtra:  id => deleteExtraEvent(id),
    });
  }

  // ============================================================
  // REKAP PAGE
  // ============================================================
  function renderRekap() {
    const el = document.getElementById("rekap-container");
    if (!el) return;

    const semMap = {};
    courses.forEach(c => {
      const sem = c.Semester || "?";
      if (!semMap[sem]) semMap[sem] = [];
      semMap[sem].push(c);
    });

    let allMutu = 0, allSKS = 0;
    const sems = Object.keys(semMap).sort((a,b) => Number(a)-Number(b));

    const semCards = sems.map(sem => {
      const sc = semMap[sem];
      let mutu = 0, sks = 0;
      sc.forEach(c => {
        const w = GRADE_WEIGHTS[c.Nilai];
        if (w !== undefined) { mutu += w * Number(c.SKS||0); sks += Number(c.SKS||0); }
      });
      allMutu += mutu; allSKS += sks;
      const ips = sks > 0 ? mutu / sks : 0;

      const rows = sc.map(c => `
        <tr class="border-b border-slate-100 dark:border-slate-700">
          <td class="py-2 px-4 text-sm font-mono text-indigo-500">${c.Kode}</td>
          <td class="py-2 px-4 text-sm text-slate-700 dark:text-slate-200">${c.Nama}</td>
          <td class="py-2 px-4 text-sm text-center">${c.SKS}</td>
          <td class="py-2 px-4 text-sm text-center"><span class="font-semibold ${gradeColorClass(c.Nilai)} px-2 py-0.5 rounded">${c.Nilai||"–"}</span></td>
          <td class="py-2 px-4 text-sm text-center text-slate-500">${c.Nilai&&GRADE_WEIGHTS[c.Nilai]!==undefined?(GRADE_WEIGHTS[c.Nilai]*Number(c.SKS)).toFixed(1):"–"}</td>
        </tr>`).join("");

      return `
        <div class="glass-card rounded-2xl overflow-hidden mb-4">
          <div class="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-100 dark:border-slate-700">
            <h3 class="font-bold text-slate-800 dark:text-white">Semester ${sem}</h3>
            <div class="text-right"><span class="text-xs text-slate-400">IPS </span><span class="text-lg font-bold text-indigo-600 dark:text-indigo-400">${ips.toFixed(2)}</span></div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead><tr class="text-xs text-slate-400 uppercase tracking-wide">
                <th class="px-4 py-2 text-left">Kode</th><th class="px-4 py-2 text-left">Nama</th>
                <th class="px-4 py-2 text-center">SKS</th><th class="px-4 py-2 text-center">Nilai</th>
                <th class="px-4 py-2 text-center">Mutu</th>
              </tr></thead>
              <tbody>${rows}</tbody>
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
  // STATISTICS PAGE
  // ============================================================
  function renderStatistics() {
    setTimeout(() => Charts.renderAll(courses), 50);
  }

  // ============================================================
  // MODAL: MATA KULIAH
  // ============================================================
  function openAddCourseModal() {
    editingId = null;
    document.getElementById("modal-title").textContent = "Tambah Mata Kuliah";
    document.getElementById("course-form").reset();
    document.getElementById("color-picker").value = COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
    // Reset jadwal 2
    showJadwal2(false);
    UI.openModal("course-modal");
  }

  function openEditCourseModal(id) {
    const c = courses.find(x => x.ID?.toString() === id?.toString());
    if (!c) return;
    editingId = id;
    document.getElementById("modal-title").textContent = "Edit Mata Kuliah";
    fillCourseForm(c);
    UI.openModal("course-modal");
  }

  function fillCourseForm(c) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||""; };
    set("f-semester", c.Semester);
    set("f-kode",     c.Kode);
    set("f-nama",     c.Nama);
    set("f-sks",      c.SKS);
    set("f-nilai",    c.Nilai);
    set("f-dosen",    c.Dosen);
    set("color-picker", c.Warna||"#6366f1");
    set("f-hari",    c.Hari);    set("f-mulai",   c.Mulai);   set("f-selesai",  c.Selesai);  set("f-ruang",   c.Ruang);
    set("f-hari2",   c.Hari2);   set("f-mulai2",  c.Mulai2);  set("f-selesai2", c.Selesai2); set("f-ruang2",  c.Ruang2);
    showJadwal2(!!(c.Hari2));
  }

  function showJadwal2(show) {
    const section = document.getElementById("jadwal2-section");
    const btnAdd  = document.getElementById("btn-add-jadwal2");
    if (show) { section?.classList.remove("hidden"); btnAdd?.classList.add("hidden"); }
    else       { section?.classList.add("hidden");    btnAdd?.classList.remove("hidden"); }
  }

  function getCourseFormData() {
    const get = id => document.getElementById(id)?.value?.trim() || "";
    return {
      Semester: get("f-semester"),
      Kode:     get("f-kode"),
      Nama:     get("f-nama"),
      SKS:      Number(get("f-sks")) || 0,
      Nilai:    get("f-nilai"),
      Dosen:    get("f-dosen"),
      Warna:    get("color-picker") || "#6366f1",
      Hari:     get("f-hari"),    Mulai:    get("f-mulai"),   Selesai:  get("f-selesai"),  Ruang:   get("f-ruang"),
      Hari2:    get("f-hari2"),   Mulai2:   get("f-mulai2"),  Selesai2: get("f-selesai2"), Ruang2:  get("f-ruang2"),
    };
  }

  async function saveCourse() {
    const data = getCourseFormData();
    if (!data.Nama || !data.Semester || !data.SKS) {
      UI.toast("Semester, Nama, dan SKS wajib diisi", "warning"); return;
    }
    UI.showLoading(editingId ? "Menyimpan perubahan..." : "Menambahkan...");
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
        if (res.success) courses.push({ ID: res.id, ...data });
      }
      if (res.success) {
        Storage.saveCourses(courses);
        UI.closeModal("course-modal");
        renderCurrentPage();
        UI.toast(editingId ? "Mata kuliah diperbarui ✓" : "Mata kuliah ditambahkan ✓", "success");
      } else {
        UI.toast(res.message || "Gagal menyimpan", "error");
      }
    } catch { UI.toast("Gagal terhubung ke server", "error"); }
    finally  { UI.hideLoading(); }
  }

  async function deleteCourse(id) {
    const c = courses.find(x => x.ID?.toString() === id?.toString());
    if (!await UI.confirm(`Hapus "${c?.Nama}"?\nJadwal Tambahan terkait juga akan dihapus.`)) return;
    UI.showLoading("Menghapus...");
    try {
      const res = await Api.deleteCourse(id);
      if (res.success) {
        courses     = courses.filter(x => x.ID?.toString() !== id?.toString());
        extraEvents = extraEvents.filter(x => x.MKId?.toString() !== id?.toString());
        Storage.saveCourses(courses);
        Storage.saveExtraEvents(extraEvents);
        renderCurrentPage();
        UI.toast("Mata kuliah dihapus ✓", "success");
      } else UI.toast(res.message || "Gagal menghapus", "error");
    } catch { UI.toast("Gagal terhubung ke server", "error"); }
    finally  { UI.hideLoading(); }
  }

  // Dipanggil dari scheduler drag & drop
  async function updateCourse(id, data) {
    UI.showLoading("Memperbarui jadwal...");
    try {
      const res = await Api.updateCourse(id, data);
      if (res.success) {
        const idx = courses.findIndex(c => c.ID?.toString() === id?.toString());
        if (idx >= 0) courses[idx] = { ...courses[idx], ...data };
        Storage.saveCourses(courses);
        renderSchedule();
        UI.toast("Jadwal diperbarui ✓", "success");
      }
    } catch { UI.toast("Gagal memperbarui jadwal", "error"); }
    finally  { UI.hideLoading(); }
  }

  // ============================================================
  // MODAL: JADWAL EXTRA
  // ============================================================
  function openAddExtraModal() {
    editingExtraId = null;
    document.getElementById("extra-modal-title").textContent = "Tambah Jadwal Tambahan";
    document.getElementById("extra-form").reset();
    // Default warna dari tipe default
    updateExtraColor("Praktikum");
    // Isi dropdown MK
    populateExtraMKSelect(null);
    UI.openModal("extra-modal");
  }

  function openEditExtraModal(id) {
    const ev = extraEvents.find(x => x.ID?.toString() === id?.toString());
    if (!ev) return;
    editingExtraId = id;
    document.getElementById("extra-modal-title").textContent = "Edit Jadwal Tambahan";
    fillExtraForm(ev);
    UI.openModal("extra-modal");
  }

  function fillExtraForm(ev) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||""; };
    set("ef-tipe",     ev.Tipe);
    set("ef-label",    ev.Label);
    set("ef-nama",     ev.Nama);   // tampilkan nama MK terkait
    set("ef-hari",     ev.Hari);
    set("ef-mulai",    ev.Mulai);
    set("ef-selesai",  ev.Selesai);
    set("ef-ruang",    ev.Ruang);
    set("ef-pengajar", ev.Pengajar);
    set("ef-warna",    ev.Warna);
    populateExtraMKSelect(ev.MKId);
    updateExtraColor(ev.Tipe);
  }

  function populateExtraMKSelect(selectedId) {
    const sel = document.getElementById("ef-mkid");
    if (!sel) return;
    sel.innerHTML = `<option value="">– Tidak terkait MK –</option>` +
      courses.map(c => `<option value="${c.ID}" ${c.ID?.toString()===selectedId?.toString()?"selected":""}>${c.Kode} – ${c.Nama}</option>`).join("");
  }

  function updateExtraColor(tipe) {
    const colorEl = document.getElementById("ef-warna");
    if (colorEl && !editingExtraId) colorEl.value = EXTRA_COLORS[tipe] || "#10b981";
  }

  function getExtraFormData() {
    const get = id => document.getElementById(id)?.value?.trim() || "";
    const mkId = get("ef-mkid");
    const tipe = get("ef-tipe");
    // Ambil nama MK untuk field Nama
    const mk = courses.find(c => c.ID?.toString() === mkId);
    return {
      MKId:     mkId,
      Tipe:     tipe,
      Label:    get("ef-label"),
      Nama:     mk ? mk.Nama : get("ef-nama"),
      Hari:     get("ef-hari"),
      Mulai:    get("ef-mulai"),
      Selesai:  get("ef-selesai"),
      Ruang:    get("ef-ruang"),
      Pengajar: get("ef-pengajar"),
      Warna:    get("ef-warna") || EXTRA_COLORS[tipe] || "#10b981",
    };
  }

  async function saveExtraEvent() {
    const data = getExtraFormData();
    if (!data.Tipe || !data.Hari || !data.Mulai || !data.Selesai) {
      UI.toast("Tipe, Hari, Jam Mulai & Selesai wajib diisi", "warning"); return;
    }
    UI.showLoading(editingExtraId ? "Menyimpan..." : "Menambahkan...");
    try {
      let res;
      if (editingExtraId) {
        res = await Api.updateExtraEvent(editingExtraId, data);
        if (res.success) {
          const idx = extraEvents.findIndex(x => x.ID?.toString() === editingExtraId?.toString());
          if (idx >= 0) extraEvents[idx] = { ...extraEvents[idx], ...data };
        }
      } else {
        res = await Api.addExtraEvent(data);
        if (res.success) extraEvents.push({ ID: res.id, ...data });
      }
      if (res.success) {
        Storage.saveExtraEvents(extraEvents);
        UI.closeModal("extra-modal");
        renderCurrentPage();
        UI.toast(editingExtraId ? "Jadwal diperbarui ✓" : "Jadwal tambahan ditambahkan ✓", "success");
      } else UI.toast(res.message || "Gagal menyimpan", "error");
    } catch { UI.toast("Gagal terhubung ke server", "error"); }
    finally  { UI.hideLoading(); }
  }

  async function deleteExtraEvent(id) {
    const ev = extraEvents.find(x => x.ID?.toString() === id?.toString());
    if (!await UI.confirm(`Hapus jadwal "${ev?.Label || ev?.Tipe}"?`)) return;
    UI.showLoading("Menghapus...");
    try {
      const res = await Api.deleteExtraEvent(id);
      if (res.success) {
        extraEvents = extraEvents.filter(x => x.ID?.toString() !== id?.toString());
        Storage.saveExtraEvents(extraEvents);
        renderCurrentPage();
        UI.toast("Jadwal tambahan dihapus ✓", "success");
      } else UI.toast(res.message || "Gagal menghapus", "error");
    } catch { UI.toast("Gagal terhubung ke server", "error"); }
    finally  { UI.hideLoading(); }
  }

  // Dipanggil dari scheduler drag & drop
  async function updateExtraEvent(id, data) {
    UI.showLoading("Memperbarui jadwal...");
    try {
      const res = await Api.updateExtraEvent(id, data);
      if (res.success) {
        const idx = extraEvents.findIndex(x => x.ID?.toString() === id?.toString());
        if (idx >= 0) extraEvents[idx] = { ...extraEvents[idx], ...data };
        Storage.saveExtraEvents(extraEvents);
        renderSchedule();
        UI.toast("Jadwal diperbarui ✓", "success");
      }
    } catch { UI.toast("Gagal memperbarui jadwal", "error"); }
    finally  { UI.hideLoading(); }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  function setupEventListeners() {
    // FAB / Add Course
    document.getElementById("btn-add-fab")?.addEventListener("click",    openAddCourseModal);
    document.getElementById("btn-add-course")?.addEventListener("click", openAddCourseModal);

    // Add Extra (tombol di header halaman)
    document.getElementById("btn-add-extra")?.addEventListener("click", openAddExtraModal);

    // Form saves
    document.getElementById("btn-save-course")?.addEventListener("click", saveCourse);
    document.getElementById("btn-save-extra")?.addEventListener("click",  saveExtraEvent);

    // Sync
    document.getElementById("btn-sync")?.addEventListener("click", syncData);

    // Modal close
    document.querySelectorAll("[data-close-modal]").forEach(btn =>
      btn.addEventListener("click", () => UI.closeModal(btn.dataset.closeModal))
    );
    document.querySelectorAll(".modal-backdrop").forEach(bd =>
      bd.addEventListener("click", e => { if (e.target === bd) UI.closeAllModals(); })
    );

    // Search & filter
    document.getElementById("search-input")?.addEventListener("input", e => {
      searchQuery = e.target.value; renderCourses();
    });
    document.getElementById("filter-semester")?.addEventListener("change", e => {
      filterSemester = e.target.value; renderCourses();
    });

    // Dark mode
    document.getElementById("btn-theme")?.addEventListener("click", toggleTheme);

    // Sidebar mobile
    document.getElementById("btn-menu")?.addEventListener("click", () =>
      document.getElementById("sidebar")?.classList.toggle("-translate-x-full")
    );

    // Autocomplete MK nama
    document.getElementById("f-nama")?.addEventListener("input", e => handleAutocomplete(e.target.value));

    // Semester aktif
    document.getElementById("active-semester")?.addEventListener("change", e => {
      const s = Storage.loadSettings(); s.activeSemester = e.target.value;
      Storage.saveSettings(s); renderDashboard();
    });

    // Color presets
    document.querySelectorAll(".color-preset").forEach(btn =>
      btn.addEventListener("click", () => { document.getElementById("color-picker").value = btn.dataset.color; })
    );

    // Jadwal 2 toggle
    document.getElementById("btn-add-jadwal2")?.addEventListener("click", () => showJadwal2(true));
    document.getElementById("btn-remove-jadwal2")?.addEventListener("click", () => {
      showJadwal2(false);
      ["f-hari2","f-mulai2","f-selesai2","f-ruang2"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
    });

    // SKS auto-show jadwal 2
    document.getElementById("f-sks")?.addEventListener("change", e => {
      if (Number(e.target.value) >= 4) showJadwal2(true);
    });

    // Tipe extra → update warna default
    document.getElementById("ef-tipe")?.addEventListener("change", e => updateExtraColor(e.target.value));

    // Enter submit form MK
    document.getElementById("course-form")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName !== "SELECT") { e.preventDefault(); saveCourse(); }
    });
  }

  // ── Autocomplete ─────────────────────────────────────────
  function handleAutocomplete(query) {
    const dd = document.getElementById("autocomplete-dropdown");
    if (!dd) return;
    if (!query) { dd.classList.add("hidden"); return; }
    const res = dataset.filter(d =>
      d.Nama?.toLowerCase().includes(query.toLowerCase()) ||
      d.Kode?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 7);
    if (!res.length) { dd.classList.add("hidden"); return; }
    dd.innerHTML = res.map(d =>
      `<div class="autocomplete-item px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer text-sm flex items-center gap-2"
        data-kode="${d.Kode}" data-nama="${d.Nama}" data-sks="${d.SKS}">
        <span class="font-mono text-indigo-500 text-xs w-16 flex-shrink-0">${d.Kode}</span>
        <span class="text-slate-700 dark:text-slate-200 flex-1 truncate">${d.Nama}</span>
        <span class="text-slate-400 text-xs">${d.SKS} SKS</span>
      </div>`
    ).join("");
    dd.classList.remove("hidden");
    dd.querySelectorAll(".autocomplete-item").forEach(item =>
      item.addEventListener("click", () => {
        document.getElementById("f-kode").value = item.dataset.kode;
        document.getElementById("f-nama").value = item.dataset.nama;
        document.getElementById("f-sks").value  = item.dataset.sks;
        dd.classList.add("hidden");
        if (Number(item.dataset.sks) >= 4) showJadwal2(true);
      })
    );
    document.addEventListener("click", e => {
      if (!dd.contains(e.target) && e.target.id !== "f-nama") dd.classList.add("hidden");
    }, { once: true });
  }

  // ── Theme ─────────────────────────────────────────────────
  function applyTheme() {
    const s = Storage.loadSettings();
    document.documentElement.classList.toggle("dark", !!s.darkMode);
  }

  function toggleTheme() {
    const s = Storage.loadSettings(); s.darkMode = !s.darkMode;
    Storage.saveSettings(s); applyTheme(); Charts.renderAll(courses);
  }

  return { init, syncData, updateCourse, updateExtraEvent };
})();

document.addEventListener("DOMContentLoaded", App.init);
