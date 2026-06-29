// ============================================================
// storage.js - Cache LocalStorage (hanya cache offline)
// ============================================================

const Storage = (() => {
  const KEYS = {
    COURSES:      "ap_courses_cache",
    EXTRA_EVENTS: "ap_extra_events_cache",
    DATASET:      "ap_dataset_cache",
    LAST_SYNC:    "ap_last_sync",
    SETTINGS:     "ap_settings",
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

  // Courses
  const saveCourses    = c  => save(KEYS.COURSES, c);
  const loadCourses    = () => load(KEYS.COURSES) || [];

  // Extra Events
  const saveExtraEvents = ev => save(KEYS.EXTRA_EVENTS, ev);
  const loadExtraEvents = () => load(KEYS.EXTRA_EVENTS) || [];

  // Dataset
  const saveDataset    = d  => save(KEYS.DATASET, d);
  const loadDataset    = () => load(KEYS.DATASET) || [];

  // Sync timestamp
  const saveLastSync   = () => save(KEYS.LAST_SYNC, Date.now());
  const loadLastSync   = () => load(KEYS.LAST_SYNC);

  // Settings
  const saveSettings   = s  => save(KEYS.SETTINGS, s);
  const loadSettings   = () => load(KEYS.SETTINGS) || { darkMode: false, activeSemester: "1" };

  function clearCache() {
    [KEYS.COURSES, KEYS.EXTRA_EVENTS, KEYS.DATASET, KEYS.LAST_SYNC].forEach(remove);
  }

  return {
    saveCourses, loadCourses,
    saveExtraEvents, loadExtraEvents,
    saveDataset, loadDataset,
    saveLastSync, loadLastSync,
    saveSettings, loadSettings,
    clearCache,
  };
})();
