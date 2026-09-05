import { Link } from "wouter";
import { PageLayout } from "../layout";

function WrenchIcon() {
    return (
        <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a4 4 0 0 0-5 5L3.5 17.5a2.1 2.1 0 0 0 3 3l6.2-6.2a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z" />
        </svg>
    );
}

export function Tools() {
    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <header className="mb-5">
                    <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Tools</h1>
                    <p className="mt-1 text-sm text-zinc-400">Small utilities for match day.</p>
                </header>

                <Link
                    href="/tools/lineup-creator"
                    className="flex items-center gap-4 rounded-lg border border-white/10 bg-zinc-900/75 p-4 transition-colors hover:border-amber-400/50 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                    <span className="text-amber-400"><WrenchIcon /></span>
                    <span className="min-w-0 flex-1">
                        <strong className="block text-sm font-semibold text-zinc-100">Lineup creator</strong>
                        <span className="mt-1 block text-sm text-zinc-400">Build and share both team lineups.</span>
                    </span>
                    <span className="text-xl text-zinc-500" aria-hidden="true">&#8250;</span>
                </Link>
            </section>
        </PageLayout>
    );
}
