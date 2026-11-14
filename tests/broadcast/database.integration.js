import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { createSession, signSession } from "../../server/broadcast/auth.js";
import { acquireLock, renewLock, releaseLock, withOwnedLock } from "../../server/broadcast/lock.js";
import { consumeLoginAttempt, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS } from "../../server/broadcast/rate-limit.js";
import { createBroadcastService } from "../../server/broadcast/service.js";
import { apiHandler } from "../../server/broadcast/http.js";
import { LOCK_LEASE_MS, SESSION_LIFETIME_SECONDS } from "../../src/broadcast/constants.js";

const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host ?? "")) throw new Error("These tests require FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:<port>; live databases are forbidden.");
const project = "demo-u11p-broadcast-tests";
const databaseURL = `http://${host}?ns=${project}`;
const app = initializeApp({ projectId: project, databaseURL }, "broadcast-integration");
const otherApp = initializeApp({ projectId: project, databaseURL }, "broadcast-integration-other");
const database = getDatabase(app);
const otherDatabase = getDatabase(otherApp);
const secret = "integration-test-only-signing-secret-no-real-credentials";
const password = "integration-test-password";
let time = 1_800_000_000_000;
const now = () => time;
const service = createBroadcastService({ getDatabase: () => database, getConfig: () => ({ secret, password }), now });

const request = (body = {}, cookie) => ({
    method: "POST", body,
    headers: { host: "club.example", origin: "https://club.example", "content-type": "application/json", cookie },
    socket: { encrypted: true, remoteAddress: "192.0.2.1" },
});
const response = () => ({
    headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
});
const call = async (operation, req = request()) => {
    const res = response();
    const method = operation === "session" ? "GET" : "POST";
    await apiHandler(method, service[operation])({ ...req, method }, res);
    return res;
};
const cookieFrom = (res) => res.headers["Set-Cookie"].split(";")[0];

before(async () => {
    const rules = await readFile(new URL("../../firebase.database.rules.json", import.meta.url), "utf8");
    const res = await fetch(`http://${host}/.settings/rules.json?ns=${project}`, {
        method: "PUT", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: rules,
    });
    assert.equal(res.status, 200, await res.text());
});
beforeEach(async () => {
    time = 1_800_000_000_000;
    await database.ref().set(null);
});
after(async () => { await Promise.all([deleteApp(app), deleteApp(otherApp)]); });

test("simultaneous administrators produce exactly one owner", async () => {
    const sessions = Array.from({ length: 8 }, () => createSession(now()));
    const results = await Promise.allSettled(sessions.map((session, i) => acquireLock(i % 2 ? database : otherDatabase, session, now)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    for (const result of results.filter((entry) => entry.status === "rejected")) assert.equal(result.reason.code, "ADMIN_ACTIVE");
    const stored = (await database.ref("admin/lock").get()).val();
    assert.equal(stored.expiresAt, now() + LOCK_LEASE_MS);
});

test("heartbeat renews an owned lease without extending session expiry and never revives an expired lease", async () => {
    const session = createSession(now());
    await acquireLock(database, session, now);
    time += 10_000;
    const renewed = await renewLock(otherDatabase, session, now);
    assert.equal(renewed.expiresAt, now() + LOCK_LEASE_MS);
    time = renewed.expiresAt;
    await assert.rejects(renewLock(database, session, now), { code: "LOCK_LOST" });
    const replacement = createSession(now());
    await acquireLock(otherDatabase, replacement, now);
    await assert.rejects(renewLock(database, session, now), { code: "LOCK_LOST" });
    await releaseLock(database, session);
    assert.equal((await database.ref("admin/lock").get()).val().sessionId, replacement.sessionId);
    await releaseLock(otherDatabase, replacement);
    assert.equal((await database.ref("admin/lock").get()).val(), null);
});

test("a lease cannot outlive its JWT", async () => {
    const session = createSession(now());
    time = session.exp * 1000 - 5_000;
    assert.equal((await acquireLock(database, session, now)).expiresAt, session.exp * 1000);
    time += 1_000;
    assert.equal((await renewLock(database, session, now)).expiresAt, session.exp * 1000);
    time = session.exp * 1000;
    await assert.rejects(renewLock(database, session, now), { code: "LOCK_LOST" });
});

test("a queued mutation cannot commit after a new administrator acquires the lock", async () => {
    const old = createSession(now());
    await acquireLock(database, old, now);
    let resume;
    let warmed;
    const waiting = new Promise((resolve) => { warmed = resolve; });
    const gate = new Promise((resolve) => { resume = resolve; });
    const delayed = { ref() {
        const root = database.ref();
        return {
            on: (...args) => root.on(...args),
            off: (...args) => root.off(...args),
            async transaction(...args) { warmed(); await gate; return root.transaction(...args); },
        };
    } };
    const pending = assert.rejects(withOwnedLock(delayed, old, (state) => ({ ...state, broadcast: { testWrite: true } }), now), { code: "LOCK_LOST" });
    await waiting;
    time += LOCK_LEASE_MS;
    const current = createSession(now());
    await acquireLock(otherDatabase, current, now);
    resume();
    await pending;
    assert.equal((await database.ref("broadcast").get()).val(), null);
    await withOwnedLock(database, current, (state) => ({ ...state, broadcast: { testWrite: true } }), now);
    assert.equal((await database.ref("broadcast/testWrite").get()).val(), true);
});

test("rate limiting is atomic across instances, keeps IPs private, and resets after fifteen minutes", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => consumeLoginAttempt(i % 2 ? database : otherDatabase, "192.0.2.1", secret, now)));
    assert.equal(attempts.filter((entry) => entry.status === "fulfilled").length, LOGIN_ATTEMPT_LIMIT);
    for (const entry of attempts.filter((result) => result.status === "rejected")) {
        assert.equal(entry.reason.status, 429);
        assert.equal(entry.reason.retryAfterSeconds, LOGIN_WINDOW_MS / 1000);
    }
    const records = (await database.ref("admin/loginRateLimits").get()).val();
    assert.equal(Object.keys(records).length, 1);
    assert.ok(!JSON.stringify(records).includes("192.0.2.1"));
    await consumeLoginAttempt(database, "192.0.2.2", secret, now);
    time += LOGIN_WINDOW_MS;
    await consumeLoginAttempt(database, "192.0.2.1", secret, now);
    const refreshed = (await database.ref("admin/loginRateLimits").get()).val();
    assert.equal(Object.keys(refreshed).length, 1);
    assert.equal(Object.values(refreshed)[0].attempts, 1);
});

test("login, session inspection, heartbeat and logout work through API handlers", async () => {
    assert.equal((await call("session")).body.authenticated, false);
    const invalid = await call("login", request({ password: "wrong" }));
    assert.equal(invalid.statusCode, 401);
    assert.equal((await database.ref("admin/lock").get()).val(), null);
    const loggedIn = await call("login", request({ password }));
    assert.equal(loggedIn.statusCode, 200);
    assert.equal(loggedIn.body.ownsLock, true);
    const cookie = cookieFrom(loggedIn);
    const sessionId = (await database.ref("admin/lock").get()).val().sessionId;
    time += 10_000;
    const inspection = await call("session", request({}, cookie));
    assert.equal(inspection.body.ownsLock, true);
    assert.equal(inspection.body.lockExpiresAt, time + LOCK_LEASE_MS);
    const heartbeat = await call("heartbeat", request({}, cookie));
    assert.equal(heartbeat.body.lockExpiresAt, time + LOCK_LEASE_MS);
    assert.equal(heartbeat.body.sessionExpiresAt, loggedIn.body.sessionExpiresAt);
    const sameBrowser = await call("login", request({ password }, cookie));
    assert.equal(sameBrowser.body.sessionExpiresAt, loggedIn.body.sessionExpiresAt);
    assert.equal((await database.ref("admin/lock").get()).val().sessionId, sessionId);
    const conflict = await call("login", request({ password }));
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.headers["Set-Cookie"], undefined);
    const loggedOut = await call("logout", request({}, cookie));
    assert.equal(loggedOut.statusCode, 200);
    assert.ok(loggedOut.headers["Set-Cookie"].includes("Max-Age=0"));
    assert.equal((await database.ref("admin/lock").get()).val(), null);
});

test("an unexpired session reclaims an expired lease without another password", async () => {
    const loggedIn = await call("login", request({ password }));
    const cookie = cookieFrom(loggedIn);
    const sessionId = (await database.ref("admin/lock").get()).val().sessionId;
    time += LOCK_LEASE_MS;

    const recovered = await call("session", request({}, cookie));
    assert.equal(recovered.statusCode, 200);
    assert.equal(recovered.body.authenticated, true);
    assert.equal(recovered.body.ownsLock, true);
    assert.equal(recovered.body.sessionExpiresAt, loggedIn.body.sessionExpiresAt);
    assert.deepEqual((await database.ref("admin/lock").get()).val(), {
        sessionId,
        expiresAt: time + LOCK_LEASE_MS,
    });
});

test("old cookies cannot heartbeat or release a replacement administrator's lock", async () => {
    const first = await call("login", request({ password }));
    const oldCookie = cookieFrom(first);
    time += LOCK_LEASE_MS;
    const second = await call("login", request({ password }));
    assert.equal(second.statusCode, 200);
    const replacement = (await database.ref("admin/lock").get()).val();
    const oldStatus = await call("session", request({}, oldCookie));
    assert.equal(oldStatus.body.authenticated, false);
    assert.equal(oldStatus.body.ownsLock, false);
    assert.equal(oldStatus.body.reason, "LOCK_REPLACED");
    assert.ok(oldStatus.headers["Set-Cookie"].includes("Max-Age=0"));
    const oldHeartbeat = await call("heartbeat", request({}, oldCookie));
    assert.equal(oldHeartbeat.statusCode, 409);
    assert.ok(oldHeartbeat.headers["Set-Cookie"].includes("Max-Age=0"));
    await call("logout", request({}, oldCookie));
    assert.deepEqual((await database.ref("admin/lock").get()).val(), replacement);
});

test("expired and forged JWTs are rejected without touching the active lock", async () => {
    const session = createSession(now());
    const token = await signSession(session, secret);
    const badToken = await signSession(session, "wrong-secret");
    await acquireLock(database, session, now);
    assert.equal((await call("heartbeat", request({}, `broadcast_session=${badToken}`))).statusCode, 401);
    time += SESSION_LIFETIME_SECONDS * 1000;
    const heartbeat = await call("heartbeat", request({}, `broadcast_session=${token}`));
    assert.equal(heartbeat.statusCode, 401);
    const status = await call("session", request({}, `broadcast_session=${token}`));
    assert.equal(status.body.authenticated, false);
    assert.ok(status.headers["Set-Cookie"].includes("Max-Age=0"));
});

test("HTTP login throttling sends Retry-After and does not create a lock", async () => {
    for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i++) assert.equal((await call("login", request({ password: "wrong" }))).statusCode, 401);
    const limited = await call("login", request({ password }));
    assert.equal(limited.statusCode, 429);
    assert.equal(Number(limited.headers["Retry-After"]), LOGIN_WINDOW_MS / 1000);
    assert.equal((await database.ref("admin/lock").get()).val(), null);
});

test("deployed rules expose only the active match and reject public writes and admin reads", async () => {
    await database.ref().set({
        broadcast: { activeMatchId: "match_1", matches: { match_1: { status: "live" }, match_2: { status: "full_time" } } },
        admin: { lock: { sessionId: "private" }, loginRateLimits: { private: { attempts: 1 } } },
    });
    const read = (path) => fetch(`http://${host}/${path}.json?ns=${project}`);
    assert.equal((await read("broadcast/activeMatchId")).status, 200);
    assert.equal((await read("broadcast/matches/match_1")).status, 200);
    for (const path of ["", "broadcast", "broadcast/matches", "broadcast/matches/match_2", "admin", "admin/lock", "admin/loginRateLimits"]) {
        assert.equal((await read(path)).status, 401, path);
    }
    for (const path of ["broadcast/activeMatchId", "broadcast/matches/match_1/score", "admin/lock"]) {
        const res = await fetch(`http://${host}/${path}.json?ns=${project}`, { method: "PUT", body: JSON.stringify("forbidden") });
        assert.equal(res.status, 401);
    }
});
