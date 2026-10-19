import { API_TIMEOUT_MS } from "./constants.js";

export async function broadcastRequest(operation, { method = "POST", body = {}, signal } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, API_TIMEOUT_MS);
    try {
        const response = await fetch(`/api/broadcast/${operation}`, {
            method,
            credentials: "same-origin",
            cache: "no-store",
            headers: method === "GET" ? {} : { "Content-Type": "application/json" },
            ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
            signal: controller.signal,
        });
        let result;
        try { result = await response.json(); } catch { throw new Error("The broadcast service is unavailable. Please try again."); }
        if (!response.ok) {
            const error = new Error(result.error?.message ?? "The broadcast request failed.");
            error.code = result.error?.code;
            error.retryAfterSeconds = Number(result.error?.retryAfterSeconds ?? response.headers.get("Retry-After")) || 0;
            throw error;
        }
        return result;
    } catch (error) {
        if (error.name === "AbortError") throw new Error("The connection timed out. Check your connection and reconnect.");
        if (error instanceof TypeError) throw new Error("Unable to reach the broadcast service. Check your connection.");
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
    }
}
