import { Link, useLocation } from "wouter";
import { isLocalHost } from "./utils/is-local-host";

const navItems = [
    { label: "Home", icon: "home", path: "/" },
    { label: "Matches", icon: "matches", path: "/matches" },
    { label: "Players", icon: "players", path: "/players" },
    { label: "Stats", icon: "stats", path: "/stats" },
    { label: "Devtools", icon: "devtools", path: "/devtools", localOnly: true },
];

function NavIcon({ name }) {
    return (
        <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {name === "home" && (
                <>
                    <path d="m3 10.5 9-7.5 9 7.5" />
                    <path d="M5 9v12h14V9M9 21v-6h6v6" />
                </>
            )}
            {name === "matches" && (
                <>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M3 10h18" />
                    <path d="m12 13 2.4 1.7-.9 2.8h-3l-.9-2.8L12 13Z" />
                </>
            )}
            {name === "players" && (
                <>
                    <circle cx="12" cy="7.5" r="3.5" />
                    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </>
            )}
            {name === "stats" && (
                <>
                    <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7" />
                    <path d="M2 20h20" />
                </>
            )}
            {name === "devtools" && (
                <>
                    <path d="M14.7 6.3a4 4 0 0 0-5 5L3.5 17.5a2.1 2.1 0 0 0 3 3l6.2-6.2a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z" />
                    <path d="m5 19 1-1" />
                </>
            )}
        </svg>
    );
}

function Navigation() {
    const [location] = useLocation();
    const visibleNavItems = navItems.filter(({ localOnly }) => !localOnly || isLocalHost());

    return (
        <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
            <nav
                className="mx-auto flex h-16 max-w-xl items-stretch justify-around px-2"
                aria-label="Primary navigation"
            >
                {visibleNavItems.map(({ label, icon, path }) => {
                    const className = `flex min-w-0 flex-1 flex-col items-center justify-center rounded-md text-[11px] font-medium transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-amber-400 ${location === path ? "text-amber-400" : "text-zinc-400"}`;
                    const content = (
                        <>
                            <NavIcon name={icon} />
                            <span>{label}</span>
                        </>
                    );

                    return path ? (
                        <Link
                            className={className}
                            href={path}
                            aria-current={location === path ? "page" : undefined}
                            key={label}
                        >
                            {content}
                        </Link>
                    ) : (
                        <button className={className} type="button" key={label}>
                            {content}
                        </button>
                    );
                })}
            </nav>
        </footer>
    );
}

function Shell({ children, showHero }) {
    return (
        <div className="min-h-dvh bg-zinc-950 text-white">
            {showHero && (
                <header className="h-64 bg-[url('/stadium.png')] bg-cover bg-center px-4 pt-8 sm:h-72">
                    <img
                        className="mx-auto h-44 w-auto object-contain sm:h-52"
                        src="/u11p-logo.png"
                        alt="United XI Pallilamkara"
                    />
                </header>
            )}

            <main className={`px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] ${showHero ? "" : "pt-[calc(1.5rem+env(safe-area-inset-top))]"}`}>
                {children}
            </main>

            <Navigation />
        </div>
    );
}

export default function Layout({ children }) {
    return <Shell showHero>{children}</Shell>;
}

export function PageLayout({ children }) {
    return <Shell showHero={false}>{children}</Shell>;
}
