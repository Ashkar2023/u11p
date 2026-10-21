import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import SafeImage from "../components/safe-image.jsx";
import ground from "../assets/lineup-ground-gold.webp";
import shield from "../assets/fifa-player-shield.webp";
import fallback from "../assets/user.webp";
import clubLogo from "../assets/u11p-logo.webp";
import data from "../data.json";
import { hasMatchResult } from "../utils/date.util.js";
import { calculateGoalScorers } from "../utils/goal-scorers.util.js";
import { getPositionMap } from "../utils/lineup-creator.util.js";
import { LINEUP_DURATION_MS, LINEUP_SCORERS_DURATION_MS, LINEUP_TEAM_DURATION_MS } from "./constants.js";
import { getCurrentMonthTeamForm } from "./match.js";

const players = new Map(data.players.map((player) => [player.id, player]));
const completedMatches = data.matches.filter(hasMatchResult);
const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Kolkata" });
const monthLabelFormatter = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const monthKey = (date) => {
    const parts = Object.fromEntries(monthKeyFormatter.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}`;
};
const currentMonth = monthKey(new Date());
const scorerBoards = [
    {
        key: "current-month",
        label: monthLabelFormatter.format(new Date()),
        players: calculateGoalScorers(completedMatches.filter((match) => monthKey(match.date) === currentMonth)).filter((player) => player?.id).slice(0, 5),
    },
    {
        key: "all-time",
        label: "All time",
        players: calculateGoalScorers(completedMatches).filter((player) => player?.id).slice(0, 5),
    },
];

export function createLineupTimeline(element) {
    const lineupScenes = [...element.querySelectorAll(".ob-lineup-scene")];
    const scorerScenes = [...element.querySelectorAll(".ob-scorers-scene")];
    const timeline = gsap.timeline({ paused: true });
    gsap.set([...lineupScenes, ...scorerScenes], { autoAlpha: 0 });
    lineupScenes.forEach((scene, index) => {
        const start = index * LINEUP_TEAM_DURATION_MS / 1000;
        const logo = scene.querySelector(".ob-lineup-logo");
        const pitch = scene.querySelector(".ob-lineup-pitch");
        const intro = scene.querySelector(".ob-lineup-intro-name");
        const cards = [...scene.querySelectorAll(".ob-lineup-card")];
        const notes = scene.querySelectorAll(".ob-lineup-note");
        const form = scene.querySelector(".ob-lineup-form");
        gsap.set([pitch, intro, ...cards, ...notes, ...(form ? [form] : [])], { autoAlpha: 0 });
        gsap.set(logo, { xPercent: -50, yPercent: -50 });
        timeline.set(scene, { autoAlpha: 1 }, start)
            .fromTo(logo, { autoAlpha: 0, scale: 0.7, x: 0, y: 0 }, { autoAlpha: 1, scale: 1, duration: 0.65, ease: "power3.out" }, start)
            .to(intro, { autoAlpha: 1, duration: 0.35 }, start + 0.35)
            .to(intro, { autoAlpha: 0, duration: 0.25 }, start + 1.1)
            .to(pitch, { autoAlpha: 1, duration: 0.7 }, start + 1.25)
            .to(logo, { x: 0, y: -440, scale: 0.65, duration: 0.95, ease: "power2.inOut" }, start + 1.25);
        if (cards.length) timeline.fromTo(cards,
            { autoAlpha: 0, y: 22, scale: 0.85 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, stagger: { amount: 3.3, from: "start" }, ease: "back.out(1.2)" }, start + 2.5);
        if (notes.length) timeline.to(notes, { autoAlpha: 1, duration: 0.3 }, start + 6.4);
        if (form) timeline.fromTo(form,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, start + 6.6);
        timeline.to(scene, { autoAlpha: 0, duration: 0.4 }, start + LINEUP_TEAM_DURATION_MS / 1000 - 0.4);
    });
    scorerScenes.forEach((scene, index) => {
        const start = (2 * LINEUP_TEAM_DURATION_MS + index * LINEUP_SCORERS_DURATION_MS) / 1000;
        const board = scene.querySelector(".ob-scorers-board");
        const headings = scene.querySelectorAll(".ob-scorers-heading > *");
        const rows = scene.querySelectorAll(".ob-scorers-row");
        const empty = scene.querySelector(".ob-scorers-empty");
        gsap.set([board, ...headings, ...rows, ...(empty ? [empty] : [])], { autoAlpha: 0 });
        timeline.set(scene, { autoAlpha: 1 }, start)
            .fromTo(board, { autoAlpha: 0, y: 36, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" }, start)
            .fromTo(headings, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.09, ease: "power2.out" }, start + 0.18);
        if (rows.length) timeline.fromTo(rows,
            { autoAlpha: 0, x: index % 2 ? 70 : -70 },
            { autoAlpha: 1, x: 0, duration: 0.48, stagger: 0.16, ease: "power3.out" }, start + 0.8);
        if (empty) timeline.fromTo(empty, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4 }, start + 0.8);
        timeline.to(scene, { autoAlpha: 0, y: -18, duration: 0.45 }, start + LINEUP_SCORERS_DURATION_MS / 1000 - 0.45);
    });
    timeline.to({}, { duration: LINEUP_DURATION_MS / 1000 }, 0);
    return timeline;
}

export function Lineups({ match, visible, serverOffset = 0 }) {
    const element = useRef(null);
    const [complete, setComplete] = useState(false);
    const fixture = data.matches.find((entry) => entry.id === match.sourceMatchId);
    const startedAt = match.presentation?.lineupStartedAt;
    const runId = match.presentation?.lineupRunId;

    useLayoutEffect(() => {
        if (!visible) return;
        setComplete(false);
        let tick;
        const context = gsap.context(() => {
            gsap.set(element.current, { autoAlpha: 1 });
            const timeline = createLineupTimeline(element.current);
            const elapsed = Number.isFinite(startedAt) ? Math.max(0, Date.now() + serverOffset - startedAt) / 1000 : LINEUP_DURATION_MS / 1000;
            const mountedAt = performance.now();
            // Use the shared broadcast clock, including after a reload, rather than restarting a locked sequence.
            tick = () => {
                const time = Math.min(LINEUP_DURATION_MS / 1000, elapsed + (performance.now() - mountedAt) / 1000);
                timeline.time(time, false);
                if (time >= LINEUP_DURATION_MS / 1000) {
                    gsap.ticker.remove(tick);
                    setComplete(true);
                }
            };
            gsap.ticker.add(tick);
            tick();
        }, element);
        return () => { gsap.ticker.remove(tick); context.revert(); };
    }, [visible, startedAt, runId, match.sourceMatchId, serverOffset]);

    return <section ref={element} className="ob-lineup-show ob-graphic" aria-hidden={!visible || complete}>
        {["home", "away"].map((side) => {
            const team = match.info[`${side}Team`];
            const ids = fixture?.lineup?.find((entry) => entry.teamId === team.id)?.playerIds ?? [];
            const positions = getPositionMap(ids.length);
            const extra = ids.slice(11).map((id) => players.get(id)?.name).filter(Boolean);
            const form = getCurrentMonthTeamForm(data.matches, match.sourceMatchId, team.id);
            const formMonth = fixture ? monthLabelFormatter.format(new Date(fixture.date)).toLocaleUpperCase("en-IN") : "";

            return <div key={side} className="ob-lineup-scene" data-team={side}>
                <div className="ob-lineup-pitch">
                    <img src={ground} alt="" className="ob-lineup-ground" />
                    {form.length > 0 && <div className="ob-lineup-form">
                        <span>CURRENT MONTH FORM · {formMonth}</span>
                        <ol aria-label={`${team.name} ${formMonth} form`}>
                            {form.map((result, index) => <li key={index} className={`ob-form-${result.toLocaleLowerCase()}`} aria-label={result === "W" ? "Win" : result === "L" ? "Loss" : "Draw"}>{result}</li>)}
                        </ol>
                    </div>}
                </div>
                <SafeImage src={team.logoUrl} fallbackSrc={clubLogo} alt="" className="ob-lineup-logo" />
                <h2 className="ob-lineup-intro-name">{team.name}</h2>
                {ids.slice(0, 11).map((id, index) => {
                    const player = players.get(id);
                    if (player?.hidden) return null;
                    const [top, left] = positions[index];
                    return <div key={`${id}-${index}`} className="ob-lineup-slot" style={{ left: 80 + (100 - top) * 12, top: 40 + left * 9 }}>
                        <div className="ob-lineup-card" data-player-index={index}>
                            <img src={shield} alt="" className="ob-lineup-shield" />
                            <div className="ob-lineup-portrait"><SafeImage src={player?.image} fallbackSrc={fallback} alt="" /></div>
                            <div className="ob-lineup-player-name">{player?.name ?? "Player"}</div>
                        </div>
                    </div>;
                })}
                {!ids.length && <p className="ob-lineup-note ob-lineup-missing">Lineup not available yet</p>}
                {extra.length > 0 && <p className="ob-lineup-note ob-lineup-extra">Also listed: {extra.join(" · ")}</p>}
            </div>;
        })}
        {scorerBoards.map((board) => <div key={board.key} className="ob-scorers-scene">
            <section className="ob-scorers-board">
                <header className="ob-scorers-heading">
                    <span>UNITED XI PALLILAMKARA</span>
                    <h2>TOP SCORERS</h2>
                    <p>{board.label}</p>
                </header>
                {board.players.length ? <ol className="ob-scorers-list">
                    {board.players.map((player, index) => <li key={player.id} className="ob-scorers-row">
                        <span className="ob-scorers-rank">{index + 1}</span>
                        <div className="ob-scorers-photo"><SafeImage src={player.image} fallbackSrc={fallback} alt="" /></div>
                        <div className="ob-scorers-player"><strong>{player.name}</strong><span>{player.matchesPlayed} APPEARANCES</span></div>
                        <div className="ob-scorers-goals"><strong>{player.goals}</strong><span>{player.goals === 1 ? "GOAL" : "GOALS"}</span></div>
                    </li>)}
                </ol> : <p className="ob-scorers-empty">No goals recorded</p>}
                <footer>UNITED BY FOOTBALL</footer>
            </section>
        </div>)}
    </section>;
}
