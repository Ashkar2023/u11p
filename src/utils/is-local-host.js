function isPrivateIpv4(hostname) {
    const parts = hostname.split(".").map(Number);

    if (
        parts.length !== 4
        || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
        return false;
    }

    const [first, second] = parts;

    return first === 10
        || first === 127
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168)
        || (first === 169 && second === 254)
        || (first === 100 && second >= 64 && second <= 127)
        || hostname === "0.0.0.0";
}

export function isLocalHost(hostname = globalThis.location?.hostname ?? "") {
    const normalizedHost = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

    if (normalizedHost === "localhost" || normalizedHost.endsWith(".localhost")) return true;
    if (isPrivateIpv4(normalizedHost)) return true;

    const mappedIpv4 = normalizedHost.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4 && isPrivateIpv4(mappedIpv4)) return true;

    return normalizedHost === "::1"
        || (
            normalizedHost.includes(":")
            && (
                normalizedHost.startsWith("fc")
                || normalizedHost.startsWith("fd")
                || /^fe[89ab]/.test(normalizedHost)
            )
        );
}
