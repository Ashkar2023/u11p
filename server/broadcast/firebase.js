import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirebaseAdminConfig } from "./config.js";

const APP_NAME = "broadcast-server";

export function getBroadcastDatabase() {
    let app = getApps().find((entry) => entry.name === APP_NAME);
    if (!app) {
        const { serviceAccount, databaseURL } = getFirebaseAdminConfig();
        app = initializeApp({ credential: cert(serviceAccount), databaseURL }, APP_NAME);
    }
    return getDatabase(app);
}
