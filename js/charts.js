// ============================================================
// charts.js - Grafik statistik menggunakan Chart.js
// ============================================================

const Charts = (() => {
  const chartInstances = {};

  const GRADE_WEIGHTS = { A: 4.0, AB: 3.5, B: 3.0, BC: 2.5, C: 2.0, D: 1.0, E: 0.0 };
  const GRADE_COLORS = {
    A: "#22c55e", AB: "#84cc16", B: "#3b82f6",
    BC: "#a855f7", C: "#f59e0b", D: "#f97316", E: "#ef4444"
  };

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  // IPS per semester
  function renderIPSChart(courses) {
    destroyChart("ipsChart");
    const ctx = document.getElementById("ipsChart");
    if (!ctx) return;

    const semesterData = groupBySemester(courses);
    const labels = Object.keys(semesterData).sort((a, b) => Number(a) - Number(b));
    const ipsData = labels.map(sem => calcIPS(semesterData[sem]));

    chartInstances["ipsChart"] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map(l => `Semester ${l}`),
        datasets: [{
          label: "IPS",
          data: ipsData,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.15)",
          borderWidth: 2.5,
          pointBackgroundColor: "#6366f1",
          pointRadius: 5,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: getTextColor() } },
          tooltip: { callbacks: { label: ctx => `IPS: ${ctx.parsed.y.toFixed(2)}` } }
        },
        scales: {
          x: { ticks: { color: getTextColor() }, grid: { color: getGridColor() } },
          y: { min: 0, max: 4, ticks: { color: getTextColor() }, grid: { color: getGridColor() } }
        }
      }
    });
  }

  // Distribusi nilai
  function renderGradeChart(courses) {
    destroyChart("gradeChart");
    const ctx = document.getElementById("gradeChart");
    if (!ctx) return;

    const gradeCounts = {};
    Object.keys(GRADE_WEIGHTS).forEach(g => gradeCounts[g] = 0);
    courses.forEach(c => { if (c.Nilai && gradeCounts[c.Nilai] !== undefined) gradeCounts[c.Nilai]++; });

    const labels = Object.keys(gradeCounts).filter(g => gradeCounts[g] > 0);
    const data = labels.map(g => gradeCounts[g]);
    const colors = labels.map(g => GRADE_COLORS[g] || "#6366f1");

    chartInstances["gradeChart"] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: "transparent" }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: getTextColor(), padding: 12, boxWidth: 12 } }
        }
      }
    });
  }

  // SKS per semester
  function renderSKSChart(courses) {
    destroyChart("sksChart");
    const ctx = document.getElementById("sksChart");
    if (!ctx) return;

    const semesterData = groupBySemester(courses);
    const labels = Object.keys(semesterData).sort((a, b) => Number(a) - Number(b));
    const sksData = labels.map(sem => semesterData[sem].reduce((s, c) => s + Number(c.SKS || 0), 0));

    chartInstances["sksChart"] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels.map(l => `Sem ${l}`),
        datasets: [{
          label: "SKS",
          data: sksData,
          backgroundColor: "rgba(99,102,241,0.7)",
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: getTextColor() } } },
        scales: {
          x: { ticks: { color: getTextColor() }, grid: { color: getGridColor() } },
          y: { ticks: { color: getTextColor() }, grid: { color: getGridColor() } }
        }
      }
    });
  }

  function renderAll(courses) {
    renderIPSChart(courses);
    renderGradeChart(courses);
    renderSKSChart(courses);
  }

  function groupBySemester(courses) {
    const result = {};
    courses.forEach(c => {
      const sem = c.Semester || "?";
      if (!result[sem]) result[sem] = [];
      result[sem].push(c);
    });
    return result;
  }

  function calcIPS(semCourses) {
    let totalMutu = 0, totalSKS = 0;
    semCourses.forEach(c => {
      const w = GRADE_WEIGHTS[c.Nilai];
      if (w !== undefined) {
        totalMutu += w * Number(c.SKS || 0);
        totalSKS += Number(c.SKS || 0);
      }
    });
    return totalSKS > 0 ? totalMutu / totalSKS : 0;
  }

  function getTextColor() {
    return document.documentElement.classList.contains("dark") ? "#e2e8f0" : "#374151";
  }

  function getGridColor() {
    return document.documentElement.classList.contains("dark") ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  }

  return { renderAll, renderIPSChart, renderGradeChart, renderSKSChart };
})();
