import { getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const APP_NAME = "broadcast-web";

export function getBroadcastDatabase() {
    let app = getApps().find((entry) => entry.name === APP_NAME);
    if (!app) {
        const config = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        const required = ["apiKey", "projectId", "databaseURL", "appId"];
        if (required.some((key) => !config[key]?.trim())) {
            throw new Error("Broadcast connection is not configured yet.");
        }
        app = initializeApp(config, APP_NAME);
    }
    return getDatabase(app);
}
