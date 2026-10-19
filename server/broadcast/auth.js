import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_LIFETIME_SECONDS } from "../../src/broadcast/constants.js";
import { ApiError } from "./errors.js";

const COOKIE_NAME = "broadcast_session";
const ISSUER = "u11p:broadcast";
const AUDIENCE = "broadcast-console";
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function passwordMatches(input, expected) {
    if (typeof input !== "string" || Buffer.byteLength(input) > 512) return false;
    const digest = (value) => createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(input), digest(expected));
}

export function createSession(now = Date.now()) {
    const iat = Math.floor(now / 1000);
    return { role: "broadcast_admin", sessionId: randomUUID(), iat, exp: iat + SESSION_LIFETIME_SECONDS };
}

export function signSession(session, secret) {
    return new SignJWT(session)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .sign(new TextEncoder().encode(secret));
}

export async function verifySession(token, secret, now = Date.now()) {
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
            requiredClaims: ["iat", "exp", "role", "sessionId"], currentDate: new Date(now),
        });
        if (payload.role !== "broadcast_admin" || !SESSION_ID.test(payload.sessionId)
            || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
            || payload.iat > Math.floor(now / 1000) || payload.exp - payload.iat !== SESSION_LIFETIME_SECONDS) {
            throw new Error("Invalid claims");
        }
        return { role: payload.role, sessionId: payload.sessionId, iat: payload.iat, exp: payload.exp };
    } catch {
        throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again.");
    }
}

export function readSessionCookie(req) {
    const header = req.headers.cookie;
    if (typeof header !== "string") return null;
    const values = header.split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (values.length !== 1) return null;
    const token = values[0].slice(COOKIE_NAME.length + 1);
    return token && token.length <= 2048 ? token : null;
}

export function setSessionCookie(req, res, token, maxAge = SESSION_LIFETIME_SECONDS) {
    const secure = process.env.VERCEL || req.socket?.encrypted;
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/api/broadcast; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure ? "; Secure" : ""}`);
}

export function clearSessionCookie(req, res) {
    setSessionCookie(req, res, "", 0);
}
