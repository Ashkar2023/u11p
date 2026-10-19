import { ApiError } from "./errors.js";

const MAX_BODY_BYTES = 8 * 1024;

export function assertSameOrigin(req) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (typeof origin !== "string" || typeof host !== "string") {
        throw new ApiError(403, "INVALID_ORIGIN", "Open the console on this website to continue.");
    }

    const protocol = process.env.VERCEL || req.socket?.encrypted ? "https:" : "http:";
    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        throw new ApiError(403, "INVALID_ORIGIN", "Open the console on this website to continue.");
    }
    if (parsed.origin !== origin || parsed.host !== host || parsed.protocol !== protocol) {
        throw new ApiError(403, "INVALID_ORIGIN", "Open the console on this website to continue.");
    }
}

export function readJsonBody(req) {
    const header = req.headers["content-type"];
    const contentType = typeof header === "string" ? header.split(";")[0].trim().toLowerCase() : "";
    if (contentType !== "application/json") {
        throw new ApiError(415, "INVALID_CONTENT_TYPE", "Send application/json.");
    }

    let body = req.body;
    const serialized = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body ?? {});
    if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
        throw new ApiError(413, "BODY_TOO_LARGE", "The request is too large.");
    }
    if (typeof body === "string" || Buffer.isBuffer(body)) {
        try {
            body = JSON.parse(body.toString());
        } catch {
            throw new ApiError(400, "INVALID_JSON", "Send a valid JSON object.");
        }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ApiError(400, "INVALID_JSON", "Send a valid JSON object.");
    }
    return body;
}

export function apiHandler(method, handler) {
    return async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("CDN-Cache-Control", "no-store");
        res.setHeader("Vercel-CDN-Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        try {
            if (req.method !== method) {
                res.setHeader("Allow", method);
                throw new ApiError(405, "METHOD_NOT_ALLOWED", "This request method is not supported.");
            }
            if (method !== "GET") {
                assertSameOrigin(req);
                req.body = readJsonBody(req);
            }
            const result = await handler(req, res);
            return res.status(200).json(result);
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
                return res.status(error.status).json({ error: {
                    code: error.code, message: error.message,
                    ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
                } });
            }
            console.error("Broadcast API request failed unexpectedly.");
            return res.status(500).json({
                error: { code: "INTERNAL_ERROR", message: "The broadcast request could not be completed." },
            });
        }
    };
}
