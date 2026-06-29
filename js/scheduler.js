// ============================================================
// scheduler.js - Grid jadwal mingguan
//   • Mata kuliah: hingga 2 slot jadwal (Jadwal 1 & 2)
//   • JadwalExtra: Praktikum / Tutorial / Kelas Tambahan
//   • Deteksi bentrok antar SEMUA blok
//   • Drag & drop untuk Jadwal 1 MK (slot utama)
// ============================================================

const Scheduler = (() => {
  const DAYS            = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const START_HOUR      = 7;
  const END_HOUR        = 21;
  const SLOT_HEIGHT     = 48;   // px per 30 menit
  const MINUTES_PER_SLOT = 30;

  // Konversi "HH:MM" → menit
  function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + (m || 0);
  }

  // Menit → "HH:MM"
  function minutesToTime(m) {
    return `${Math.floor(m/60).toString().padStart(2,"0")}:${(m%60).toString().padStart(2,"0")}`;
  }

  // Cek overlap dua rentang waktu
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  // Kumpulkan semua slot (hari+waktu) dari satu item (MK atau Extra)
  function getSlots(item, isExtra = false) {
    const slots = [];
    if (isExtra) {
      if (item.Hari) slots.push({
        hari: item.Hari, mulai: item.Mulai, selesai: item.Selesai,
        id: item.ID, slot: 1, isExtra: true
      });
    } else {
      if (item.Hari)  slots.push({ hari: item.Hari,  mulai: item.Mulai,  selesai: item.Selesai,  id: item.ID, slot: 1, isExtra: false });
      if (item.Hari2) slots.push({ hari: item.Hari2, mulai: item.Mulai2, selesai: item.Selesai2, id: item.ID, slot: 2, isExtra: false });
    }
    return slots;
  }

  // Cari semua bentrok dari courses + extraEvents gabungan
  function findConflicts(courses, extraEvents = []) {
    // Kumpulkan semua slot dengan referensi ke item aslinya
    const allSlots = [];
    courses.forEach(c => {
      getSlots(c, false).forEach(s => allSlots.push({ ...s, item: c }));
    });
    extraEvents.forEach(ev => {
      getSlots(ev, true).forEach(s => allSlots.push({ ...s, item: ev }));
    });

    const conflictIds = new Set();   // Set of "ID:slot" string
    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const a = allSlots[i], b = allSlots[j];
        if (a.id === b.id) continue;  // sama persis
        if (a.hari !== b.hari || !a.hari) continue;
        if (overlaps(
          timeToMinutes(a.mulai), timeToMinutes(a.selesai),
          timeToMinutes(b.mulai), timeToMinutes(b.selesai)
        )) {
          conflictIds.add(`${a.id}:${a.slot}`);
          conflictIds.add(`${b.id}:${b.slot}`);
        }
      }
    }
    return conflictIds;  // Set<"ID:slotNumber">
  }

  // ── RENDER UTAMA ──────────────────────────────────────────

  function renderGrid(containerId, courses, extraEvents, callbacks) {
    const { onEditCourse, onDeleteCourse, onEditExtra, onDeleteExtra } = callbacks;
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const totalHeight  = (totalMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT;

    const conflictIds = findConflicts(courses, extraEvents);

    // ── Time labels
    let timeLabels = "";
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const top = ((h - START_HOUR) * 60 / MINUTES_PER_SLOT) * SLOT_HEIGHT;
      timeLabels += `<div class="schedule-time-label" style="top:${top}px">${String(h).padStart(2,"0")}:00</div>`;
    }

    // ── Day columns
    let dayColumns = "";
    DAYS.forEach(day => {
      let blocks = "";

      // ── Blok Mata Kuliah (slot 1 dan slot 2)
      courses.forEach(course => {
        // Slot 1
        if (course.Hari === day && course.Mulai) {
          blocks += buildCourseBlock(course, 1, conflictIds);
        }
        // Slot 2
        if (course.Hari2 === day && course.Mulai2) {
          blocks += buildCourseBlock(course, 2, conflictIds);
        }
      });

      // ── Blok JadwalExtra
      extraEvents.forEach(ev => {
        if (ev.Hari === day && ev.Mulai) {
          blocks += buildExtraBlock(ev, conflictIds);
        }
      });

      dayColumns += `
        <div class="schedule-day-col" data-day="${day}">
          <div class="schedule-day-header">${day}</div>
          <div class="schedule-day-body" style="height:${totalHeight}px;position:relative;">
            ${generateGridLines(START_HOUR, END_HOUR)}
            ${blocks}
          </div>
        </div>`;
    });

    container.innerHTML = `
      <div class="schedule-wrapper">
        <div class="schedule-time-col" style="height:${totalHeight + 40}px;">
          <div style="height:40px"></div>
          <div style="position:relative;height:${totalHeight}px">${timeLabels}</div>
        </div>
        <div class="schedule-grid">${dayColumns}</div>
      </div>`;

    // ── Event listeners
    container.querySelectorAll(".btn-edit-block[data-type='mk']").forEach(btn =>
      btn.addEventListener("click", e => { e.stopPropagation(); onEditCourse(btn.dataset.id); })
    );
    container.querySelectorAll(".btn-del-block[data-type='mk']").forEach(btn =>
      btn.addEventListener("click", e => { e.stopPropagation(); onDeleteCourse(btn.dataset.id); })
    );
    container.querySelectorAll(".btn-edit-block[data-type='extra']").forEach(btn =>
      btn.addEventListener("click", e => { e.stopPropagation(); onEditExtra(btn.dataset.id); })
    );
    container.querySelectorAll(".btn-del-block[data-type='extra']").forEach(btn =>
      btn.addEventListener("click", e => { e.stopPropagation(); onDeleteExtra(btn.dataset.id); })
    );

    setupDragDrop(container, courses, extraEvents);
  }

  // ── Builder: blok MK ─────────────────────────────────────

  function buildCourseBlock(course, slot, conflictIds) {
    const hari    = slot === 1 ? course.Hari    : course.Hari2;
    const mulai   = slot === 1 ? course.Mulai   : course.Mulai2;
    const selesai = slot === 1 ? course.Selesai : course.Selesai2;
    const ruang   = slot === 1 ? course.Ruang   : course.Ruang2;

    if (!mulai || !selesai) return "";

    const startMin = timeToMinutes(mulai)   - START_HOUR * 60;
    const endMin   = timeToMinutes(selesai) - START_HOUR * 60;
    const top      = (startMin / MINUTES_PER_SLOT) * SLOT_HEIGHT;
    const height   = Math.max(((endMin - startMin) / MINUTES_PER_SLOT) * SLOT_HEIGHT, SLOT_HEIGHT);

    const isConflict = conflictIds.has(`${course.ID}:${slot}`);
    const color      = course.Warna || "#6366f1";
    // Slot 2 → warna sedikit lebih terang (opacity stripe)
    const bgStyle = slot === 2
      ? `background:${color};opacity:0.85;`
      : `background:${color};`;

    const slotBadge = slot === 2
      ? `<span class="block-slot-badge">Jadwal 2</span>`
      : "";

    return `
      <div class="schedule-block ${isConflict ? "conflict" : ""}"
        style="top:${top}px;height:${height}px;${bgStyle}left:4px;right:4px;"
        data-id="${course.ID}" data-slot="${slot}" data-type="mk"
        draggable="${slot === 1 ? "true" : "false"}">
        <div class="schedule-block-inner">
          <div class="block-nama">${course.Nama || course.Kode}${slotBadge}</div>
          <div class="block-info">${mulai}–${selesai}</div>
          <div class="block-info">${ruang || ""}</div>
        </div>
        <div class="block-actions">
          <button class="btn-edit-block" data-id="${course.ID}" data-type="mk" title="Edit">✏️</button>
          <button class="btn-del-block"  data-id="${course.ID}" data-type="mk" title="Hapus">🗑️</button>
        </div>
        ${isConflict ? '<div class="conflict-badge">⚠️</div>' : ""}
      </div>`;
  }

  // ── Builder: blok Extra ───────────────────────────────────

  function buildExtraBlock(ev, conflictIds) {
    const startMin = timeToMinutes(ev.Mulai)   - START_HOUR * 60;
    const endMin   = timeToMinutes(ev.Selesai) - START_HOUR * 60;
    const top      = (startMin / MINUTES_PER_SLOT) * SLOT_HEIGHT;
    const height   = Math.max(((endMin - startMin) / MINUTES_PER_SLOT) * SLOT_HEIGHT, SLOT_HEIGHT);

    const isConflict = conflictIds.has(`${ev.ID}:1`);
    const color      = ev.Warna || "#10b981";

    // Label tipe: ikon + nama tipe
    const tipeIcon = { Praktikum:"🔬", Tutorial:"📖", "Kelas Tambahan":"➕" };
    const icon = tipeIcon[ev.Tipe] || "📌";

    return `
      <div class="schedule-block extra-block ${isConflict ? "conflict" : ""}"
        style="top:${top}px;height:${height}px;background:${color};left:4px;right:4px;"
        data-id="${ev.ID}" data-type="extra"
        draggable="true">
        <div class="schedule-block-inner">
          <div class="block-tipe-badge">${icon} ${ev.Tipe}</div>
          <div class="block-nama">${ev.Label || ev.Nama}</div>
          <div class="block-info">${ev.Mulai}–${ev.Selesai}</div>
          <div class="block-info">${ev.Ruang || ""}</div>
        </div>
        <div class="block-actions">
          <button class="btn-edit-block" data-id="${ev.ID}" data-type="extra" title="Edit">✏️</button>
          <button class="btn-del-block"  data-id="${ev.ID}" data-type="extra" title="Hapus">🗑️</button>
        </div>
        ${isConflict ? '<div class="conflict-badge">⚠️</div>' : ""}
      </div>`;
  }

  // ── Grid lines ────────────────────────────────────────────

  function generateGridLines(start, end) {
    let lines = "";
    for (let h = start; h <= end; h++) {
      const top = ((h - start) * 60 / MINUTES_PER_SLOT) * SLOT_HEIGHT;
      lines += `<div class="grid-line hour-line" style="top:${top}px"></div>`;
      if (h < end) lines += `<div class="grid-line half-line" style="top:${top + SLOT_HEIGHT}px"></div>`;
    }
    return lines;
  }

  // ── Drag & Drop ───────────────────────────────────────────

  function setupDragDrop(container, courses, extraEvents) {
    let dragging = null;

    // Hanya blok dengan draggable="true" yang bisa di-drag
    container.querySelectorAll(".schedule-block[draggable='true']").forEach(block => {
      block.addEventListener("dragstart", e => {
        dragging = block;
        block.style.opacity = "0.5";
        e.dataTransfer.setData("text/plain", JSON.stringify({
          id:   block.dataset.id,
          type: block.dataset.type,
          slot: block.dataset.slot || "1",
        }));
      });
      block.addEventListener("dragend", () => {
        block.style.opacity = "1";
        dragging = null;
      });
    });

    container.querySelectorAll(".schedule-day-body").forEach(body => {
      body.addEventListener("dragover",  e => { e.preventDefault(); body.classList.add("drag-over"); });
      body.addEventListener("dragleave", () => body.classList.remove("drag-over"));
      body.addEventListener("drop", async e => {
        e.preventDefault();
        body.classList.remove("drag-over");
        if (!dragging) return;

        let payload;
        try { payload = JSON.parse(e.dataTransfer.getData("text/plain")); }
        catch { return; }

        const newDay  = body.closest(".schedule-day-col").dataset.day;
        const rect    = body.getBoundingClientRect();
        const relY    = e.clientY - rect.top;
        const slotIdx = Math.round(relY / SLOT_HEIGHT);
        const newStartMin = START_HOUR * 60 + slotIdx * MINUTES_PER_SLOT;

        if (payload.type === "mk") {
          const course = courses.find(c => c.ID?.toString() === payload.id);
          if (!course) return;
          const duration = timeToMinutes(course.Selesai) - timeToMinutes(course.Mulai);
          const updated  = {
            ...course,
            Hari:    newDay,
            Mulai:   minutesToTime(newStartMin),
            Selesai: minutesToTime(newStartMin + (duration || 100)),
          };
          await App.updateCourse(payload.id, updated);

        } else if (payload.type === "extra") {
          const ev = extraEvents.find(x => x.ID?.toString() === payload.id);
          if (!ev) return;
          const duration = timeToMinutes(ev.Selesai) - timeToMinutes(ev.Mulai);
          const updated  = {
            ...ev,
            Hari:    newDay,
            Mulai:   minutesToTime(newStartMin),
            Selesai: minutesToTime(newStartMin + (duration || 100)),
          };
          await App.updateExtraEvent(payload.id, updated);
        }
      });
    });
  }

  return { DAYS, findConflicts, renderGrid, timeToMinutes, minutesToTime };
})();
