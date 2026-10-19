import { LOCK_LEASE_MS } from "../../src/broadcast/constants.js";
import { ApiError } from "./errors.js";
import { transaction } from "./transaction.js";

export function ownsLock(lock, session, now) {
    return session?.role === "broadcast_admin" && session.exp * 1000 > now && lock?.sessionId === session.sessionId
        && Number.isFinite(lock.expiresAt) && lock.expiresAt > now;
}

export async function acquireLock(database, session, now = Date.now) {
    const ref = database.ref("admin/lock");
    const result = await transaction(ref, (lock) => {
        const time = now();
        if (session.exp * 1000 <= time || (lock?.expiresAt > time && lock.sessionId !== session.sessionId)) return;
        return { sessionId: session.sessionId, expiresAt: Math.min(time + LOCK_LEASE_MS, session.exp * 1000) };
    });
    if (!result.committed) {
        throw new ApiError(409, "ADMIN_ACTIVE", "Another administrator is active. Try again after they log out or disconnect.");
    }
    return result.snapshot.val();
}

export async function renewLock(database, session, now = Date.now) {
    const ref = database.ref("admin/lock");
    const result = await transaction(ref, (lock) => {
        const time = now();
        if (!ownsLock(lock, session, time)) return;
        return { ...lock, expiresAt: Math.min(time + LOCK_LEASE_MS, session.exp * 1000) };
    });
    if (!result.committed) throw new ApiError(409, "LOCK_LOST", "You no longer control the broadcast. Sign in again.");
    return result.snapshot.val();
}

export async function releaseLock(database, session) {
    const ref = database.ref("admin/lock");
    await transaction(ref, (lock) => lock?.sessionId === session.sessionId ? null : undefined);
}

export async function withOwnedLock(database, session, change, now = Date.now) {
    const ref = database.ref();
    let failure;
    // Root is the common ancestor of the private lock and public match state. The callback must be synchronous and retry-safe.
    const result = await transaction(ref, (state) => {
        failure = null;
        const time = now();
        if (!ownsLock(state?.admin?.lock, session, time)) {
            failure = new ApiError(409, "LOCK_LOST", "You no longer control the broadcast. Sign in again.");
            return;
        }
        try {
            const next = change(state, time);
            if (!next || typeof next !== "object" || typeof next.then === "function") throw new Error("Invalid transaction result");
            return next;
        } catch (error) {
            failure = error;
            return;
        }
    });
    if (!result.committed) throw failure ?? new ApiError(409, "CONFLICT", "The broadcast changed. Try again.");
    return result.snapshot;
}
