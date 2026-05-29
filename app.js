const EMPLOYEE_STORAGE_KEY = "coffeeAttendanceEmployees";
const RECORD_STORAGE_KEY = "coffeeAttendanceRecords";
const OWNER_PASSCODE = "1111";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJPWbtaYP1EbNzNuIAxivWQiCSV02uBE3h6mgA0mu23SVDGB8P1wnzalPJHtBAMaf12w/exec";
const USE_GOOGLE_SHEET = true;
const SHOP_LOCATION = {
  latitude: 15.018154,
  longitude: 102.410922,
  allowedRadiusMeters: 500
};
const DEFAULT_EMPLOYEES = ["แน็ค", "แป้ง", "แก้ม", "เมย์", "Rider1"];

const state = {
  activeTab: "checkIn",
  ownerMode: "add",
  employees: [],
  toastTimer: null
};

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  forms: document.querySelectorAll(".attendance-form"),
  checkInEmployee: document.getElementById("checkInEmployee"),
  checkOutEmployee: document.getElementById("checkOutEmployee"),
  oldEmployeeName: document.getElementById("oldEmployeeName"),
  ownerModeButtons: document.querySelectorAll(".owner-mode-button"),
  addEmployeeFields: document.getElementById("addEmployeeFields"),
  renameEmployeeFields: document.getElementById("renameEmployeeFields"),
  deleteEmployeeFields: document.getElementById("deleteEmployeeFields"),
  newEmployeeToAdd: document.getElementById("newEmployeeToAdd"),
  employeeToDelete: document.getElementById("employeeToDelete"),
  ownerSubmitButton: document.getElementById("ownerSubmitButton"),
  ownerModal: document.getElementById("ownerModal"),
  openOwnerModal: document.getElementById("openOwnerModal"),
  closeOwnerModal: document.getElementById("closeOwnerModal"),
  ownerForm: document.getElementById("ownerForm"),
  recordsList: document.getElementById("recordsList"),
  todayLabel: document.getElementById("todayLabel"),
  toast: document.getElementById("toast")
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  state.employees = getEmployees();
  renderEmployeeOptions();
  renderTodayRecords();
  bindEvents();
  loadInitialDataFromGoogleSheet();
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  elements.forms.forEach((form) => {
    form.addEventListener("submit", handleAttendanceSubmit);
  });

  elements.ownerModeButtons.forEach((button) => {
    button.addEventListener("click", () => setOwnerMode(button.dataset.ownerMode));
  });

  elements.openOwnerModal.addEventListener("click", openOwnerModal);
  elements.closeOwnerModal.addEventListener("click", closeOwnerModal);
  elements.ownerModal.addEventListener("click", (event) => {
    if (event.target === elements.ownerModal) {
      closeOwnerModal();
    }
  });
  elements.ownerForm.addEventListener("submit", handleOwnerSubmit);
}

function switchTab(tabName) {
  state.activeTab = tabName;

  elements.tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  elements.forms.forEach((form) => {
    form.classList.toggle("active", form.dataset.type === tabName);
  });
}

async function handleAttendanceSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const type = form.dataset.type;
  const employeeName = form.elements.employeeName.value.trim();
  const note = form.elements.note.value.trim();

  if (!employeeName) {
    showToast("กรุณาเลือกชื่อพนักงาน", "error");
    return;
  }

  const todayRecord = getTodayAttendanceRecord(employeeName);
  const isRepeatedCheckOut = type === "checkOut" && Boolean(todayRecord && todayRecord.checkOutTime);

  if (type === "checkIn" && todayRecord && todayRecord.checkInTime) {
    alert("วันนี้มีการเข้างานแล้ว");
    return;
  }

  if (type === "checkOut" && (!todayRecord || !todayRecord.checkInTime)) {
    alert("ยังไม่ได้เข้างานวันนี้ กรุณากดเข้างานก่อน");
    return;
  }

  if (isRepeatedCheckOut && !confirm("วันนี้มีเวลาออกงานแล้ว ต้องการอัปเดตเวลาออกงานใหม่ใช่ไหม?")) {
    return;
  }

  let locationInfo;

  try {
    showToast("กำลังตรวจสอบตำแหน่ง...");
    locationInfo = await checkShopLocation();
  } catch (error) {
    alert(getGeolocationErrorMessage(error));
    return;
  }

  if (locationInfo.locationStatus !== "IN_RANGE") {
    alert("คุณอยู่นอกพื้นที่ร้าน กรุณาเช็คอินเมื่ออยู่ใกล้ร้าน");
    return;
  }

  const confirmMessage = type === "checkIn"
    ? `ยืนยันเข้างานของ ${employeeName} ใช่ไหม?`
    : `ยืนยันออกงานของ ${employeeName} ใช่ไหม?`;

  if (!isRepeatedCheckOut && !confirm(confirmMessage)) {
    return;
  }

  const record = saveAttendanceRecord({ type, employeeName, note, locationInfo });
  form.elements.note.value = "";
  form.elements.employeeName.value = "";
  renderTodayRecords();
  showToast(type === "checkIn" ? "บันทึกเข้างานแล้ว" : "บันทึกออกงานแล้ว");
  syncAttendanceInBackground(record, type);
}

function saveAttendanceRecord({ type, employeeName, note, locationInfo }) {
  const records = getRecords();
  const now = new Date();
  const date = formatDate(now);
  const time = formatTime(now);
  const updatedAt = formatLocalDateTime(now);
  let savedRecord;
  const existingRecord = records.find((record) => {
    return record.date === date && record.employeeName === employeeName;
  });

  if (existingRecord) {
    const parsedNotes = parseCombinedNote(existingRecord.note);
    existingRecord.checkInNote = existingRecord.checkInNote || parsedNotes.checkInNote;
    existingRecord.checkOutNote = existingRecord.checkOutNote || parsedNotes.checkOutNote;

    if (type === "checkIn") {
      existingRecord.checkInTime = time;
      existingRecord.checkInNote = note;
    } else {
      existingRecord.checkOutTime = time;
      existingRecord.checkOutNote = note;
    }

    existingRecord.note = buildCombinedNote(
      existingRecord.checkInNote,
      existingRecord.checkOutNote
    );
    existingRecord.updatedAt = updatedAt;
    applyLocationInfo(existingRecord, locationInfo);
    savedRecord = existingRecord;
  } else {
    const checkInNote = type === "checkIn" ? note : "";
    const checkOutNote = type === "checkOut" ? note : "";

    savedRecord = {
      date,
      employeeName,
      checkInTime: type === "checkIn" ? time : "",
      checkOutTime: type === "checkOut" ? time : "",
      checkInNote,
      checkOutNote,
      note: buildCombinedNote(checkInNote, checkOutNote),
      updatedAt,
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      accuracy: locationInfo.accuracy,
      distanceFromShop: locationInfo.distanceFromShop,
      locationStatus: locationInfo.locationStatus
    };
    records.push(savedRecord);
  }

  saveRecords(records);
  return { ...savedRecord };
}

function buildCombinedNote(checkInNote, checkOutNote) {
  const parts = [];

  const cleanCheckInNote = String(checkInNote || "").trim();
  const cleanCheckOutNote = String(checkOutNote || "").trim();

  if (cleanCheckInNote) {
    parts.push(`เข้างาน: ${cleanCheckInNote}`);
  }

  if (cleanCheckOutNote) {
    parts.push(`ออกงาน: ${cleanCheckOutNote}`);
  }

  return parts.join("\n");
}

function applyLocationInfo(record, locationInfo) {
  if (!locationInfo) {
    return;
  }

  record.latitude = locationInfo.latitude;
  record.longitude = locationInfo.longitude;
  record.accuracy = locationInfo.accuracy;
  record.distanceFromShop = locationInfo.distanceFromShop;
  record.locationStatus = locationInfo.locationStatus;
}

async function checkShopLocation() {
  const position = await getCurrentPosition();
  const distanceFromShop = calculateDistanceMeters(
    position.coords.latitude,
    position.coords.longitude,
    SHOP_LOCATION.latitude,
    SHOP_LOCATION.longitude
  );

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy || 0),
    distanceFromShop: Math.round(distanceFromShop),
    locationStatus: distanceFromShop <= SHOP_LOCATION.allowedRadiusMeters
      ? "IN_RANGE"
      : "OUT_OF_RANGE"
  };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("เบราว์เซอร์นี้ไม่รองรับการตรวจสอบตำแหน่ง"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

function getGeolocationErrorMessage(error) {
  if (error && error.code === error.PERMISSION_DENIED) {
    return "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อเช็คเข้า-ออกงาน";
  }

  if (error && error.code === error.POSITION_UNAVAILABLE) {
    return "ตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  if (error && error.code === error.TIMEOUT) {
    return "ตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  return "ตรวจสอบตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCombinedNote(note) {
  const result = {
    checkInNote: "",
    checkOutNote: ""
  };

  String(note || "").split("\n").forEach((line) => {
    const cleanLine = line.trim();

    if (cleanLine.startsWith("เข้างาน:")) {
      result.checkInNote = cleanLine.replace("เข้างาน:", "").trim();
    }

    if (cleanLine.startsWith("ออกงาน:")) {
      result.checkOutNote = cleanLine.replace("ออกงาน:", "").trim();
    }
  });

  return result;
}

async function apiPost(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
  }

  return data;
}

async function apiGet(action) {
  const url = `${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
  }

  return data;
}

function shouldUseGoogleSheet() {
  return USE_GOOGLE_SHEET && APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "PASTE_WEB_APP_URL_HERE";
}

async function loadInitialDataFromGoogleSheet() {
  if (!shouldUseGoogleSheet()) {
    return;
  }

  try {
    const data = await apiGet("getInitialData");

    if (Array.isArray(data.employees) && data.employees.length) {
      state.employees = data.employees;
      localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(state.employees));
      renderEmployeeOptions();
    }

    if (Array.isArray(data.todayRecords)) {
      replaceTodayRecords(data.todayRecords);
      renderTodayRecords();
    }
  } catch (error) {
    showToast("เชื่อมต่อ Google Sheet ไม่สำเร็จ ใช้ข้อมูลในเครื่องชั่วคราว", "error");
  }
}

function syncAttendanceInBackground(record, type) {
  if (!shouldUseGoogleSheet()) {
    return;
  }

  const payload = {
    action: "saveAttendance",
    date: record.date,
    employeeName: record.employeeName,
    checkInTime: type === "checkIn" ? record.checkInTime : "",
    checkOutTime: type === "checkOut" ? record.checkOutTime : "",
    note: record.note,
    updatedAt: record.updatedAt,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    distanceFromShop: record.distanceFromShop,
    locationStatus: record.locationStatus
  };

  apiPost(payload).catch((error) => {
    if (error && error.message) {
      alert(error.message);
    }

    showToast("บันทึกในเครื่องแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ", "error");
  });
}

function syncEmployeeAddInBackground(employeeName, passcode) {
  if (!shouldUseGoogleSheet()) {
    return;
  }

  apiPost({
    action: "addEmployee",
    passcode,
    employeeName
  }).catch(() => {
    showToast("บันทึกในเครื่องแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ", "error");
  });
}

function syncEmployeeRenameInBackground(oldEmployeeName, newEmployeeName, passcode) {
  if (!shouldUseGoogleSheet()) {
    return;
  }

  apiPost({
    action: "renameEmployee",
    passcode,
    oldEmployeeName,
    newEmployeeName
  }).catch(() => {
    showToast("บันทึกในเครื่องแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ", "error");
  });
}

function syncEmployeeDeleteInBackground(employeeName, passcode) {
  if (!shouldUseGoogleSheet()) {
    return;
  }

  apiPost({
    action: "deleteEmployee",
    passcode,
    employeeName
  }).catch(() => {
    showToast("ลบในเครื่องแล้ว แต่ซิงก์ Google Sheet ไม่สำเร็จ", "error");
    loadInitialDataFromGoogleSheet();
  });
}

function replaceTodayRecords(todayRecords) {
  const today = formatDate(new Date());
  const otherRecords = getRecords().filter((record) => record.date !== today);
  const normalizedTodayRecords = todayRecords.map(normalizeAttendanceRecord);
  saveRecords([...otherRecords, ...normalizedTodayRecords]);
}

function normalizeAttendanceRecord(record) {
  const parsedNotes = parseCombinedNote(record.note);
  const checkInNote = record.checkInNote || parsedNotes.checkInNote;
  const checkOutNote = record.checkOutNote || parsedNotes.checkOutNote;
  const note = record.note || buildCombinedNote(checkInNote, checkOutNote);

  return {
    date: record.date || "",
    employeeName: record.employeeName || "",
    checkInTime: record.checkInTime || "",
    checkOutTime: record.checkOutTime || "",
    checkInNote,
    checkOutNote,
    note,
    updatedAt: record.updatedAt || "",
    latitude: record.latitude || "",
    longitude: record.longitude || "",
    accuracy: record.accuracy || "",
    distanceFromShop: record.distanceFromShop || "",
    locationStatus: record.locationStatus || ""
  };
}

function handleOwnerSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const passcode = form.elements.ownerPasscode.value.trim();

  if (!passcode) {
    alert("กรุณาใส่รหัสเจ้าของร้าน");
    return;
  }

  if (passcode !== OWNER_PASSCODE) {
    alert("รหัสเจ้าของร้านไม่ถูกต้อง กรุณากรอกใหม่อีกครั้ง");
    return;
  }

  if (state.ownerMode === "add") {
    addEmployee(form, passcode);
    return;
  }

  if (state.ownerMode === "delete") {
    removeEmployee(form, passcode);
    return;
  }

  renameEmployee(form, passcode);
}

function addEmployee(form, passcode) {
  const newName = normalizeEmployeeName(form.elements.newEmployeeToAdd.value);

  if (!newName) {
    showToast("กรุณากรอกชื่อพนักงานใหม่", "error");
    return;
  }

  if (employeeNameExists(newName)) {
    alert("มีชื่อพนักงานนี้อยู่แล้ว");
    return;
  }

  state.employees = [...state.employees, newName];
  saveEmployees();
  renderEmployeeOptions();
  closeOwnerModal();
  showToast("เพิ่มพนักงานแล้ว");
  syncEmployeeAddInBackground(newName, passcode);
}

function renameEmployee(form, passcode) {
  const oldName = form.elements.oldEmployeeName.value;
  const newName = normalizeEmployeeName(form.elements.newEmployeeName.value);

  if (!oldName || !newName) {
    showToast("กรุณาเลือกชื่อเดิมและกรอกชื่อใหม่", "error");
    return;
  }

  if (employeeNameExists(newName, oldName)) {
    alert("มีชื่อพนักงานนี้อยู่แล้ว");
    return;
  }

  state.employees = state.employees.map((employee) => {
    return employee === oldName ? newName : employee;
  });

  saveEmployees();
  renderEmployeeOptions();
  closeOwnerModal();
  showToast("เปลี่ยนชื่อพนักงานแล้ว");
  syncEmployeeRenameInBackground(oldName, newName, passcode);
}

function removeEmployee(form, passcode) {
  const employeeName = form.elements.employeeToDelete.value;

  if (!employeeName) {
    showToast("กรุณาเลือกพนักงานที่ต้องการลบ", "error");
    return;
  }

  const confirmMessage = `ต้องการลบพนักงาน ${employeeName} ออกจากรายชื่อใช่ไหม?\nประวัติการเข้า-ออกงานเดิมจะยังคงอยู่`;

  if (!confirm(confirmMessage)) {
    return;
  }

  deleteEmployee(employeeName);
  closeOwnerModal();
  showToast("ลบพนักงานแล้ว");
  syncEmployeeDeleteInBackground(employeeName, passcode);
}

function deleteEmployee(employeeName) {
  const target = normalizeEmployeeName(employeeName);
  state.employees = state.employees.filter((employee) => {
    return normalizeEmployeeName(employee) !== target;
  });
  saveEmployees();
  renderEmployeeOptions();
  renderTodayRecords();
}

function openOwnerModal() {
  elements.ownerModal.classList.add("open");
  elements.ownerModal.setAttribute("aria-hidden", "false");
  elements.ownerForm.reset();
  setOwnerMode("add");
  elements.ownerForm.elements.ownerPasscode.focus();
}

function closeOwnerModal() {
  elements.ownerModal.classList.remove("open");
  elements.ownerModal.setAttribute("aria-hidden", "true");
  elements.ownerForm.reset();
}

function setOwnerMode(mode) {
  state.ownerMode = ["add", "rename", "delete"].includes(mode) ? mode : "add";

  elements.ownerModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.ownerMode === state.ownerMode);
  });

  elements.addEmployeeFields.hidden = state.ownerMode !== "add";
  elements.renameEmployeeFields.hidden = state.ownerMode !== "rename";
  elements.deleteEmployeeFields.hidden = state.ownerMode !== "delete";
  elements.ownerSubmitButton.classList.toggle("button-danger", state.ownerMode === "delete");

  if (state.ownerMode === "add") {
    elements.ownerSubmitButton.textContent = "เพิ่มพนักงาน";
    return;
  }

  elements.ownerSubmitButton.textContent = state.ownerMode === "rename"
    ? "บันทึกชื่อใหม่"
    : "ลบพนักงาน";
}

function renderEmployeeOptions() {
  const selects = [
    elements.checkInEmployee,
    elements.checkOutEmployee,
    elements.oldEmployeeName,
    elements.employeeToDelete
  ];

  selects.forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">เลือกชื่อพนักงาน</option>';

    state.employees.forEach((employee) => {
      const option = document.createElement("option");
      option.value = employee;
      option.textContent = employee;
      select.appendChild(option);
    });

    if (state.employees.includes(currentValue)) {
      select.value = currentValue;
    }
  });
}

function renderTodayRecords() {
  const today = formatDate(new Date());
  const todayRecords = getRecords()
    .filter((record) => record.date === today)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "th"));

  elements.todayLabel.textContent = today;
  elements.recordsList.innerHTML = "";

  if (!todayRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "ยังไม่มีรายการวันนี้";
    elements.recordsList.appendChild(empty);
    return;
  }

  todayRecords.forEach((record) => {
    const item = document.createElement("article");
    item.className = "record-item";
    item.innerHTML = `
      <div class="record-name">${escapeHtml(record.employeeName)}</div>
      <div class="record-grid">
        <div class="record-meta">
          <small>เวลาเข้า</small>
          <strong>${escapeHtml(record.checkInTime || "-")}</strong>
        </div>
        <div class="record-meta">
          <small>เวลาออก</small>
          <strong>${escapeHtml(record.checkOutTime || "-")}</strong>
        </div>
      </div>
      <div class="record-note">${escapeHtml(record.note || "ไม่มี note")}</div>
      ${renderLocationSummary(record)}
    `;
    elements.recordsList.appendChild(item);
  });
}

function renderLocationSummary(record) {
  if (!record.locationStatus) {
    return "";
  }

  const statusText = record.locationStatus === "IN_RANGE"
    ? "อยู่ในพื้นที่ร้าน"
    : "อยู่นอกพื้นที่ร้าน";
  const hasDistance = record.distanceFromShop !== "" &&
    record.distanceFromShop !== undefined &&
    record.distanceFromShop !== null;
  const distanceText = hasDistance
    ? ` · ${escapeHtml(record.distanceFromShop)} ม.`
    : "";

  return `<div class="record-location">ตำแหน่ง: ${statusText}${distanceText}</div>`;
}

function getEmployees() {
  const savedEmployees = readJson(EMPLOYEE_STORAGE_KEY);

  if (Array.isArray(savedEmployees) && savedEmployees.length) {
    return savedEmployees;
  }

  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
  return [...DEFAULT_EMPLOYEES];
}

function getRecords() {
  const records = readJson(RECORD_STORAGE_KEY);
  return Array.isArray(records) ? records : [];
}

function getTodayAttendanceRecord(employeeName) {
  const today = formatDate(new Date());
  return getRecords().find((record) => {
    return record.date === today && record.employeeName === employeeName;
  });
}

function saveRecords(records) {
  localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));
}

function saveEmployees() {
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(state.employees));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function normalizeEmployeeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function employeeNameExists(name, excludeName = "") {
  const target = normalizeEmployeeName(name);
  const exclude = normalizeEmployeeName(excludeName);

  return state.employees.some((employee) => {
    const current = normalizeEmployeeName(employee);
    return current === target && current !== exclude;
  });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatLocalDateTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${formatDate(date)}T${hours}:${minutes}:${seconds}`;
}

function showToast(message, type = "success") {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", type === "error");
  elements.toast.classList.add("show");

  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
