/**
 * =========================================================================
 * ROUTER Department - Application State Store
 * จัดการ State ทั้งหมดของแอพและการกระจายข้อมูล (Reactive Store)
 * =========================================================================
 */

const Store = (() => {
  const STORAGE_THEME_KEY = "router_app_theme_mode";
  const STORAGE_ADMIN_PIN_HASH_KEY = "router_app_admin_pin_hash";
  const LEGACY_ADMIN_PIN_KEY = "router_app_admin_pin"; // คีย์เก่า (plaintext) เก็บไว้เพื่อ migration เท่านั้น
  const PIN_HASH_SALT = "router-admin::";
  // SHA-256("router-admin::1234") — แฮชของ PIN เริ่มต้น ไม่เก็บ plaintext ไว้ในโค้ดหรือ localStorage
  const DEFAULT_PIN_HASH = "225d5ab6fe5137b0bb7597b6b3574927ef43c5b14423bbedf5efddaa367a2a6d";

  // Initial State
  const state = {
    employees: [],
    incidents: [],
    themeMode: localStorage.getItem(STORAGE_THEME_KEY) || "auto", // 'auto' | 'light' | 'dark'
    activeTab: "record", // 'record' | 'dashboard' | 'logs' | 'employees'
    
    // Filters for Logs Table & Dashboard
    searchQuery: "",
    filterShift: "all",
    filterSeverity: "all",
    filterStatus: "all",
    filterCategory: "all",
    
    // Form Selection
    selectedEmployee: null,

    // Admin State
    isAdmin: false,
    adminPinHash: localStorage.getItem(STORAGE_ADMIN_PIN_HASH_KEY) || DEFAULT_PIN_HASH,

    // Sync state
    syncStatus: "offline", // 'connected' | 'syncing' | 'offline' | 'error'
    lastSyncTime: null,
    isLiveSheet: false
  };

  // Event Listeners Registry
  const listeners = {};

  const on = (event, callback) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  };

  const emit = (event, data) => {
    if (listeners[event]) {
      listeners[event].forEach(cb => cb(data, state));
    }
  };

  // State Getters
  const getState = () => ({ ...state });

  // State Modifiers
  const setEmployees = (employees) => {
    state.employees = employees || [];
    emit("employeesUpdated", state.employees);
  };

  const setIncidents = (incidents) => {
    state.incidents = incidents || [];
    emit("incidentsUpdated", state.incidents);
  };

  const addIncident = (incident) => {
    state.incidents.unshift(incident);
    emit("incidentsUpdated", state.incidents);
  };

  const updateIncident = (updated) => {
    const idx = state.incidents.findIndex(item => item.id === updated.id);
    if (idx !== -1) {
      state.incidents[idx] = { ...state.incidents[idx], ...updated };
      emit("incidentsUpdated", state.incidents);
    }
  };

  const deleteIncident = (id) => {
    state.incidents = state.incidents.filter(item => item.id !== id);
    emit("incidentsUpdated", state.incidents);
  };

  const setActiveTab = (tab) => {
    state.activeTab = tab;
    emit("tabChanged", tab);
  };

  const setThemeMode = (mode) => {
    state.themeMode = mode;
    localStorage.setItem(STORAGE_THEME_KEY, mode);
    emit("themeChanged", mode);
  };

  const setSelectedEmployee = (emp) => {
    state.selectedEmployee = emp;
    emit("selectedEmployeeChanged", emp);
  };

  const setFilters = (newFilters) => {
    Object.assign(state, newFilters);
    emit("filtersChanged", {
      searchQuery: state.searchQuery,
      filterShift: state.filterShift,
      filterSeverity: state.filterSeverity,
      filterStatus: state.filterStatus,
      filterCategory: state.filterCategory
    });
  };

  const setSyncStatus = (status, isLive = false) => {
    state.syncStatus = status;
    state.isLiveSheet = isLive;
    if (status === "connected") {
      state.lastSyncTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    emit("syncStatusChanged", { status, isLive, time: state.lastSyncTime });
  };

  const setAdminAuth = (isAuth) => {
    state.isAdmin = isAuth;
    emit("adminAuthChanged", isAuth);
  };

  // แฮช PIN ด้วย SHA-256 (Web Crypto) — ไม่บันทึกรหัสผ่านเป็นข้อความดิบลง localStorage
  const hashPin = async (pin) => {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("บราวเซอร์ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน HTTPS หรือ localhost)");
    }
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(PIN_HASH_SALT + pin)
    );
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  // ตรวจสอบ PIN โดยเทียบแฮชเท่านั้น — รหัสจริงไม่ถูกเก็บไว้ที่ใด
  const verifyAdminPin = async (pin) => {
    return (await hashPin(pin)) === state.adminPinHash;
  };

  const setAdminPin = async (newPin) => {
    state.adminPinHash = await hashPin(newPin);
    localStorage.setItem(STORAGE_ADMIN_PIN_HASH_KEY, state.adminPinHash);
    localStorage.removeItem(LEGACY_ADMIN_PIN_KEY);
    emit("adminPinChanged", true);
  };

  // Migration: ย้าย PIN แบบ plaintext ของระบบเดิมไปเป็นแฮช (ทำงานครั้งเดียวตอนเปิดแอพ)
  const initAdminPinHash = async () => {
    const legacyPin = localStorage.getItem(LEGACY_ADMIN_PIN_KEY);
    if (legacyPin) {
      try {
        state.adminPinHash = await hashPin(legacyPin);
        localStorage.setItem(STORAGE_ADMIN_PIN_HASH_KEY, state.adminPinHash);
        localStorage.removeItem(LEGACY_ADMIN_PIN_KEY);
      } catch (err) {
        console.warn("[Store] Migration ของ Admin PIN ไม่สำเร็จ:", err);
      }
    }
  };

  // Helper: คำนวณข้อมูลสรุป KPI อัตโนมัติ
  const getMetrics = () => {
    const list = state.incidents;
    const total = list.length;
    const criticalCount = list.filter(i => i.severity === "วิกฤต").length;
    const highCount = list.filter(i => i.severity === "สูง").length;
    const pendingCount = list.filter(i => i.status === "รอดำเนินการ" || i.status === "กำลังตรวจสอบ").length;
    const closedCount = list.filter(i => i.status === "ปิดงาน" || i.status === "อบรมซ้ำแล้ว").length;

    // หาพนักงานที่มีข้อผิดพลาดสูงสุด
    const empCountMap = {};
    list.forEach(i => {
      const key = `${i.empName} (${i.empId})`;
      empCountMap[key] = (empCountMap[key] || 0) + 1;
    });

    let topEmployee = "-";
    let maxEmpCount = 0;
    Object.entries(empCountMap).forEach(([emp, count]) => {
      if (count > maxEmpCount) {
        maxEmpCount = count;
        topEmployee = `${emp} [${count} ครั้ง]`;
      }
    });

    return {
      total,
      criticalCount,
      highCount,
      pendingCount,
      closedCount,
      topEmployee
    };
  };

  // Helper: กรองข้อมูลตารางตาม Search และ Dropdown Filters
  const getFilteredIncidents = () => {
    return state.incidents.filter(item => {
      // 1. Search Query
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase().trim();
        const matchId = (item.id || "").toLowerCase().includes(q);
        const matchEmpName = (item.empName || "").toLowerCase().includes(q);
        const matchEmpId = (item.empId || "").toLowerCase().includes(q);
        const matchMachine = (item.machine || "").toLowerCase().includes(q);
        const matchPartNo = (item.partNo || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        const matchCategory = (item.category || "").toLowerCase().includes(q);
        if (!matchId && !matchEmpName && !matchEmpId && !matchMachine && !matchPartNo && !matchDesc && !matchCategory) {
          return false;
        }
      }

      // 2. Filter Shift
      if (state.filterShift !== "all" && item.shift !== state.filterShift) {
        return false;
      }

      // 3. Filter Severity
      if (state.filterSeverity !== "all" && item.severity !== state.filterSeverity) {
        return false;
      }

      // 4. Filter Status
      if (state.filterStatus !== "all" && item.status !== state.filterStatus) {
        return false;
      }

      // 5. Filter Category
      if (state.filterCategory !== "all" && !item.category.includes(state.filterCategory)) {
        return false;
      }

      return true;
    });
  };

  return {
    getState,
    on,
    emit,
    setEmployees,
    setIncidents,
    addIncident,
    updateIncident,
    deleteIncident,
    setActiveTab,
    setThemeMode,
    setSelectedEmployee,
    setFilters,
    setSyncStatus,
    setAdminAuth,
    verifyAdminPin,
    setAdminPin,
    initAdminPinHash,
    getMetrics,
    getFilteredIncidents
  };
})();
