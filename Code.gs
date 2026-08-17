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

        const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
        const votes = rows
            .filter(row => row[0] !== "")
            .map(row => ({
                voterId: row[0],
                voterName: row[1],
                candidateId: row[2],
                candidateName: row[3],
                timestamp: row[4],
                revoted: row[5] === true,
            }));

        return respond({ success: true, votes });
    } catch (err) {
        return respond({ success: false, reason: err.message });
    }
}

function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents);
        const { matchId, voterId, voterName, candidateId, candidateName, isRevote } = body;

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
            const rowIndex = existingIds.indexOf(voterId);

            if (rowIndex !== -1) {
                if (isRevote) {
                    const sheetRow = rowIndex + 2;
                    sheet.getRange(sheetRow, 3).setValue(candidateId);
                    sheet.getRange(sheetRow, 4).setValue(candidateName);
                    sheet.getRange(sheetRow, 5).setValue(new Date());
                    sheet.getRange(sheetRow, 6).setValue(true);
                    return respond({ success: true });
                } else {
                    return respond({ success: false, reason: "already_voted" });
                }
            }
        }

        sheet.appendRow([voterId, voterName, candidateId, candidateName, new Date(), false]);

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