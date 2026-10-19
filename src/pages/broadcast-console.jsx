import { useState } from "react";
import { Link } from "wouter";
import { PageLayout } from "../layout";
import { useBroadcastSession } from "../broadcast/use-broadcast-session.js";
import MatchControls from "../broadcast/match-controls.jsx";

export default function BroadcastConsole() {
    const [password, setPassword] = useState("");
    const { session, status, pending, error, retrySeconds, canControl, login, logout, reconnect } = useBroadcastSession();
    const checking = status === "checking";
    const busy = Boolean(pending);
    const hasControlSession = status !== "signed_out" && Boolean(session?.authenticated && session?.ownsLock);
    const retryLabel = `${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, "0")}`;

    async function submit(event) {
        event.preventDefault();
        if (await login(password)) setPassword("");
    }

    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <header className="mb-5">
                    <Link href="/tools" className="text-xs text-zinc-500 hover:text-white">Tools</Link>
                    <h1 className="mt-1 text-xl font-semibold text-amber-400 sm:text-2xl">Broadcast Console</h1>
                    <p className="mt-1 text-sm text-zinc-400">Live scores and broadcast graphics.</p>
                    <a href="/broadcast/overlay" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-amber-300 underline">Open 16:9 overlay</a>
                </header>
                {error && <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100" role="alert">{error}</p>}

                {pending === "logout" || (checking && !hasControlSession) ? <p className="py-6 text-zinc-400" role="status">{pending === "logout" ? "Releasing control…" : "Checking your session…"}</p> : hasControlSession ? (
                    <div className="space-y-4">
                        <div className={`rounded-lg border p-5 ${canControl ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`} role="status">
                            <p className={`font-semibold ${canControl ? "text-emerald-300" : "text-amber-200"}`}>{canControl ? "You control the broadcast" : checking ? "Checking broadcast control…" : "Broadcast controls paused"}</p>
                            <p className="mt-2 text-sm text-zinc-300">{canControl ? "Keep this page open during the broadcast." : "Match controls will unlock after ownership is confirmed."}</p>
                            <p className="mt-1 text-sm text-zinc-400">Sign-in expires at {new Date(session.sessionExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
                        </div>
                        <MatchControls onSessionLost={reconnect} disabled={!canControl} />
                        {!canControl && <button type="button" onClick={reconnect} disabled={busy} className="min-h-12 w-full rounded-lg border border-white/15 px-4 py-3 font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50">
                            {pending === "check" ? "Checking control…" : "Check broadcast control"}
                        </button>}
                        <button type="button" onClick={logout} disabled={busy} className="min-h-12 w-full rounded-lg border border-white/15 px-4 py-3 font-semibold text-red-400 hover:bg-white/5 disabled:opacity-50">
                            Log out and release control
                        </button>
                    </div>
                ) : status === "signed_out" ? (
                    <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-5">
                        <h2 className="text-lg font-semibold text-zinc-100">Sign in to control the broadcast</h2>
                        <p className="mt-2 text-sm text-zinc-400">Only one administrator can control the broadcast at a time.</p>
                        <form onSubmit={submit} className="mt-5 space-y-4">
                            <div>
                                <label htmlFor="broadcast-password" className="mb-2 block text-sm text-zinc-300">Shared password</label>
                                <input id="broadcast-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={512} disabled={busy} className="min-h-12 w-full rounded-lg border border-white/15 bg-zinc-950 px-4 py-3 text-base outline-none focus:border-amber-400 disabled:opacity-50" />
                            </div>
                            <button type="submit" disabled={busy || !password || retrySeconds > 0} className="min-h-12 w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50">
                                {pending === "login" ? "Signing in…" : retrySeconds > 0 ? `Try again in ${retryLabel}` : "Sign in"}
                            </button>
                        </form>
                        {(status === "paused" || error) && <button type="button" onClick={reconnect} disabled={busy} className="mt-3 min-h-12 w-full rounded-lg border border-white/15 px-4 py-3 text-zinc-200 hover:bg-white/5 disabled:opacity-50">
                            {pending === "check" ? "Checking connection…" : "Check existing session"}
                        </button>}
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5">
                        <h2 className="font-semibold text-amber-200">Unable to confirm your session</h2>
                        <p className="mt-2 text-sm text-zinc-300">Reconnect to check whether you still control the broadcast.</p>
                        <button type="button" onClick={reconnect} disabled={busy} className="mt-4 min-h-12 w-full rounded-lg border border-white/15 px-4 py-3 font-semibold text-zinc-100 hover:bg-white/5 disabled:opacity-50">
                            {pending === "check" ? "Checking connection…" : "Reconnect"}
                        </button>
                    </div>
                )}
            </section>
        </PageLayout>
    );
}
