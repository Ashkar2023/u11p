const SHEET_NAME = "PaymentTracker";
const PASSWORD = "";
const HEADERS = ["matchday_id", "player_name", "paid", "amount_upi", "amount_cash", "timestamp", "player_id"];

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || "").toLowerCase();

    if (action === "verify_password") {
      const password = String(params.password || "");
      return respond({ success: true, valid: password === PASSWORD });
    }

    const matchdayId = params.matchday_id ? Number(params.matchday_id) : null;
    const sheet = ensureSheet();
    const values = sheet.getDataRange().getValues();

    if (!values.length) {
      return respond({ success: true, rows: [], readOnly: true });
    }

    const headers = values[0];
    const rows = values.slice(1)
      .filter((row) => row.some((cell) => cell !== ""))
      .map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      })
      .filter((row) => !matchdayId || Number(row.matchday_id) === Number(matchdayId));

    return respond({ success: true, rows, readOnly: true });
  } catch (err) {
    return respond({ success: false, reason: err.message });
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};

    if (String(body.password || "") !== PASSWORD) {
      return respond({ success: false, reason: "unauthorized", readOnly: true });
    }

    const { matchday_id, player_id, player_name, paid, amount_upi, amount_cash } = body;
    if (!matchday_id || player_id === undefined || player_id === null || player_id === "") {
      return respond({ success: false, reason: "matchday_id and player_id are required" });
    }

    const sheet = ensureSheet();
    const values = sheet.getDataRange().getValues();
    const existingRowIndex = values.findIndex((row, index) => {
      if (index === 0) return false;
      return String(row[0]) === String(matchday_id) && String(row[6]).trim() === String(player_id);
    });

    const row = [
      String(matchday_id),
      String(player_name),
      Boolean(paid),
      Number(amount_upi) || 0,
      Number(amount_cash) || 0,
      new Date().toISOString(),
      String(player_id),
    ];

    if (existingRowIndex !== -1) {
      sheet.getRange(existingRowIndex + 1, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return respond({ success: true, row });
  } catch (err) {
    return respond({ success: false, reason: err.message });
  }
}

function ensureSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length || values[0].join("|") !== HEADERS.join("|")) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}