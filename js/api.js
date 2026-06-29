// ============================================================
// api.js - Komunikasi dengan Google Apps Script
// ============================================================
//
// FIX: sanitizeTime() membersihkan nilai waktu yang mungkin
// datang sebagai ISO string "1899-12-30T05:52:48.000Z" atau
// angka desimal dari Google Sheets, memastikan selalu "HH:MM".
// ============================================================

const API_URL ="https://script.google.com/macros/s/AKfycbwuEd9oxpsAwWi189PNqlCpScMm_8Q0RdJmX7febnxZIpjwmUaNZpxIb_vcu_o42gnY/exec"; // ← Ganti dengan URL Anda

// ── Kolom waktu yang perlu disanitasi ─────────────────────
const MK_TIME_FIELDS    = ["Mulai","Selesai","Mulai2","Selesai2"];
const EXTRA_TIME_FIELDS = ["Mulai","Selesai"];

// ============================================================
// SANITASI WAKTU (frontend safety net)
// Handles semua format aneh yang mungkin lolos dari GAS:
//   "1899-12-30T05:52:48.000Z"  → "05:52"
//   "0.291666..."               → "07:00"
//   "07:00"                     → "07:00"  (tidak berubah)
//   ""  / null / undefined      → ""
// ============================================================
function sanitizeTime(val) {
  if (!val && val !== 0) return "";

  // Angka desimal (Sheets time serial: 0..1)
  if (typeof val === "number") {
    if (val > 1) {
      // Epoch ms
      const d = new Date(val);
      return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
    }
    const totalMin = Math.round(val * 24 * 60);
    return pad2(Math.floor(totalMin / 60)) + ":" + pad2(totalMin % 60);
  }

  const s = String(val).trim();
  if (!s) return "";

  // ISO / Date string  "1899-12-30T05:52:48.000Z"
  if (s.includes("T") || (s.includes("-") && s.length > 8)) {
    const d = new Date(s);
    if (!isNaN(d)) return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }

  // "H:MM" atau "HH:MM" — hanya pastikan padding
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return pad2(h) + ":" + pad2(m);
  }

  return s;
}

function pad2(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

// Terapkan sanitasi ke array objek untuk field tertentu
function sanitizeTimeFields(items, fields) {
  if (!Array.isArray(items)) return items;
  return items.map(item => {
    const cleaned = { ...item };
    fields.forEach(f => { if (f in cleaned) cleaned[f] = sanitizeTime(cleaned[f]); });
    return cleaned;
  });
}

// ============================================================
// HTTP HELPER
// ============================================================
const Api = (() => {
  const TIMEOUT_MS = 15000;

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ── Mata Kuliah ───────────────────────────────────────────
  async function getCourses() {
    const res = await request(`${API_URL}?action=getCourses`);
    if (res.success && res.data) {
      res.data = sanitizeTimeFields(res.data, MK_TIME_FIELDS);
    }
    return res;
  }

  async function addCourse(data) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "addCourse", data }),
    });
  }

  async function updateCourse(id, data) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "updateCourse", id, data }),
    });
  }

  async function deleteCourse(id) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "deleteCourse", id }),
    });
  }

  // ── Dataset ───────────────────────────────────────────────
  async function getDataset() {
    return request(`${API_URL}?action=getDataset`);
  }

  // ── Jadwal Extra ──────────────────────────────────────────
  async function getExtraEvents() {
    const res = await request(`${API_URL}?action=getExtraEvents`);
    if (res.success && res.data) {
      res.data = sanitizeTimeFields(res.data, EXTRA_TIME_FIELDS);
    }
    return res;
  }

  async function addExtraEvent(data) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "addExtraEvent", data }),
    });
  }

  async function updateExtraEvent(id, data) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "updateExtraEvent", id, data }),
    });
  }

  async function deleteExtraEvent(id) {
    return request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "deleteExtraEvent", id }),
    });
  }

  return {
    getCourses, addCourse, updateCourse, deleteCourse,
    getDataset,
    getExtraEvents, addExtraEvent, updateExtraEvent, deleteExtraEvent,
  };
})();
