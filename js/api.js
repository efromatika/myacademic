// ============================================================
// api.js - Modul komunikasi dengan Google Apps Script
// ============================================================

const API_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL"; // Ganti dengan URL Apps Script Anda

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

  async function getCourses() {
    return request(`${API_URL}?action=getCourses`);
  }

  async function getDataset() {
    return request(`${API_URL}?action=getDataset`);
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

  return { getCourses, getDataset, addCourse, updateCourse, deleteCourse };
})();
