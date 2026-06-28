// ============================================================
// scheduler.js - Logika jadwal, deteksi bentrok, drag & drop
// ============================================================

const Scheduler = (() => {
  const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const START_HOUR = 7;
  const END_HOUR = 21;
  const SLOT_HEIGHT = 48; // px per 30 menit
  const MINUTES_PER_SLOT = 30;

  // Konversi "HH:MM" → menit dari tengah malam
  function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  }

  // Menit → "HH:MM"
  function minutesToTime(m) {
    const h = Math.floor(m / 60).toString().padStart(2, "0");
    const min = (m % 60).toString().padStart(2, "0");
    return `${h}:${min}`;
  }

  // Deteksi bentrok antara dua mata kuliah
  function hasConflict(a, b) {
    if (a.ID === b.ID) return false;
    if (a.Hari !== b.Hari || !a.Hari) return false;
    const aStart = timeToMinutes(a.Mulai);
    const aEnd = timeToMinutes(a.Selesai);
    const bStart = timeToMinutes(b.Mulai);
    const bEnd = timeToMinutes(b.Selesai);
    return aStart < bEnd && bStart < aEnd;
  }

  // Cari semua bentrok dari array courses
  function findConflicts(courses) {
    const conflicts = [];
    for (let i = 0; i < courses.length; i++) {
      for (let j = i + 1; j < courses.length; j++) {
        if (hasConflict(courses[i], courses[j])) {
          conflicts.push([courses[i], courses[j]]);
        }
      }
    }
    return conflicts;
  }

  // Hitung posisi & tinggi blok jadwal (dalam px)
  function getBlockStyle(course) {
    const startMin = timeToMinutes(course.Mulai) - START_HOUR * 60;
    const endMin = timeToMinutes(course.Selesai) - START_HOUR * 60;
    const top = (startMin / MINUTES_PER_SLOT) * SLOT_HEIGHT;
    const height = Math.max(((endMin - startMin) / MINUTES_PER_SLOT) * SLOT_HEIGHT, SLOT_HEIGHT);
    return { top, height };
  }

  // Render HTML
  function renderBlock(course, slot, top, height) {
    const hari    = slot === 1 ? course.Hari    : course.Hari2;
    const mulai   = slot === 1 ? course.Mulai   : course.Mulai2;
    const selesai = slot === 1 ? course.Selesai : course.Selesai2;
    const ruang   = slot === 1 ? course.Ruang   : course.Ruang2;
    return `
          <div class="schedule-block"
            style="top:${top}px;height:${height}px;background:${course.Warna || '#6366f1'};left:4px;right:4px;"
            data-id="${course.ID}"
            draggable="true">
            <div class="schedule-block-inner">
              <div class="block-nama">${course.Nama || course.Kode}</div>
              <div class="block-info">${mulai}–${selesai}</div>
              <div class="block-info">${ruang || ''}</div>
            </div>
            <div class="block-actions">
              <button class="btn-edit-block" data-id="${course.ID}" title="Edit">✏️</button>
              <button class="btn-del-block" data-id="${course.ID}" title="Hapus">🗑️</button>
            </div>
          </div>`;
  }

  // Render grid jadwal ke dalam container
  function renderGrid(containerId, courses, onEdit, onDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const totalHeight = (totalMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT;

    // Time labels
    let timeLabels = "";
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const top = ((h - START_HOUR) * 60 / MINUTES_PER_SLOT) * SLOT_HEIGHT;
      timeLabels += `<div class="schedule-time-label" style="top:${top}px">${h.toString().padStart(2,'0')}:00</div>`;
    }

    // Day columns
    let dayColumns = "";
    DAYS.forEach(day => {
      const dayCourses = courses.filter(c => c.Hari === day);
      const conflicts = findConflicts(courses);
      const conflictIds = new Set(conflicts.flat().map(c => c.ID));

      let blocks = "";
      dayCourses.forEach(course => {
        const { top, height } = getBlockStyle(course);
        const isConflict = conflictIds.has(course.ID);
        if (course.Hari) blocks += renderBlock(course, 1, top, height);
        if (course.Hari2) blocks += renderBlock(course, 2, top, height);
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

    // Event listeners
    container.querySelectorAll(".btn-edit-block").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); onEdit(btn.dataset.id); });
    });
    container.querySelectorAll(".btn-del-block").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); onDelete(btn.dataset.id); });
    });

    // Drag & drop
    setupDragDrop(container, courses, onEdit);
  }

  function generateGridLines(start, end) {
    let lines = "";
    for (let h = start; h <= end; h++) {
      const top = ((h - start) * 60 / MINUTES_PER_SLOT) * SLOT_HEIGHT;
      lines += `<div class="grid-line hour-line" style="top:${top}px"></div>`;
      const topHalf = top + SLOT_HEIGHT;
      if (h < end) {
        lines += `<div class="grid-line half-line" style="top:${topHalf}px"></div>`;
      }
    }
    return lines;
  }

  function setupDragDrop(container, courses, onEdit) {
    let dragging = null;

    container.querySelectorAll(".schedule-block").forEach(block => {
      block.addEventListener("dragstart", e => {
        dragging = block;
        block.style.opacity = "0.5";
        e.dataTransfer.setData("text/plain", block.dataset.id);
      });
      block.addEventListener("dragend", () => {
        block.style.opacity = "1";
        dragging = null;
      });
    });

    container.querySelectorAll(".schedule-day-body").forEach(body => {
      body.addEventListener("dragover", e => { e.preventDefault(); body.classList.add("drag-over"); });
      body.addEventListener("dragleave", () => { body.classList.remove("drag-over"); });
      body.addEventListener("drop", async e => {
        e.preventDefault();
        body.classList.remove("drag-over");
        if (!dragging) return;
        const id = e.dataTransfer.getData("text/plain");
        const course = courses.find(c => c.ID?.toString() === id);
        if (!course) return;
        const newDay = body.closest(".schedule-day-col").dataset.day;
        const rect = body.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const slotIndex = Math.round(relY / SLOT_HEIGHT);
        const newStartMin = START_HOUR * 60 + slotIndex * MINUTES_PER_SLOT;
        const duration = timeToMinutes(course.Selesai) - timeToMinutes(course.Mulai);
        const newEndMin = newStartMin + (duration || 90);
        const updatedCourse = {
          ...course,
          Hari: newDay,
          Mulai: minutesToTime(newStartMin),
          Selesai: minutesToTime(newEndMin),
        };
        await App.updateCourse(id, updatedCourse);
      });
    });
  }

  return { DAYS, findConflicts, renderGrid, timeToMinutes, hasConflict };
})();
