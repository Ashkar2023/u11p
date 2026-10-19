import { clearSessionCookie, createSession, passwordMatches, readSessionCookie, setSessionCookie, signSession, verifySession } from "./auth.js";
import { getBroadcastAuthConfig } from "./config.js";
import { getBroadcastDatabase } from "./firebase.js";
import { ApiError } from "./errors.js";
import { acquireLock, ownsLock, releaseLock, renewLock } from "./lock.js";
import { clientAddress, consumeLoginAttempt } from "./rate-limit.js";

export function createBroadcastService({ getDatabase = getBroadcastDatabase, getConfig = getBroadcastAuthConfig, now = Date.now } = {}) {
    async function requireSession(req) {
        const token = readSessionCookie(req);
        if (!token) throw new ApiError(401, "SESSION_EXPIRED", "Sign in to control the broadcast.");
        return verifySession(token, getConfig().secret, now());
    }

    function describe(session, lock) {
        const serverNow = now();
        const owner = ownsLock(lock, session, serverNow);
        return { authenticated: true, ownsLock: owner, sessionExpiresAt: session.exp * 1000, lockExpiresAt: owner ? lock.expiresAt : null, serverNow };
    }

    return {
        requireSession,
        async login(req, res) {
            const config = getConfig();
            const database = getDatabase();
            await consumeLoginAttempt(database, clientAddress(req), config.secret, now);
            if (!passwordMatches(req.body.password, config.password)) {
                throw new ApiError(401, "INVALID_PASSWORD", "The password is incorrect.");
            }

            // A second tab with this cookie shares its session; it does not displace it or extend its two-hour lifetime.
            let existing;
            try { existing = await requireSession(req); } catch (error) { if (error.status !== 401) throw error; }
            if (existing) {
                const lock = (await database.ref("admin/lock").get()).val();
                if (ownsLock(lock, existing, now())) return describe(existing, await renewLock(database, existing, now));
            }

            const session = createSession(now());
            const token = await signSession(session, config.secret);
            const lock = await acquireLock(database, session, now);
            if (!ownsLock(lock, session, now())) throw new ApiError(409, "LOCK_LOST", "Login took too long. Try again.");
            setSessionCookie(req, res, token, session.exp - Math.floor(now() / 1000));
            return describe(session, lock);
        },
        async session(req, res) {
            if (!readSessionCookie(req)) return { authenticated: false, ownsLock: false };
            let session;
            try { session = await requireSession(req); } catch (error) {
                if (error.status !== 401) throw error;
                clearSessionCookie(req, res);
                return { authenticated: false, ownsLock: false, reason: "SESSION_EXPIRED" };
            }
            try {
                return describe(session, await acquireLock(getDatabase(), session, now));
            } catch (error) {
                if (error.code !== "ADMIN_ACTIVE") throw error;
                clearSessionCookie(req, res);
                return { authenticated: false, ownsLock: false, reason: "LOCK_REPLACED" };
            }
        },
        async heartbeat(req, res) {
            const session = await requireSession(req);
            try {
                return describe(session, await acquireLock(getDatabase(), session, now));
            } catch (error) {
                if (error.code !== "ADMIN_ACTIVE") throw error;
                clearSessionCookie(req, res);
                throw new ApiError(409, "LOCK_LOST", "Another administrator has taken control. Sign in again.");
            }
        },
        async logout(req, res) {
            try {
                const session = await requireSession(req);
                await releaseLock(getDatabase(), session);
            } catch (error) {
                if (error.status !== 401) throw error;
            } finally {
                clearSessionCookie(req, res);
            }
            return { authenticated: false, ownsLock: false };
        },
    };
}

export const broadcastService = createBroadcastService();
