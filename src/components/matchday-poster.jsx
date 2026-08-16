import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function MatchdayPoster({ filename }) {
    const [open, setOpen] = useState(false);
    const [src, setSrc] = useState(null);
    const [status, setStatus] = useState("idle"); // idle | loading | ready | 429 | error

    useEffect(() => {
        if (!open || src) return;
        setStatus("loading");
        fetch(`${import.meta.env.VITE_R2_URL}/matchday-posters/${filename}`)
            .then(async (res) => {
                if (res.status === 429) return setStatus("429");
                if (!res.ok) return setStatus("error");
                setSrc(URL.createObjectURL(await res.blob()));
                setStatus("ready");
            })
            .catch(() => setStatus("error"));
    }, [open]);

    useEffect(() => {
        if (!open) return;
        window.history.pushState({ poster: true }, "");
        const onPop = () => setOpen(false);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [open]);

    const handleClose = () => {
        if (window.history.state?.poster) window.history.back();
        setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && handleClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    if (!filename) return null;

    return (
        <>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                className="pointer-events-auto rounded-md p-1 text-yellow-300/30 transition hover:text-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400"
                aria-label="View matchday poster"
                title="Matchday poster"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
            </button>

            {open && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={(e)=>{e.stopPropagation(); handleClose()}}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="relative max-h-[90dvh] w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleClose}
                            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-black/50 text-zinc-400 hover:text-white"
                            aria-label="Close"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex min-h-48 items-center justify-center">
                            {status === "loading" && (
                                <div className="size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
                            )}
                            {status === "429" && (
                                <div className="p-8 text-center">
                                    <p className="text-3xl">🔥</p>
                                    <p className="mt-2 text-sm font-bold text-amber-400">Everyone wants this poster!</p>
                                    <p className="mt-1 text-xs text-zinc-500">Server's overwhelmed. Try again in a sec.</p>
                                </div>
                            )}
                            {status === "error" && (
                                <p className="p-8 text-sm text-zinc-500">Failed to load poster.</p>
                            )}
                            {status === "ready" && (
                                <img src={src} alt="Matchday poster" className="block max-h-[88dvh] w-full object-contain" />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}