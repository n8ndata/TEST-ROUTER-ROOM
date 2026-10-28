/**
 * =========================================================================
 * ROUTER Department - Main Application Controller
 * ควบคุม UI, ฟอร์ม, ระบบธีมอัตโนมัติ, ระบบ Admin, ตาราง, และการซิงค์ข้อมูล
 * =========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------------------------------------
  // 1. Initial State & Elements
  // ------------------------------------------------------------------------
  const formIncident = document.getElementById("form-incident");
  const selectEmployee = document.getElementById("field-employee");
  const inputEmpId = document.getElementById("field-emp-id");
  const selectShift = document.getElementById("field-shift");
  const inputIncidentDate = document.getElementById("field-incident-date");
  const selectMachine = document.getElementById("field-machine");
  const inputPartNo = document.getElementById("field-part-no");
  const inputModelNo = document.getElementById("field-model-no");
  const inputLotNo = document.getElementById("field-lot-no");
  const inputTotalQty = document.getElementById("field-total-qty");
  const inputNgQty = document.getElementById("field-ng-qty");
  const inputNgPercent = document.getElementById("field-ng-percent");
  const inputCategory = document.getElementById("field-category");
  const inputDescription = document.getElementById("field-description");
  const inputImpact = document.getElementById("field-impact");
  const inputRootCause = document.getElementById("field-root-cause");
  const inputCorrective = document.getElementById("field-corrective");
  const inputReporter = document.getElementById("field-reporter");


  // คำนวณ % NG อัตโนมัติ
  const calcNgPercent = () => {
    if (!inputNgPercent) return;
    const total = parseFloat(inputTotalQty && inputTotalQty.value);
    const ng = parseFloat(inputNgQty && inputNgQty.value);
    if (isNaN(total) || total <= 0 || isNaN(ng) || ng < 0) {
      inputNgPercent.value = "0.00%";
      inputNgPercent.style.color = "var(--text-main)";
      inputNgPercent.style.backgroundColor = "";
      inputNgPercent.style.borderColor = "";
      return;
    }
    let ngClamped = ng;
    if (ngClamped > total) ngClamped = total;
    if (inputNgQty && ng !== ngClamped) inputNgQty.value = ngClamped;
    const pct = (ngClamped / total) * 100;
    inputNgPercent.value = pct.toFixed(2) + "%";
    if (pct > 5) {
      inputNgPercent.style.color = "#dc2626";
      inputNgPercent.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
      inputNgPercent.style.borderColor = "rgba(239, 68, 68, 0.45)";
    } else {
      inputNgPercent.style.color = "#d97706";
      inputNgPercent.style.backgroundColor = "rgba(245, 158, 11, 0.12)";
      inputNgPercent.style.borderColor = "rgba(245, 158, 11, 0.45)";
    }
  };

  if (inputTotalQty) inputTotalQty.addEventListener("input", calcNgPercent);
  if (inputNgQty) inputNgQty.addEventListener("input", calcNgPercent);
  calcNgPercent();

  // Filter Elements
  const inputSearch = document.getElementById("table-search");
  const selectFilterShift = document.getElementById("filter-shift");
  const selectFilterSeverity = document.getElementById("filter-severity");
  const selectFilterStatus = document.getElementById("filter-status");

  // Admin Modal Elements
  const modalAdminAuth = document.getElementById("modal-admin-auth");
  const modalAdminPanel = document.getElementById("modal-admin-panel");
  const modalEditIncident = document.getElementById("modal-edit-incident");
  const modalGasSettings = document.getElementById("modal-gas-settings");

  // Sync Status Badges
  const badgeSyncStatus = document.getElementById("sync-status-badge");
  const textSyncStatus = document.getElementById("sync-status-text");
  const dotSync = document.getElementById("sync-dot");
  const btnManualSync = document.getElementById("btn-manual-sync");

  // Theme Elements
  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  const textThemeMode = document.getElementById("theme-mode-text");

  // ------------------------------------------------------------------------
  // 2. Theme Management: Auto Dark/White by Time + Manual Toggle
  // ------------------------------------------------------------------------
  const calculateAutoTheme = () => {
    const hour = new Date().getHours();
    // 06:00 - 17:59 = Light Theme, 18:00 - 05:59 = Dark Theme
    return (hour >= 6 && hour < 18) ? "light" : "dark";
  };

  const applyTheme = (mode) => {
    let activeTheme = mode;
    if (mode === "auto") {
      activeTheme = calculateAutoTheme();
      if (textThemeMode) textThemeMode.textContent = `อัตโนมัติ (${activeTheme === "dark" ? "🌙 กลางคืน" : "☀️ กลางวัน"})`;
    } else if (mode === "dark") {
      if (textThemeMode) textThemeMode.textContent = "🌙 โหมดมืด";
    } else {
      if (textThemeMode) textThemeMode.textContent = "☀️ โหมดสว่าง";
    }

    document.documentElement.setAttribute("data-theme", activeTheme);
    ChartsModule.handleThemeChange();
  };

  // Schedule auto-theme verification every 1 minute
  setInterval(() => {
    if (Store.getState().themeMode === "auto") {
      applyTheme("auto");
    }
  }, 60000);

  btnThemeToggle?.addEventListener("click", () => {
    const current = Store.getState().themeMode;
    let nextMode = "auto";
    if (current === "auto") nextMode = "dark";
    else if (current === "dark") nextMode = "light";
    else if (current === "light") nextMode = "auto";

    Store.setThemeMode(nextMode);
    applyTheme(nextMode);
    showToast(`เปลี่ยนธีมเป็น: ${nextMode.toUpperCase()}`, "info");
  });

  // ------------------------------------------------------------------------
  // 3. Navigation & Tab Switching
  // ------------------------------------------------------------------------
  const navButtons = document.querySelectorAll(".nav-item");
  const tabViews = document.querySelectorAll(".tab-content-view");

  const switchTab = (targetTab) => {
    Store.setActiveTab(targetTab);

    navButtons.forEach(btn => {
      if (btn.dataset.tab === targetTab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    tabViews.forEach(view => {
      if (view.id === `tab-${targetTab}`) {
        view.classList.remove("hidden");
      } else {
        view.classList.add("hidden");
      }
    });

    // ถ้าเข้าแท็บแดชบอร์ดให้ trigger charts render
    if (targetTab === "dashboard") {
      setTimeout(() => {
        ChartsModule.renderAllCharts(Store.getState().incidents);
      }, 50);
    }
  };

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // ------------------------------------------------------------------------
  // 4. Employee Dropdown & Quick Setup (Drawn from "รายชื่อพนักงาน")
  // ------------------------------------------------------------------------
  const populateEmployeeDropdown = (employees) => {
    if (!selectEmployee) return;

    selectEmployee.innerHTML = `<option value="">-- เลือกรหัสหรือชื่อพนักงาน --</option>`;
    employees.forEach(emp => {
      const option = document.createElement("option");
      option.value = emp.empId;
      option.textContent = `${emp.empId} - ${emp.fullName} (${emp.position || "Router Tech"})`;
      selectEmployee.appendChild(option);
    });
  };

  selectEmployee?.addEventListener("change", (e) => {
    const empId = e.target.value;
    const emp = Store.getState().employees.find(item => item.empId === empId);
    const badgePreview = document.getElementById("employee-preview-card");
    const previewName = document.getElementById("preview-emp-name");
    const previewDetails = document.getElementById("preview-emp-details");

    if (emp) {
      if (inputEmpId) inputEmpId.value = emp.empId;
      if (selectShift && emp.shift) selectShift.value = emp.shift;
      
      if (badgePreview) {
        badgePreview.classList.remove("hidden");
        if (previewName) previewName.textContent = `${emp.prefix || ""} ${emp.fullName}`;
        if (previewDetails) previewDetails.textContent = `รหัส: ${emp.empId} | กะ: ${emp.shift} | ตำแหน่ง: ${emp.position}`;
      }
    } else {
      if (inputEmpId) inputEmpId.value = "";
      if (badgePreview) badgePreview.classList.add("hidden");
    }
  });

  // ------------------------------------------------------------------------
  // 5. Quick Category Chips Handler
  // ------------------------------------------------------------------------
  const categoryChips = document.querySelectorAll(".category-chip");
  categoryChips.forEach(chip => {
    chip.addEventListener("click", () => {
      categoryChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      if (inputCategory) {
        inputCategory.value = chip.dataset.category || chip.textContent.trim();
        inputCategory.focus();
      }
    });
  });

  // ------------------------------------------------------------------------
  // 6. Severity Radio Pill Selection
  // ------------------------------------------------------------------------
  const severityCards = document.querySelectorAll(".severity-pill-card");
  severityCards.forEach(card => {
    card.addEventListener("click", () => {
      severityCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // ------------------------------------------------------------------------
  // 7. Form Submission (New Operational Error Incident)
  // ------------------------------------------------------------------------
  formIncident?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const empId = inputEmpId.value.trim();
    const emp = Store.getState().employees.find(i => i.empId === empId);
    const empName = emp ? `${emp.prefix || ""} ${emp.fullName}`.trim() : (document.getElementById("field-employee-manual")?.value || "ไม่ระบุ");

    const severityRadio = document.querySelector('input[name="severity"]:checked');
    const severity = severityRadio ? severityRadio.value : "ปานกลาง";

    if (!empId) {
      showToast("กรุณาเลือกพนักงานที่ทำความผิดพลาด", "error");
      selectEmployee.focus();
      return;
    }

    if (!inputDescription.value.trim()) {
      showToast("กรุณาระบุรายละเอียดข้อผิดพลาด", "error");
      inputDescription.focus();
      return;
    }

    const newIncidentData = {
      incidentDate: inputIncidentDate.value || new Date().toISOString().slice(0, 10),
      empId: empId,
      empName: empName,
      shift: selectShift.value || "กะเช้า",
      machine: selectMachine.value || "TONGTAI-10",
      partNo: inputPartNo.value.trim() || "-",
      modelNo: inputModelNo?.value.trim() || "-",
      lotNo: inputLotNo?.value.trim() || "-",
      totalQty: inputTotalQty?.value.trim() || "-",
      ngQty: inputNgQty?.value.trim() || "-",
      ngPercent: inputNgPercent?.value.trim() || "0.00%",
      category: inputCategory.value.trim() || "อื่นๆ",
      description: inputDescription.value.trim(),
      severity: severity,
      impact: inputImpact.value.trim() || "-",
      rootCause: inputRootCause.value.trim() || "-",
      correctiveAction: inputCorrective.value.trim() || "-",
      reporter: inputReporter.value.trim() || "พนักงานกะ",
      status: "รอดำเนินการ",
      notes: ""
    };

    const submitBtn = formIncident.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `กำลังบันทึกข้อมูล...`;
    }

    try {
      const res = await APIService.submitIncident(newIncidentData);
      Store.addIncident(res.data);

      showToast("บันทึกข้อมูลข้อผิดพลาดเรียบร้อยแล้ว!", "success");

      // Reset Form fields
      formIncident.reset();
      if (inputModelNo) inputModelNo.value = "";
      if (inputLotNo) inputLotNo.value = "";
      if (inputTotalQty) inputTotalQty.value = "";
      if (inputNgQty) inputNgQty.value = "";
      if (inputNgPercent) {
        inputNgPercent.value = "0.00%";
        inputNgPercent.style.color = "var(--text-main)";
        inputNgPercent.style.backgroundColor = "";
        inputNgPercent.style.borderColor = "";
      }
      setDefaultFormValues();
      document.getElementById("employee-preview-card")?.classList.add("hidden");
      categoryChips.forEach(c => c.classList.remove("active"));
      severityCards.forEach(c => c.classList.remove("selected"));
      const defaultSev = document.querySelector('.severity-pill-card.sev-med');
      if (defaultSev) {
        defaultSev.classList.add("selected");
        const rad = defaultSev.querySelector('input[type="radio"]');
        if (rad) rad.checked = true;
      }

      // Switch to table or dashboard to view
      setTimeout(() => {
        switchTab("logs");
      }, 700);

    } catch (err) {
      showToast(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> บันทึกข้อมูลข้อผิดพลาด`;
      }
    }
  });

  const setDefaultFormValues = () => {
    if (inputIncidentDate) {
      inputIncidentDate.value = new Date().toISOString().slice(0, 10);
    }
  };

  // ------------------------------------------------------------------------
  // 8. Render Table Logs (Non-overflowing, scroll isolated to container)
  // ------------------------------------------------------------------------
  const tableBody = document.getElementById("incidents-table-body");
  const countDisplay = document.getElementById("logs-total-count");

  const renderTable = () => {
    if (!tableBody) return;

    const list = Store.getFilteredIncidents();
    if (countDisplay) {
      countDisplay.textContent = `พบ ${list.length} รายการ`;
    }

    if (list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center" style="padding: 2.5rem 1rem;">
            <div style="color: var(--text-muted); font-size: 0.95rem;">
              ไม่พบข้อมูลข้อผิดพลาดตามเงื่อนไขที่ค้นหา
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = list.map(item => {
      let sevBadge = `<span class="badge badge-med">ปานกลาง</span>`;
      if (item.severity === "เล็กน้อย") sevBadge = `<span class="badge badge-low">เล็กน้อย</span>`;
      else if (item.severity === "สูง") sevBadge = `<span class="badge badge-high">สูง</span>`;
      else if (item.severity === "วิกฤต") sevBadge = `<span class="badge badge-crit">วิกฤต</span>`;

      let statusBadge = `<span class="badge-status badge-status-pending">รอดำเนินการ</span>`;
      if (item.status === "กำลังตรวจสอบ") statusBadge = `<span class="badge-status badge-status-investigating">กำลังตรวจสอบ</span>`;
      else if (item.status === "อบรมซ้ำแล้ว") statusBadge = `<span class="badge-status badge-status-retrained">อบรมซ้ำแล้ว</span>`;
      else if (item.status === "ปิดงาน") statusBadge = `<span class="badge-status badge-status-resolved">ปิดงาน</span>`;

      const safeId = item.id || "";

      return `
        <tr data-id="${safeId}">
          <td style="font-weight: 600; font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${safeId}</td>
          <td>${item.incidentDate || "-"}</td>
          <td>
            <div style="font-weight: 600;">${item.empName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.empId} • ${item.shift}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${item.machine || "-"}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Part: ${item.partNo || "-"}</div>
          </td>
          <td>${item.category || "-"}</td>
          <td>${sevBadge}</td>
          <td>
            <div style="max-width: 260px; white-space: normal; line-height: 1.35; font-size: 0.85rem;">
              ${item.description || "-"}
            </div>
            ${item.impact && item.impact !== "-" ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">ผลกระทบ: ${item.impact}</div>` : ""}
          </td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn-touch btn-action-edit" data-id="${safeId}" title="แก้ไข/จัดการสถานะ" style="min-height: 36px; padding: 0.25rem 0.6rem; font-size: 0.8rem; background: var(--bg-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                จัดการ
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Attach click listeners to action buttons
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        handleOpenEditModal(id);
      });
    });
  };

  // ------------------------------------------------------------------------
  // 9. Table Search & Filtering
  // ------------------------------------------------------------------------
  inputSearch?.addEventListener("input", (e) => {
    Store.setFilters({ searchQuery: e.target.value });
    renderTable();
  });

  selectFilterShift?.addEventListener("change", (e) => {
    Store.setFilters({ filterShift: e.target.value });
    renderTable();
  });

  selectFilterSeverity?.addEventListener("change", (e) => {
    Store.setFilters({ filterSeverity: e.target.value });
    renderTable();
  });

  selectFilterStatus?.addEventListener("change", (e) => {
    Store.setFilters({ filterStatus: e.target.value });
    renderTable();
  });

  // ------------------------------------------------------------------------
  // 10. Dashboard Metrics Renderer
  // ------------------------------------------------------------------------
  const renderDashboardMetrics = () => {
    const metrics = Store.getMetrics();
    const elTotal = document.getElementById("metric-total-count");
    const elCritical = document.getElementById("metric-critical-count");
    const elPending = document.getElementById("metric-pending-count");
    const elTopEmp = document.getElementById("metric-top-emp");

    if (elTotal) elTotal.textContent = metrics.total;
    if (elCritical) elCritical.textContent = metrics.criticalCount + metrics.highCount;
    if (elPending) elPending.textContent = metrics.pendingCount;
    if (elTopEmp) elTopEmp.textContent = metrics.topEmployee;
  };

  // ------------------------------------------------------------------------
  // 11. Employees Tab Renderer (Drawn from "รายชื่อพนักงาน")
  // ------------------------------------------------------------------------
  const renderEmployeesTab = () => {
    const container = document.getElementById("employees-card-grid");
    if (!container) return;

    const employees = Store.getState().employees;
    const incidents = Store.getState().incidents;

    if (employees.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">กำลังโหลดข้อมูลพนักงานจาก Google Sheet...</div>`;
      return;
    }

    container.innerHTML = employees.map(emp => {
      // นับจำนวนความผิดพลาดของพนักงานคนนี้
      const empIncidents = incidents.filter(i => i.empId === emp.empId);
      const totalErrors = empIncidents.length;
      const criticalErrors = empIncidents.filter(i => i.severity === "วิกฤต" || i.severity === "สูง").length;

      let errorBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">0 ครั้ง (ดีเยี่ยม)</span>`;
      if (totalErrors > 0) {
        errorBadge = `<span class="badge ${criticalErrors > 0 ? 'badge-crit' : 'badge-med'}">${totalErrors} ครั้ง ${criticalErrors > 0 ? `(รุนแรง ${criticalErrors})` : ''}</span>`;
      }

      return `
        <div class="metric-card" style="padding: 1.15rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #2563eb); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.1rem; flex-shrink: 0;">
              ${emp.fullName ? emp.fullName.charAt(0) : "R"}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem;">${emp.prefix || ""} ${emp.fullName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${emp.empId} • ${emp.position}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 0.5rem 0; border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.75rem;">
            <div>กะทำงาน: <span style="font-weight: 600;">${emp.shift}</span></div>
            <div>สถานะ: <span style="color: #10b981; font-weight: 600;">${emp.status || "ปกติ"}</span></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.775rem; color: var(--text-muted);">ข้อผิดพลาดสะสม:</span>
            ${errorBadge}
          </div>
        </div>
      `;
    }).join("");
  };

  // ------------------------------------------------------------------------
  // 12. Edit Incident & Admin Status Management Modal
  // ------------------------------------------------------------------------
  let currentEditingIncidentId = null;

  const handleOpenEditModal = (id) => {
    const item = Store.getState().incidents.find(i => i.id === id);
    if (!item) return;

    currentEditingIncidentId = id;

    // Fill Modal Fields
    document.getElementById("edit-modal-id").textContent = item.id;
    document.getElementById("edit-modal-emp").textContent = `${item.empName} (${item.empId})`;
    document.getElementById("edit-modal-machine").textContent = `${item.machine} | Part: ${item.partNo}`;
    document.getElementById("edit-field-status").value = item.status || "รอดำเนินการ";
    document.getElementById("edit-field-description").value = item.description || "";
    document.getElementById("edit-field-root-cause").value = item.rootCause || "";
    document.getElementById("edit-field-corrective").value = item.correctiveAction || "";
    document.getElementById("edit-field-notes").value = item.notes || "";

    openModal(modalEditIncident);
  };

  document.getElementById("form-edit-incident")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditingIncidentId) return;

    const updatedData = {
      id: currentEditingIncidentId,
      status: document.getElementById("edit-field-status").value,
      description: document.getElementById("edit-field-description").value.trim(),
      rootCause: document.getElementById("edit-field-root-cause").value.trim(),
      correctiveAction: document.getElementById("edit-field-corrective").value.trim(),
      notes: document.getElementById("edit-field-notes").value.trim()
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await APIService.updateIncident(updatedData);
      Store.updateIncident(updatedData);
      showToast("อัพเดทสถานะและการแก้ไขสำเร็จ!", "success");
      closeModal(modalEditIncident);
    } catch (err) {
      showToast(`อัพเดทไม่สำเร็จ: ${err.message}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("btn-delete-incident")?.addEventListener("click", async () => {
    if (!currentEditingIncidentId) return;

    // ต้องผ่านสิทธิ์ Admin ก่อนลบ
    if (!Store.getState().isAdmin) {
      showToast("ต้องยืนยันตัวตน Admin ก่อนลบข้อมูล", "info");
      openAdminAuthModal(() => {
        executeDelete(currentEditingIncidentId);
      });
      return;
    }

    executeDelete(currentEditingIncidentId);
  });

  const executeDelete = async (id) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการข้อผิดพลาด ${id} นี้?`)) {
      return;
    }

    try {
      const result = await APIService.deleteIncident(id, APIService.getAdminToken());

      if (result.success) {
        Store.deleteIncident(id);
        showToast("ลบรายการข้อผิดพลาดสำเร็จ", "success");
        closeModal(modalEditIncident);
        return;
      }

      // Token หมดอายุ/ไม่ถูกต้อง → ล็อคเซสชันและขอให้ยืนยันใหม่
      if (result.code === "UNAUTHORIZED") {
        APIService.clearAdminToken();
        Store.setAdminAuth(false);
        // ซิงค์ข้อมูลกลับเพื่อคืนรายการที่ถูกลบออกจากแคชแบบ optimistic
        try { syncDataWithSheet(true); } catch (e) { /* ignore */ }
        showToast(result.message || "เซสชัน Admin หมดอายุ กรุณายืนยันตัวตนใหม่", "error");
        openAdminAuthModal(() => {
          executeDelete(id);
        });
        return;
      }

      showToast(`ลบไม่สำเร็จ: ${result.message || "Unknown error"}`, "error");
    } catch (err) {
      showToast(`ลบไม่สำเร็จ: ${err.message}`, "error");
    }
  };

  // ------------------------------------------------------------------------
  // 13. Admin PIN Authentication & Modal Handlers
  //     - ตรวจสอบ PIN แบบ SHA-256 hash ผ่าน Store (ไม่มี plaintext ในโค้ด/เครื่องผู้ใช้)
  //     - จำกัดกรอกผิด 5 ครั้ง แล้วล็อค 30 วินาที (เก็บใน sessionStorage)
  // ------------------------------------------------------------------------
  const MAX_PIN_ATTEMPTS = 5;
  const PIN_LOCKOUT_MILLISECONDS = 30 * 1000;

  let enteredPin = "";
  let pendingAdminCallback = null;
  let failedPinAttempts = parseInt(sessionStorage.getItem("router_app_pin_attempts") || "0", 10) || 0;
  let pinLockoutUntil = parseInt(sessionStorage.getItem("router_app_pin_lock_until") || "0", 10) || 0;
  let pinLockoutTimer = null;

  const savePinAttempts = () => {
    sessionStorage.setItem("router_app_pin_attempts", String(failedPinAttempts));
  };

  const releasePinLockout = () => {
    pinLockoutUntil = 0;
    failedPinAttempts = 0;
    sessionStorage.removeItem("router_app_pin_lock_until");
    savePinAttempts();
    clearInterval(pinLockoutTimer);
    pinLockoutTimer = null;
  };

  const updateLockoutStatus = () => {
    const statusEl = document.getElementById("pin-lock-status");
    const keyBtns = document.querySelectorAll(".numpad-key");
    if (!statusEl) return;

    // ช่วงถูกล็อค: ไล่นับวินาทีถอยหลังและปิดปุ่ม Numpad
    if (Date.now() < pinLockoutUntil) {
      const remainSec = Math.ceil((pinLockoutUntil - Date.now()) / 1000);
      statusEl.textContent = `🔒 กดผิดครบ ${MAX_PIN_ATTEMPTS} ครั้ง ล็อคชั่วคราวอีก ${remainSec} วินาที`;
      statusEl.style.display = "block";
      keyBtns.forEach(btn => { btn.disabled = true; });
      if (!pinLockoutTimer) pinLockoutTimer = setInterval(updateLockoutStatus, 500);
      return;
    }

    // พ้นช่วงล็อคแล้ว: เคลียร์สถานะและปลดล็อคปุ่ม
    if (pinLockoutUntil > 0) releasePinLockout();
    keyBtns.forEach(btn => { btn.disabled = false; });

    if (failedPinAttempts > 0) {
      const remain = MAX_PIN_ATTEMPTS - failedPinAttempts;
      statusEl.textContent = `⚠️ กรอกผิดมาแล้ว ${failedPinAttempts} ครั้ง (เหลืออีก ${remain} ครั้งก่อนถูกล็อค)`;
      statusEl.style.display = "block";
    } else {
      statusEl.style.display = "none";
    }
  };

  const openAdminAuthModal = (onSuccess) => {
    enteredPin = "";
    updatePinDisplay();
    pendingAdminCallback = onSuccess;
    openModal(modalAdminAuth);
    updateLockoutStatus();
  };

  const updatePinDisplay = () => {
    const digitBoxes = document.querySelectorAll(".pin-digit-box");
    digitBoxes.forEach((box, idx) => {
      if (idx < enteredPin.length) {
        box.textContent = "●";
        box.classList.add("filled");
      } else {
        box.textContent = "";
        box.classList.remove("filled");
      }
    });
  };

  document.querySelectorAll(".numpad-key").forEach(keyBtn => {
    keyBtn.addEventListener("click", () => {
      if (Date.now() < pinLockoutUntil) return; // ขณะถูกล็อคห้ามกด

      const val = keyBtn.dataset.key;
      if (val === "clear") {
        enteredPin = "";
      } else if (val === "back") {
        enteredPin = enteredPin.slice(0, -1);
      } else if (enteredPin.length < 4) {
        enteredPin += val;
      }
      updatePinDisplay();

      // เมื่อกดครบ 4 หลัก — ตรวจสอบทันที (ไม่มีดีเลย์) พร้อมแสดงสถานะกำลังตรวจสอบ
      if (enteredPin.length === 4) {
        const statusEl0 = document.getElementById("pin-lock-status");
        if (statusEl0 && failedPinAttempts === 0) {
          statusEl0.textContent = "⏳ กำลังตรวจสอบรหัส...";
          statusEl0.style.display = "block";
        }
        verifyAdminPin();
      }
    });
  });

  const verifyAdminPin = async () => {
    if (Date.now() < pinLockoutUntil) return;

    let isMatch = false;
    let serverMessage = "";
    try {
      const result = await APIService.verifyAdminPin(enteredPin);
      isMatch = result.success;
      serverMessage = result.message || "";
    } catch (err) {
      showToast(err.message, "error");
      enteredPin = "";
      updatePinDisplay();
      return;
    }

    if (isMatch) {
      releasePinLockout();
      Store.setAdminAuth(true);
      showToast(serverMessage || "เข้าสู่ระบบ Admin สำเร็จ", "success");
      closeModal(modalAdminAuth);

      if (pendingAdminCallback) {
        pendingAdminCallback();
        pendingAdminCallback = null;
      } else {
        renderAdminPanelKpis();
        openModal(modalAdminPanel);
      }
    } else {
      failedPinAttempts += 1;
      enteredPin = "";

      if (failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        pinLockoutUntil = Date.now() + PIN_LOCKOUT_MILLISECONDS;
        sessionStorage.setItem("router_app_pin_lock_until", String(pinLockoutUntil));
        showToast(`รหัส PIN ไม่ถูกต้อง ระบบล็อคชั่วคราว ${PIN_LOCKOUT_MILLISECONDS / 1000} วินาที`, "error");
      } else {
        savePinAttempts();
        showToast(serverMessage || `รหัส PIN ไม่ถูกต้อง (ผิด ${failedPinAttempts}/${MAX_PIN_ATTEMPTS} ครั้ง)`, "error");
      }

      updateLockoutStatus();
      updatePinDisplay();
    }
  };

  document.getElementById("btn-open-admin")?.addEventListener("click", () => {
    if (Store.getState().isAdmin) {
      renderAdminPanelKpis();
      openModal(modalAdminPanel);
    } else {
      openAdminAuthModal(() => {
        renderAdminPanelKpis();
        openModal(modalAdminPanel);
      });
    }
  });

  document.getElementById("btn-change-pin")?.addEventListener("click", async () => {
    // ต้องยืนยันรหัส PIN ปัจจุบันก่อนเปลี่ยน เพื่อป้องกันการเปลี่ยนโดยไม่ได้รับอนุญาต
    const currentPin = prompt("ระบุรหัส PIN ปัจจุบันเพื่อยืนยันตัวตน:", "");
    if (currentPin === null) return;

    const currentPinTrimmed = currentPin.trim();

    const newPin = prompt("ระบุรหัส PIN ใหม่ 4 หลัก:", "");
    if (newPin === null) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
      showToast("รหัส PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น", "error");
      return;
    }

    const confirmPin = prompt("ยืนยันรหัส PIN ใหม่อีกครั้ง:", "");
    if (confirmPin === null) return;
    if (confirmPin.trim() !== newPin.trim()) {
      showToast("รหัส PIN ที่ยืนยันไม่ตรงกัน ยกเลิกการเปลี่ยน", "error");
      return;
    }

    try {
      // ตรวจและเปลี่ยน PIN ฝั่งเซิร์ฟเวอร์ (Google Apps Script) — ฝั่ง client ไม่เก็บ PIN จริง
      const result = await APIService.changeAdminPin(currentPinTrimmed, newPin.trim());
      if (!result.success) {
        showToast(result.message || "เปลี่ยนรหัส PIN ไม่สำเร็จ", "error");
        return;
      }
      // ซิงค์ client-side hash ด้วย (สำหรับโหมดออฟไลน์/fallback)
      try { await Store.setAdminPin(newPin.trim()); } catch (e) { /* ignore */ }
      showToast(result.message || "เปลี่ยนรหัส PIN เรียบร้อย", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // ------------------------------------------------------------------------
  // 13.1 Admin Session Management (Logout + Auto Lock + KPI Summary)
  // ------------------------------------------------------------------------
  const ADMIN_IDLE_LOCK_MINUTES = 15;
  let adminIdleLockTimer = null;

  const lockAdminSession = (reason) => {
    APIService.clearAdminToken();
    Store.setAdminAuth(false);
    closeModal(modalAdminPanel);
    if (reason) showToast(reason, "info");
  };

  document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
    lockAdminSession("ออกจากโหมด Admin เรียบร้อย (ปิดเซสชันแล้ว)");
  });

  // ปิดหน้าศูนย์ควบคุม Admin (ปุ่ม X หรือ "ปิดหน้าต่าง") → ล็อคเซสชันทันที ต้องใส่ PIN ใหม่ทุกครั้ง
  document.querySelectorAll("#modal-admin-panel .modal-close-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      lockAdminSession("ล็อคโหมด Admin แล้ว (ต้องใส่ PIN ใหม่เมื่อเข้าครั้งถัดไป)");
    });
  });

  // Auto Lock: ไม่มีการใช้งาน 15 นาที → ล็อคเซสชัน Admin อัตโนมัติ
  const resetAdminIdleLock = () => {
    if (!Store.getState().isAdmin) return;
    clearTimeout(adminIdleLockTimer);
    adminIdleLockTimer = setTimeout(() => {
      lockAdminSession(`ล็อคโหมด Admin อัตโนมัติ (ไม่มีการใช้งาน ${ADMIN_IDLE_LOCK_MINUTES} นาที)`);
    }, ADMIN_IDLE_LOCK_MINUTES * 60 * 1000);
  };

  document.addEventListener("click", () => {
    if (Store.getState().isAdmin) resetAdminIdleLock();
  });

  // สรุปสถิติสำคัญแสดงใน Admin Panel ทุกครั้งที่เปิด
  const renderAdminPanelKpis = () => {
    const wrap = document.getElementById("admin-panel-kpis");
    if (!wrap) return;
    const metrics = Store.getMetrics();
    const cards = [
      { label: "รายการทั้งหมด", value: metrics.total, color: "#2563eb" },
      { label: "วิกฤต (Critical)", value: metrics.criticalCount, color: "#ef4444" },
      { label: "รอดำเนินการ", value: metrics.pendingCount, color: "#f59e0b" },
      { label: "ปิดงานแล้ว", value: metrics.closedCount, color: "#10b981" }
    ];
    wrap.innerHTML = cards.map(card => `
      <div style="padding: 0.75rem 0.5rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-subtle); text-align: center;">
        <div style="font-size: 1.35rem; font-weight: 800; color: ${card.color};">${card.value}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">${card.label}</div>
      </div>
    `).join("");
  };

  // ------------------------------------------------------------------------
  // 14. Google Apps Script Settings Modal & Real-time Sync
  // ------------------------------------------------------------------------
  const inputGasUrl = document.getElementById("field-gas-url");

  // ปุ่มเปิดตั้งค่าเชื่อมต่อ — อยู่ในศูนย์ควบคุม Admin เท่านั้น (ถูกย้ายออกจาก header)
  document.getElementById("btn-admin-open-settings")?.addEventListener("click", () => {
    if (inputGasUrl) inputGasUrl.value = APIService.getGasUrl();
    openModal(modalGasSettings);
  });

  document.getElementById("form-gas-settings")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = inputGasUrl.value.trim();
    APIService.setGasUrl(url);
    showToast("บันทึกการตั้งค่า Web App URL เรียบร้อย", "success");
    closeModal(modalGasSettings);

    // ทำการซิงค์ข้อมูลทันที
    syncDataWithSheet(true);
  });

  // ปุ่มกดซิงค์ข้อมูลแบบ Real-time ด้วยตนเอง
  btnManualSync?.addEventListener("click", () => {
    syncDataWithSheet(true);
  });

  const syncDataWithSheet = async (showNotification = false) => {
    if (btnManualSync) {
      btnManualSync.classList.add("rotating");
    }
    Store.setSyncStatus("syncing");
    if (dotSync) dotSync.className = "sync-dot syncing";
    if (textSyncStatus) textSyncStatus.textContent = "กำลังซิงค์ Google Sheet...";

    try {
      const data = await APIService.fetchAllData();
      if (data.employees) {
        Store.setEmployees(data.employees);
        populateEmployeeDropdown(data.employees);
      }
      if (data.incidents) {
        Store.setIncidents(data.incidents);
      }

      Store.setSyncStatus("connected", data.isLive);
      if (dotSync) dotSync.className = data.isLive ? "sync-dot" : "sync-dot offline";
      if (textSyncStatus) {
        textSyncStatus.textContent = data.isLive 
          ? `ซิงค์แล้ว ${Store.getState().lastSyncTime}` 
          : "ออฟไลน์ (ใช้ข้อมูลในเครื่อง)";
      }

      if (showNotification) {
        showToast(data.isLive ? "ซิงค์ข้อมูลกับ Google Sheet สำเร็จ!" : "โหมดออฟไลน์: โหลดข้อมูลจากเครื่องเรียบร้อย", "success");
      }

    } catch (err) {
      Store.setSyncStatus("error");
      if (dotSync) dotSync.className = "sync-dot offline";
      if (textSyncStatus) textSyncStatus.textContent = "เชื่อมต่อล้มเหลว";
      if (showNotification) {
        showToast(`ซิงค์ข้อมูลไม่สำเร็จ: ${err.message}`, "error");
      }
    } finally {
      if (btnManualSync) {
        btnManualSync.classList.remove("rotating");
      }
    }
  };

  // ------------------------------------------------------------------------
  // 15. Export Data to CSV (Support Thai UTF-8 for Excel)
  // ------------------------------------------------------------------------
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    const list = Store.getState().incidents;
    if (list.length === 0) {
      showToast("ไม่มีข้อมูลสำหรับส่งออก", "info");
      return;
    }

    const headers = [
      "ID",
      "วันที่บันทึก",
      "วันที่เกิดเหตุ",
      "รหัสพนักงาน",
      "ชื่อพนักงาน",
      "กะ",
      "เครื่องจักร",
      "Part No",
      "ประเภทความผิดพลาด",
      "รายละเอียด",
      "ความรุนแรง",
      "ผลกระทบ",
      "สาเหตุ",
      "การแก้ไขและป้องกัน",
      "ผู้บันทึก",
      "สถานะ",
      "หมายเหตุ"
    ];

    const escapeCsv = (str) => `"${(str || "").toString().replace(/"/g, '""')}"`;

    const rows = list.map(i => [
      escapeCsv(i.id),
      escapeCsv(i.timestamp),
      escapeCsv(i.incidentDate),
      escapeCsv(i.empId),
      escapeCsv(i.empName),
      escapeCsv(i.shift),
      escapeCsv(i.machine),
      escapeCsv(i.partNo),
      escapeCsv(i.category),
      escapeCsv(i.description),
      escapeCsv(i.severity),
      escapeCsv(i.impact),
      escapeCsv(i.rootCause),
      escapeCsv(i.correctiveAction),
      escapeCsv(i.reporter),
      escapeCsv(i.status),
      escapeCsv(i.notes)
    ].join(","));

    // Add UTF-8 BOM (\uFEFF) so Microsoft Excel opens Thai font correctly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const todayStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `ROUTER_Error_Log_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว", "success");
  });

  // ------------------------------------------------------------------------
  // 16. Modal Open / Close Helpers
  // ------------------------------------------------------------------------
  const openModal = (modal) => {
    if (!modal) return;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  };

  document.querySelectorAll(".modal-close-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      closeModal(modal);
    });
  });

  // Close when clicking modal backdrop
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // ------------------------------------------------------------------------
  // 17. Toast System
  // ------------------------------------------------------------------------
  const showToast = (message, type = "info") => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconSvg = "";
    if (type === "success") {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };

  // ------------------------------------------------------------------------
  // 18. Store Event Subscriptions (Reactive UI Updates)
  // ------------------------------------------------------------------------
  Store.on("incidentsUpdated", (incidents) => {
    renderTable();
    renderDashboardMetrics();
    ChartsModule.renderAllCharts(incidents);
    renderEmployeesTab();
  });

  Store.on("employeesUpdated", (employees) => {
    populateEmployeeDropdown(employees);
    renderEmployeesTab();
  });

  // ------------------------------------------------------------------------
  // 19. Start App
  // ------------------------------------------------------------------------
  applyTheme(Store.getState().themeMode);
  setDefaultFormValues();
  Store.initAdminPinHash();
  // กู้คืนเซสชัน Admin จาก sessionStorage (ถ้า Token ยังไม่หมดอายุ)
  if (APIService.getAdminToken()) {
    Store.setAdminAuth(true);
  }
  syncDataWithSheet(false);

  // Background real-time polling every 30 seconds
  setInterval(() => {
    if (APIService.getGasUrl()) {
      syncDataWithSheet(false);
    }
  }, 30000);
});
