import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { ApiError } from "./errors.js";
import { transaction } from "./transaction.js";

export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function clientAddress(req, onVercel = Boolean(process.env.VERCEL)) {
    // Vercel overwrites these headers. Local requests use the socket rather than trusting a supplied header.
    const forwarded = req.headers["x-vercel-forwarded-for"] ?? req.headers["x-forwarded-for"];
    const address = onVercel ? (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") : req.socket?.remoteAddress;
    if (!address || !isIP(address)) throw new ApiError(503, "CLIENT_ADDRESS_UNAVAILABLE", "Login is temporarily unavailable.");
    if (address.startsWith("::ffff:") && isIP(address.slice(7)) === 4) return address.slice(7);
    return isIP(address) === 6 ? new URL(`http://[${address}]`).hostname : address;
}

export async function consumeLoginAttempt(database, address, secret, now = Date.now) {
    const key = createHmac("sha256", secret).update(`broadcast-login:${address}`).digest("hex");
    const ref = database.ref("admin/loginRateLimits");
    const result = await transaction(ref, (records) => {
        const time = now();
        const active = Object.fromEntries(Object.entries(records ?? {}).filter(([, entry]) => entry.resetAt > time));
        const bucket = active[key] ?? { attempts: 0, resetAt: time + LOGIN_WINDOW_MS };
        if (bucket.attempts >= LOGIN_ATTEMPT_LIMIT) return;
        active[key] = { attempts: bucket.attempts + 1, resetAt: bucket.resetAt };
        return active;
    });
    if (!result.committed) {
        const resetAt = result.snapshot.child(key).val()?.resetAt ?? now() + LOGIN_WINDOW_MS;
        const error = new ApiError(429, "RATE_LIMITED", "Too many login attempts. Please wait before trying again.");
        error.retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now()) / 1000));
        throw error;
    }
}
