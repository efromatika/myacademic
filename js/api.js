// ============================================================
// api.js - Modul komunikasi dengan Google Apps Script
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbxINj6tkEOzKSKTcCG7HdBUWB9w-Cnp4aSau4yyyH5HFMsxExgetT84LghAXi8lrDJ9/exec"; // ← Ganti dengan URL Anda

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
    return request(`${API_URL}?action=getCourses`);
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
    return request(`${API_URL}?action=getExtraEvents`);
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
