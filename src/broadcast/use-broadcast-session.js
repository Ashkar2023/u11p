import { useCallback, useEffect, useRef, useState } from "react";
import { broadcastRequest } from "./api-client.js";
import { HEARTBEAT_INTERVAL_MS } from "./constants.js";

export function useBroadcastSession() {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState("checking");
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    const [retrySeconds, setRetrySeconds] = useState(0);
    const mounted = useRef(false);
    const inFlight = useRef(null);
    const active = useRef(false);
    const deadlines = useRef({ lease: 0, session: 0, retry: 0 });

    const pause = useCallback((message) => {
        active.current = false;
        inFlight.current?.abort();
        inFlight.current = null;
        setPending("");
        setStatus("paused");
        setError(message);
    }, []);

    const run = useCallback(async (operation, password) => {
        if (inFlight.current || !mounted.current) return false;
        if (!navigator.onLine) {
            pause("You are offline. Reconnect before controlling the broadcast.");
            return false;
        }
        if (operation === "login" && performance.now() < deadlines.current.retry) return false;
        const controller = new AbortController();
        inFlight.current = controller;
        setPending(operation);
        if (operation !== "heartbeat") setError("");
        if (operation === "logout") {
            active.current = false;
            setStatus("paused");
        }

        async function request(action, options) {
            const started = performance.now();
            const result = await broadcastRequest(action, { ...options, signal: controller.signal });
            return { result, elapsed: performance.now() - started };
        }

        try {
            let response = await request(operation === "check" ? "session" : operation, {
                method: operation === "check" ? "GET" : "POST",
                body: operation === "login" ? { password } : {},
            });
            if (operation === "check" && response.result.ownsLock && !controller.signal.aborted) {
                response = await request("heartbeat");
            }
            if (!mounted.current || controller.signal.aborted) return false;
            const { result, elapsed } = response;
            setSession(result);
            if (result.authenticated && result.ownsLock) {
                const time = performance.now();
                // Subtract the whole round trip so a slow response cannot make the local lease look newer than it is.
                deadlines.current.lease = time + Math.max(0, result.lockExpiresAt - result.serverNow - elapsed);
                deadlines.current.session = time + Math.max(0, result.sessionExpiresAt - result.serverNow - elapsed);
                active.current = deadlines.current.lease > time && deadlines.current.session > time;
                setStatus(active.current ? "active" : "paused");
                setError(active.current ? "" : "Control expired while connecting. Sign in again.");
            } else {
                active.current = false;
                setStatus("signed_out");
                setError(result.authenticated ? "Your control has expired or another administrator has taken control. Sign in again."
                    : result.reason === "SESSION_EXPIRED" ? "Your two-hour session has expired. Sign in again."
                        : result.reason === "LOCK_REPLACED" ? "Another administrator has taken control. Sign in again." : "");
            }
            return result.ownsLock === true;
        } catch (failure) {
            if (!mounted.current || controller.signal.aborted) return false;
            active.current = false;
            const sessionLost = ["LOCK_LOST", "SESSION_EXPIRED"].includes(failure.code);
            setStatus(sessionLost || operation === "login" || operation === "logout" ? "signed_out" : "paused");
            setError(operation === "logout" ? "Logout could not be confirmed. Control will expire when the last heartbeat ends." : failure.message);
            if (failure.retryAfterSeconds > 0) {
                deadlines.current.retry = performance.now() + failure.retryAfterSeconds * 1000;
                setRetrySeconds(failure.retryAfterSeconds);
            }
            return false;
        } finally {
            if (mounted.current && inFlight.current === controller) {
                inFlight.current = null;
                setPending("");
            }
        }
    }, [pause]);

    const reconnect = useCallback(() => {
        if (!mounted.current) return Promise.resolve(false);
        active.current = false;
        inFlight.current?.abort();
        inFlight.current = null;
        setPending("");
        setStatus("checking");
        setError("");
        return run("check");
    }, [run]);

    useEffect(() => {
        mounted.current = true;
        run("check");
        const heartbeat = setInterval(() => {
            if (active.current) run("heartbeat");
        }, HEARTBEAT_INTERVAL_MS);
        const expiry = setInterval(() => {
            const time = performance.now();
            setRetrySeconds(Math.max(0, Math.ceil((deadlines.current.retry - time) / 1000)));
            if (active.current && (time >= deadlines.current.session || time >= deadlines.current.lease)) {
                const sessionExpired = time >= deadlines.current.session;
                pause(sessionExpired ? "Your two-hour session has expired. Sign in again." : "Control expired. Reconnect or sign in again.");
                if (sessionExpired) setStatus("signed_out");
            }
        }, 500);
        const offline = () => pause("You are offline. Reconnect before controlling the broadcast.");
        const visibility = () => {
            if (document.visibilityState === "visible") reconnect();
        };
        window.addEventListener("offline", offline);
        window.addEventListener("online", reconnect);
        document.addEventListener("visibilitychange", visibility);
        return () => {
            mounted.current = false;
            active.current = false;
            inFlight.current?.abort();
            inFlight.current = null;
            clearInterval(heartbeat);
            clearInterval(expiry);
            window.removeEventListener("offline", offline);
            window.removeEventListener("online", reconnect);
            document.removeEventListener("visibilitychange", visibility);
        };
    }, [pause, reconnect, run]);

    return {
        session, status, pending, error, retrySeconds,
        canControl: status === "active" && active.current && navigator.onLine,
        login: (password) => run("login", password),
        logout: () => run("logout"),
        reconnect,
    };
}
