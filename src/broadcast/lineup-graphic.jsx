import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import SafeImage from "../components/safe-image.jsx";
import ground from "../assets/lineup-ground-gold.webp";
import shield from "../assets/fifa-player-shield.webp";
import fallback from "../assets/user.webp";
import clubLogo from "../assets/u11p-logo.webp";
import data from "../data.json";
import { getPositionMap } from "../utils/lineup-creator.util.js";
import { LINEUP_DURATION_MS, LINEUP_TEAM_DURATION_MS } from "./constants.js";

const players = new Map(data.players.map((player) => [player.id, player]));

export function createLineupTimeline(element) {
    const scenes = [...element.querySelectorAll(".ob-lineup-scene")];
    const timeline = gsap.timeline({ paused: true });
    gsap.set(scenes, { autoAlpha: 0 });
    scenes.forEach((scene, index) => {
        const start = index * LINEUP_TEAM_DURATION_MS / 1000;
        const logo = scene.querySelector(".ob-lineup-logo");
        const pitch = scene.querySelector(".ob-lineup-pitch");
        const intro = scene.querySelector(".ob-lineup-intro-name");
        const cards = [...scene.querySelectorAll(".ob-lineup-card")];
        const notes = scene.querySelectorAll(".ob-lineup-note");
        gsap.set([pitch, intro, ...cards, ...notes], { autoAlpha: 0 });
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
        timeline.to(scene, { autoAlpha: 0, duration: 0.4 }, start + LINEUP_TEAM_DURATION_MS / 1000 - 0.4);
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

            return <div key={side} className="ob-lineup-scene" data-team={side}>
                <div className="ob-lineup-pitch"><img src={ground} alt="" className="ob-lineup-ground" /></div>
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
    </section>;
}
