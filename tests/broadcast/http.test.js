import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../server/broadcast/errors.js";
import { apiHandler, assertSameOrigin, readJsonBody } from "../../server/broadcast/http.js";
import session from "../../api/broadcast/session.js";

const request = (overrides = {}) => ({
    method: "POST",
    socket: { encrypted: true },
    headers: { host: "club.example", origin: "https://club.example", "content-type": "application/json" },
    body: {},
    ...overrides,
});

function response() {
    return {
        headers: {},
        setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
    };
}

test("mutation origin checks reject missing, malformed, different-host and different-protocol origins", () => {
    assert.doesNotThrow(() => assertSameOrigin(request()));
    for (const origin of [undefined, "null", "https://other.example", "http://club.example", "https://club.example/path", "https://club.example:444"]) {
        const req = request();
        req.headers.origin = origin;
        req.headers["x-forwarded-host"] = "other.example";
        assert.throws(() => assertSameOrigin(req), { status: 403 });
    }
});

test("API rejects invalid JSON, form submissions, arrays and oversized requests", () => {
    assert.deepEqual(readJsonBody(request({ body: '{"showLineup":true}' })), { showLineup: true });
    for (const body of ["{", "null", "[]", null, [], "1"]) {
        assert.throws(() => readJsonBody(request({ body })), { status: 400 });
    }
    assert.throws(() => readJsonBody(request({ body: { text: "x".repeat(8192) } })), { status: 413 });
    const req = request();
    req.headers["content-type"] = "application/x-www-form-urlencoded";
    assert.throws(() => readJsonBody(req), { status: 415 });
});

test("rejected methods and origins never execute the handler", async () => {
    let calls = 0;
    const handler = apiHandler("POST", async () => { calls += 1; return { ok: true }; });
    const invalidMethod = response();
    await handler(request({ method: "GET" }), invalidMethod);
    assert.equal(invalidMethod.statusCode, 405);
    assert.equal(invalidMethod.headers.Allow, "POST");
    const invalidOrigin = response();
    const req = request();
    delete req.headers.origin;
    await handler(req, invalidOrigin);
    assert.equal(invalidOrigin.statusCode, 403);
    assert.equal(calls, 0);
    const valid = response();
    await handler(request(), valid);
    assert.equal(calls, 1);
    assert.equal(valid.statusCode, 200);
    assert.equal(valid.headers["Cache-Control"], "no-store");
});

test("session endpoint reports signed out without accessing credentials or Firebase", async () => {
    const res = response();
    await session(request({ method: "GET" }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { authenticated: false, ownsLock: false });
    assert.equal(res.headers["Vercel-CDN-Cache-Control"], "no-store");
});

test("API returns expected public errors without a stack trace", async () => {
    const handler = apiHandler("GET", async () => { throw new ApiError(400, "INVALID_MATCH", "Choose a valid match."); });
    const res = response();
    await handler(request({ method: "GET" }), res);
    assert.deepEqual(res.body, { error: { code: "INVALID_MATCH", message: "Choose a valid match." } });
});
