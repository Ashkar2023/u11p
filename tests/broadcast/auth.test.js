import assert from "node:assert/strict";
import test from "node:test";
import { createSession, passwordMatches, readSessionCookie, setSessionCookie, clearSessionCookie, signSession, verifySession } from "../../server/broadcast/auth.js";
import { getBroadcastAuthConfig } from "../../server/broadcast/config.js";
import { SESSION_LIFETIME_SECONDS } from "../../src/broadcast/constants.js";
import { clientAddress } from "../../server/broadcast/rate-limit.js";
import { apiHandler } from "../../server/broadcast/http.js";
import { ApiError } from "../../server/broadcast/errors.js";

const secret = "unit-test-only-signing-secret-32-bytes-minimum";
const now = 1_800_000_000_000;

test("sessions enforce signature, role, claims and the absolute two-hour expiry", async () => {
    const session = createSession(now);
    const token = await signSession(session, secret);
    assert.deepEqual(await verifySession(token, secret, now + 1000), session);
    await assert.rejects(verifySession(token, "different-signing-secret", now), { status: 401 });
    await assert.rejects(verifySession(token, secret, now + SESSION_LIFETIME_SECONDS * 1000), { status: 401 });
    for (const change of [{ role: "viewer" }, { sessionId: "invented" }, { exp: session.exp + 100 }, { iat: session.iat + 1 }]) {
        await assert.rejects(verifySession(await signSession({ ...session, ...change }, secret), secret, now), { status: 401 });
    }
    await assert.rejects(verifySession("not-a-jwt", secret, now), { status: 401 });
});

test("password comparison preserves spaces and rejects missing or oversized values", () => {
    assert.equal(passwordMatches("secret with spaces ", "secret with spaces "), true);
    for (const input of ["wrong", "secret with spaces", null, { password: "anything" }, "x".repeat(513)]) {
        assert.equal(passwordMatches(input, "secret with spaces "), false);
    }
    assert.throws(() => getBroadcastAuthConfig({ BROADCAST_ADMIN_PASSWORD: "test", BROADCAST_JWT_SECRET: "short" }), { status: 503 });
});

test("cookies are HTTP-only, secure on HTTPS, restricted to broadcast API, and cleared with the same scope", () => {
    const req = { headers: {}, socket: { encrypted: true } };
    const res = { setHeader(name, value) { this[name] = value; } };
    setSessionCookie(req, res, "token");
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/api/broadcast", "Max-Age=7200"]) {
        assert.ok(res["Set-Cookie"].includes(flag));
    }
    assert.equal(readSessionCookie({ headers: { cookie: "other=value; broadcast_session=token" } }), "token");
    assert.equal(readSessionCookie({ headers: { cookie: "broadcast_session=a; broadcast_session=b" } }), null);
    clearSessionCookie(req, res);
    assert.ok(res["Set-Cookie"].startsWith("broadcast_session=;"));
    assert.ok(res["Set-Cookie"].includes("Max-Age=0"));
});

test("client IP uses Vercel's overwritten header or the local socket, with normalized IPv6", () => {
    const req = { headers: { "x-forwarded-for": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.2" }, socket: { remoteAddress: "::ffff:127.0.0.1" } };
    assert.equal(clientAddress(req, true), "192.0.2.2");
    assert.equal(clientAddress(req, false), "127.0.0.1");
    assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "0:0:0:0:0:0:0:1" } }, false), "[::1]");
    assert.throws(() => clientAddress({ headers: {}, socket: req.socket }, true), { status: 503 });
});

test("rate-limit responses include a retry interval in both the header and JSON", async () => {
    const error = new ApiError(429, "RATE_LIMITED", "Wait before retrying.");
    error.retryAfterSeconds = 900;
    const handler = apiHandler("GET", () => { throw error; });
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({ method: "GET" }, res);
    assert.equal(res.code, 429);
    assert.equal(res.headers["Retry-After"], "900");
    assert.equal(res.body.error.retryAfterSeconds, 900);
});
