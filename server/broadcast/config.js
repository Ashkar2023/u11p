import { ApiError } from "./errors.js";

export function getBroadcastAuthConfig(env = process.env) {
    const password = env.BROADCAST_ADMIN_PASSWORD;
    const secret = env.BROADCAST_JWT_SECRET;
    if (!password || !secret || Buffer.byteLength(secret) < 32) {
        throw new ApiError(503, "BROADCAST_NOT_CONFIGURED", "Broadcast login is not configured yet.");
    }
    return { password, secret };
}

export function getFirebaseAdminConfig(env = process.env) {
    const keys = [
        "FIREBASE_PROJECT_ID",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY",
        "FIREBASE_DATABASE_URL",
    ];
    if (keys.some((key) => !env[key]?.trim())) {
        throw new ApiError(503, "BROADCAST_NOT_CONFIGURED", "Broadcast is not configured yet.");
    }

    let databaseUrl;
    try {
        databaseUrl = new URL(env.FIREBASE_DATABASE_URL.trim());
    } catch {
        throw new ApiError(503, "BROADCAST_NOT_CONFIGURED", "Broadcast is not configured yet.");
    }
    if (databaseUrl.protocol !== "https:" || databaseUrl.username || databaseUrl.password) {
        throw new ApiError(503, "BROADCAST_NOT_CONFIGURED", "Broadcast is not configured yet.");
    }

    return {
        databaseURL: databaseUrl.href,
        serviceAccount: {
            projectId: env.FIREBASE_PROJECT_ID.trim(),
            clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(),
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").trim(),
        },
    };
}
