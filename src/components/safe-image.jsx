import { useEffect, useState } from "react";

const failedImageSources = new Set();

function resolveSource(source, fallbackSource) {
    const primarySource = source || fallbackSource;

    if (primarySource && failedImageSources.has(primarySource)) {
        if (fallbackSource && !failedImageSources.has(fallbackSource)) {
            return fallbackSource;
        }
        return null;
    }

    return primarySource || null;
}

export default function SafeImage({ src, fallbackSrc, alt = "", className = "", ...props }) {
    const [activeSrc, setActiveSrc] = useState(() => resolveSource(src, fallbackSrc));

    useEffect(() => {
        setActiveSrc(resolveSource(src, fallbackSrc));
    }, [src, fallbackSrc]);

    const handleError = () => {
        if (activeSrc) failedImageSources.add(activeSrc);

        if (
            fallbackSrc
            && activeSrc !== fallbackSrc
            && !failedImageSources.has(fallbackSrc)
        ) {
            setActiveSrc(fallbackSrc);
            return;
        }

        setActiveSrc(null);
    };

    if (!activeSrc) {
        return (
            <span
                className={`block bg-zinc-800 ${className}`}
                role={alt ? "img" : undefined}
                aria-label={alt || undefined}
            />
        );
    }

    return (
        <img
            {...props}
            className={className}
            src={activeSrc}
            alt={alt}
            onError={handleError}
        />
    );
}
