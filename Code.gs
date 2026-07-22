// IMPORTANT:
// After editing Code.gs, deploy a new Apps Script Web App version.
// Apps Script > Deploy > Manage deployments > Edit > Version: New version > Deploy.
// Otherwise the Web App URL may still run the old code.

const TIMEZONE = "Asia/Bangkok";
const SPREADSHEET_ID = "1ZJqj-XIbL_TScm7c9JRxcdHGJKyRk4dpehsuUsiKYBk";
const OWNER_PASSCODE = "1111";
const LINE_CHANNEL_ACCESS_TOKEN = "";
const USE_LINE_NOTIFICATION = false;
const USE_DISCORD_NOTIFICATION = true;

const SHEET_NAMES = {
  ATTENDANCE: "Attendance",
  EMPLOYEES: "Employees",
  SETTINGS: "Settings",
  NOTIFICATION_LOG: "NotificationLog",
  PAYROLL_PAYMENTS: "PayrollPayments",
  PAYROLL_CONFIRMATIONS: "PayrollConfirmations",
  PART_TIME_RECORDS: "PartTimeRecords"
};

const HEADERS = {
  ATTENDANCE: ["วันที่", "ชื่อพนักงาน", "เวลาเข้า", "เวลาออก", "note", "updatedAt", "latitude", "longitude", "accuracy", "distanceFromShop", "locationStatus"],
  EMPLOYEES: ["employeeName", "active", "updatedAt"],
  SETTINGS: ["key", "value", "updatedAt"],
  NOTIFICATION_LOG: [
    "NotificationID",
    "Date",
    "EmployeeName",
    "EventType",
    "EventTime",
    "Provider",
    "Message",
    "Status",
    "Attempts",
    "LastError",
    "LastCode",
    "CreatedAt",
    "UpdatedAt",
    "SentAt"
  ]
};

const DEFAULT_EMPLOYEES = ["แน็ค", "แป้ง", "แก้ม", "เมย์", "Rider1"];
const SETTING_KEYS = {
  LINE_CHANNEL_ACCESS_TOKEN: "LINE_CHANNEL_ACCESS_TOKEN",
  LINE_OWNER_USER_ID: "LINE_OWNER_USER_ID",
  LINE_OWNER_USER_IDS: "LINE_OWNER_USER_IDS"
};

const PAYROLL_EMPLOYEE_HEADERS = [
  "EmployeeID",
  "Name",
  "Role",
  "Active",
  "PayType",
  "DailyRate",
  "HourlyRate",
  "PhoneAllowance",
  "DefaultPayCycle",
  "WeeklySchedule",
  "WeeklyScheduleEffectiveFrom",
  "UpdatedAt"
];

const PAYROLL_CONFIRMATION_HEADERS = [
  "RecordID",
  "Date",
  "EmployeeID",
  "EmployeeName",
  "Confirmed",
  "WorkStatus",
  "RawCheckInTime",
  "RawCheckOutTime",
  "ScheduledStart",
  "ScheduledEnd",
  "OTMinutes",
  "LeaveMinutes",
  "ManagerNote",
  "Kilometers",
  "ManualTimeEdited",
  "ManualTimeEditedAt",
  "ManualTimeEditedBy",
  "ScheduleTimeEdited",
  "ScheduleTimeEditedAt",
  "ScheduleTimeEditedBy",
  "UpdatedAt"
];

const PART_TIME_RECORD_HEADERS = [
  "RecordID",
  "Date",
  "EmployeeID",
  "EmployeeName",
  "Confirmed",
  "CheckInTime",
  "CheckOutTime",
  "ScheduledStart",
  "ScheduledEnd",
  "WorkedMinutes",
  "Wage",
  "Kilometers",
  "Note",
  "ManualTimeEdited",
  "ManualTimeEditedAt",
  "ManualTimeEditedBy",
  "ScheduleTimeEdited",
  "ScheduleTimeEditedAt",
  "ScheduleTimeEditedBy",
  "UpdatedAt"
];

const PAYROLL_PAYMENT_HEADERS = [
  "PaymentID",
  "WorkerType",
  "EmployeeID",
  "EmployeeName",
  "PeriodStart",
  "PeriodEnd",
  "PaymentType",
  "TotalWorkedDays",
  "BasePay",
  "PhoneAllowance",
  "CupBonus",
  "MissingMoney",
  "MissingMoneyShare",
  "BonusAdjustment",
  "FuelAllowance",
  "TotalWage",
  "TotalKilometers",
  "FuelPrice",
  "BurnRate",
  "DepreciationFactor",
  "TotalPay",
  "Status",
  "ExcludedDates",
  "PaidAt",
  "PaidBy",
  "CancelledAt",
  "CancelledBy",
  "Note",
  "CreatedAt",
  "UpdatedAt",
  "EffectiveDailyRate",
  "TotalOTMinutes",
  "TotalLeaveMinutes",
  "OTPay",
  "LeaveDeduction",
  "WorkedDaysWith170Cups",
  "WorkedDaysWith200Cups",
  "CupBonus170",
  "CupBonus200",
  "DamageDeduction",
  "IncludedItems",
  "EarlyCheckInDays",
  "EarlyCheckInDates",
  "LateCheckInDays",
  "LateCheckInDates",
  "OtherDeduction",
  "BusinessKey",
  "FormulaVersion",
  "SelectedDates",
  "PaidStatusEdits",
  "PaymentDayBreakdown",
  "RawComponents",
  "AppliedComponents",
  "CupDataSnapshot"
];

const PAYROLL_EMPLOYEE_NAME_ALIASES = [
  "Name",
  "employeeName",
  "EmployeeName",
  "Employee",
  "ชื่อพนักงาน",
  "ชื่อ",
  "พนักงาน",
  "รายชื่อ",
  "ชื่อ-สกุล"
];

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || "";

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
        passcode: params.passcode
      }));
    }

    if (action === "testDiscordNotification") {
      return writeResponse(testDiscordNotification({
        passcode: params.passcode
      }));
    }

    if (action === "retryPendingDiscordNotifications") {
      validatePasscode(params.passcode);
      return writeResponse(retryPendingDiscordNotifications());
    }

    if (action === "getNotificationStatus") {
      return writeResponse(getNotificationStatus({
        passcode: params.passcode
      }));
    }

    if (action === "setup") {
      return writePayrollResponse(setupPayrollSheets());
    }

    if (action === "bootstrap") {
      return writePayrollResponse(getPayrollBootstrapData());
    }

    if (action === "employees") {
      return writePayrollResponse({
        ok: true,
        data: getPayrollEmployees()
      });
    }

    if (action === "debugEmployees") {
      return writePayrollResponse({
        ok: true,
        data: debugPayrollEmployees()
      });
    }

    if (action === "debugEmployeeSchedule") {
      return writePayrollResponse({
        ok: true,
        data: debugEmployeeSchedule()
      });
    }

    if (action === "attendance") {
      return writePayrollResponse({
        ok: true,
        data: getPayrollAttendance()
      });
    }

    if (action === "payments") {
      return writePayrollResponse({
        ok: true,
        data: getPayrollPayments(params)
      });
    }


    if (action === "confirmations") {
      return writePayrollResponse({
        ok: true,
        data: getPayrollConfirmations()
      });
    }

    if (action === "partTimeRecords") {
      return writePayrollResponse({
        ok: true,
        data: getPartTimeRecords()
      });
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
    const requestStartedAt = Date.now();
    const requestId = payload.requestId || "";

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

    if (action === "testDiscordNotification") {
      return writeResponse(testDiscordNotification(payload));
    }

    if (action === "retryPendingDiscordNotifications") {
      validatePasscode(payload.passcode);
      return writeResponse(retryPendingDiscordNotifications());
    }

    if (action === "getNotificationStatus") {
      return writeResponse(getNotificationStatus(payload));
    }

    if (action === "saveEmployee") {
      return writePayrollResponse(addPayrollTiming(savePayrollEmployee(payload.employee), requestStartedAt, requestId));
    }

    if (action === "saveEmployees") {
      return writePayrollResponse(savePayrollEmployees(payload.employees || []));
    }

    if (action === "savePayment") {
      return writePayrollResponse(addPayrollTiming(savePayrollPayment(payload.payment), requestStartedAt, requestId));
    }

    if (action === "saveConfirmation") {
      return writePayrollResponse(addPayrollTiming(savePayrollConfirmation(payload.record), requestStartedAt, requestId));
    }

    if (action === "saveConfirmations") {
      return writePayrollResponse(savePayrollConfirmations(payload.records || []));
    }

    if (action === "savePartTimeRecord") {
      return writePayrollResponse(addPayrollTiming(savePartTimeRecord(payload.record), requestStartedAt, requestId));
    }

    if (action === "savePartTimeRecords") {
      return writePayrollResponse(savePartTimeRecords(payload.records || []));
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

  const notificationPayload = {
    date,
    employeeName,
    checkInTime,
    checkOutTime,
    oldCheckOutTime,
    eventType: payload.eventType || (checkOutTime ? "checkOut" : "checkIn"),
    eventNote: payload.eventNote,
    note,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    distanceFromShop: location.distanceFromShop,
    locationStatus: location.locationStatus
  };
  const notification = sendOrQueueAttendanceNotification(notificationPayload);

  return {
    success: true,
    saved: true,
    message: "Attendance saved successfully",
    notification
  };
}

function sendAttendanceNotification(payload) {
  if (USE_DISCORD_NOTIFICATION) {
    const discordMessage = buildAttendanceDiscordMessage(payload);

    if (!discordMessage) {
      return {
        provider: "discord",
        attempted: false,
        success: false,
        error: "",
        code: ""
      };
    }

    try {
      const result = sendDiscordNotification(discordMessage);
      return {
        provider: "discord",
        attempted: true,
        success: result.success,
        error: result.error || "",
        code: result.code || ""
      };
    } catch (error) {
      Logger.log("Discord notification error: " + error.message);
      return {
        provider: "discord",
        attempted: true,
        success: false,
        error: error.message,
        code: ""
      };
    }
  }

  if (USE_LINE_NOTIFICATION) {
    const lineMessage = buildAttendanceLineMessage(payload);

    if (!lineMessage) {
      return {
        provider: "line",
        attempted: false,
        success: false,
        error: "",
        code: ""
      };
    }

    try {
      const lineResult = sendLinePushMessageToOwners(lineMessage);
      Logger.log("LINE notification result: " + JSON.stringify(lineResult));
      return {
        provider: "line",
        attempted: true,
        success: lineResult.success,
        error: lineResult.error || "",
        code: ""
      };
    } catch (lineError) {
      Logger.log("LINE notification error: " + lineError.message);
      return {
        provider: "line",
        attempted: true,
        success: false,
        error: lineError.message,
        code: ""
      };
    }
  }

  return {
    provider: "",
    attempted: false,
    success: false,
    error: "",
    code: ""
  };
}

function sendOrQueueAttendanceNotification(payload) {
  if (!USE_DISCORD_NOTIFICATION) {
    return sendAttendanceNotification(payload);
  }

  const discordMessage = buildAttendanceDiscordMessage(payload);

  if (!discordMessage) {
    return {
      provider: "discord",
      attempted: false,
      success: false,
      queued: false,
      error: "Empty Discord message",
      code: ""
    };
  }

  const notificationId = createAttendanceNotificationId(payload);
  const existingLog = findNotificationLogById(notificationId);

  if (existingLog && normalizeText(existingLog.status) === "sent") {
    return {
      provider: "discord",
      attempted: false,
      success: true,
      queued: false,
      skipped: true,
      code: normalizeText(existingLog.lastCode),
      error: ""
    };
  }

  if (existingLog) {
    const existingAttempts = Number(existingLog.attempts || 0);

    if (existingAttempts >= 5) {
      return {
        provider: "discord",
        attempted: false,
        success: false,
        queued: false,
        skipped: true,
        code: normalizeText(existingLog.lastCode),
        error: normalizeText(existingLog.lastError) || "Discord retry limit reached"
      };
    }

    if (existingAttempts > 0 && existingAttempts < 5) {
      return {
        provider: "discord",
        attempted: false,
        success: false,
        queued: true,
        skipped: true,
        code: normalizeText(existingLog.lastCode),
        error: normalizeText(existingLog.lastError) || "Discord retry already queued"
      };
    }
  }

  const logRecord = {
    notificationId,
    date: payload.date,
    employeeName: payload.employeeName,
    eventType: payload.eventType,
    eventTime: payload.eventType === "checkOut"
      ? payload.checkOutTime
      : payload.checkInTime,
    provider: "discord",
    message: discordMessage
  };
  const result = sendDiscordNotification(discordMessage);

  if (result.success) {
    upsertNotificationLog(Object.assign({}, logRecord, {
      status: "sent",
      attempts: existingLog ? Number(existingLog.attempts || 0) + 1 : 1,
      lastError: "",
      lastCode: result.code || "",
      sentAt: getTimestamp()
    }));

    return {
      provider: "discord",
      attempted: true,
      success: true,
      queued: false,
      code: result.code || "",
      error: ""
    };
  }

  upsertNotificationLog(Object.assign({}, logRecord, {
    status: "pending",
    attempts: existingLog ? Number(existingLog.attempts || 0) + 1 : 1,
    lastError: result.error || "Discord failed",
    lastCode: result.code || "",
    sentAt: existingLog ? existingLog.sentAt || "" : ""
  }));

  return {
    provider: "discord",
    attempted: true,
    success: false,
    queued: true,
    code: result.code || "",
    error: result.error || "Discord failed"
  };
}

function createAttendanceNotificationId(payload) {
  return [
    "attendance",
    normalizeText(payload.date),
    normalizeText(payload.employeeName),
    normalizeText(payload.eventType),
    normalizeText(
      payload.eventType === "checkOut"
        ? payload.checkOutTime
        : payload.checkInTime
    )
  ].join("|");
}

function getNotificationLogSheet() {
  return getOrCreateSheet(SHEET_NAMES.NOTIFICATION_LOG, HEADERS.NOTIFICATION_LOG);
}

function getNotificationLogHeaderMap(sheet) {
  const headers = ensureSheetHeaders(sheet, HEADERS.NOTIFICATION_LOG);

  return headers.reduce((map, header, index) => {
    map[header] = index + 1;
    return map;
  }, {});
}

function findNotificationLogById(notificationId) {
  const sheet = getNotificationLogSheet();
  const headerMap = getNotificationLogHeaderMap(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const target = normalizeText(notificationId);

  for (let index = 0; index < values.length; index += 1) {
    if (normalizeText(values[index][headerMap.NotificationID - 1]) === target) {
      return {
        row: index + 2,
        notificationId: normalizeText(values[index][headerMap.NotificationID - 1]),
        status: normalizeText(values[index][headerMap.Status - 1]),
        attempts: Number(values[index][headerMap.Attempts - 1] || 0),
        lastError: String(values[index][headerMap.LastError - 1] || ""),
        lastCode: String(values[index][headerMap.LastCode - 1] || ""),
        sentAt: String(values[index][headerMap.SentAt - 1] || "")
      };
    }
  }

  return null;
}

function upsertNotificationLog(record) {
  const sheet = getNotificationLogSheet();
  const headerMap = getNotificationLogHeaderMap(sheet);
  const existingLog = findNotificationLogById(record.notificationId);
  const now = getTimestamp();
  const row = existingLog ? existingLog.row : sheet.getLastRow() + 1;

  if (!existingLog) {
    sheet.getRange(row, headerMap.NotificationID).setValue(record.notificationId);
    sheet.getRange(row, headerMap.CreatedAt).setValue(now);
  }

  sheet.getRange(row, headerMap.Date).setValue(record.date || "");
  sheet.getRange(row, headerMap.EmployeeName).setValue(record.employeeName || "");
  sheet.getRange(row, headerMap.EventType).setValue(record.eventType || "");
  sheet.getRange(row, headerMap.EventTime).setValue(record.eventTime || "");
  sheet.getRange(row, headerMap.Provider).setValue(record.provider || "discord");
  sheet.getRange(row, headerMap.Message).setValue(record.message || "");
  sheet.getRange(row, headerMap.Status).setValue(record.status || "pending");
  sheet.getRange(row, headerMap.Attempts).setValue(Number(record.attempts || 0));
  sheet.getRange(row, headerMap.LastError).setValue(record.lastError || "");
  sheet.getRange(row, headerMap.LastCode).setValue(record.lastCode || "");
  sheet.getRange(row, headerMap.UpdatedAt).setValue(now);
  sheet.getRange(row, headerMap.SentAt).setValue(record.sentAt || "");

  return {
    success: true,
    row
  };
}

function retryPendingDiscordNotifications() {
  const sheet = getNotificationLogSheet();
  const headerMap = getNotificationLogHeaderMap(sheet);
  const values = sheet.getDataRange().getValues();
  let sentCount = 0;
  let failedCount = 0;

  for (let index = 1; index < values.length; index += 1) {
    const row = index + 1;
    const status = normalizeText(values[index][headerMap.Status - 1]);
    const provider = normalizeText(values[index][headerMap.Provider - 1]);
    const attempts = Number(values[index][headerMap.Attempts - 1] || 0);

    if (provider !== "discord") continue;
    if (status !== "pending" && status !== "failed") continue;
    if (attempts >= 5) continue;

    const message = String(values[index][headerMap.Message - 1] || "");
    if (!message) continue;

    const result = sendDiscordNotification(message);
    const now = getTimestamp();

    sheet.getRange(row, headerMap.Attempts).setValue(attempts + 1);
    sheet.getRange(row, headerMap.UpdatedAt).setValue(now);
    sheet.getRange(row, headerMap.LastCode).setValue(result.code || "");
    sheet.getRange(row, headerMap.LastError).setValue(result.error || "");

    if (result.success) {
      sheet.getRange(row, headerMap.Status).setValue("sent");
      sheet.getRange(row, headerMap.SentAt).setValue(now);
      sentCount += 1;
    } else {
      sheet.getRange(row, headerMap.Status).setValue(attempts + 1 >= 5 ? "failed" : "pending");
      failedCount += 1;
    }

    Utilities.sleep(700);
  }

  return {
    success: true,
    sentCount,
    failedCount
  };
}

function installDiscordRetryTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "retryPendingDiscordNotifications")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("retryPendingDiscordNotifications")
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("Discord retry trigger installed");
}

function testDiscordNotification(payload) {
  payload = payload || {};
  validatePasscode(payload.passcode);

  const result = sendDiscordNotification("ทดสอบแจ้งเตือน Discord ระบบเข้า-ออกงาน ✅");

  return {
    success: result.success,
    provider: "discord",
    code: result.code || "",
    error: result.error || ""
  };
}

function getNotificationStatus(payload) {
  payload = payload || {};
  validatePasscode(payload.passcode);

  const sheet = getNotificationLogSheet();
  const headerMap = getNotificationLogHeaderMap(sheet);
  const values = sheet.getDataRange().getValues();
  const counts = {
    pending: 0,
    sent: 0,
    failed: 0
  };

  for (let index = 1; index < values.length; index += 1) {
    const status = normalizeText(values[index][headerMap.Status - 1]);

    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  }

  return {
    success: true,
    total: Math.max(values.length - 1, 0),
    pending: counts.pending,
    sent: counts.sent,
    failed: counts.failed
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

function buildAttendanceDiscordMessage(payload) {
  const eventType = payload.eventType || (payload.checkOutTime ? "checkOut" : "checkIn");
  const isCheckIn = eventType === "checkIn";
  const location = normalizeLocationPayload(payload);

  const title = isCheckIn ? "✅ เข้างาน" : "📌 ออกงาน";
  const timeLabel = isCheckIn ? "เวลาเข้า" : "เวลาออก";
  const timeValue = isCheckIn ? payload.checkInTime : payload.checkOutTime;
  const note = String(payload.eventNote || "").trim() || "-";

  let locationText = "ไม่ทราบตำแหน่ง";
  if (location.locationStatus === "IN_RANGE") {
    locationText = "อยู่ในพื้นที่ร้าน";
  } else if (location.locationStatus === "OUT_OF_RANGE") {
    locationText = "อยู่นอกพื้นที่ร้าน";
  }

  const distanceText = location.distanceFromShop !== "" && location.distanceFromShop !== null && location.distanceFromShop !== undefined
    ? location.distanceFromShop + " เมตร"
    : "- เมตร";

  const accuracyText = location.accuracy !== "" && location.accuracy !== null && location.accuracy !== undefined
    ? "±" + location.accuracy + " เมตร"
    : "±- เมตร";

  return [
    title,
    "ชื่อ: " + (payload.employeeName || "-"),
    "วันที่: " + (payload.date || "-"),
    timeLabel + ": " + (timeValue || "-"),
    "หมายเหตุ:",
    note,
    "ตำแหน่ง: " + locationText,
    "ระยะห่างจากร้าน: " + distanceText,
    "ความคลาดเคลื่อน GPS: " + accuracyText
  ].join("\n");
}

function getDiscordWebhookUrl() {
  return PropertiesService
    .getScriptProperties()
    .getProperty("DISCORD_WEBHOOK_URL") || "";
}

function hasDiscordWebhook() {
  return Boolean(getDiscordWebhookUrl());
}

function sendDiscordNotification(message) {
  const webhookUrl = getDiscordWebhookUrl();

  if (!webhookUrl) {
    Logger.log("Discord webhook: missing");
    return {
      success: false,
      code: "",
      error: "Missing DISCORD_WEBHOOK_URL"
    };
  }

  Logger.log("Discord webhook: exists");

  const payload = {
    content: String(message || "")
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log("Discord response code: " + responseCode);
    Logger.log("Discord response body: " + responseBody);

    if (responseCode >= 200 && responseCode <= 299) {
      return {
        success: true,
        code: responseCode,
        error: ""
      };
    }

    return {
      success: false,
      code: responseCode,
      error: "Discord webhook failed: " + responseCode + " " + responseBody
    };
  } catch (error) {
    Logger.log("Discord fetch error: " + error.message);

    return {
      success: false,
      code: "",
      error: error.message || String(error)
    };
  }
}

function runTestDiscordStatus() {
  Logger.log(hasDiscordWebhook() ? "Discord webhook: exists" : "Discord webhook: missing");
}

function runTestDiscordNotification() {
  const result = sendDiscordNotification("Test notification from DÈ TREE CAFE attendance system ✅");
  Logger.log(JSON.stringify(result));
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

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = getSpreadsheet();
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

function withPayrollLock(callback) {
  const lock = LockService.getScriptLock();
  const lockStartedAt = Date.now();
  let locked = false;

  try {
    lock.waitLock(10000);
    locked = true;

    const lockWaitMs = Date.now() - lockStartedAt;
    const result = callback() || {};

    return Object.assign(
      {},
      result,
      {
        lockWaitMs: lockWaitMs
      }
    );
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
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

  if (sheetName === SHEET_NAMES.NOTIFICATION_LOG) {
    return HEADERS.NOTIFICATION_LOG;
  }

  if (sheetName === SHEET_NAMES.PAYROLL_PAYMENTS) {
    return PAYROLL_PAYMENT_HEADERS;
  }

  if (sheetName === SHEET_NAMES.PAYROLL_CONFIRMATIONS) {
    return PAYROLL_CONFIRMATION_HEADERS;
  }

  if (sheetName === SHEET_NAMES.PART_TIME_RECORDS) {
    return PART_TIME_RECORD_HEADERS;
  }

  return HEADERS.EMPLOYEES;
}

function setupPayrollSheets() {
  ensurePayrollEmployeeHeaders();
  getOrCreateSheet(SHEET_NAMES.ATTENDANCE, HEADERS.ATTENDANCE);
  ensurePayrollPaymentsSheet();
  ensurePayrollConfirmationsSheet();
  ensurePartTimeRecordsSheet();

  return {
    ok: true,
    data: {
      message: "setup complete"
    }
  };
}

function getPayrollBootstrapData() {
  setupPayrollSheets();

  return {
    ok: true,
    success: true,
    data: {
      employees: getPayrollEmployees(),
      attendance: getPayrollAttendance(),
      confirmations: getPayrollConfirmations(),
      partTimeRecords: getPartTimeRecords(),
      payments: getPayrollPayments()
    },
    serverTime: new Date().toISOString()
  };
}

function ensurePayrollEmployeeHeaders() {
  const sheet = getOrCreateSheet(SHEET_NAMES.EMPLOYEES, HEADERS.EMPLOYEES);
  ensureSheetHeaders(sheet, PAYROLL_EMPLOYEE_HEADERS);
  return sheet;
}

function ensurePayrollPaymentsSheet() {
  return getOrCreateSheet(SHEET_NAMES.PAYROLL_PAYMENTS, PAYROLL_PAYMENT_HEADERS);
}

function ensurePayrollConfirmationsSheet() {
  return getOrCreateSheet(SHEET_NAMES.PAYROLL_CONFIRMATIONS, PAYROLL_CONFIRMATION_HEADERS);
}

function ensurePartTimeRecordsSheet() {
  return getOrCreateSheet(SHEET_NAMES.PART_TIME_RECORDS, PART_TIME_RECORD_HEADERS);
}

function getPayrollEmployees() {
  const sheet = ensurePayrollEmployeeHeaders();
  const table = readPayrollTable(sheet);
  const headers = table.headers;

  const employeeNameIndex = getPayrollHeaderIndex(headers, ["employeeName"]);
  const nameIndex = getPayrollHeaderIndex(headers, ["Name"]);
  const employeeIdIndex = getPayrollHeaderIndex(headers, ["EmployeeID"]);
  const oldActiveIndex = getPayrollHeaderIndex(headers, ["active"]);
  const newActiveIndex = getPayrollHeaderIndex(headers, ["Active"]);
  const roleIndex = getPayrollHeaderIndex(headers, ["Role"]);

  const employees = [];

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;

    let name = "";

    if (employeeNameIndex >= 0 && row[employeeNameIndex] !== "" && row[employeeNameIndex] !== null && row[employeeNameIndex] !== undefined) {
      name = normalizeText(row[employeeNameIndex]);
    }

    if (!name && nameIndex >= 0 && row[nameIndex] !== "" && row[nameIndex] !== null && row[nameIndex] !== undefined) {
      name = normalizeText(row[nameIndex]);
    }

    if (!name) {
      return;
    }

    let employeeId = employeeIdIndex >= 0 ? normalizeText(row[employeeIdIndex]) : "";

    if (!employeeId) {
      employeeId = "emp-" + rowNumber;
      setAnyCell(sheet, rowNumber, headers, ["EmployeeID"], employeeId);
    }

    let active = true;

    if (newActiveIndex >= 0 && row[newActiveIndex] !== "" && row[newActiveIndex] !== null && row[newActiveIndex] !== undefined) {
      active = parsePayrollBoolean(row[newActiveIndex], true);
    } else if (oldActiveIndex >= 0 && row[oldActiveIndex] !== "" && row[oldActiveIndex] !== null && row[oldActiveIndex] !== undefined) {
      active = parsePayrollBoolean(row[oldActiveIndex], true);
    }

    let role = roleIndex >= 0 ? normalizeText(row[roleIndex]) : "";
    role = role === "parttime" ? "parttime" : "fulltime";

    if (nameIndex >= 0 && !normalizeText(row[nameIndex])) {
      sheet.getRange(rowNumber, nameIndex + 1).setValue(name);
    }

    if (employeeNameIndex >= 0 && !normalizeText(row[employeeNameIndex])) {
      sheet.getRange(rowNumber, employeeNameIndex + 1).setValue(name);
    }

    if (roleIndex >= 0 && !normalizeText(row[roleIndex])) {
      sheet.getRange(rowNumber, roleIndex + 1).setValue(role);
    }

    if (newActiveIndex >= 0 && (row[newActiveIndex] === "" || row[newActiveIndex] === null || row[newActiveIndex] === undefined)) {
      sheet.getRange(rowNumber, newActiveIndex + 1).setValue(active);
    }

    employees.push({
      id: employeeId,
      name: name,
      role: role,
      active: active,
      payType: normalizeText(getAnyCell(row, headers, ["PayType"])),
      dailyRate: payrollNumber(getAnyCell(row, headers, ["DailyRate"])),
      hourlyRate: payrollNumber(getAnyCell(row, headers, ["HourlyRate"])),
      phoneAllowance: payrollNumber(getAnyCell(row, headers, ["PhoneAllowance"])),
      defaultPayCycle: normalizeText(getAnyCell(row, headers, ["DefaultPayCycle"])),
      weeklySchedule: parsePayrollJsonObject(getAnyCell(row, headers, ["WeeklySchedule"])),
      weeklyScheduleEffectiveFrom: normalizePayrollDate(getAnyCell(row, headers, ["WeeklyScheduleEffectiveFrom"]))
    });
  });

  return employees;
}

function debugPayrollEmployees() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.EMPLOYEES);

  if (!sheet) {
    return {
      spreadsheetName: spreadsheet.getName(),
      sheetExists: false,
      headers: [],
      rowCount: 0,
      firstFiveRows: [],
      parsedEmployees: []
    };
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const values = lastRow && lastColumn
    ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
    : [];
  const headers = values.length ? values[0].map(String) : [];
  const firstFiveRows = values.slice(1, 6);
  const table = readPayrollTable(sheet);
  const employeeNameIndex = getPayrollHeaderIndex(table.headers, ["employeeName"]);
  const nameIndex = getPayrollHeaderIndex(table.headers, ["Name"]);
  const oldActiveIndex = getPayrollHeaderIndex(table.headers, ["active"]);
  const newActiveIndex = getPayrollHeaderIndex(table.headers, ["Active"]);
  const parsedNamePerRow = table.rows.slice(0, 10).map((row, index) => ({
    rowNumber: index + 2,
    employeeNameCell: employeeNameIndex >= 0 ? row[employeeNameIndex] : "",
    nameCell: nameIndex >= 0 ? row[nameIndex] : "",
    parsedName: normalizeText(
      (employeeNameIndex >= 0 ? row[employeeNameIndex] : "") ||
      (nameIndex >= 0 ? row[nameIndex] : "")
    ),
    oldActiveCell: oldActiveIndex >= 0 ? row[oldActiveIndex] : "",
    newActiveCell: newActiveIndex >= 0 ? row[newActiveIndex] : ""
  }));

  return {
    spreadsheetName: spreadsheet.getName(),
    sheetExists: true,
    headers,
    rowCount: Math.max(lastRow - 1, 0),
    firstFiveRows,
    parsedNamePerRow,
    parsedEmployees: getPayrollEmployees()
  };
}

function debugEmployeeSchedule() {
  const sheet = ensurePayrollEmployeeHeaders();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const values = lastRow && lastColumn
    ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
    : [];
  const headers = values.length ? values[0].map(String) : [];

  return {
    headers,
    firstFiveRows: values.slice(1, 6),
    parsedEmployees: getPayrollEmployees().map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      dailyRate: employee.dailyRate,
      weeklySchedule: employee.weeklySchedule,
      weeklyScheduleEffectiveFrom: employee.weeklyScheduleEffectiveFrom
    }))
  };
}

function savePayrollEmployee(employee) {
  return withPayrollLock(function () {
    if (!employee || !employee.name) {
      return {
        ok: false,
        error: "Missing employee"
      };
    }

    const sheet = ensurePayrollEmployeeHeaders();
    upsertPayrollEmployee(sheet, employee);

    return {
      ok: true,
      data: employee
    };
  });
}

function savePayrollEmployees(employees) {
  return withPayrollLock(function () {
    const sheet = ensurePayrollEmployeeHeaders();
    (employees || []).forEach((employee) => {
      upsertPayrollEmployee(sheet, employee);
    });

    return {
      ok: true,
      data: {
        count: (employees || []).length
      }
    };
  });
}

function upsertPayrollEmployee(sheet, employee) {
  const table = readPayrollTable(sheet);
  const name = normalizeText(employee.name || employee.employeeName);
  const employeeId = normalizeText(employee.id || employee.employeeId) || "emp-" + Date.now();
  let rowNumber = findPayrollRowByAliases(table, ["EmployeeID"], employeeId);

  if (!rowNumber && name) {
    rowNumber = findPayrollRowByAliases(table, PAYROLL_EMPLOYEE_NAME_ALIASES, name);
  }

  if (!rowNumber) {
    rowNumber = sheet.getLastRow() + 1;
  }

  const now = getTimestamp();
  const existingRow = rowNumber <= sheet.getLastRow()
    ? sheet.getRange(rowNumber, 1, 1, table.headers.length).getValues()[0]
    : [];
  const hasWeeklySchedulePayload = Object.prototype.hasOwnProperty.call(employee, "weeklySchedule");
  const hasWeeklyScheduleEffectiveFromPayload = Object.prototype.hasOwnProperty.call(employee, "weeklyScheduleEffectiveFrom");
  const values = {
    EmployeeID: employeeId,
    Name: name,
    employeeName: name,
    EmployeeName: name,
    Employee: name,
    "ชื่อพนักงาน": name,
    "ชื่อ": name,
    "พนักงาน": name,
    "รายชื่อ": name,
    "ชื่อ-สกุล": name,
    Role: employee.role === "parttime" ? "parttime" : "fulltime",
    Active: employee.active === false ? false : true,
    active: employee.active === false ? false : true,
    PayType: employee.payType || "",
    DailyRate: payrollNumber(employee.dailyRate),
    HourlyRate: payrollNumber(employee.hourlyRate),
    PhoneAllowance: payrollNumber(employee.phoneAllowance),
    DefaultPayCycle: employee.defaultPayCycle || "",
    WeeklySchedule: hasWeeklySchedulePayload
      ? stringifyPayrollJsonObject(employee.weeklySchedule)
      : getAnyCell(existingRow, table.headers, ["WeeklySchedule"]),
    WeeklyScheduleEffectiveFrom: hasWeeklyScheduleEffectiveFromPayload
      ? employee.weeklyScheduleEffectiveFrom || ""
      : getAnyCell(existingRow, table.headers, ["WeeklyScheduleEffectiveFrom"]),
    UpdatedAt: now,
    updatedAt: now
  };

  writePayrollObjectToRow(sheet, table.headers, rowNumber, values);
}

function getPayrollAttendance() {
  const sheet = getOrCreateSheet(SHEET_NAMES.ATTENDANCE, HEADERS.ATTENDANCE);
  const table = readPayrollTable(sheet);
  const records = [];

  table.rows.forEach((row) => {
    const date = normalizePayrollDate(getAnyCell(row, table.headers, ["วันที่", "Date"]));
    const employeeName = normalizeText(getAnyCell(row, table.headers, ["ชื่อพนักงาน", "ชื่อ", "Name", "employeeName"]));

    if (!date || !employeeName) {
      return;
    }

    records.push({
      date,
      employeeName,
      checkInTime: normalizePayrollTime(getAnyCell(row, table.headers, ["เวลาเข้า", "CheckIn", "Check In"])),
      checkOutTime: normalizePayrollTime(getAnyCell(row, table.headers, ["เวลาออก", "CheckOut", "Check Out"])),
      note: String(getAnyCell(row, table.headers, ["note", "Note", "หมายเหตุ"]) || "")
    });
  });

  return records;
}

function getPayrollPayments(params) {
  const sheet = ensurePayrollPaymentsSheet();
  const table = readPayrollTable(sheet);

  return table.rows
    .map((row) => payrollPaymentFromRow(row, table.headers))
    .filter((payment) => {
      if (!payment.paymentId) return false;
      if (params && params.workerType && payment.workerType !== params.workerType) return false;
      if (params && params.employeeId && payment.employeeId !== params.employeeId) return false;
      return true;
    });
}

function activePaymentStatus(status) {
  return ["paid", "calculated"].indexOf(normalizeText(status)) !== -1;
}

function paymentBusinessKey(payment) {
  if (payment.businessKey) return normalizeText(payment.businessKey);
  const workerType = normalizeText(payment.workerType);

  if (workerType === "parttime") {
    const selectedDates = Array.isArray(payment.selectedDates)
      ? payment.selectedDates
      : parsePayrollJsonArray(payment.selectedDates);
    return [
      "parttime",
      payment.employeeId || "",
      selectedDates.slice().sort().join(",")
    ].join("|");
  }

  return [
    "fulltime",
    payment.employeeId || "",
    payment.periodStart || "",
    payment.periodEnd || "",
    payment.periodHalf || ""
  ].join("|");
}

function activePaymentDates(payment) {
  const excluded = parsePayrollJsonArray(payment.excludedDates);
  const excludedMap = {};
  excluded.forEach(function (date) {
    excludedMap[normalizePayrollDate(date)] = true;
  });

  const selectedDates = parsePayrollJsonArray(payment.selectedDates).map(normalizePayrollDate).filter(Boolean);
  const baseDates = selectedDates.length
    ? selectedDates
    : payrollDateRange(payment.periodStart, payment.periodEnd);

  return baseDates.filter(function (date) {
    return !excludedMap[date];
  });
}

function payrollDateRange(start, end) {
  const startDate = normalizePayrollDate(start);
  const endDate = normalizePayrollDate(end);
  if (!startDate || !endDate || startDate > endDate) return [];

  const parts = startDate.split("-").map(Number);
  const endParts = endDate.split("-").map(Number);
  const cursor = new Date(parts[0], parts[1] - 1, parts[2]);
  const last = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  const dates = [];

  while (cursor <= last) {
    dates.push(Utilities.formatDate(cursor, TIMEZONE, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function hasActiveDuplicatePayment(table, payment) {
  const currentPaymentId = normalizeText(payment.paymentId);
  const currentBusinessKey = paymentBusinessKey(payment);
  const currentDates = activePaymentDates(payment);
  const currentDateMap = {};
  currentDates.forEach(function (date) {
    currentDateMap[date] = true;
  });

  return table.rows.some(function (row) {
    const existing = payrollPaymentFromRow(row, table.headers);
    if (!existing.paymentId) return false;
    if (normalizeText(existing.paymentId) === currentPaymentId) return false;
    if (existing.employeeId !== payment.employeeId) return false;
    if (!activePaymentStatus(existing.status)) return false;

    const existingBusinessKey = paymentBusinessKey(existing);
    if (currentBusinessKey && existingBusinessKey === currentBusinessKey) return true;

    const existingDates = activePaymentDates(existing);
    return existingDates.some(function (date) {
      return currentDateMap[date] === true;
    });
  });
}

function savePayrollPayment(payment) {
  return withPayrollLock(function () {
    if (!payment || !payment.paymentId) {
      return {
        ok: false,
        error: "Missing payment"
      };
    }

    const sheet = ensurePayrollPaymentsSheet();
    const table = readPayrollTable(sheet);
    const existingRowNumber = findPayrollRowByAliases(table, ["PaymentID"], payment.paymentId);

    if (!existingRowNumber && hasActiveDuplicatePayment(table, payment)) {
      return {
        ok: false,
        code: "DUPLICATE_PAYMENT",
        error: "มีรายการจ่ายเงินซ้ำ"
      };
    }

    const rowNumber = existingRowNumber || sheet.getLastRow() + 1;
    const existingRow = rowNumber <= sheet.getLastRow() ? sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    const now = getTimestamp();

    const values = {
    PaymentID: payment.paymentId,
    WorkerType: payment.workerType || "",
    EmployeeID: payment.employeeId || "",
    EmployeeName: payment.employeeName || "",
    PeriodStart: payment.periodStart || "",
    PeriodEnd: payment.periodEnd || "",
    PaymentType: payment.paymentType || "",
    TotalWorkedDays: payrollNumber(payment.totalWorkedDays || payment.workedDays),
    BasePay: payrollNumber(payment.basePay),
    PhoneAllowance: payrollNumber(payment.phoneAllowance),
    CupBonus: payrollNumber(payment.cupBonus),
    MissingMoney: payrollNumber(payment.missingMoney),
    MissingMoneyShare: payrollNumber(payment.missingMoneyShare),
    BonusAdjustment: payrollNumber(payment.bonusAdjustment),
    FuelAllowance: payrollNumber(payment.fuelAllowance),
    TotalWage: payrollNumber(payment.totalWage),
    TotalKilometers: payrollNumber(payment.totalKilometers),
    FuelPrice: payrollNumber(payment.fuelPrice),
    BurnRate: payrollNumber(payment.burnRate),
    DepreciationFactor: payrollNumber(payment.depreciationFactor),
    TotalPay: payrollNumber(payment.totalPay || payment.netPay),
    Status: payment.status || "paid",
    ExcludedDates: JSON.stringify(payment.excludedDates || []),
    PaidAt: payment.paidAt || "",
    PaidBy: payment.paidBy || "",
    CancelledAt: payment.cancelledAt || "",
    CancelledBy: payment.cancelledBy || "",
    Note: payment.note || "",
    CreatedAt: getAnyCell(existingRow, table.headers, ["CreatedAt"]) || now,
    UpdatedAt: now,
    EffectiveDailyRate: payrollNumber(payment.effectiveDailyRate),
    TotalOTMinutes: payrollNumber(payment.totalOtMinutes),
    TotalLeaveMinutes: payrollNumber(payment.totalLeaveMinutes),
    OTPay: payrollNumber(payment.otPay),
    LeaveDeduction: payrollNumber(payment.leaveDeduction),
    WorkedDaysWith170Cups: payrollNumber(payment.workedDaysWith170Cups),
    WorkedDaysWith200Cups: payrollNumber(payment.workedDaysWith200Cups),
    CupBonus170: payrollNumber(payment.cupBonus170),
    CupBonus200: payrollNumber(payment.cupBonus200),
    DamageDeduction: payrollNumber(payment.damageDeduction),
    IncludedItems: JSON.stringify(payment.includedItems || {}),
    EarlyCheckInDays: payrollNumber(payment.earlyCheckInDays),
    EarlyCheckInDates: JSON.stringify(payment.earlyCheckInDates || []),
    LateCheckInDays: payrollNumber(payment.lateCheckInDays),
    LateCheckInDates: JSON.stringify(payment.lateCheckInDates || []),
      OtherDeduction: payrollNumber(payment.otherDeduction || payment.deduction),
      BusinessKey: payment.businessKey || paymentBusinessKey(payment),
      FormulaVersion: payment.formulaVersion || "",
      SelectedDates: JSON.stringify(payment.selectedDates || []),
      PaidStatusEdits: JSON.stringify(payment.paidStatusEdits || []),
      PaymentDayBreakdown: JSON.stringify(payment.paymentDayBreakdown || []),
      RawComponents: JSON.stringify(payment.rawComponents || {}),
      AppliedComponents: JSON.stringify(payment.appliedComponents || {}),
      CupDataSnapshot: JSON.stringify(payment.cupDataSnapshot || {})
    };

    writePayrollObjectToRow(sheet, table.headers, rowNumber, values);

    return {
      ok: true,
      data: payment
    };
  });
}

function payrollPaymentFromRow(row, headers) {
  return {
    paymentId: normalizeText(getAnyCell(row, headers, ["PaymentID"])),
    workerType: normalizeText(getAnyCell(row, headers, ["WorkerType"])),
    employeeId: normalizeText(getAnyCell(row, headers, ["EmployeeID"])),
    employeeName: normalizeText(getAnyCell(row, headers, ["EmployeeName"])),
    periodStart: normalizePayrollDate(getAnyCell(row, headers, ["PeriodStart"])),
    periodEnd: normalizePayrollDate(getAnyCell(row, headers, ["PeriodEnd"])),
    paymentType: normalizeText(getAnyCell(row, headers, ["PaymentType"])),
    totalWorkedDays: payrollNumber(getAnyCell(row, headers, ["TotalWorkedDays"])),
    basePay: payrollNumber(getAnyCell(row, headers, ["BasePay"])),
    phoneAllowance: payrollNumber(getAnyCell(row, headers, ["PhoneAllowance"])),
    cupBonus: payrollNumber(getAnyCell(row, headers, ["CupBonus"])),
    missingMoney: payrollNumber(getAnyCell(row, headers, ["MissingMoney"])),
    missingMoneyShare: payrollNumber(getAnyCell(row, headers, ["MissingMoneyShare"])),
    bonusAdjustment: payrollNumber(getAnyCell(row, headers, ["BonusAdjustment"])),
    fuelAllowance: payrollNumber(getAnyCell(row, headers, ["FuelAllowance"])),
    totalWage: payrollNumber(getAnyCell(row, headers, ["TotalWage"])),
    totalKilometers: payrollNumber(getAnyCell(row, headers, ["TotalKilometers"])),
    fuelPrice: payrollNumber(getAnyCell(row, headers, ["FuelPrice"])),
    burnRate: payrollNumber(getAnyCell(row, headers, ["BurnRate"])),
    depreciationFactor: payrollNumber(getAnyCell(row, headers, ["DepreciationFactor"])),
    totalPay: payrollNumber(getAnyCell(row, headers, ["TotalPay"])),
    effectiveDailyRate: payrollNumber(getAnyCell(row, headers, ["EffectiveDailyRate"])),
    totalOtMinutes: payrollNumber(getAnyCell(row, headers, ["TotalOTMinutes"])),
    totalLeaveMinutes: payrollNumber(getAnyCell(row, headers, ["TotalLeaveMinutes"])),
    otPay: payrollNumber(getAnyCell(row, headers, ["OTPay"])),
    leaveDeduction: payrollNumber(getAnyCell(row, headers, ["LeaveDeduction"])),
    workedDaysWith170Cups: payrollNumber(getAnyCell(row, headers, ["WorkedDaysWith170Cups"])),
    workedDaysWith200Cups: payrollNumber(getAnyCell(row, headers, ["WorkedDaysWith200Cups"])),
    cupBonus170: payrollNumber(getAnyCell(row, headers, ["CupBonus170"])),
    cupBonus200: payrollNumber(getAnyCell(row, headers, ["CupBonus200"])),
    damageDeduction: payrollNumber(getAnyCell(row, headers, ["DamageDeduction"])),
    includedItems: parsePayrollJsonObject(getAnyCell(row, headers, ["IncludedItems"])),
    earlyCheckInDays: payrollNumber(getAnyCell(row, headers, ["EarlyCheckInDays"])),
    earlyCheckInDates: parsePayrollJsonArray(getAnyCell(row, headers, ["EarlyCheckInDates"])),
    lateCheckInDays: payrollNumber(getAnyCell(row, headers, ["LateCheckInDays"])),
    lateCheckInDates: parsePayrollJsonArray(getAnyCell(row, headers, ["LateCheckInDates"])),
    otherDeduction: payrollNumber(getAnyCell(row, headers, ["OtherDeduction"])),
    businessKey: normalizeText(getAnyCell(row, headers, ["BusinessKey"])),
    formulaVersion: normalizeText(getAnyCell(row, headers, ["FormulaVersion"])),
    selectedDates: parsePayrollJsonArray(getAnyCell(row, headers, ["SelectedDates"])),
    paidStatusEdits: parsePayrollJsonArray(getAnyCell(row, headers, ["PaidStatusEdits"])),
    paymentDayBreakdown: parsePayrollJsonArray(getAnyCell(row, headers, ["PaymentDayBreakdown"])),
    rawComponents: parsePayrollJsonObject(getAnyCell(row, headers, ["RawComponents"])),
    appliedComponents: parsePayrollJsonObject(getAnyCell(row, headers, ["AppliedComponents"])),
    cupDataSnapshot: parsePayrollJsonObject(getAnyCell(row, headers, ["CupDataSnapshot"])),
    status: normalizeText(getAnyCell(row, headers, ["Status"])) || "paid",
    excludedDates: parsePayrollJsonArray(getAnyCell(row, headers, ["ExcludedDates"])),
    paidAt: formatSheetTimestamp(getAnyCell(row, headers, ["PaidAt"])),
    paidBy: normalizeText(getAnyCell(row, headers, ["PaidBy"])),
    cancelledAt: formatSheetTimestamp(getAnyCell(row, headers, ["CancelledAt"])),
    cancelledBy: normalizeText(getAnyCell(row, headers, ["CancelledBy"])),
    note: String(getAnyCell(row, headers, ["Note"]) || "")
  };
}

function getPayrollConfirmations() {
  const sheet = ensurePayrollConfirmationsSheet();
  const table = readPayrollTable(sheet);
  return table.rows
    .map((row) => payrollConfirmationFromRow(row, table.headers))
    .filter((record) => record.date && record.employeeId);
}

function savePayrollConfirmation(record) {
  return withPayrollLock(function () {
    if (!record || !record.date || !(record.employeeId || record.EmployeeID)) {
      return { ok: false, error: "Missing confirmation" };
    }

    const sheet = ensurePayrollConfirmationsSheet();
    upsertPayrollDailyRecord(sheet, PAYROLL_CONFIRMATION_HEADERS, confirmationValues(record));
    return { ok: true, data: record };
  });
}

function savePayrollConfirmations(records) {
  return withPayrollLock(function () {
    const sheet = ensurePayrollConfirmationsSheet();
    (records || []).forEach((record) => {
      if (record && record.date && (record.employeeId || record.EmployeeID)) {
        upsertPayrollDailyRecord(sheet, PAYROLL_CONFIRMATION_HEADERS, confirmationValues(record));
      }
    });
    return { ok: true, data: { count: (records || []).length } };
  });
}

function getPartTimeRecords() {
  const sheet = ensurePartTimeRecordsSheet();
  const table = readPayrollTable(sheet);
  return table.rows
    .map((row) => partTimeRecordFromRow(row, table.headers))
    .filter((record) => record.date && record.employeeId);
}

function savePartTimeRecord(record) {
  return withPayrollLock(function () {
    if (!record || !record.date || !(record.employeeId || record.EmployeeID)) {
      return { ok: false, error: "Missing part time record" };
    }

    const sheet = ensurePartTimeRecordsSheet();
    upsertPayrollDailyRecord(sheet, PART_TIME_RECORD_HEADERS, partTimeRecordValues(record));
    return { ok: true, data: record };
  });
}

function savePartTimeRecords(records) {
  return withPayrollLock(function () {
    const sheet = ensurePartTimeRecordsSheet();
    (records || []).forEach((record) => {
      if (record && record.date && (record.employeeId || record.EmployeeID)) {
        upsertPayrollDailyRecord(sheet, PART_TIME_RECORD_HEADERS, partTimeRecordValues(record));
      }
    });
    return { ok: true, data: { count: (records || []).length } };
  });
}

function upsertPayrollDailyRecord(sheet, headers, values) {
  const table = readPayrollTable(sheet);
  const rowNumber = findPayrollDailyRecordRow(table, values.EmployeeID, values.Date) || sheet.getLastRow() + 1;
  writePayrollObjectToRow(sheet, headers, rowNumber, values);
}

function findPayrollDailyRecordRow(table, employeeId, date) {
  const targetEmployeeId = normalizeText(employeeId);
  const targetDate = normalizePayrollDate(date);
  const employeeIndex = getPayrollHeaderIndex(table.headers, ["EmployeeID"]);
  const dateIndex = getPayrollHeaderIndex(table.headers, ["Date"]);
  if (employeeIndex < 0 || dateIndex < 0 || !targetEmployeeId || !targetDate) return 0;

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const row = table.rows[rowIndex];
    if (normalizeText(row[employeeIndex]) === targetEmployeeId && normalizePayrollDate(row[dateIndex]) === targetDate) {
      return rowIndex + 2;
    }
  }

  return 0;
}

function confirmationValues(record) {
  const employeeId = normalizeText(record.employeeId || record.EmployeeID);
  const date = normalizePayrollDate(record.date || record.Date);
  return {
    RecordID: normalizeText(record.recordId || record.RecordID) || employeeId + "_" + date,
    Date: date,
    EmployeeID: employeeId,
    EmployeeName: normalizeText(record.employeeName || record.EmployeeName),
    Confirmed: parsePayrollBoolean(record.confirmed !== undefined ? record.confirmed : record.Confirmed, false),
    WorkStatus: normalizeText(record.workStatus || record.WorkStatus || "pending"),
    RawCheckInTime: normalizePayrollTime(record.rawCheckInTime || record.RawCheckInTime),
    RawCheckOutTime: normalizePayrollTime(record.rawCheckOutTime || record.RawCheckOutTime),
    ScheduledStart: normalizePayrollTime(record.scheduledStart || record.ScheduledStart),
    ScheduledEnd: normalizePayrollTime(record.scheduledEnd || record.ScheduledEnd),
    OTMinutes: payrollNumber(record.otMinutes !== undefined ? record.otMinutes : record.OTMinutes),
    LeaveMinutes: payrollNumber(record.leaveMinutes !== undefined ? record.leaveMinutes : record.LeaveMinutes),
    ManagerNote: String(record.managerNote || record.ManagerNote || ""),
    Kilometers: payrollNumber(record.kilometers !== undefined ? record.kilometers : record.Kilometers),
    ManualTimeEdited: parsePayrollBoolean(record.manualTimeEdited !== undefined ? record.manualTimeEdited : record.ManualTimeEdited, false),
    ManualTimeEditedAt: record.manualTimeEditedAt || record.ManualTimeEditedAt || "",
    ManualTimeEditedBy: record.manualTimeEditedBy || record.ManualTimeEditedBy || "",
    ScheduleTimeEdited: parsePayrollBoolean(record.scheduleTimeEdited !== undefined ? record.scheduleTimeEdited : record.ScheduleTimeEdited, false),
    ScheduleTimeEditedAt: record.scheduleTimeEditedAt || record.ScheduleTimeEditedAt || "",
    ScheduleTimeEditedBy: record.scheduleTimeEditedBy || record.ScheduleTimeEditedBy || "",
    UpdatedAt: record.updatedAt || record.UpdatedAt || getTimestamp()
  };
}

function partTimeRecordValues(record) {
  const employeeId = normalizeText(record.employeeId || record.EmployeeID);
  const date = normalizePayrollDate(record.date || record.Date);
  return {
    RecordID: normalizeText(record.recordId || record.RecordID) || employeeId + "_" + date,
    Date: date,
    EmployeeID: employeeId,
    EmployeeName: normalizeText(record.employeeName || record.EmployeeName),
    Confirmed: parsePayrollBoolean(record.confirmed !== undefined ? record.confirmed : record.Confirmed, false),
    CheckInTime: normalizePayrollTime(record.checkInTime || record.CheckInTime),
    CheckOutTime: normalizePayrollTime(record.checkOutTime || record.CheckOutTime),
    ScheduledStart: normalizePayrollTime(record.scheduledStart || record.ScheduledStart),
    ScheduledEnd: normalizePayrollTime(record.scheduledEnd || record.ScheduledEnd),
    WorkedMinutes: payrollNumber(record.workedMinutes !== undefined ? record.workedMinutes : record.WorkedMinutes),
    Wage: payrollNumber(record.wage !== undefined ? record.wage : record.Wage),
    Kilometers: payrollNumber(record.kilometers !== undefined ? record.kilometers : record.Kilometers),
    Note: String(record.note || record.Note || ""),
    ManualTimeEdited: parsePayrollBoolean(record.manualTimeEdited !== undefined ? record.manualTimeEdited : record.ManualTimeEdited, false),
    ManualTimeEditedAt: record.manualTimeEditedAt || record.ManualTimeEditedAt || "",
    ManualTimeEditedBy: record.manualTimeEditedBy || record.ManualTimeEditedBy || "",
    ScheduleTimeEdited: parsePayrollBoolean(record.scheduleTimeEdited !== undefined ? record.scheduleTimeEdited : record.ScheduleTimeEdited, false),
    ScheduleTimeEditedAt: record.scheduleTimeEditedAt || record.ScheduleTimeEditedAt || "",
    ScheduleTimeEditedBy: record.scheduleTimeEditedBy || record.ScheduleTimeEditedBy || "",
    UpdatedAt: record.updatedAt || record.UpdatedAt || getTimestamp()
  };
}

function payrollConfirmationFromRow(row, headers) {
  return {
    recordId: normalizeText(getAnyCell(row, headers, ["RecordID"])),
    date: normalizePayrollDate(getAnyCell(row, headers, ["Date"])),
    employeeId: normalizeText(getAnyCell(row, headers, ["EmployeeID"])),
    employeeName: normalizeText(getAnyCell(row, headers, ["EmployeeName"])),
    confirmed: parsePayrollBoolean(getAnyCell(row, headers, ["Confirmed"]), false),
    workStatus: normalizeText(getAnyCell(row, headers, ["WorkStatus"])) || "pending",
    rawCheckInTime: normalizePayrollTime(getAnyCell(row, headers, ["RawCheckInTime"])),
    rawCheckOutTime: normalizePayrollTime(getAnyCell(row, headers, ["RawCheckOutTime"])),
    scheduledStart: normalizePayrollTime(getAnyCell(row, headers, ["ScheduledStart"])),
    scheduledEnd: normalizePayrollTime(getAnyCell(row, headers, ["ScheduledEnd"])),
    otMinutes: payrollNumber(getAnyCell(row, headers, ["OTMinutes"])),
    leaveMinutes: payrollNumber(getAnyCell(row, headers, ["LeaveMinutes"])),
    managerNote: String(getAnyCell(row, headers, ["ManagerNote"]) || ""),
    kilometers: payrollNumber(getAnyCell(row, headers, ["Kilometers"])),
    manualTimeEdited: parsePayrollBoolean(getAnyCell(row, headers, ["ManualTimeEdited"]), false),
    manualTimeEditedAt: formatSheetTimestamp(getAnyCell(row, headers, ["ManualTimeEditedAt"])),
    manualTimeEditedBy: normalizeText(getAnyCell(row, headers, ["ManualTimeEditedBy"])),
    scheduleTimeEdited: parsePayrollBoolean(getAnyCell(row, headers, ["ScheduleTimeEdited"]), false),
    scheduleTimeEditedAt: formatSheetTimestamp(getAnyCell(row, headers, ["ScheduleTimeEditedAt"])),
    scheduleTimeEditedBy: normalizeText(getAnyCell(row, headers, ["ScheduleTimeEditedBy"])),
    updatedAt: formatSheetTimestamp(getAnyCell(row, headers, ["UpdatedAt"]))
  };
}

function partTimeRecordFromRow(row, headers) {
  return {
    recordId: normalizeText(getAnyCell(row, headers, ["RecordID"])),
    date: normalizePayrollDate(getAnyCell(row, headers, ["Date"])),
    employeeId: normalizeText(getAnyCell(row, headers, ["EmployeeID"])),
    employeeName: normalizeText(getAnyCell(row, headers, ["EmployeeName"])),
    confirmed: parsePayrollBoolean(getAnyCell(row, headers, ["Confirmed"]), false),
    checkInTime: normalizePayrollTime(getAnyCell(row, headers, ["CheckInTime"])),
    checkOutTime: normalizePayrollTime(getAnyCell(row, headers, ["CheckOutTime"])),
    scheduledStart: normalizePayrollTime(getAnyCell(row, headers, ["ScheduledStart"])),
    scheduledEnd: normalizePayrollTime(getAnyCell(row, headers, ["ScheduledEnd"])),
    workedMinutes: payrollNumber(getAnyCell(row, headers, ["WorkedMinutes"])),
    wage: payrollNumber(getAnyCell(row, headers, ["Wage"])),
    kilometers: payrollNumber(getAnyCell(row, headers, ["Kilometers"])),
    note: String(getAnyCell(row, headers, ["Note"]) || ""),
    manualTimeEdited: parsePayrollBoolean(getAnyCell(row, headers, ["ManualTimeEdited"]), false),
    manualTimeEditedAt: formatSheetTimestamp(getAnyCell(row, headers, ["ManualTimeEditedAt"])),
    manualTimeEditedBy: normalizeText(getAnyCell(row, headers, ["ManualTimeEditedBy"])),
    scheduleTimeEdited: parsePayrollBoolean(getAnyCell(row, headers, ["ScheduleTimeEdited"]), false),
    scheduleTimeEditedAt: formatSheetTimestamp(getAnyCell(row, headers, ["ScheduleTimeEditedAt"])),
    scheduleTimeEditedBy: normalizeText(getAnyCell(row, headers, ["ScheduleTimeEditedBy"])),
    updatedAt: formatSheetTimestamp(getAnyCell(row, headers, ["UpdatedAt"]))
  };
}

function readPayrollTable(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    return {
      headers: [],
      rows: []
    };
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();

  return {
    headers: values[0].map(String),
    rows: values.slice(1)
  };
}

function getAnyCell(row, headers, aliases) {
  const index = getPayrollHeaderIndex(headers, aliases);
  return index >= 0 ? row[index] : "";
}

function setAnyCell(sheet, rowNumber, headers, aliases, value) {
  const index = getPayrollHeaderIndex(headers, aliases);

  if (index >= 0) {
    sheet.getRange(rowNumber, index + 1).setValue(value);
  }
}

function getPayrollHeaderIndex(headers, aliases) {
  for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
    const normalizedAlias = normalizePayrollHeader(aliases[aliasIndex]);
    const index = headers.findIndex((header) => normalizePayrollHeader(header) === normalizedAlias);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function findPayrollRowByAliases(table, aliases, value) {
  const target = normalizeText(value);

  if (!target) {
    return 0;
  }

  const columnIndexes = aliases
    .map((alias) => getPayrollHeaderIndex(table.headers, [alias]))
    .filter((index) => index >= 0);

  if (!columnIndexes.length) {
    return 0;
  }

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const row = table.rows[rowIndex];
    const found = columnIndexes.some((columnIndex) => normalizeText(row[columnIndex]) === target);

    if (found) {
      return rowIndex + 2;
    }
  }

  return 0;
}

function writePayrollObjectToRow(sheet, headers, rowNumber, values) {
  const existing = rowNumber <= sheet.getLastRow()
    ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]
    : [];
  const row = headers.map((header, index) => (
    Object.prototype.hasOwnProperty.call(values, header) ? values[header] : existing[index] || ""
  ));

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

function normalizePayrollHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizePayrollDate(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
  }

  const text = normalizeText(value);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (iso) {
    return iso[1] + "-" + padPayrollNumber(iso[2]) + "-" + padPayrollNumber(iso[3]);
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (slash) {
    return slash[3] + "-" + padPayrollNumber(slash[2]) + "-" + padPayrollNumber(slash[1]);
  }

  return text;
}

function normalizePayrollTime(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, TIMEZONE, "HH:mm");
  }

  const text = normalizeText(value).replace(".", ":");
  const compact = text.replace(/[^0-9]/g, "");
  let hours;
  let minutes;

  if (text.indexOf(":") !== -1) {
    const parts = text.split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else if (compact.length === 3) {
    hours = Number(compact.slice(0, 1));
    minutes = Number(compact.slice(1));
  } else if (compact.length === 4) {
    hours = Number(compact.slice(0, 2));
    minutes = Number(compact.slice(2));
  } else if (compact.length === 1 || compact.length === 2) {
    hours = Number(compact);
    minutes = 0;
  } else {
    return "";
  }

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }

  return padPayrollNumber(hours) + ":" + padPayrollNumber(minutes);
}

function parsePayrollBoolean(value, fallback) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() !== "false";
}

function payrollNumber(value) {
  const number = Number(value || 0);
  return isNaN(number) ? 0 : number;
}

function parsePayrollJsonArray(value) {
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function parsePayrollJsonObject(value) {
  if (!value) return {};

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function stringifyPayrollJsonObject(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const parsed = parsePayrollJsonObject(value);
    return parsed ? JSON.stringify(parsed) : value;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return "";
}

function padPayrollNumber(value) {
  return String(value).padStart(2, "0");
}

function addPayrollTiming(result, requestStartedAt, requestId) {
  const finishedAt = Date.now();

  return Object.assign(
    {},
    result || {},
    {
      requestId: requestId || "",
      serverDurationMs: finishedAt - requestStartedAt,
      serverFinishedAt: new Date(finishedAt).toISOString()
    }
  );
}

function writePayrollResponse(data) {
  const output = data && typeof data === "object"
    ? Object.assign({}, data)
    : {
      ok: false,
      error: "Invalid response"
    };

  if (output.ok === true || output.success === true) {
    output.ok = true;
    output.success = true;
  } else {
    output.ok = false;
    output.success = false;
    output.error = output.error || "API error";
  }

  return writeResponse(output);
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
