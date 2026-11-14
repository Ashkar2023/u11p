import assert from "node:assert/strict";
import test from "node:test";
import { getApps } from "firebase-admin/app";
import { getFirebaseAdminConfig } from "../../server/broadcast/config.js";

test("importing the server connection does not initialize Firebase or require credentials", async () => {
    const before = getApps().length;
    await import("../../server/broadcast/firebase.js");
    assert.equal(getApps().length, before);
});

test("missing server credentials fail without disclosing environment values", () => {
    assert.throws(() => getFirebaseAdminConfig({ FIREBASE_PRIVATE_KEY: "private-test-value" }), {
        status: 503,
        code: "BROADCAST_NOT_CONFIGURED",
        message: "Broadcast is not configured yet.",
    });
});

test("private key escaped newlines are normalized and insecure database URLs are rejected", () => {
    const env = {
        FIREBASE_PROJECT_ID: "demo-broadcast",
        FIREBASE_CLIENT_EMAIL: "test@example.invalid",
        FIREBASE_PRIVATE_KEY: "line1\\nline2",
        FIREBASE_DATABASE_URL: "https://demo-broadcast-default-rtdb.firebaseio.com",
    };
    assert.equal(getFirebaseAdminConfig(env).serviceAccount.privateKey, "line1\nline2");
    for (const url of ["not a url", "http://example.invalid", "https://user:password@example.invalid"]) {
        assert.throws(() => getFirebaseAdminConfig({ ...env, FIREBASE_DATABASE_URL: url }), { status: 503 });
    }
});
