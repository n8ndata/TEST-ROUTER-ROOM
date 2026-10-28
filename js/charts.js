/**
 * =========================================================================
 * ROUTER Department - Responsive Chart.js Analytics
 * รองรับการปรับขนาดอัตโนมัติตามหน้าจอ / แนวนอน-แนวตั้ง และปรับธีม Dark/Light
 * =========================================================================
 */

const ChartsModule = (() => {
  let chartSeverity = null;
  let chartCategories = null;
  let chartShifts = null;
  let chartTimeline = null;

  // อ่านสีข้อความและเส้นตามธีมปัจจุบัน
  const getThemeColors = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      textColor: isDark ? "#cbd5e1" : "#475569",
      gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      borderColor: isDark ? "#334155" : "#e2e8f0"
    };
  };

  /**
   * สร้างหรืออัพเดทชาร์ตทั้งหมด
   */
  const renderAllCharts = (incidents) => {
    renderSeverityChart(incidents);
    renderCategoriesChart(incidents);
    renderShiftsChart(incidents);
    renderTimelineChart(incidents);
  };

  /**
   * 1. ชาร์ตระดับความรุนแรง (Severity Donut Chart)
   */
  const renderSeverityChart = (incidents) => {
    const canvas = document.getElementById("chart-severity");
    if (!canvas) return;

    const theme = getThemeColors();
    const counts = { "เล็กน้อย": 0, "ปานกลาง": 0, "สูง": 0, "วิกฤต": 0 };

    incidents.forEach(item => {
      const sev = item.severity || "ปานกลาง";
      if (counts[sev] !== undefined) {
        counts[sev]++;
      } else {
        counts["ปานกลาง"]++;
      }
    });

    const data = {
      labels: ["เล็กน้อย", "ปานกลาง", "สูง", "วิกฤต"],
      datasets: [{
        data: [counts["เล็กน้อย"], counts["ปานกลาง"], counts["สูง"], counts["วิกฤต"]],
        backgroundColor: [
          "#10b981", // Emerald
          "#f59e0b", // Amber
          "#ea580c", // Orange
          "#ef4444"  // Red
        ],
        borderWidth: 2,
        borderColor: theme.borderColor,
        hoverOffset: 6
      }]
    };

    if (chartSeverity) {
      chartSeverity.data = data;
      chartSeverity.options.plugins.legend.labels.color = theme.textColor;
      chartSeverity.update();
    } else {
      chartSeverity = new Chart(canvas, {
        type: "doughnut",
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: theme.textColor,
                font: { family: "Prompt", size: 12, weight: "500" },
                padding: 14
              }
            },
            tooltip: {
              bodyFont: { family: "Prompt" }
            }
          },
          cutout: "65%"
        }
      });
    }
  };

  /**
   * 2. ชาร์ตประเภทความผิดพลาด (Defect Categories Bar Chart)
   */
  const renderCategoriesChart = (incidents) => {
    const canvas = document.getElementById("chart-categories");
    if (!canvas) return;

    const theme = getThemeColors();
    const catMap = {};

    incidents.forEach(item => {
      let cat = (item.category || "อื่นๆ").split("(")[0].trim();
      // เก็บชื่อเต็ม ไม่ตัด เพื่อให้แสดงบนกราฟได้สมบูรณ์
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    // เรียงลำดับจากมากไปน้อย เลือก Top 5
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(i => i[0]);
    const values = sorted.map(i => i[1]);

    const data = {
      labels: labels.length ? labels : ["ยังไม่มีข้อมูล"],
      datasets: [{
        label: "จำนวนครั้ง",
        data: values.length ? values : [0],
        backgroundColor: "rgba(37, 99, 235, 0.8)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#2563eb"
      }]
    };

    // Plugin วาด "ชื่อประเภทข้อผิดพลาด" ลงบนแท่งกราฟโดยตรง
    const barLabelsPlugin = {
      id: "barLabels",
      afterDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        const opts = (chart.options.plugins && chart.options.plugins.barLabel) || {};
        if (opts.enabled === false) return;

        const fontSize = opts.fontSize || 11;
        const themeColors = getThemeColors();

        // ตัดข้อความด้วย "…" ให้พอดีความกว้างที่กำหนด
        const fitText = (text, maxWidth) => {
          if (ctx.measureText(text).width <= maxWidth) return text;
          let t = text;
          while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
            t = t.slice(0, -1);
          }
          return t + "…";
        };

        ctx.save();
        ctx.font = "bold " + fontSize + "px Prompt, sans-serif";
        ctx.textBaseline = "middle";

        chart.data.datasets.forEach(function(dataset, datasetIndex) {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach(function(bar, index) {
            const label = chart.data.labels[index] || "";
            const innerWidth = (bar.x - bar.base) - 16; // พื้นที่วางข้อความในแท่ง

            if (innerWidth >= 40) {
              // แสดงชื่อ "บนแท่งกราฟ" (ชิดซ้ายในแท่ง) สีขาว
              ctx.fillStyle = "#ffffff";
              ctx.textAlign = "left";
              ctx.fillText(fitText(label, innerWidth), bar.base + 8, bar.y);
            } else {
              // แท่งสั้นเกินไป → วาดชื่อนอกแท่งด้านขวา ใช้สีตามธีม
              const room = Math.max(chart.chartArea.right - bar.x - 12, 60);
              ctx.fillStyle = themeColors.textColor;
              ctx.textAlign = "left";
              ctx.fillText(fitText(label, room), bar.x + 6, bar.y);
            }
          });
        });

        ctx.restore();
      }
    };

    if (chartCategories) {
      chartCategories.data = data;
      chartCategories.options.scales.x.ticks.color = theme.textColor;
      chartCategories.options.scales.x.grid.color = theme.gridColor;
      chartCategories.update();
    } else {
      chartCategories = new Chart(canvas, {
        type: "bar",
        data: data,
        plugins: [barLabelsPlugin], // inline plugin ทำให้ชื่อรายการแสดงบนแท่งกราฟ
        options: {
          indexAxis: "y", // แนวนอน เหมาะกับมือถือและหน้าจอแคบ
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { bodyFont: { family: "Prompt" } },
            barLabel: { enabled: true, fontSize: 11 }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0, color: theme.textColor, font: { family: "Prompt" } },
              grid: { color: theme.gridColor }
            },
            y: {
              // ซ่อนชื่อบนแกน Y เพราะย้ายไปแสดงบนแท่งกราฟแล้ว
              ticks: { display: false },
              grid: { display: false }
            }
          }
        }
      });
    }
  };

  /**
   * 3. ชาร์ตความผิดพลาดตามกะ (Shifts Distribution)
   */
  const renderShiftsChart = (incidents) => {
    const canvas = document.getElementById("chart-shifts");
    if (!canvas) return;

    const theme = getThemeColors();
    const shiftMap = { "กะเช้า": 0, "กะบ่าย": 0, "กะดึก": 0, "กะปกติ": 0 };

    incidents.forEach(item => {
      const sh = item.shift || "กะเช้า";
      if (shiftMap[sh] !== undefined) {
        shiftMap[sh]++;
      } else {
        shiftMap["กะปกติ"]++;
      }
    });

    const data = {
      labels: ["กะเช้า 🌅", "กะบ่าย 🌇", "กะดึก 🌙", "กะปกติ 🏢"],
      datasets: [{
        label: "ความผิดพลาด",
        data: [shiftMap["กะเช้า"], shiftMap["กะบ่าย"], shiftMap["กะดึก"], shiftMap["กะปกติ"]],
        backgroundColor: [
          "rgba(59, 130, 246, 0.75)",
          "rgba(249, 115, 22, 0.75)",
          "rgba(139, 92, 246, 0.75)",
          "rgba(16, 185, 129, 0.75)"
        ],
        borderRadius: 8
      }]
    };

    if (chartShifts) {
      chartShifts.data = data;
      chartShifts.options.scales.x.ticks.color = theme.textColor;
      chartShifts.options.scales.y.ticks.color = theme.textColor;
      chartShifts.options.scales.y.grid.color = theme.gridColor;
      chartShifts.update();
    } else {
      chartShifts = new Chart(canvas, {
        type: "bar",
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { bodyFont: { family: "Prompt" } }
          },
          scales: {
            x: {
              ticks: { color: theme.textColor, font: { family: "Prompt", size: 11 } },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { precision: 0, color: theme.textColor, font: { family: "Prompt" } },
              grid: { color: theme.gridColor }
            }
          }
        }
      });
    }
  };

  /**
   * 4. แนวโน้มรายวัน (Timeline Trend Line Chart)
   */
  const renderTimelineChart = (incidents) => {
    const canvas = document.getElementById("chart-timeline");
    if (!canvas) return;

    const theme = getThemeColors();
    // นับจำนวนตามวันที่เกิดเหตุ ย้อนหลัง 7 วัน
    const daysMap = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(5, 10); // MM-DD
      daysMap[key] = 0;
    }

    incidents.forEach(item => {
      const dateStr = item.incidentDate || item.timestamp || "";
      if (dateStr.length >= 10) {
        const key = dateStr.slice(5, 10);
        if (daysMap[key] !== undefined) {
          daysMap[key]++;
        }
      }
    });

    const labels = Object.keys(daysMap);
    const values = Object.values(daysMap);

    const data = {
      labels: labels,
      datasets: [{
        label: "เคสที่พบ (ครั้ง)",
        data: values,
        borderColor: "#0284c7",
        backgroundColor: "rgba(2, 132, 199, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#0284c7",
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };

    if (chartTimeline) {
      chartTimeline.data = data;
      chartTimeline.options.scales.x.ticks.color = theme.textColor;
      chartTimeline.options.scales.x.grid.color = theme.gridColor;
      chartTimeline.options.scales.y.ticks.color = theme.textColor;
      chartTimeline.options.scales.y.grid.color = theme.gridColor;
      chartTimeline.update();
    } else {
      chartTimeline = new Chart(canvas, {
        type: "line",
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { bodyFont: { family: "Prompt" } }
          },
          scales: {
            x: {
              ticks: { color: theme.textColor, font: { family: "Prompt", size: 11 } },
              grid: { color: theme.gridColor }
            },
            y: {
              beginAtZero: true,
              ticks: { precision: 0, color: theme.textColor, font: { family: "Prompt" } },
              grid: { color: theme.gridColor }
            }
          }
        }
      });
    }
  };

  /**
   * รีไซส์กราฟเมื่อเปลี่ยนหน้าจอหรือหมุนแนวตั้ง/แนวนอน
   */
  const handleResize = () => {
    if (chartSeverity) chartSeverity.resize();
    if (chartCategories) chartCategories.resize();
    if (chartShifts) chartShifts.resize();
    if (chartTimeline) chartTimeline.resize();
  };

  /**
   * อัพเดทสีเมื่อเปลี่ยน Dark/Light Theme
   */
  const handleThemeChange = () => {
    const incidents = Store.getState().incidents;
    renderAllCharts(incidents);
  };

  // Event Listeners สำหรับ Resize และการเปลี่ยน Orientation
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 150);
  });

  return {
    renderAllCharts,
    handleResize,
    handleThemeChange
  };
})();
