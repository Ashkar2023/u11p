export function YouTubeIcon({ className = "size-5" }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
    );
}

export default function YouTubeLink({ href, label, iconOnly = false, className = "" }) {
    if (!href) return null;

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={iconOnly
                ? `pointer-events-auto rounded-md p-1 text-red-500 transition hover:text-red-400 focus-visible:outline-2 focus-visible:outline-red-500 ${className}`
                : `flex items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm font-medium text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-500/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${className}`}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            onClick={(event) => event.stopPropagation()}
        >
            <YouTubeIcon className={iconOnly ? "size-6" : "size-4"} />
            {!iconOnly && <span>{label}</span>}
        </a>
    );
}
