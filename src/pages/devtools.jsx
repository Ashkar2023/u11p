import { useState } from "react";
import { PageLayout } from "../layout";

function getLocalStorageCount() {
    try {
        return localStorage.length;
    } catch {
        return null;
    }
}

export const Devtools = () => {
    const [storedItems, setStoredItems] = useState(getLocalStorageCount);
    const [message, setMessage] = useState("");
    const hostname = globalThis.location?.hostname ?? "local host";

    const clearLocalStorage = () => {
        const itemCount = getLocalStorageCount();

        if (itemCount === null) {
            setMessage("Local storage is not available in this browser.");
            return;
        }

        if (itemCount === 0) {
            setMessage("Local storage is already empty.");
            return;
        }

        if (!window.confirm(`Clear ${itemCount} local storage ${itemCount === 1 ? "item" : "items"} for this site?`)) {
            return;
        }

        try {
            localStorage.clear();
            setStoredItems(0);
            setMessage(`Cleared ${itemCount} local storage ${itemCount === 1 ? "item" : "items"}.`);
        } catch {
            setMessage("Local storage could not be cleared.");
        }
    };

    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <div className="mb-5">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Devtools</h1>
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            Local only
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                        Browser utilities for <span className="font-mono text-zinc-300">{hostname}</span>
                    </p>
                </div>

                <article className="rounded-lg border border-white/10 bg-zinc-900/75 p-4 shadow-2xl shadow-black/25">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="font-semibold text-zinc-100">Local storage</h2>
                            <p className="mt-1 text-sm text-zinc-400">
                                Clear saved browser state, including local voting flags.
                            </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-black/30 px-2 py-1 text-xs text-zinc-400">
                            {storedItems === null ? "Unavailable" : `${storedItems} ${storedItems === 1 ? "item" : "items"}`}
                        </span>
                    </div>

                    <button
                        className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        onClick={clearLocalStorage}
                        disabled={storedItems === null}
                    >
                        Clear local storage
                    </button>

                    <p className="mt-3 min-h-5 text-sm text-zinc-400" aria-live="polite">
                        {message}
                    </p>
                </article>
            </section>
        </PageLayout>
    );
};
