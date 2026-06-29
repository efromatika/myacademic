// ============================================================
// ui.js - Komponen UI: Toast, Modal, Loading, dll.
// ============================================================

const UI = (() => {
  // ---- Toast Notification ----
  let toastTimeout;
  function toast(message, type = "success", duration = 3000) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed top-4 right-4 z-50 flex flex-col gap-2";
      document.body.appendChild(container);
    }
    const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
    const colors = {
      success: "bg-green-600", error: "bg-red-600",
      warning: "bg-yellow-600", info: "bg-blue-600"
    };
    const toast = document.createElement("div");
    toast.className = `toast-item flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${colors[type]} min-w-[220px] max-w-xs`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  // ---- Loading Overlay ----
  function showLoading(text = "Memuat data...") {
    let el = document.getElementById("loading-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "loading-overlay";
      el.className = "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center";
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="glass-card rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">${text}</p>
      </div>`;
    el.style.display = "flex";
  }

  function hideLoading() {
    const el = document.getElementById("loading-overlay");
    if (el) el.style.display = "none";
  }

  // ---- Modal ----
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.body.style.overflow = "";
    }
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach(m => {
      m.classList.add("hidden");
      m.classList.remove("flex");
    });
    document.body.style.overflow = "";
  }

  // ---- Confirm Dialog ----
  function confirm(message, title = "Konfirmasi") {
    return new Promise(resolve => {
      let modal = document.getElementById("confirm-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "confirm-modal";
        modal.className = "modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 items-center justify-center";
        modal.innerHTML = `
          <div class="glass-card rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 id="confirm-title" class="text-lg font-bold text-slate-800 dark:text-white mb-2"></h3>
            <p id="confirm-message" class="text-slate-600 dark:text-slate-300 text-sm mb-5"></p>
            <div class="flex gap-3 justify-end">
              <button id="confirm-cancel" class="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Batal</button>
              <button id="confirm-ok" class="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">Hapus</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
      }
      document.getElementById("confirm-title").textContent = title;
      document.getElementById("confirm-message").textContent = message;
      modal.classList.remove("hidden");
      modal.classList.add("flex");

      const cleanup = (result) => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        resolve(result);
      };
      document.getElementById("confirm-ok").onclick = () => cleanup(true);
      document.getElementById("confirm-cancel").onclick = () => cleanup(false);
    });
  }

  // ---- Offline Indicator ----
  function updateOnlineStatus() {
    const indicator = document.getElementById("offline-indicator");
    if (!indicator) return;
    if (navigator.onLine) {
      indicator.classList.add("hidden");
    } else {
      indicator.classList.remove("hidden");
    }
  }

  // ---- Active Nav ----
  function setActiveNav(page) {
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.remove("active");
      if (el.dataset.page === page) el.classList.add("active");
    });
    document.querySelectorAll(".bottom-nav-item").forEach(el => {
      el.classList.remove("active");
      if (el.dataset.page === page) el.classList.add("active");
    });
  }

  // ---- Page Switch ----
  function showPage(pageId) {
    document.querySelectorAll(".page-content").forEach(p => p.classList.add("hidden"));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove("hidden");
  }

  // ---- Render summary stat cards ----
  function updateStats(stats) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("stat-total-mk", stats.totalMK);
    set("stat-total-sks", stats.totalSKS);
    set("stat-ips", stats.ips.toFixed(2));
    set("stat-ipk", stats.ipk.toFixed(2));
    set("stat-bentrok", stats.bentrok);
  }

  return {
    toast, showLoading, hideLoading,
    openModal, closeModal, closeAllModals,
    confirm, updateOnlineStatus, setActiveNav, showPage, updateStats
  };
})();
