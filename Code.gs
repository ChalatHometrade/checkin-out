const TIMEZONE = "Asia/Bangkok";
const OWNER_PASSCODE = "1111";
const LINE_CHANNEL_ACCESS_TOKEN = "2x88i+nULL4pVHWhbtmVCDekCB8fzFfCYbjHaVtQq79ZzOSO4Tt1m1EagPVxowdL1A1x0AoOW3i10ixsR9gw8D+2NYDPj18ishfM7VHumwjZN8kfIoc9S8O4onFu0HA/VOOXBAhQyWmo8/hX1p0CrAdB04t89/1O/w1cDnyilFU=";

const SHEET_NAMES = {
  ATTENDANCE: "Attendance",
  EMPLOYEES: "Employees",
  SETTINGS: "Settings"
};

const HEADERS = {
  ATTENDANCE: ["วันที่", "ชื่อพนักงาน", "เวลาเข้า", "เวลาออก", "note", "updatedAt", "latitude", "longitude", "accuracy", "distanceFromShop", "locationStatus"],
  EMPLOYEES: ["employeeName", "active", "updatedAt"],
  SETTINGS: ["key", "value", "updatedAt"]
};

const DEFAULT_EMPLOYEES = ["แน็ค", "แป้ง", "แก้ม", "เมย์", "Rider1"];
const SETTING_KEYS = {
  LINE_CHANNEL_ACCESS_TOKEN: "LINE_CHANNEL_ACCESS_TOKEN",
  LINE_OWNER_USER_ID: "LINE_OWNER_USER_ID",
  LINE_OWNER_USER_IDS: "LINE_OWNER_USER_IDS"
};

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "";

    if (action === "getInitialData") {
      return writeResponse({
        success: true,
        employees: readEmployees(),
        todayRecords: readTodayRecords()
      });
    }

    if (action === "getLineStatus") {
      return writeResponse(getLineStatus());
    }

    if (action === "testLineNotification") {
      return writeResponse(testLineNotification({
        passcode: e.parameter.passcode
      }));
    }

    throw new Error("ไม่พบ action ที่ต้องการ");
  } catch (error) {
    return writeResponse({
      success: false,
      error: error.message || String(error)
    });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");

    if (Array.isArray(payload.events)) {
      handleLineWebhook(payload);
      return writeLineWebhookOk();
    }

    const action = payload.action;

    if (!action) {
      return writeLineWebhookOk();
    }

    if (action === "getInitialData") {
      return writeResponse({
        success: true,
        employees: readEmployees(),
        todayRecords: readTodayRecords()
      });
    }

    if (action === "saveAttendance") {
      return writeResponse(saveAttendance(payload));
    }

    if (action === "addEmployee") {
      return writeResponse(addEmployee(payload));
    }

    if (action === "renameEmployee") {
      return writeResponse(renameEmployee(payload));
    }

    if (action === "deleteEmployee") {
      return writeResponse(deleteEmployee(payload));
    }

    if (action === "getLineStatus") {
      return writeResponse(getLineStatus());
    }

    if (action === "testLineNotification") {
      return writeResponse(testLineNotification(payload));
    }

    throw new Error("ไม่พบ action ที่ต้องการ");
  } catch (error) {
    return writeResponse({
      success: false,
      error: error.message || String(error)
    });
  }
}

function saveAttendance(payload) {
  const sheet = getOrCreateSheet(SHEET_NAMES.ATTENDANCE, HEADERS.ATTENDANCE);
  const headerMap = getHeaderMap(sheet);
  const date = normalizeText(payload.date || getTodayDateKey());
  const employeeName = normalizeText(payload.employeeName);
  const checkInTime = normalizeText(payload.checkInTime);
  const checkOutTime = normalizeText(payload.checkOutTime);
  const note = String(payload.note || "").trim();
  const updatedAt = normalizeText(payload.updatedAt || getTimestamp());
  const location = normalizeLocationPayload(payload);

  Logger.log("saveAttendance payload locationStatus: " + payload.locationStatus);
  Logger.log("saveAttendance payload distanceFromShop: " + payload.distanceFromShop);
  Logger.log("normalized location: " + JSON.stringify(location));

  if (!date) {
    throw new Error("กรุณาระบุวันที่");
  }

  if (!employeeName) {
    throw new Error("กรุณาระบุชื่อพนักงาน");
  }

  const row = findAttendanceRow(sheet, date, employeeName);
  let oldCheckOutTime = "";

  if (row) {
    const existingCheckInTime = formatSheetTime(sheet.getRange(row, headerMap["เวลาเข้า"]).getValue());
    const existingCheckOutTime = formatSheetTime(sheet.getRange(row, headerMap["เวลาออก"]).getValue());
    oldCheckOutTime = existingCheckOutTime;

    if (checkInTime) {
      if (existingCheckInTime) {
        throw new Error("วันนี้มีการเข้างานแล้ว");
      }

      sheet.getRange(row, headerMap["เวลาเข้า"]).setValue(checkInTime);
    }

    if (checkOutTime) {
      if (!existingCheckInTime) {
        throw new Error("ยังไม่ได้เข้างานวันนี้ กรุณากดเข้างานก่อน");
      }

      sheet.getRange(row, headerMap["เวลาออก"]).setValue(checkOutTime);
    }

    sheet.getRange(row, headerMap.note).setValue(note);
    sheet.getRange(row, headerMap.updatedAt).setValue(updatedAt);
    sheet.getRange(row, headerMap.latitude).setValue(location.latitude);
    sheet.getRange(row, headerMap.longitude).setValue(location.longitude);
    sheet.getRange(row, headerMap.accuracy).setValue(location.accuracy);
    sheet.getRange(row, headerMap.distanceFromShop).setValue(location.distanceFromShop);
    sheet.getRange(row, headerMap.locationStatus).setValue(location.locationStatus);
  } else {
    if (checkOutTime) {
      throw new Error("ยังไม่ได้เข้างานวันนี้ กรุณากดเข้างานก่อน");
    }

    sheet.appendRow([
      date,
      employeeName,
      checkInTime,
      checkOutTime,
      note,
      updatedAt,
      location.latitude,
      location.longitude,
      location.accuracy,
      location.distanceFromShop,
      location.locationStatus
    ]);
  }

  const lineMessage = buildAttendanceLineMessage({
    date,
    employeeName,
    checkInTime,
    checkOutTime,
    oldCheckOutTime,
    note,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    distanceFromShop: location.distanceFromShop,
    locationStatus: location.locationStatus
  });

  if (lineMessage) {
    try {
      const lineResult = sendLinePushMessageToOwners(lineMessage);
      Logger.log("LINE notification result: " + JSON.stringify(lineResult));
    } catch (lineError) {
      Logger.log("LINE notification error: " + lineError.message);
    }
  }

  return {
    success: true,
    message: lineMessage
  };
}

function buildAttendanceLineMessage(payload) {
  const employeeName = payload.employeeName || "-";
  const date = payload.date || "-";
  const note = payload.note || "-";
  const locationLines = buildLineLocationLines(payload);

  if (payload.checkInTime) {
    return [
      "✅ เข้างาน",
      "ชื่อ: " + employeeName,
      "วันที่: " + date,
      "เวลาเข้า: " + payload.checkInTime,
      "หมายเหตุ:",
      note || "-",
      ...locationLines
    ].join("\n");
  }

  if (payload.checkOutTime) {
    if (payload.oldCheckOutTime) {
      return [
        "📌 อัปเดตเวลาออกงาน",
        "ชื่อ: " + employeeName,
        "วันที่: " + date,
        "เวลาออกเดิม: " + payload.oldCheckOutTime,
        "เวลาออกใหม่: " + payload.checkOutTime,
        "หมายเหตุ:",
        note || "-",
        ...locationLines
      ].join("\n");
    }

    return [
      "📌 ออกงาน",
      "ชื่อ: " + employeeName,
      "วันที่: " + date,
      "เวลาออก: " + payload.checkOutTime,
      "หมายเหตุ:",
      note || "-",
      ...locationLines
    ].join("\n");
  }

  return "";
}

function normalizeLocationPayload(payload) {
  payload = payload || {};
  const info = payload.locationInfo || {};

  return {
    latitude: getLocationValue(payload.latitude, info.latitude),
    longitude: getLocationValue(payload.longitude, info.longitude),
    accuracy: getLocationValue(payload.accuracy, info.accuracy),
    distanceFromShop: getLocationValue(payload.distanceFromShop, info.distanceFromShop),
    locationStatus: getLocationValue(payload.locationStatus, info.locationStatus)
  };
}

function getLocationValue(primaryValue, fallbackValue) {
  if (primaryValue !== undefined && primaryValue !== null && primaryValue !== "") {
    return primaryValue;
  }

  if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== "") {
    return fallbackValue;
  }

  return "";
}

function buildLineLocationLines(payload) {
  const location = normalizeLocationPayload(payload);
  const hasDistance = location.distanceFromShop !== "" &&
    location.distanceFromShop !== undefined &&
    location.distanceFromShop !== null;

  if (!location.locationStatus && !hasDistance) {
    return [
      "ตำแหน่ง: ไม่ได้ส่งข้อมูลตำแหน่ง"
    ];
  }

  const locationStatusText = location.locationStatus === "OUT_OF_RANGE"
    ? "ตำแหน่ง: อยู่นอกพื้นที่ร้าน"
    : "ตำแหน่ง: อยู่ในพื้นที่ร้าน";
  const lines = [locationStatusText];

  if (hasDistance) {
    lines.push("ระยะห่างจากร้าน: " + location.distanceFromShop + " เมตร");
  }

  if (location.accuracy !== "" && location.accuracy !== undefined && location.accuracy !== null) {
    lines.push("ความคลาดเคลื่อน GPS: ±" + Math.round(Number(location.accuracy)) + " เมตร");
  }

  return lines;
}

function addEmployee(payload) {
  validatePasscode(payload.passcode);

  const sheet = getOrCreateSheet(SHEET_NAMES.EMPLOYEES, HEADERS.EMPLOYEES);
  const employeeName = normalizeText(payload.employeeName);

  if (!employeeName) {
    throw new Error("กรุณากรอกชื่อพนักงาน");
  }

  const employees = readSheetObjects(SHEET_NAMES.EMPLOYEES);
  const exists = employees.some((employee) => {
    return normalizeText(employee.employeeName) === employeeName &&
      String(employee.active).toUpperCase() === "TRUE";
  });

  if (exists) {
    throw new Error("มีชื่อพนักงานนี้อยู่แล้ว");
  }

  sheet.appendRow([employeeName, true, getTimestamp()]);

  return {
    success: true,
    employees: readEmployees()
  };
}

function renameEmployee(payload) {
  validatePasscode(payload.passcode);

  const sheet = getOrCreateSheet(SHEET_NAMES.EMPLOYEES, HEADERS.EMPLOYEES);
  const oldEmployeeName = normalizeText(payload.oldEmployeeName);
  const newEmployeeName = normalizeText(payload.newEmployeeName);

  if (!oldEmployeeName || !newEmployeeName) {
    throw new Error("กรุณาระบุชื่อพนักงาน");
  }

  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, HEADERS.EMPLOYEES.length).getValues()
    : [];

  let targetRow = 0;

  values.forEach((row, index) => {
    const employeeName = normalizeText(row[0]);
    const active = String(row[1]).toUpperCase() === "TRUE";

    if (employeeName === newEmployeeName && employeeName !== oldEmployeeName && active) {
      throw new Error("มีชื่อพนักงานนี้อยู่แล้ว");
    }

    if (!targetRow && employeeName === oldEmployeeName && active) {
      targetRow = index + 2;
    }
  });

  if (!targetRow) {
    throw new Error("ไม่พบชื่อพนักงานเดิม");
  }

  sheet.getRange(targetRow, 1).setValue(newEmployeeName);
  sheet.getRange(targetRow, 3).setValue(getTimestamp());

  return {
    success: true,
    employees: readEmployees()
  };
}

function deleteEmployee(payload) {
  validatePasscode(payload.passcode);

  const sheet = getOrCreateSheet(SHEET_NAMES.EMPLOYEES, HEADERS.EMPLOYEES);
  const employeeName = normalizeText(payload.employeeName);

  if (!employeeName) {
    throw new Error("กรุณากรอกชื่อพนักงาน");
  }

  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, HEADERS.EMPLOYEES.length).getValues()
    : [];

  let targetRow = 0;

  values.forEach((row, index) => {
    const rowEmployeeName = normalizeText(row[0]);
    const isActive = String(row[1]).toUpperCase() === "TRUE";

    if (!targetRow && rowEmployeeName === employeeName && isActive) {
      targetRow = index + 2;
    }
  });

  if (!targetRow) {
    throw new Error("ไม่พบชื่อพนักงานนี้");
  }

  sheet.getRange(targetRow, 2).setValue(false);
  sheet.getRange(targetRow, 3).setValue(getTimestamp());

  return {
    success: true
  };
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    ensureSheetHeaders(sheet, headers);
  }

  return sheet;
}

function ensureSheetHeaders(sheet, requiredHeaders) {
  const lastColumn = sheet.getLastColumn();
  const currentHeaders = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String)
    : [];

  requiredHeaders.forEach((header) => {
    if (!currentHeaders.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      currentHeaders.push(header);
    }
  });

  return currentHeaders;
}

function getHeaderMap(sheet) {
  const headers = ensureSheetHeaders(sheet, HEADERS.ATTENDANCE);
  return headers.reduce((map, header, index) => {
    map[header] = index + 1;
    return map;
  }, {});
}

function readSheetObjects(sheetName) {
  const headers = getHeadersForSheet(sheetName);
  const sheet = getOrCreateSheet(sheetName, headers);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const lastColumn = sheet.getLastColumn();
  const sheetHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return rows.map((row) => {
    return sheetHeaders.reduce((object, header, index) => {
      object[header] = row[index];
      return object;
    }, {});
  });
}

function getHeadersForSheet(sheetName) {
  if (sheetName === SHEET_NAMES.ATTENDANCE) {
    return HEADERS.ATTENDANCE;
  }

  if (sheetName === SHEET_NAMES.SETTINGS) {
    return HEADERS.SETTINGS;
  }

  return HEADERS.EMPLOYEES;
}

function writeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function writeLineWebhookOk() {
  return HtmlService.createHtmlOutput("OK");
}

function getTodayDateKey() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
}

function getCurrentTime() {
  return Utilities.formatDate(new Date(), TIMEZONE, "HH:mm");
}

function getTimestamp() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function validatePasscode(passcode) {
  const input = String(passcode || "").trim();
  const expected = String(OWNER_PASSCODE || "").trim();

  if (!input) {
    throw new Error("กรุณาใส่รหัสเจ้าของร้าน");
  }

  if (input !== expected) {
    throw new Error("รหัสเจ้าของร้านไม่ถูกต้อง");
  }

  return true;
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function findAttendanceRow(sheet, date, employeeName) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.ATTENDANCE.length).getValues();
  const targetDate = normalizeText(date);
  const targetEmployeeName = normalizeText(employeeName);
  let firstMatchRow = 0;

  for (let index = 0; index < values.length; index += 1) {
    const rowDate = formatSheetDate(values[index][0]);
    const rowEmployeeName = normalizeText(values[index][1]);

    if (rowDate === targetDate && rowEmployeeName === targetEmployeeName) {
      if (!firstMatchRow) {
        firstMatchRow = index + 2;
      } else {
        Logger.log("Duplicate attendance row found for " + targetDate + " / " + targetEmployeeName + " at row " + (index + 2));
      }
    }
  }

  return firstMatchRow;
}

function readEmployees() {
  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);

  if (!sheet || sheet.getLastRow() <= 1) {
    getOrCreateSheet(SHEET_NAMES.EMPLOYEES, HEADERS.EMPLOYEES);
    return DEFAULT_EMPLOYEES.slice();
  }

  const employees = readSheetObjects(SHEET_NAMES.EMPLOYEES)
    .filter((employee) => String(employee.active).toUpperCase() === "TRUE")
    .map((employee) => normalizeText(employee.employeeName))
    .filter(Boolean);

  return employees.length ? employees : DEFAULT_EMPLOYEES.slice();
}

function readTodayRecords() {
  const sheet = getSheet(SHEET_NAMES.ATTENDANCE);

  if (!sheet || sheet.getLastRow() <= 1) {
    getOrCreateSheet(SHEET_NAMES.ATTENDANCE, HEADERS.ATTENDANCE);
    return [];
  }

  const today = getTodayDateKey();

  return readSheetObjects(SHEET_NAMES.ATTENDANCE)
    .filter((record) => formatSheetDate(record["วันที่"]) === today)
    .map((record) => ({
      date: formatSheetDate(record["วันที่"]),
      employeeName: normalizeText(record["ชื่อพนักงาน"]),
      checkInTime: formatSheetTime(record["เวลาเข้า"]),
      checkOutTime: formatSheetTime(record["เวลาออก"]),
      note: String(record.note || ""),
      updatedAt: formatSheetTimestamp(record.updatedAt),
      latitude: record.latitude || "",
      longitude: record.longitude || "",
      accuracy: record.accuracy || "",
      distanceFromShop: record.distanceFromShop || "",
      locationStatus: record.locationStatus || ""
    }));
}

function formatSheetDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
  }

  return normalizeText(value);
}

function formatSheetTime(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, TIMEZONE, "HH:mm");
  }

  return normalizeText(value);
}

function formatSheetTimestamp(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }

  return normalizeText(value);
}

function sendLineNotification(message) {
  // TODO: Add LINE notification later.
}

function handleLineWebhook(payload) {
  const events = Array.isArray(payload.events) ? payload.events : [];

  events.forEach((event) => {
    const messageText = normalizeText(event.message && event.message.text);
    const userId = event.source && event.source.userId;
    const replyToken = event.replyToken;

    if (!userId || !replyToken) {
      return;
    }

    if (messageText === "ลงทะเบียนเจ้าของ") {
      const result = addLineOwnerUserId(userId);
      const replyText = result.added
        ? "ลงทะเบียนเจ้าของร้านเรียบร้อยแล้ว ✅"
        : "คุณลงทะเบียนเจ้าของร้านไว้แล้ว ✅";
      replyLineMessage(replyToken, replyText);
      return;
    }

    if (messageText === "ยกเลิกเจ้าของ") {
      removeLineOwnerUserId(userId);
      replyLineMessage(replyToken, "ยกเลิกการรับแจ้งเตือนแล้ว");
    }
  });

  return {
    success: true
  };
}

function getLineStatus() {
  const ownerUserIds = getLineOwnerUserIds();

  return {
    success: true,
    ownerCount: ownerUserIds.length,
    hasOwnerUserId: ownerUserIds.length > 0,
    ownerUserIdsMasked: ownerUserIds.map(maskLineUserId),
    hasLineToken: hasLineToken()
  };
}

function testLineNotification(payload) {
  payload = payload || {};
  validatePasscode(payload.passcode);

  const ownerUserIds = getLineOwnerUserIds();

  if (!ownerUserIds.length) {
    throw new Error("ยังไม่ได้ลงทะเบียน LINE เจ้าของร้าน กรุณาส่งคำว่า ลงทะเบียนเจ้าของ ไปที่ LINE OA ก่อน");
  }

  const result = sendLinePushMessageToOwners("ทดสอบแจ้งเตือนระบบเข้า-ออกงาน ✅");

  return {
    success: result.success,
    ownerCount: ownerUserIds.length,
    lineResult: result
  };
}

function authorizeUrlFetch() {
  const response = UrlFetchApp.fetch("https://api.line.me", {
    method: "get",
    muteHttpExceptions: true
  });

  Logger.log("authorizeUrlFetch response code: " + response.getResponseCode());
  Logger.log("authorizeUrlFetch response body: " + response.getContentText());
}

function runTestLineNotification() {
  const result = testLineNotification({
    passcode: "1111"
  });

  Logger.log(JSON.stringify(result));
}

function getLineOwnerUserIds() {
  const ownerUserIdsValue = getSettingValue(SETTING_KEYS.LINE_OWNER_USER_IDS);
  const legacyOwnerUserIdValue = getSettingValue(SETTING_KEYS.LINE_OWNER_USER_ID);
  const values = [];

  if (ownerUserIdsValue) {
    values.push.apply(values, ownerUserIdsValue.split(","));
  }

  if (legacyOwnerUserIdValue) {
    values.push(legacyOwnerUserIdValue);
  }

  return dedupeLineUserIds(values);
}

function addLineOwnerUserId(userId) {
  const cleanUserId = normalizeText(userId);
  const ownerUserIds = getLineOwnerUserIds();

  if (!cleanUserId) {
    return {
      added: false
    };
  }

  if (ownerUserIds.indexOf(cleanUserId) !== -1) {
    return {
      added: false
    };
  }

  ownerUserIds.push(cleanUserId);
  setLineOwnerUserIds(ownerUserIds);

  return {
    added: true
  };
}

function removeLineOwnerUserId(userId) {
  const cleanUserId = normalizeText(userId);
  const ownerUserIds = getLineOwnerUserIds().filter((ownerUserId) => {
    return ownerUserId !== cleanUserId;
  });

  setLineOwnerUserIds(ownerUserIds);

  if (normalizeText(getSettingValue(SETTING_KEYS.LINE_OWNER_USER_ID)) === cleanUserId) {
    setSettingValue(SETTING_KEYS.LINE_OWNER_USER_ID, "");
  }

  return {
    success: true
  };
}

function setLineOwnerUserIds(userIds) {
  const ownerUserIds = dedupeLineUserIds(userIds);
  setSettingValue(SETTING_KEYS.LINE_OWNER_USER_IDS, ownerUserIds.join(","));
}

function maskLineUserId(userId) {
  const cleanUserId = normalizeText(userId);

  if (cleanUserId.length <= 10) {
    return cleanUserId ? cleanUserId.charAt(0) + "...": "";
  }

  return cleanUserId.slice(0, 6) + "..." + cleanUserId.slice(-4);
}

function dedupeLineUserIds(userIds) {
  const seen = {};

  return (userIds || [])
    .map((userId) => normalizeText(userId))
    .filter(Boolean)
    .filter((userId) => {
      if (seen[userId]) {
        return false;
      }

      seen[userId] = true;
      return true;
    });
}

function sendLinePushMessageToOwners(text) {
  const ownerUserIds = getLineOwnerUserIds();

  Logger.log("LINE owner count: " + ownerUserIds.length);
  Logger.log("LINE message: " + text);

  if (!ownerUserIds.length) {
    Logger.log("No LINE owner userIds registered.");
    return {
      success: false,
      error: "No LINE owner userIds registered."
    };
  }

  const results = ownerUserIds.map((userId) => {
    try {
      return sendLinePushMessage(userId, text);
    } catch (error) {
      Logger.log("Failed to send LINE message to owner: " + error.message);
      return {
        success: false,
        error: error.message
      };
    }
  });

  return {
    success: results.some((result) => result && result.success),
    results
  };
}

function sendLinePushMessage(to, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || LINE_CHANNEL_ACCESS_TOKEN.includes("PASTE_")) {
    Logger.log("LINE token is not configured.");
    return {
      success: false,
      error: "LINE token is not configured."
    };
  }

  if (!to) {
    Logger.log("LINE target userId is missing.");
    return {
      success: false,
      error: "LINE target userId is missing."
    };
  }

  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: to,
    messages: [
      {
        type: "text",
        text: text
      }
    ]
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    headers: {
      Authorization: "Bearer " + LINE_CHANNEL_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  Logger.log("LINE push response code: " + code);
  Logger.log("LINE push response body: " + body);

  if (code < 200 || code >= 300) {
    return {
      success: false,
      error: "LINE push failed: " + code + " " + body
    };
  }

  return {
    success: true
  };
}

function replyLineMessage(replyToken, text) {
  const token = getLineChannelAccessToken();

  if (!token) {
    Logger.log("LINE channel access token is not configured.");
    return;
  }

  try {
    const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        replyToken,
        messages: [
          {
            type: "text",
            text
          }
        ]
      }),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode < 200 || responseCode >= 300) {
      Logger.log("LINE reply failed: " + responseCode + " " + response.getContentText());
    }
  } catch (error) {
    Logger.log("LINE reply error: " + error.message);
  }
}

function getLineChannelAccessToken() {
  return LINE_CHANNEL_ACCESS_TOKEN ||
    getSettingValue(SETTING_KEYS.LINE_CHANNEL_ACCESS_TOKEN) ||
    PropertiesService.getScriptProperties().getProperty(SETTING_KEYS.LINE_CHANNEL_ACCESS_TOKEN) ||
    "";
}

function hasLineToken() {
  return Boolean(LINE_CHANNEL_ACCESS_TOKEN && !LINE_CHANNEL_ACCESS_TOKEN.includes("PASTE_"));
}

function getSettingValue(key) {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS, HEADERS.SETTINGS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return "";
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.SETTINGS.length).getValues();
  const targetKey = normalizeText(key);

  for (let index = 0; index < values.length; index += 1) {
    if (normalizeText(values[index][0]) === targetKey) {
      return String(values[index][1] || "").trim();
    }
  }

  return "";
}

function setSettingValue(key, value) {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS, HEADERS.SETTINGS);
  const lastRow = sheet.getLastRow();
  const targetKey = normalizeText(key);
  const updatedAt = getTimestamp();

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.SETTINGS.length).getValues();

    for (let index = 0; index < values.length; index += 1) {
      if (normalizeText(values[index][0]) === targetKey) {
        sheet.getRange(index + 2, 2).setValue(value);
        sheet.getRange(index + 2, 3).setValue(updatedAt);
        return;
      }
    }
  }

  sheet.appendRow([targetKey, value, updatedAt]);
}
