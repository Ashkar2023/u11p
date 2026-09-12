export const PAYMENT_TRACKER_STORAGE_KEY = "u11p_payment_tracker";

function normalizeStorageValue(value) {
    return Array.isArray(value) ? value : [];
}

export function readPaymentRecords() {
    if (typeof window === "undefined") return [];

    try {
        const rawValue = window.localStorage.getItem(PAYMENT_TRACKER_STORAGE_KEY);
        if (!rawValue) return [];

        const parsedValue = JSON.parse(rawValue);
        return normalizeStorageValue(parsedValue);
    } catch (error) {
        console.error("Failed to read payment tracker records.", error);
        return [];
    }
}

export function writePaymentRecords(records) {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(PAYMENT_TRACKER_STORAGE_KEY, JSON.stringify(normalizeStorageValue(records)));
    } catch (error) {
        console.error("Failed to save payment tracker records.", error);
        throw error;
    }
}

export function getPaymentRecordsForMatchday(matchdayId) {
    const matchdayKey = String(matchdayId);
    return readPaymentRecords().filter((record) => String(record.matchday_id) === matchdayKey);
}

export function upsertPaymentRecord(record) {
    const rows = readPaymentRecords();
    const playerName = String(record.player_name ?? "").trim();
    const matchdayId = String(record.matchday_id ?? "");

    if (!matchdayId || !playerName) {
        throw new Error("Player details are required to save payment status.");
    }

    const sanitizedRecord = {
        matchday_id: matchdayId,
        player_name: playerName,
        paid: Boolean(record.paid),
        amount_upi: Number(record.amount_upi) || 0,
        amount_cash: Number(record.amount_cash) || 0,
        timestamp: record.timestamp || new Date().toISOString(),
    };

    const existingIndex = rows.findIndex((entry) => {
        return String(entry.matchday_id) === matchdayId && String(entry.player_name).trim().toLowerCase() === playerName.toLowerCase();
    });

    if (existingIndex >= 0) {
        rows[existingIndex] = {
            ...rows[existingIndex],
            ...sanitizedRecord,
        };
    } else {
        rows.push(sanitizedRecord);
    }

    writePaymentRecords(rows);
    return sanitizedRecord;
}
