function doGet(e) {
    try {
        const matchId = e.parameter.match_id;

        if (!matchId) {
            return respond({ success: false, reason: "Match ID is required" });
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(`match_${matchId}`);

        if (!sheet) {
            return respond({ success: false, reason: "match sheet not found" });
        }

        const lastRow = sheet.getLastRow();

        if (lastRow <= 1) {
            return respond({ success: true, votes: [] });
        }

        const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
        const votes = rows
            .filter(row => row[0] !== "")
            .map(row => ({
                voterId: row[0],
                voterName: row[1],
                candidateId: row[2],
                candidateName: row[3],
                timestamp: row[4],
            }));

        return respond({ success: true, data });
    } catch (err) {
        return respond({ success: false, reason: err.message });
    }
}

function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents);
        const { matchId, voterId, voterName, candidateId, candidateName } = body;

        if (!matchId || !voterId || !voterName || !candidateId || !candidateName) {
            return respond({ success: false, reason: "missing required fields" });
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(`match_${matchId}`);

        if (!sheet) {
            return respond({ success: false, reason: "match sheet not found" });
        }

        const lastRow = sheet.getLastRow();

        if (lastRow > 1) {
            const existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
            if (existingIds.includes(voterId)) {
                return respond({ success: false, reason: "already_voted" });
            }
        }

        sheet.appendRow([voterId, voterName, candidateId, candidateName, new Date()]);

        return respond({ success: true });

    } catch (err) {
        return respond({ success: false, reason: err.message });
    }
}

function respond(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
