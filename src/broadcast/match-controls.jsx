import { useEffect, useRef, useState } from "react";
import data from "../data.json";
import SafeImage from "../components/safe-image.jsx";
import playerFallback from "../assets/user.webp";
import playerShield from "../assets/fifa-player-shield.webp";
import clubLogo from "../assets/u11p-logo.webp";
import { broadcastRequest } from "./api-client.js";
import { LINEUP_DURATION_MS } from "./constants.js";
import { getPresentation, getScorerSections, lineupRemainingMs } from "./match.js";

const button = "min-h-12 rounded-lg border border-white/15 px-4 py-3 font-semibold disabled:opacity-40 hover:bg-white/5";
const primary = `${button} bg-amber-400 text-zinc-950 hover:bg-amber-300`;
const fixtures = [...data.matches].sort((a, b) => a.date.localeCompare(b.date));
const teamName = (match, side) => match.info[`${side}Team`].name;
const scorerName = (goal) => goal.type === "own_goal" ? goal.playerName ? `${goal.playerName} (OG)` : "Own goal" : `${goal.playerName}${goal.type === "penalty" ? " (Penalty)" : ""}`;
const recordedGoals = (match) => Object.entries(match.goals ?? {}).filter(([, goal]) => !goal.voided).sort((a, b) => a[1].sequence - b[1].sequence);
const playerImageStyle = {
    maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
    WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
};

function GoalList({ match, onEdit }) {
    const goals = recordedGoals(match);
    return goals.length ? <ul className="space-y-2">
        {goals.map(([id, goal]) => <li key={id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>{scorerName(goal)} <span className="text-zinc-400">· {teamName(match, goal.team)}</span></span>
            {onEdit && <button type="button" onClick={() => onEdit(id, goal)} className="min-h-11 px-2 text-amber-300">Edit scorer</button>}
        </li>)}
    </ul> : <p className="text-sm text-zinc-400">No goals recorded.</p>;
}

function ScorerCard({ player, selected, onSelect }) {
    return <button type="button" aria-pressed={selected} aria-label={`Select ${player.name}`} onClick={onSelect} className={`group block w-full rounded-lg border p-1 focus-visible:outline-2 focus-visible:outline-amber-400 ${selected ? "border-amber-400 bg-amber-400/15" : "border-transparent hover:bg-white/5"}`}>
        <div className="relative mx-auto aspect-[2/2.7] w-full max-w-32">
            <img src={playerShield} alt="" className="absolute inset-0 h-full w-full object-contain" aria-hidden="true" />
            <div className="absolute overflow-hidden" style={{ top: "5%", left: "7%", width: "85%", height: "72%" }}>
                <SafeImage src={player.image} fallbackSrc={playerFallback} alt="" className="h-full w-full object-cover object-top" style={playerImageStyle} />
            </div>
            <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center">
                <span className="w-full truncate text-center font-ddin text-[clamp(9px,2.6vw,14px)] font-bold uppercase tracking-wide text-[#1a1a1a]">{player.name.split(" ")[0]}</span>
            </div>
        </div>
        <span className={`mt-1 block truncate text-center text-[11px] ${selected ? "text-amber-200" : "text-zinc-300"}`}>{player.name}</span>
    </button>;
}

function TeamLineupGroup({ section, selected, onSelect, suggested, suggestion }) {
    const sideLabel = section.side === "home" ? "Home" : "Away";
    return <section className={`rounded-xl border p-3 transition-colors ${suggested ? "border-amber-400/45 bg-amber-400/10" : "border-white/10 bg-zinc-900/70"}`}>
        <header className="mb-3 flex min-h-10 items-center gap-2 border-b border-white/10 pb-2">
            <SafeImage src={section.team?.logo} fallbackSrc={clubLogo} alt="" className="size-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-zinc-100">{section.team?.name ?? `${sideLabel} team`}</h4>
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${suggested ? "text-amber-300" : "text-zinc-500"}`}>{suggested ? suggestion : sideLabel}</p>
            </div>
        </header>
        {section.players.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 lg:grid-cols-3">{section.players.map((entry) => <ScorerCard key={entry.id} player={entry} selected={selected === entry.id} onSelect={() => onSelect(entry.id)} />)}</div> : <p className="py-3 text-center text-sm text-zinc-500">No matching lineup players.</p>}
    </section>;
}

function ToggleSwitch({ checked, onToggle, disabled = false, label }) {
    return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onToggle} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${checked ? "bg-amber-400" : "bg-zinc-700"}`}>
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>;
}

function GoalTypeToggle({ label, checked, onToggle }) {
    return <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-3">
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <ToggleSwitch label={label} checked={checked} onToggle={onToggle} />
    </div>;
}

function Confirmation({ draft, busy, blocked, onClose, onConfirm }) {
    const ref = useRef(null);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(draft.goal?.playerId ?? null);
    const [goalType, setGoalType] = useState(draft.goal?.type ?? "normal");
    const picking = ["add_goal", "correct_goal"].includes(draft.action);
    const sections = picking ? getScorerSections(data, draft.match.sourceMatchId, search) : null;
    const player = data.players.find((entry) => entry.id === selected);
    useEffect(() => { ref.current.showModal(); }, []);
    const titles = { select: "Load broadcast match?", start: "Start match?", undo_start: "Undo match start?", full_time: "Confirm full time", resume: "Resume live match?", void_goal: "Disallow latest goal?", add_goal: "Choose goalscorer", correct_goal: "Correct goalscorer" };
    function confirm() {
        const { match, goal, ...body } = draft;
        if (picking) Object.assign(body, { type: goalType, playerId: selected });
        onConfirm(body);
    }
    const suggestedSide = goalType === "own_goal" ? draft.team === "home" ? "away" : "home" : draft.team;
    const suggestion = goalType === "own_goal" ? "Own-goal team" : "Scoring team";
    return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="broadcast-confirm-title" className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-amber-400/30 bg-zinc-950 p-5 text-zinc-100 backdrop:bg-black/75 ${picking ? "max-w-4xl" : "max-w-lg"}`}>
        <h2 id="broadcast-confirm-title" className="text-xl font-semibold text-amber-300">{titles[draft.action]}</h2>
        <fieldset disabled={busy || blocked} className="mt-4 space-y-4">
            {draft.match && <p className="text-center font-semibold">{teamName(draft.match, "home")} {draft.match.score.home} – {draft.match.score.away} {teamName(draft.match, "away")}</p>}
            {draft.match?.status === "full_time" && draft.action !== "resume" && <p className="text-sm text-amber-200">Post-match correction. The match will remain full time.</p>}
            {draft.action === "select" && <p className="text-sm text-zinc-300">Switch the overlay to fixture #{draft.sourceMatchId}? New fixtures start at 0–0; previously loaded fixtures resume their saved broadcast score. Website results are not changed.</p>}
            {draft.action === "start" && <p className="text-sm text-zinc-300">This sets the match to LIVE and hides the pre-match graphics. It does not control YouTube.</p>}
            {draft.action === "undo_start" && <p className="text-sm text-zinc-300">Return this 0–0 match to pre-match? The kickoff graphic will replace the live scorebug. This is only allowed before any goal has been recorded.</p>}
            {draft.action === "full_time" && <><GoalList match={draft.match} /><p className="text-sm text-zinc-300">Confirm the score and scorers above. The full-time scoreboard will appear and the scorebug will hide. The camera keeps streaming.</p></>}
            {draft.action === "resume" && <><GoalList match={draft.match} /><p className="text-sm text-zinc-300">Resume this match with the score and scorers above? The full-time scoreboard will hide and the live scorebug will return.</p></>}
            {draft.action === "void_goal" && <p>Remove goal #{draft.goal.sequence}: <strong>{scorerName(draft.goal)}</strong> for {teamName(draft.match, draft.team)}?</p>}
            {picking && <>
                <p className="text-sm text-zinc-300">Goal credited to <strong>{teamName(draft.match, draft.team)}</strong>. You may select any player.</p>
                <input type="search" aria-label="Search goalscorers" placeholder="Search all players…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-12 w-full rounded-lg border border-white/20 bg-zinc-900 px-3" />
                <div className="grid grid-cols-2 gap-2">
                    <GoalTypeToggle label="Own Goal" checked={goalType === "own_goal"} onToggle={() => {
                        setGoalType((current) => current === "own_goal" ? "normal" : "own_goal");
                    }} />
                    <GoalTypeToggle label="Penalty" checked={goalType === "penalty"} onToggle={() => setGoalType((current) => current === "penalty" ? "normal" : "penalty")} />
                </div>
                <div className="max-h-[42dvh] overflow-y-auto">
                    <section className="rounded-xl border border-amber-400/25 bg-white/[0.025] p-3">
                        <div className="mb-3 flex items-baseline justify-between gap-3">
                            <h3 className="text-sm font-semibold text-zinc-300">Current lineup</h3>
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Home / Away</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {sections.teamLineups.map((section) => <TeamLineupGroup key={section.side} section={section} selected={selected} onSelect={setSelected} suggested={section.side === suggestedSide} suggestion={suggestion} />)}
                        </div>
                    </section>
                    <section className="mt-3 rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-zinc-400">Other players</h3>
                        {sections.others.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">{sections.others.map((entry) => <ScorerCard key={entry.id} player={entry} selected={selected === entry.id} onSelect={() => setSelected(entry.id)} />)}</div> : <p className="py-2 text-sm text-zinc-500">No matching players.</p>}
                    </section>
                </div>
                {selected !== null && <p className="text-sm text-amber-200">Confirm: {player?.name}{goalType === "own_goal" ? " · Own goal" : goalType === "penalty" ? " · Penalty" : ""} for {teamName(draft.match, draft.team)}.</p>}
            </>}
        </fieldset>
        {blocked && <p role="alert" className="mt-4 text-sm text-amber-200">The save could not be confirmed. Close this dialog to retry or refresh the match.</p>}
        <div className="mt-5 flex gap-3">
            <button type="button" disabled={busy} onClick={onClose} className={`${button} flex-1`}>{blocked ? "Close" : "Cancel"}</button>
            <button type="button" disabled={busy || blocked || (picking && selected === null)} onClick={confirm} className={`${primary} flex-1`}>{busy ? "Saving…" : "Confirm"}</button>
        </div>
    </dialog>;
}

export default function MatchControls({ onSessionLost, disabled = false }) {
    const [state, setState] = useState(null);
    const [fixtureId, setFixtureId] = useState(() => String(fixtures.find((match) => new Date(match.date) > new Date())?.id ?? ""));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [failed, setFailed] = useState(null);
    const [draft, setDraft] = useState(null);
    const inFlight = useRef(false);
    const [serverTime, setServerTime] = useState(Date.now());
    const match = state?.match;
    const presentation = match ? getPresentation(match, serverTime) : {};
    const lineupSeconds = Math.ceil(lineupRemainingMs(match, serverTime) / 1000);
    const hasRecordedGoals = Object.keys(match?.goals ?? {}).length > 0;

    useEffect(() => {
        if (!state?.serverNow) return;
        const received = performance.now();
        const tick = () => setServerTime(state.serverNow + performance.now() - received);
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [state]);

    useEffect(() => {
        let cancelled = false;
        broadcastRequest("state", { method: "GET" }).then((result) => {
            if (cancelled) return;
            setState(result);
            if (result.match) setFixtureId(String(result.match.sourceMatchId));
        }).catch((failure) => { if (!cancelled) setError(failure.message); });
        return () => { cancelled = true; };
    }, []);

    async function refresh() {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        try {
            const result = await broadcastRequest("state", { method: "GET" });
            setState(result);
            setFailed(null);
            setDraft(null);
            setError("");
        } catch (failure) {
            setError(failure.message);
            if (["LOCK_LOST", "SESSION_EXPIRED"].includes(failure.code)) onSessionLost();
        } finally { inFlight.current = false; setBusy(false); }
    }

    function requestBody(action, extra = {}) {
        return { action, activeMatchId: state?.activeMatchId ?? null, revision: match?.revision ?? 0, requestId: crypto.randomUUID(), ...extra };
    }

    function confirm(action, extra = {}) {
        setDraft({ ...requestBody(action, extra), match: action === "select" ? null : match });
    }

    async function save(body) {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await broadcastRequest("match", { body });
            setState(result);
            setDraft(null);
            setFailed(null);
        } catch (failure) {
            setError(failure.message);
            setFailed(body);
            if (["LOCK_LOST", "SESSION_EXPIRED"].includes(failure.code)) onSessionLost();
        } finally { inFlight.current = false; setBusy(false); }
    }

    function remove(team) {
        const latest = recordedGoals(match).filter(([, goal]) => goal.team === team).at(-1);
        if (latest) confirm("void_goal", { team, goalId: latest[0], goal: latest[1] });
    }

    return <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        {error && <div role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p>{error}</p>
            {failed && <p className="mt-2">If the connection dropped, the change may already be saved. Retry safely or refresh to see the current result.</p>}
            <div className="mt-3 flex gap-2">
                {failed && <button type="button" disabled={busy} onClick={() => save(failed)} className={button}>Retry same request</button>}
                <button type="button" disabled={busy} onClick={refresh} className={button}>Refresh match</button>
            </div>
        </div>}
        {!state && !error && <p role="status" className="text-zinc-400">Loading match…</p>}
        {lineupSeconds > 0 && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200">Lineup sequence playing · {lineupSeconds}s remaining. Graphics, match selection and Start match unlock after the lineups and top-scorer boards finish.</p>}
        <fieldset disabled={busy || Boolean(failed) || !state || lineupSeconds > 0} className="space-y-4 disabled:opacity-60">
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-4">
                <label htmlFor="broadcast-fixture" className="mb-2 block text-sm text-zinc-400">Match from data.json</label>
                <select id="broadcast-fixture" value={fixtureId} onChange={(event) => setFixtureId(event.target.value)} className="min-h-12 w-full rounded-lg border border-white/15 bg-zinc-950 px-3">
                    <option value="">Choose a fixture</option>
                    {[...fixtures].reverse().map((fixture) => <option key={fixture.id} value={fixture.id}>#{fixture.id} · {new Date(fixture.date).toLocaleDateString()} · {fixture.teams.map((entry) => data.teams.find((team) => team.id === entry.teamId)?.shortName).join(" vs ")}</option>)}
                </select>
                <button type="button" disabled={!fixtureId || match?.sourceMatchId === Number(fixtureId)} onClick={() => confirm("select", { sourceMatchId: Number(fixtureId) })} className={`${primary} mt-3 w-full`}>Load match</button>
                <p className="mt-2 text-xs text-zinc-500">Upcoming fixture suggested automatically. Loading a previously used fixture resumes it.</p>
            </div>
            {match && <>
                <div className="rounded-lg border border-amber-400/25 bg-zinc-900/75 p-4">
                    <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-amber-300">{match.status.replace("_", " ")}</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        {["home", "away"].map((team) => <div key={team}>
                            <h2 className="min-h-12 font-semibold">{teamName(match, team)}</h2>
                            <p className="my-3 text-6xl font-bold tabular-nums">{match.score[team]}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" aria-label={`Remove latest goal for ${teamName(match, team)}`} disabled={match.status === "upcoming" || match.score[team] === 0} onClick={() => remove(team)} className={`${button} text-2xl`}>−</button>
                                <button type="button" aria-label={`Add goal for ${teamName(match, team)}`} disabled={match.status === "upcoming"} onClick={() => confirm("add_goal", { team })} className={`${primary} text-2xl`}>+</button>
                            </div>
                        </div>)}
                    </div>
                    {match.status === "upcoming" && <button type="button" onClick={() => confirm("start")} className={`${primary} mt-5 w-full`}>Start match</button>}
                    {match.status === "live" && <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => confirm("full_time")} className={button}>End match</button>
                        <button type="button" disabled={hasRecordedGoals} onClick={() => confirm("undo_start")} className={button}>Undo start</button>
                    </div>}
                    {match.status === "live" && hasRecordedGoals && <p className="mt-3 text-center text-xs text-zinc-500">Undo start is unavailable after a goal has been recorded.</p>}
                    {match.status === "full_time" && <>
                        <p className="mt-4 text-center text-sm text-zinc-400">Full time · Score and scorer corrections remain available.</p>
                        <button type="button" onClick={() => confirm("resume")} className={`${primary} mt-4 w-full`}>Resume match</button>
                    </>}
                </div>
                <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-4">
                    <h2 className="mb-3 font-semibold">Graphics visibility</h2>
                    {[
                        ["showKickoff", "Team vs team · Kicking off soon", match.status === "upcoming"],
                        ["showLineup", `Lineups + top scorers · ${LINEUP_DURATION_MS / 1000} seconds`, match.status === "upcoming"],
                        ["showScorebug", "Scorebug", match.status === "live"],
                        ["showFinalScore", "Full-time scoreboard", match.status === "full_time"],
                    ].map(([field, label, available]) => <div key={field} className={`flex min-h-14 items-center justify-between gap-4 border-b border-white/5 py-3 ${available ? "" : "opacity-40"}`}>
                        <span>{label}</span>
                        <ToggleSwitch label={label} checked={Boolean(presentation[field])} disabled={!available} onToggle={() => save(requestBody("presentation", { field, visible: !presentation[field] }))} />
                    </div>)}
                    {match.status === "upcoming" && match.presentation?.lineupRunId && <button type="button" onClick={() => save(requestBody("presentation", { field: "showLineup", visible: true }))} className={`${button} mt-3 w-full`}>Replay lineups and top scorers</button>}
                    <p className="mt-3 text-xs text-zinc-500">Before kickoff, choose kickoff soon or the lineup sequence. It shows both team lineups, this month&apos;s top scorers and the all-time top scorers. Live goals animate alongside the scorebug. End match automatically shows the full-time board and hides the scorebug. Hiding the full-time board leaves no score graphics. Post-match corrections do not animate.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-zinc-900/75 p-4">
                    <h2 className="mb-3 font-semibold">Goalscorers</h2>
                    <GoalList match={match} onEdit={(goalId, goal) => confirm("correct_goal", { goalId, goal, team: goal.team })} />
                </div>
                <button type="button" onClick={refresh} className={`${button} w-full`}>Refresh match</button>
            </>}
        </fieldset>
        {draft && <Confirmation key={draft.requestId} draft={draft} busy={busy} blocked={Boolean(failed)} onClose={() => setDraft(null)} onConfirm={save} />}
    </fieldset>;
}
