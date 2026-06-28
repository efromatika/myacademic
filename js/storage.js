// ============================================================
// storage.js - Cache LocalStorage (hanya cache offline)
// ============================================================

const Storage = (() => {
  const KEYS = {
    COURSES: "ap_courses_cache",
    DATASET: "ap_dataset_cache",
    LAST_SYNC: "ap_last_sync",
    SETTINGS: "ap_settings",
  };

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  // Courses cache
  function saveCourses(courses) { save(KEYS.COURSES, courses); }
  function loadCourses() { return load(KEYS.COURSES) || []; }

  // Dataset cache
  function saveDataset(dataset) { save(KEYS.DATASET, dataset); }
  function loadDataset() { return load(KEYS.DATASET) || []; }

  // Sync timestamp
  function saveLastSync() { save(KEYS.LAST_SYNC, Date.now()); }
  function loadLastSync() { return load(KEYS.LAST_SYNC); }

  // Settings
  function saveSettings(s) { save(KEYS.SETTINGS, s); }
  function loadSettings() {
    return load(KEYS.SETTINGS) || { darkMode: false, activeSemester: "1" };
  }

  function clearCache() {
    remove(KEYS.COURSES);
    remove(KEYS.DATASET);
    remove(KEYS.LAST_SYNC);
  }

  return {
    saveCourses, loadCourses,
    saveDataset, loadDataset,
    saveLastSync, loadLastSync,
    saveSettings, loadSettings,
    clearCache,
  };
})();
