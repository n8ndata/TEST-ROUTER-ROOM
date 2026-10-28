/**
 * =========================================================================
 * ROUTER Department - API & Google Apps Script Service
 * จัดการการเชื่อมต่อ Google Sheets แบบ Real-time พร้อมโหมด Offline Fallback
 * =========================================================================
 */

const APIService = (() => {
  // Token เซสชัน Admin เก็บใน sessionStorage (ปิดเบราว์เซอร์ = หมดอายุ)
  let _adminToken = null;
  try { _adminToken = sessionStorage.getItem(STORAGE_KEY_ADMIN_TOKEN); } catch (e) { _adminToken = null; }

  const getAdminToken = () => _adminToken;
  const setAdminToken = (token) => {
    _adminToken = token || null;
    try {
      if (_adminToken) sessionStorage.setItem(STORAGE_KEY_ADMIN_TOKEN, _adminToken);
      else sessionStorage.removeItem(STORAGE_KEY_ADMIN_TOKEN);
    } catch (e) { /* ignore */ }
  };
  const clearAdminToken = () => setAdminToken(null);
  const STORAGE_KEY_GAS_URL = "router_app_gas_url";
  const STORAGE_KEY_INCIDENTS = "router_app_incidents_cache";
  const STORAGE_KEY_EMPLOYEES = "router_app_employees_cache";
  const STORAGE_KEY_ADMIN_TOKEN = "router_app_admin_token"; // เก็บ Token เซสชัน Admin (sessionStorage)

  // ข้อมูลจำลองเริ่มต้นเมื่อยังไม่ได้ใส่ URL หรือออฟไลน์
  const DEFAULT_EMPLOYEES = [
    { empId: "EMP-RT001", prefix: "นาย", fullName: "สมชาย กล้าหาญ", position: "หัวหน้าชุดช่าง Router", shift: "กะเช้า", phone: "081-234-5678", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT002", prefix: "นางสาว", fullName: "วิภาวรรณ สดใส", position: "พนักงานควบคุมเครื่อง CNC", shift: "กะเช้า", phone: "082-345-6789", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT003", prefix: "นาย", fullName: "ธนากร มุ่งมั่น", position: "พนักงานควบคุมเครื่อง Router", shift: "กะบ่าย", phone: "083-456-7890", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT004", prefix: "นาย", fullName: "ณัฐพงษ์ ใจดี", position: "ช่างเซ็ตอัพเครื่องจักร (Setup Tech)", shift: "กะบ่าย", phone: "084-567-8901", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT005", prefix: "นางสาว", fullName: "กัญญา สุขเกษม", position: "พนักงานตรวจสอบคุณภาพ (QC Router)", shift: "กะดึก", phone: "085-678-9012", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT006", prefix: "นาย", fullName: "กิตติพงษ์ ศรีสุข", position: "พนักงานควบคุมเครื่อง Router", shift: "กะดึก", phone: "086-789-0123", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT007", prefix: "นาย", fullName: "ปฏิภาณ วงศ์สว่าง", position: "พนักงานฝึกหัด", shift: "กะเช้า", phone: "087-890-1234", status: "ปฏิบัติงานปกติ" },
    { empId: "EMP-RT008", prefix: "นาย", fullName: "วรวุฒิ บุญมี", position: "พนักงานควบคุมเครื่อง Router", shift: "กะปกติ", phone: "088-901-2345", status: "ปฏิบัติงานปกติ" }
  ];

  const DEFAULT_INCIDENTS = [
    {
      id: "RT-20261025-1001",
      timestamp: "2026-10-25 14:20:00",
      incidentDate: "2026-10-25",
      empId: "EMP-RT003",
      empName: "นาย ธนากร มุ่งมั่น",
      shift: "กะบ่าย",
      machine: "Router-03 (High Speed PCB)",
      partNo: "PCB-MB-8802",
      category: "ติดตั้งดอกเราเตอร์ผิดเบอร์ / สึกหรอ (Wrong / Worn Tool Bit)",
      description: "ใช้ดอกคัตเตอร์ขนาด 1.5mm แทนที่จะเป็น 1.2mm ทำให้ร่องตัดกว้างเกินแบบ",
      severity: "สูง",
      impact: "ของเสีย 15 แผ่น (~3,500 บาท)",
      rootCause: "ไม่ได้ตรวจสอบเบอร์ที่กล่องดอกเราเตอร์ก่อนติดตั้ง",
      correctiveAction: "เปลี่ยนดอกตามขนาดที่ถูกต้อง และเพิ่มขั้นตอน Double-Check ก่อนเดินเครื่อง",
      reporter: "สมชาย กล้าหาญ (หัวหน้าชุด)",
      status: "อบรมซ้ำแล้ว",
      notes: "พนักงานยอมรับและปฏิบัติตามขั้นตอนตรวจสอบใหม่"
    },
    {
      id: "RT-20261026-1002",
      timestamp: "2026-10-26 08:45:00",
      incidentDate: "2026-10-26",
      empId: "EMP-RT007",
      empName: "นาย ปฏิภาณ วงศ์สว่าง",
      shift: "กะเช้า",
      machine: "Router-01 (CNC Precision)",
      partNo: "PN-FR4-552",
      category: "ลืมตรวจสอบ First Piece (First Article Inspection Missed)",
      description: "เริ่มรันชิ้นงานต่อเนื่องโดยไม่ได้ส่งชิ้นแรกให้ QC เซ็นรับรอง",
      severity: "ปานกลาง",
      impact: "ต้องนำมาคัดแยกใหม่ 50 ชิ้น เสียเวลา 40 นาที",
      rootCause: "พนักงานใหม่เข้าใจว่ากะก่อนหน้าได้ตั้งเครื่องไว้เรียบร้อยแล้ว",
      correctiveAction: "หัวหน้าตักเตือนและทบทวน SOP การตรวจสอบ First Piece ทุกครั้งที่เปิดเครื่อง",
      reporter: "วิภาวรรณ สดใส",
      status: "ปิดงาน",
      notes: "QC ทำการตรวจชิ้นงานเรียบร้อย ผ่านเกณฑ์ 48 ชิ้น"
    },
    {
      id: "RT-20261026-1003",
      timestamp: "2026-10-26 09:15:00",
      incidentDate: "2026-10-26",
      empId: "EMP-RT002",
      empName: "นางสาว วิภาวรรณ สดใส",
      shift: "กะเช้า",
      machine: "Router-02 (CNC Precision)",
      partNo: "PN-ALU-102",
      category: "วางชิ้นงาน / จิ๊กไม่แน่น (Part Misalignment / Clamping)",
      description: "ตัวหนีบล็อคชิ้นงานหลวมระหว่างการหมุน Spindle ความเร็วสูง ทำให้ขอบชิ้นงานเป็นรอย",
      severity: "เล็กน้อย",
      impact: "ขัดแต่ง Rework ได้ ไม่เป็นของเสีย",
      rootCause: "สปริงตัวล็อคจิ๊กตัวที่ 2 เริ่มล้าแรงกดไม่สม่ำเสมอ",
      correctiveAction: "เปลี่ยนสปริงตัวล็อคใหม่ และทำความสะอาดคราบน้ำมันบนฐานรอง",
      reporter: "สมชาย กล้าหาญ",
      status: "กำลังตรวจสอบ",
      notes: "แจ้งฝ่ายซ่อมบำรุงตรวจเช็คแรงหนีบทุกสัปดาห์"
    }
  ];

  /**
   * ดึง Web App URL จาก localStorage
   */
  const getGasUrl = () => {
    return localStorage.getItem(STORAGE_KEY_GAS_URL) || "";
  };

  /**
   * บันทึก Web App URL ลง localStorage
   */
  const setGasUrl = (url) => {
    localStorage.setItem(STORAGE_KEY_GAS_URL, (url || "").trim());
  };

  /**
   * ดึงข้อมูลทั้งหมดจาก Google Sheet (หรือ Cache/Mock Data)
   */
  const fetchAllData = async () => {
    const url = getGasUrl();

    // หากไม่มีการระบุ URL ให้ใช้ข้อมูล LocalStorage หรือ Mock Data
    if (!url) {
      const cachedEmployees = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEES) || "null") || DEFAULT_EMPLOYEES;
      const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
      return {
        isLive: false,
        source: "local",
        employees: cachedEmployees,
        incidents: cachedIncidents
      };
    }

    try {
      // เรียก Google Apps Script ด้วย action=getAll
      const targetUrl = url.includes("?") ? `${url}&action=getAll` : `${url}?action=getAll`;
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
        mode: "cors"
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === "success") {
        // บันทึกแคชไว้สำรอง
        if (result.employees && result.employees.length > 0) {
          localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(result.employees));
        }
        if (result.incidents) {
          localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(result.incidents));
        }

        return {
          isLive: true,
          source: "google_sheet",
          employees: result.employees || DEFAULT_EMPLOYEES,
          incidents: result.incidents || []
        };
      } else {
        throw new Error(result.message || "Failed to load data from Sheet");
      }
    } catch (err) {
      console.warn("GAS Connection failed, using local cache:", err);
      const cachedEmployees = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEES) || "null") || DEFAULT_EMPLOYEES;
      const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
      return {
        isLive: false,
        source: "cache_fallback",
        error: err.message,
        employees: cachedEmployees,
        incidents: cachedIncidents
      };
    }
  };

  /**
   * บันทึกรายการความผิดพลาดใหม่ลง Google Sheet
   */
  const submitIncident = async (incidentData) => {
    const url = getGasUrl();

    // สร้าง ID และเวลาหากยังไม่มี
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newRecord = {
      id: incidentData.id || `RT-${dateStr}-${randomSuffix}`,
      timestamp: now.toISOString().replace("T", " ").substring(0, 19),
      ...incidentData
    };

    if (!url) {
      // โหมดออฟไลน์: บันทึกลง local storage
      const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
      cachedIncidents.unshift(newRecord);
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(cachedIncidents));
      return { success: true, isLive: false, data: newRecord };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // ใช้ text/plain เลี่ยง preflight CORS ใน Google Apps Script
        body: JSON.stringify({
          action: "addIncident",
          data: newRecord
        })
      });

      const resJson = await response.json();
      if (resJson.status === "success") {
        // อัพเดทแคชท้องถิ่นด้วย
        const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
        cachedIncidents.unshift(resJson.data || newRecord);
        localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(cachedIncidents));
        return { success: true, isLive: true, data: resJson.data || newRecord };
      } else {
        throw new Error(resJson.message || "Failed to save to Google Sheet");
      }
    } catch (err) {
      console.warn("GAS POST failed, saving to local cache:", err);
      const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
      cachedIncidents.unshift(newRecord);
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(cachedIncidents));
      return { success: true, isLive: false, fallbackSaved: true, data: newRecord, error: err.message };
    }
  };

  /**
   * อัพเดทรายการความผิดพลาด
   */
  const updateIncident = async (incidentData) => {
    const url = getGasUrl();

    // บันทึกลง Cache ทันที (Optimistic UI)
    const cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
    const idx = cachedIncidents.findIndex(item => item.id === incidentData.id);
    if (idx !== -1) {
      cachedIncidents[idx] = { ...cachedIncidents[idx], ...incidentData };
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(cachedIncidents));
    }

    if (!url) {
      return { success: true, isLive: false, data: incidentData };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "updateIncident",
          data: incidentData
        })
      });

      const resJson = await response.json();
      return { success: resJson.status === "success", isLive: true, data: resJson.data || incidentData };
    } catch (err) {
      console.warn("GAS Update failed, cached locally:", err);
      return { success: true, isLive: false, fallbackSaved: true, data: incidentData };
    }
  };

  /**
   * ลบรายการความผิดพลาด
   */
  const deleteIncident = async (id, adminToken) => {
    const url = getGasUrl();
    const token = adminToken || getAdminToken();

    // ลบจาก Cache
    let cachedIncidents = JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || "null") || DEFAULT_INCIDENTS;
    cachedIncidents = cachedIncidents.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(cachedIncidents));

    if (!url) {
      return { success: true, isLive: false, id };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteIncident",
          id: id,
          adminToken: token
        })
      });

      const resJson = await response.json();
      if (resJson.status === "success") {
        return { success: true, isLive: true, id, code: resJson.code };
      }
      return {
        success: false,
        isLive: true,
        id,
        code: resJson.code || "ERROR",
        message: resJson.message || "ลบไม่สำเร็จ"
      };
    } catch (err) {
      console.warn("GAS Delete failed:", err);
      return { success: true, isLive: false, fallbackSaved: true, id };
    }
  };

  /**
   * ยืนยันตัวตน Admin ฝั่งเซิร์ฟเวอร์ (Google Apps Script)
   * คืน { success, token, server, message }
   */
  const verifyAdminPin = async (pin) => {
    const url = getGasUrl();

    // โหมดออฟไลน์: ตรวจด้วย client-side hash (Store) แล้วออก Token จำลอง
    if (!url) {
      try {
        const ok = await Store.verifyAdminPin(pin);
        if (ok) {
          const tok = "local-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
          setAdminToken(tok);
        }
        return {
          success: ok,
          token: ok ? getAdminToken() : null,
          server: false,
          message: ok ? "เข้าสู่ระบบ Admin สำเร็จ (โหมดออฟไลน์)" : "รหัส PIN ไม่ถูกต้อง"
        };
      } catch (err) {
        return { success: false, token: null, server: false, message: err.message };
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "verifyAdminPin", pin: pin })
      });
      const resJson = await response.json();
      if (resJson.status === "success" && resJson.token) {
        setAdminToken(resJson.token);
        return { success: true, token: resJson.token, server: true, message: resJson.message || "เข้าสู่ระบบ Admin สำเร็จ" };
      }
      return { success: false, token: null, server: true, message: resJson.message || "รหัส PIN ไม่ถูกต้อง" };
    } catch (err) {
      console.warn("GAS verifyAdminPin failed:", err);
      return { success: false, token: null, server: true, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + err.message };
    }
  };

  /**
   * เปลี่ยนรหัส PIN ฝั่งเซิร์ฟเวอร์
   * คืน { success, token, server, message }
   */
  const changeAdminPin = async (currentPin, newPin) => {
    const url = getGasUrl();

    if (!url) {
      try {
        const ok = await Store.verifyAdminPin(currentPin);
        if (!ok) return { success: false, token: null, server: false, message: "รหัส PIN ปัจจุบันไม่ถูกต้อง" };
        await Store.setAdminPin(newPin);
        const tok = "local-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        setAdminToken(tok);
        return { success: true, token: tok, server: false, message: "เปลี่ยนรหัส PIN เรียบร้อย (โหมดออฟไลน์)" };
      } catch (err) {
        return { success: false, token: null, server: false, message: err.message };
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "changeAdminPin", currentPin: currentPin, newPin: newPin, adminToken: getAdminToken() })
      });
      const resJson = await response.json();
      if (resJson.status === "success" && resJson.token) {
        setAdminToken(resJson.token);
        return { success: true, token: resJson.token, server: true, message: resJson.message || "เปลี่ยนรหัส PIN เรียบร้อย" };
      }
      return { success: false, token: null, server: true, message: resJson.message || "เปลี่ยนรหัส PIN ไม่สำเร็จ" };
    } catch (err) {
      return { success: false, token: null, server: true, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + err.message };
    }
  };

  /**
   * เพิ่มพนักงานใหม่ในชีต "รายชื่อพนักงาน"
   */
  const addEmployee = async (empData) => {
    const url = getGasUrl();
    const cachedEmployees = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEES) || "null") || DEFAULT_EMPLOYEES;
    cachedEmployees.push(empData);
    localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(cachedEmployees));

    if (!url) {
      return { success: true, isLive: false, data: empData };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "addEmployee",
          data: empData
        })
      });
      const resJson = await response.json();
      return { success: resJson.status === "success", isLive: true, data: resJson.data || empData };
    } catch (err) {
      return { success: true, isLive: false, data: empData };
    }
  };

  return {
    getGasUrl,
    setGasUrl,
    fetchAllData,
    submitIncident,
    updateIncident,
    deleteIncident,
    addEmployee,
    verifyAdminPin,
    changeAdminPin,
    getAdminToken,
    clearAdminToken,
    DEFAULT_EMPLOYEES,
    DEFAULT_INCIDENTS
  };
})();
