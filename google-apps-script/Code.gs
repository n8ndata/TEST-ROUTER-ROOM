/**
 * =========================================================================
 * ROUTER Department - Error Tracking & Incident Management System
 * Google Apps Script Web App Backend
 * แผนก ROUTER: ระบบบันทึกและติดตามข้อผิดพลาดในการปฏิบัติงานของพนักงาน
 * =========================================================================
 */

// ชื่อแผ่นงานหลัก (ต้องตรงกับที่กำหนดในระบบ)
const SHEET_EMPLOYEES = "รายชื่อพนักงาน";
const SHEET_INCIDENTS = "บันทึกความผิดพลาด";
const SHEET_SETTINGS = "ตั้งค่าระบบ";

// ===== ความปลอดภัยของโหมด Admin (Server-side) =====
// PIN จะถูกแฮชด้วย SHA-256 แล้วเก็บใน Script Properties (ฝั่งเซิร์ฟเวอร์)
// ไม่ส่ง/เก็บ PIN เป็นข้อความดิบในเบราว์เซอร์หรือใน Google Sheet
const ADMIN_PIN_PROP_KEY = "ADMIN_PIN_HASH";
const ADMIN_PIN_SALT = "router-admin-server::";
const ADMIN_SESSION_PREFIX = "admin_session_";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // Token มีอายุ 8 ชั่วโมง

/**
 * ฟังก์ชันรับคำขอแบบ GET (อ่านข้อมูล)
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "getAll";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ตรวจสอบและสร้างชีตอัตโนมัติหากยังไม่มี
    ensureSheetsExist(ss);

    let result = {};

    if (action === "getEmployees") {
      result = {
        status: "success",
        data: getEmployeesData(ss)
      };
    } else if (action === "getIncidents") {
      result = {
        status: "success",
        data: getIncidentsData(ss)
      };
    } else {
      // ดึงข้อมูลทั้งหมดในครั้งเดียวเพื่อความเร็วสูงสุด
      result = {
        status: "success",
        timestamp: new Date().toISOString(),
        employees: getEmployeesData(ss),
        incidents: getIncidentsData(ss),
        categories: getCategoriesList(),
        machines: getMachinesList()
      };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันรับคำขอแบบ POST (บันทึก / อัพเดท / ลบข้อมูล)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // รอคิวไม่เกิน 30 วินาที ป้องกันบันทึกพร้อมกันชนกัน
  lock.tryLock(30000);

  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "addIncident";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist(ss);

    let response = { status: "success" };

    if (action === "addIncident") {
      response.data = addIncidentRow(ss, payload.data || payload);
    } else if (action === "updateIncident") {
      response.data = updateIncidentRow(ss, payload.data || payload);
    } else if (action === "deleteIncident") {
      // ต้องมี Token ของ Admin ที่ยืนยันแล้วจากเซิร์ฟเวอร์เท่านั้น
      if (!validateAdminToken(payload.adminToken)) {
        response.status = "error";
        response.code = "UNAUTHORIZED";
        response.message = "ไม่มีสิทธิ์ลบข้อมูล (Token ไม่ถูกต้องหรือหมดอายุ) — กรุณายืนยันตัวตน Admin ใหม่";
      } else {
        response.data = deleteIncidentRow(ss, payload.id || (payload.data && payload.data.id));
      }
    } else if (action === "addEmployee") {
      response.data = addEmployeeRow(ss, payload.data || payload);
    } else if (action === "updateEmployee") {
      response.data = updateEmployeeRow(ss, payload.data || payload);
    } else if (action === "verifyAdminPin") {
      // ตรวจสอบ PIN ฝั่งเซิร์ฟเวอร์: เปรียบเทียบแฮช ไม่ส่ง PIN กลับ
      const pin = (payload.pin !== undefined && payload.pin !== null) ? payload.pin.toString() : "";
      if (hashPinServer(pin) === getStoredAdminPinHash()) {
        response.token = issueAdminToken();
        response.message = "เข้าสู่ระบบ Admin สำเร็จ";
      } else {
        response.status = "error";
        response.message = "รหัส PIN ไม่ถูกต้อง";
      }
    } else if (action === "changeAdminPin") {
      const currentPin = (payload.currentPin !== undefined && payload.currentPin !== null) ? payload.currentPin.toString() : "";
      const newPin = (payload.newPin !== undefined && payload.newPin !== null) ? payload.newPin.toString().trim() : "";
      if (hashPinServer(currentPin) !== getStoredAdminPinHash()) {
        response.status = "error";
        response.message = "รหัส PIN ปัจจุบันไม่ถูกต้อง";
      } else if (!/^\d{4}$/.test(newPin)) {
        response.status = "error";
        response.message = "รหัส PIN ใหม่ต้องเป็นตัวเลข 4 หลัก";
      } else {
        PropertiesService.getScriptProperties().setProperty(ADMIN_PIN_PROP_KEY, hashPinServer(newPin));
        if (payload.adminToken) revokeAdminToken(payload.adminToken);
        response.token = issueAdminToken();
        response.message = "เปลี่ยนรหัส PIN เรียบร้อยแล้ว";
      }
    } else {
      throw new Error("Invalid action: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ===== ความปลอดภัยของโหมด Admin (Server-side helpers) =====
 * แฮช PIN ด้วย SHA-256 + Salt — เก็บใน Script Properties เท่านั้น
 */
function hashPinServer(pin) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ADMIN_PIN_SALT + (pin === null || pin === undefined ? "" : pin), Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    return ("0" + (b & 0xFF).toString(16)).slice(-2);
  }).join("");
}

function getStoredAdminPinHash() {
  const props = PropertiesService.getScriptProperties();
  let hash = props.getProperty(ADMIN_PIN_PROP_KEY);
  if (!hash) {
    // ค่าเริ่มต้น: PIN 1234 (ถูกแฮชแล้ว) — เซ็ตครั้งแรกเท่านั้น
    hash = hashPinServer("1234");
    props.setProperty(ADMIN_PIN_PROP_KEY, hash);
  }
  return hash;
}

function issueAdminToken() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(ADMIN_SESSION_PREFIX + token, "1", ADMIN_SESSION_TTL_SECONDS);
  return token;
}

function validateAdminToken(token) {
  if (!token) return false;
  try {
    return CacheService.getScriptCache().get(ADMIN_SESSION_PREFIX + token) === "1";
  } catch (e) {
    return false;
  }
}

function revokeAdminToken(token) {
  if (token) {
    try { CacheService.getScriptCache().remove(ADMIN_SESSION_PREFIX + token); } catch (e) { /* ignore */ }
  }
}

/**
 * ตรวจสอบและสร้างโครงสร้างชีตพร้อมหัวตารางหากยังไม่มี
 */
function ensureSheetsExist(ss) {
  // 1. ชีต "รายชื่อพนักงาน"
  let empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) {
    empSheet = ss.insertSheet(SHEET_EMPLOYEES);
    const headers = ["รหัสพนักงาน", "คำนำหน้า", "ชื่อ-นามสกุล", "ตำแหน่ง", "กะการทำงาน", "เบอร์โทรศัพท์", "สถานะการทำงาน"];
    empSheet.appendRow(headers);
    formatHeaderRow(empSheet, "#1e3a8a"); // Navy Blue
    seedInitialEmployees(empSheet);
  }

  // 2. ชีต "บันทึกความผิดพลาด"
  let incSheet = ss.getSheetByName(SHEET_INCIDENTS);
  if (!incSheet) {
    incSheet = ss.insertSheet(SHEET_INCIDENTS);
    const headers = [
      "ID",
      "วันที่-เวลาบันทึก",
      "วันที่เกิดเหตุ",
      "รหัสพนักงาน",
      "ชื่อพนักงาน",
      "กะการทำงาน",
      "หมายเลขเครื่อง Router",
      "ชื่องาน / Part No.",
      "ประเภทความผิดพลาด",
      "รายละเอียดเหตุการณ์",
      "ระดับความรุนแรง",
      "ผลกระทบ/ของเสีย (ชิ้น/บาท)",
      "สาเหตุเบื้องต้น",
      "แนวทางแก้ไขและป้องกัน",
      "ผู้บันทึก",
      "สถานะการแก้ไข",
      "หมายเหตุ"
    ];
    incSheet.appendRow(headers);
    formatHeaderRow(incSheet, "#0f766e"); // Teal
    seedInitialIncidents(incSheet);
  }
}

/**
 * ดึงข้อมูลพนักงานจากชีต "รายชื่อพนักงาน"
 */
function getEmployeesData(ss) {
  const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return values
    .filter(row => row[0] && row[0].toString().trim() !== "")
    .map(row => ({
      empId: row[0].toString().trim(),
      prefix: row[1] ? row[1].toString().trim() : "",
      fullName: row[2] ? row[2].toString().trim() : "",
      position: row[3] ? row[3].toString().trim() : "พนักงานควบคุมเครื่อง",
      shift: row[4] ? row[4].toString().trim() : "กะเช้า",
      phone: row[5] ? row[5].toString().trim() : "-",
      status: row[6] ? row[6].toString().trim() : "ปฏิบัติงานปกติ"
    }));
}

/**
 * ดึงข้อมูลข้อผิดพลาดจากชีต "บันทึกความผิดพลาด"
 */
function getIncidentsData(ss) {
  const sheet = ss.getSheetByName(SHEET_INCIDENTS);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  return values
    .filter(row => row[0] && row[0].toString().trim() !== "")
    .map(row => {
      // จัดการวันที่ให้อยู่ในรูปแบบ ISO หรือ String ชัดเจน
      let recordDate = row[1];
      if (recordDate instanceof Date) {
        recordDate = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      }
      let incidentDate = row[2];
      if (incidentDate instanceof Date) {
        incidentDate = Utilities.formatDate(incidentDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }

      return {
        id: row[0].toString().trim(),
        timestamp: recordDate ? recordDate.toString() : "",
        incidentDate: incidentDate ? incidentDate.toString() : "",
        empId: row[3] ? row[3].toString().trim() : "",
        empName: row[4] ? row[4].toString().trim() : "",
        shift: row[5] ? row[5].toString().trim() : "",
        machine: row[6] ? row[6].toString().trim() : "",
        partNo: row[7] ? row[7].toString().trim() : "",
        category: row[8] ? row[8].toString().trim() : "",
        description: row[9] ? row[9].toString().trim() : "",
        severity: row[10] ? row[10].toString().trim() : "ปานกลาง",
        impact: row[11] ? row[11].toString().trim() : "-",
        rootCause: row[12] ? row[12].toString().trim() : "",
        correctiveAction: row[13] ? row[13].toString().trim() : "",
        reporter: row[14] ? row[14].toString().trim() : "",
        status: row[15] ? row[15].toString().trim() : "รอดำเนินการ",
        notes: row[16] ? row[16].toString().trim() : ""
      };
    }).reverse(); // ให้ข้อมูลล่าสุดอยู่บนสุด
}

/**
 * เพิ่มบันทึกข้อผิดพลาดใหม่
 */
function addIncidentRow(ss, item) {
  const sheet = ss.getSheetByName(SHEET_INCIDENTS);
  if (!sheet) throw new Error("ไม่พบชีต: " + SHEET_INCIDENTS);

  // สร้าง ID ประจำรายการ
  const now = new Date();
  const datePrefix = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = item.id || `RT-${datePrefix}-${randomSuffix}`;
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  const rowData = [
    id,
    timestamp,
    item.incidentDate || Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    item.empId || "",
    item.empName || "",
    item.shift || "กะเช้า",
    item.machine || "",
    item.partNo || "",
    item.category || "อื่นๆ",
    item.description || "",
    item.severity || "ปานกลาง",
    item.impact || "-",
    item.rootCause || "",
    item.correctiveAction || "",
    item.reporter || "Admin",
    item.status || "รอดำเนินการ",
    item.notes || ""
  ];

  sheet.appendRow(rowData);

  return {
    id: id,
    timestamp: timestamp,
    ...item
  };
}

/**
 * แก้ไขบันทึกข้อผิดพลาด
 */
function updateIncidentRow(ss, item) {
  const sheet = ss.getSheetByName(SHEET_INCIDENTS);
  if (!sheet) throw new Error("ไม่พบชีต: " + SHEET_INCIDENTS);

  const idToFind = item.id;
  if (!idToFind) throw new Error("ไม่ได้ระบุ ID สำหรับการแก้ไข");

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("ไม่มีข้อมูลในตาราง");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let targetRow = -1;

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim() === idToFind.toString().trim()) {
      targetRow = i + 2; // +2 เพราะเริ่มจากแถว 2 ใน spreadsheet
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error("ไม่พบรายการ ID: " + idToFind);
  }

  // อัพเดทข้อมูลตามตำแหน่งคอลัมน์
  if (item.incidentDate !== undefined) sheet.getRange(targetRow, 3).setValue(item.incidentDate);
  if (item.empId !== undefined) sheet.getRange(targetRow, 4).setValue(item.empId);
  if (item.empName !== undefined) sheet.getRange(targetRow, 5).setValue(item.empName);
  if (item.shift !== undefined) sheet.getRange(targetRow, 6).setValue(item.shift);
  if (item.machine !== undefined) sheet.getRange(targetRow, 7).setValue(item.machine);
  if (item.partNo !== undefined) sheet.getRange(targetRow, 8).setValue(item.partNo);
  if (item.category !== undefined) sheet.getRange(targetRow, 9).setValue(item.category);
  if (item.description !== undefined) sheet.getRange(targetRow, 10).setValue(item.description);
  if (item.severity !== undefined) sheet.getRange(targetRow, 11).setValue(item.severity);
  if (item.impact !== undefined) sheet.getRange(targetRow, 12).setValue(item.impact);
  if (item.rootCause !== undefined) sheet.getRange(targetRow, 13).setValue(item.rootCause);
  if (item.correctiveAction !== undefined) sheet.getRange(targetRow, 14).setValue(item.correctiveAction);
  if (item.reporter !== undefined) sheet.getRange(targetRow, 15).setValue(item.reporter);
  if (item.status !== undefined) sheet.getRange(targetRow, 16).setValue(item.status);
  if (item.notes !== undefined) sheet.getRange(targetRow, 17).setValue(item.notes);

  return item;
}

/**
 * ลบบันทึกข้อผิดพลาด
 */
function deleteIncidentRow(ss, id) {
  const sheet = ss.getSheetByName(SHEET_INCIDENTS);
  if (!sheet) throw new Error("ไม่พบชีต: " + SHEET_INCIDENTS);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("ไม่มีข้อมูลในตาราง");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim() === id.toString().trim()) {
      sheet.deleteRow(i + 2);
      return { success: true, deletedId: id };
    }
  }

  throw new Error("ไม่พบรายการที่ต้องการลบ ID: " + id);
}

/**
 * เพิ่มพนักงานใหม่ในชีต "รายชื่อพนักงาน"
 */
function addEmployeeRow(ss, emp) {
  const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!sheet) throw new Error("ไม่พบชีต: " + SHEET_EMPLOYEES);

  const row = [
    emp.empId || "",
    emp.prefix || "",
    emp.fullName || "",
    emp.position || "พนักงานควบคุมเครื่อง Router",
    emp.shift || "กะเช้า",
    emp.phone || "-",
    emp.status || "ปฏิบัติงานปกติ"
  ];
  sheet.appendRow(row);
  return emp;
}

/**
 * อัพเดทพนักงาน
 */
function updateEmployeeRow(ss, emp) {
  const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!sheet) throw new Error("ไม่พบชีต: " + SHEET_EMPLOYEES);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("ไม่มีข้อมูลพนักงาน");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim() === emp.empId.toString().trim()) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow === -1) throw new Error("ไม่พบรหัสพนักงาน: " + emp.empId);

  if (emp.fullName) sheet.getRange(targetRow, 3).setValue(emp.fullName);
  if (emp.position) sheet.getRange(targetRow, 4).setValue(emp.position);
  if (emp.shift) sheet.getRange(targetRow, 5).setValue(emp.shift);
  if (emp.phone) sheet.getRange(targetRow, 6).setValue(emp.phone);
  if (emp.status) sheet.getRange(targetRow, 7).setValue(emp.status);

  return emp;
}

/**
 * รูปแบบหัวตารางสวยงาม
 */
function formatHeaderRow(sheet, bgColor) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground(bgColor)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontFamily("Sarabun")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
}

/**
 * รายการประเภทความผิดพลาดเริ่มต้น
 */
function getCategoriesList() {
  return [
    "ตั้งค่าโปรแกรม / G-Code ผิดพลาด (Wrong Program / Setup)",
    "ติดตั้งดอกเราเตอร์ผิดเบอร์ / สึกหรอ (Wrong / Worn Tool Bit)",
    "วางชิ้นงาน / จิ๊กไม่แน่น (Part Misalignment / Clamping)",
    "ตัดกินชิ้นงานเกินพิกัด (Over-cutting / Out of Spec)",
    "ลืมตรวจสอบ First Piece (First Article Inspection Missed)",
    "ป้อนรหัส Part Number หรือ Order ผิด (Wrong Part Entry)",
    "ระบบดูดฝุ่นอุดตัน / ชิ้นงานเป็นรอย (Vacuum Failure / Scratches)",
    "การละเลยความปลอดภัย / PPE (Safety Violation)",
    "ส่งมอบงานระหว่างกะคลาดเคลื่อน (Shift Handover Missed)",
    "อื่นๆ (Other)"
  ];
}

/**
 * รายการเครื่องจักร Router
 */
function getMachinesList() {
  return [
    "Router-01 (CNC Precision)",
    "Router-02 (CNC Precision)",
    "Router-03 (High Speed PCB)",
    "Router-04 (High Speed PCB)",
    "Router-05 (Heavy Duty)",
    "Router-06 (Heavy Duty)",
    "Router-07 (Laser/Hybrid)",
    "Router-08 (Sample/Prototype)"
  ];
}

/**
 * ข้อมูลเริ่มต้นตัวอย่างสำหรับชีต "รายชื่อพนักงาน"
 */
function seedInitialEmployees(sheet) {
  const sampleEmployees = [
    ["EMP-RT001", "นาย", "สมชาย กล้าหาญ", "หัวหน้าชุดช่าง Router", "กะเช้า", "081-234-5678", "ปฏิบัติงานปกติ"],
    ["EMP-RT002", "นางสาว", "วิภาวรรณ สดใส", "พนักงานควบคุมเครื่อง CNC", "กะเช้า", "082-345-6789", "ปฏิบัติงานปกติ"],
    ["EMP-RT003", "นาย", "ธนากร มุ่งมั่น", "พนักงานควบคุมเครื่อง Router", "กะบ่าย", "083-456-7890", "ปฏิบัติงานปกติ"],
    ["EMP-RT004", "นาย", "ณัฐพงษ์ ใจดี", "ช่างเซ็ตอัพเครื่องจักร (Setup Tech)", "กะบ่าย", "084-567-8901", "ปฏิบัติงานปกติ"],
    ["EMP-RT005", "นางสาว", "กัญญา สุขเกษม", "พนักงานตรวจสอบคุณภาพ (QC Router)", "กะดึก", "085-678-9012", "ปฏิบัติงานปกติ"],
    ["EMP-RT006", "นาย", "กิตติพงษ์ ศรีสุข", "พนักงานควบคุมเครื่อง Router", "กะดึก", "086-789-0123", "ปฏิบัติงานปกติ"],
    ["EMP-RT007", "นาย", "ปฏิภาณ วงศ์สว่าง", "พนักงานฝึกหัด", "กะเช้า", "087-890-1234", "ปฏิบัติงานปกติ"],
    ["EMP-RT008", "นาย", "วรวุฒิ บุญมี", "พนักงานควบคุมเครื่อง Router", "กะปกติ", "088-901-2345", "ปฏิบัติงานปกติ"]
  ];

  sampleEmployees.forEach(row => sheet.appendRow(row));
  sheet.autoResizeColumns(1, 7);
}

/**
 * ข้อมูลเริ่มต้นตัวอย่างสำหรับชีต "บันทึกความผิดพลาด"
 */
function seedInitialIncidents(sheet) {
  const sampleIncidents = [
    [
      "RT-20261025-1001",
      "2026-10-25 14:20:00",
      "2026-10-25",
      "EMP-RT003",
      "นาย ธนากร มุ่งมั่น",
      "กะบ่าย",
      "Router-03 (High Speed PCB)",
      "PCB-MB-8802",
      "ติดตั้งดอกเราเตอร์ผิดเบอร์ / สึกหรอ (Wrong / Worn Tool Bit)",
      "ใช้ดอกคัตเตอร์ขนาด 1.5mm แทนที่จะเป็น 1.2mm ทำให้ร่องตัดกว้างเกินแบบ",
      "สูง",
      "ของเสีย 15 แผ่น (~3,500 บาท)",
      "ไม่ได้ตรวจสอบเบอร์ที่กล่องดอกเราเตอร์ก่อนติดตั้ง",
      "เปลี่ยนดอกตามขนาดที่ถูกต้อง และเพิ่มขั้นตอน Double-Check ก่อนเดินเครื่อง",
      "สมชาย กล้าหาญ (หัวหน้าชุด)",
      "อบรมซ้ำแล้ว",
      "พนักงานยอมรับและปฏิบัติตามขั้นตอนตรวจสอบใหม่"
    ],
    [
      "RT-20261026-1002",
      "2026-10-26 08:45:00",
      "2026-10-26",
      "EMP-RT007",
      "นาย ปฏิภาณ วงศ์สว่าง",
      "กะเช้า",
      "Router-01 (CNC Precision)",
      "PN-FR4-552",
      "ลืมตรวจสอบ First Piece (First Article Inspection Missed)",
      "เริ่มรันชิ้นงานต่อเนื่องโดยไม่ได้ส่งชิ้นแรกให้ QC เซ็นรับรอง",
      "ปานกลาง",
      "ต้องนำมาคัดแยกใหม่ 50 ชิ้น เสียเวลา 40 นาที",
      "พนักงานใหม่เข้าใจว่ากะก่อนหน้าได้ตั้งเครื่องไว้เรียบร้อยแล้ว",
      "หัวหน้าตักเตือนและทบทวน SOP การตรวจสอบ First Piece ทุกครั้งที่เปิดเครื่อง",
      "วิภาวรรณ สดใส",
      "ปิดงาน",
      "QC ทำการตรวจชิ้นงานเรียบร้อย ผ่านเกณฑ์ 48 ชิ้น"
    ]
  ];

  sampleIncidents.forEach(row => sheet.appendRow(row));
  sheet.autoResizeColumns(1, 17);
}

/**
 * ฟังก์ชันสำหรับกดรัน 1 ครั้งเพื่อ Setup ระบบทั้งหมดให้พร้อมใช้งานทันที
 */
function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);
  Logger.log("ระบบพร้อมใช้งานแล้ว! มีแผ่นงาน 'รายชื่อพนักงาน' และ 'บันทึกความผิดพลาด'");
}
