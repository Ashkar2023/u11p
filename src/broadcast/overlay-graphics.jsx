import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import SafeImage from "../components/safe-image.jsx";
import fallback from "../assets/user.webp";
import clubLogo from "../assets/u11p-logo.webp";
import data from "../data.json";
export { Lineups } from "./lineup-graphic.jsx";

const players = new Map(data.players.map((player) => [player.id, player]));
const statusText = { upcoming: "UPCOMING", live: "LIVE", full_time: "FT" };
const teamLabel = (value) => String(value ?? "").toLocaleUpperCase();

function Crest({ team }) {
    return <SafeImage src={team.logoUrl} fallbackSrc={clubLogo} alt="" className="ob-crest" />;
}

export function AnimatedGraphic({ visible, className, children }) {
    const element = useRef(null);
    useLayoutEffect(() => {
        const animation = gsap.to(element.current, { autoAlpha: visible ? 1 : 0, y: visible ? 0 : 18, duration: visible ? 0.45 : 0.25, ease: "power2.out", overwrite: true });
        return () => animation.kill();
    }, [visible]);
    return <section ref={element} className={`ob-graphic ${className}`} aria-hidden={!visible}>{children}</section>;
}

export function Scorebug({ match, visible }) {
    const { homeTeam: home, awayTeam: away } = match.info;
    return <AnimatedGraphic visible={visible} className="ob-scorebug">
        <div className="ob-brand">UNITED XI PALLILAMKARA <span>MATCH {match.sourceMatchId}</span></div>
        <div className="ob-score-row">
            <div className="ob-score-team"><Crest team={home} /><span>{teamLabel(home.shortName)}</span></div>
            <div className="ob-score-number">{match.score.home}<span>:</span>{match.score.away}</div>
            <div className="ob-score-team"><span>{teamLabel(away.shortName)}</span><Crest team={away} /></div>
            <span className={`ob-status ob-status-${match.status}`}>{statusText[match.status]}</span>
        </div>
    </AnimatedGraphic>;
}

export function Kickoff({ match, visible }) {
    const { homeTeam: home, awayTeam: away } = match.info;

    return <AnimatedGraphic visible={visible} className="ob-kickoff">
        <div className="ob-kickoff-heading"><span>UNITED XI PALLILAMKARA</span><b>MATCHDAY {match.sourceMatchId}</b></div>
        <div className="ob-kickoff-teams"><Crest team={home} /><span>VS</span><Crest team={away} /></div>
        <div className="ob-kickoff-label">KICKING OFF SOON</div>
    </AnimatedGraphic>;
}

export function LiveIndicator({ visible }) {
    return <AnimatedGraphic visible={visible} className="ob-live-indicator">
        <span className="ob-live-dot" aria-hidden="true" />
        <span>LIVE</span>
    </AnimatedGraphic>;
}

function scorers(match, side) {
    const totals = new Map();
    for (const goal of Object.values(match.goals ?? {}).filter((entry) => !entry.voided && entry.team === side).sort((a, b) => a.sequence - b.sequence)) {
        const key = `${goal.type}_${goal.playerId ?? goal.playerName ?? "unknown"}`;
        const item = totals.get(key) ?? { name: goal.type === "own_goal" ? goal.playerName ? `${goal.playerName} (OG)` : "Own goal" : `${goal.playerName}${goal.type === "penalty" ? " (P)" : ""}`, count: 0 };
        item.count++;
        totals.set(key, item);
    }
    return [...totals.values()];
}

export function FinalScore({ match, visible }) {
    return <AnimatedGraphic visible={visible} className="ob-final ob-panel">
        <div className="ob-panel-heading"><span>UNITED XI PALLILAMKARA</span><h1>FULL TIME</h1></div>
        <div className="ob-final-score">
            <div><Crest team={match.info.homeTeam} /><h2>{teamLabel(match.info.homeTeam.name)}</h2></div>
            <strong>{match.score.home}<span>–</span>{match.score.away}</strong>
            <div><Crest team={match.info.awayTeam} /><h2>{teamLabel(match.info.awayTeam.name)}</h2></div>
        </div>
        <div className="ob-two-teams ob-final-scorers">
            {["home", "away"].map((side) => {
                const list = scorers(match, side);
                return <ul key={side} className={`ob-final-scorers-${side} ${list.length > 18 ? "ob-scorers-dense" : ""}`} style={{ columns: list.length > 18 ? 3 : list.length > 9 ? 2 : 1 }}>
                    {list.map((scorer, index) => <li key={index}>
                        {side === "home" && scorer.count > 1 && <b>×{scorer.count}</b>}
                        <span>{scorer.name}</span>
                        {side === "away" && scorer.count > 1 && <b>×{scorer.count}</b>}
                    </li>)}
                </ul>;
            })}
        </div>
        <div className="ob-panel-footer">UNITED BY FOOTBALL</div>
    </AnimatedGraphic>;
}

export function GoalAnimation({ event, match, onComplete }) {
    const element = useRef(null);
    const disallowed = event.type === "goal_disallowed";
    const goal = event.goal;
    const team = match.info[`${goal.team}Team`];
    const ownGoal = goal.type === "own_goal";
    const penalty = goal.type === "penalty";
    const player = players.get(goal.playerId);
    const headline = disallowed ? "NO GOAL" : "GOAL";
    const playerName = goal.playerName ?? player?.name ?? "Goalscorer";
    useLayoutEffect(() => {
        const context = gsap.context(() => {
            if (disallowed) {
                gsap.timeline({ defaults: { ease: "power2.out" }, onComplete: () => onComplete(event.id) })
                    .set(element.current, { autoAlpha: 1 })
                    .from(".ob-no-goal > *", { autoAlpha: 0, y: 18, stagger: 0.08, duration: 0.32 })
                    .to(element.current, { autoAlpha: 0, y: 18, duration: 0.28, ease: "power2.in" }, "+=2.6");
                return;
            }
            const timeline = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: () => onComplete(event.id) });
            timeline
                .set(element.current, { autoAlpha: 1 })
                .from(".ob-goal-flash", { scaleX: 0, duration: 0.45, transformOrigin: "left center", ease: "expo.out" })
                .from(".ob-goal-letter", {
                    autoAlpha: 0,
                    x: (index) => index % 2 ? 190 : -190,
                    y: (index) => index % 2 ? -35 : 35,
                    rotation: (index) => index % 2 ? 7 : -7,
                    stagger: 0.075,
                    duration: 0.55,
                    ease: "back.out(1.4)",
                }, "<0.08")
                .from(".ob-goal-word", { x: -90, duration: 0.7, ease: "expo.out" }, "<");
            if (!ownGoal) timeline
                .from(".ob-goal-portrait", { autoAlpha: 0, x: 230, clipPath: "inset(0 0 0 100%)", duration: 0.75, ease: "expo.out" }, "<0.12")
                .from(".ob-goal-orbit", { autoAlpha: 0, scale: 0.25, rotation: -90, duration: 0.7, ease: "back.out(1.7)" }, "<");
            timeline
                .from(".ob-goal-team", { autoAlpha: 0, x: -70, duration: 0.42 }, "<0.18")
                .from(".ob-goal-detail > *", { autoAlpha: 0, y: 32, stagger: 0.09, duration: 0.42 }, "<0.08")
                .from(".ob-goal-speedline", { scaleX: 0, stagger: 0.05, duration: 0.35, transformOrigin: "left center" }, "<");
            if (ownGoal) timeline.to({}, { duration: 3.2 }, ">");
            else timeline.to(".ob-goal-orbit", { rotation: 35, duration: 3.2, ease: "none" }, ">");
            timeline.to(".ob-goal-word, .ob-goal-detail, .ob-goal-team", { autoAlpha: 0, x: -170, stagger: 0.035, duration: 0.38, ease: "power3.in" });
            if (!ownGoal) timeline.to(".ob-goal-portrait, .ob-goal-orbit", { autoAlpha: 0, x: 190, duration: 0.42, ease: "power3.in" }, "<");
            timeline
                .to(".ob-goal-flash, .ob-goal-speedlines", { autoAlpha: 0, duration: 0.2 }, "<0.18")
                .set(element.current, { autoAlpha: 0 });
        }, element);
        return () => context.revert();
    }, [event.id, disallowed, ownGoal, onComplete]);

    if (disallowed) return <section ref={element} className="ob-goal ob-graphic ob-disallowed">
        <div className="ob-no-goal">
            <span className="ob-no-goal-label">DECISION REVERSED</span>
            <h1>NO GOAL</h1>
            <div className="ob-no-goal-team"><Crest team={team} /><span>{teamLabel(team.name)}</span></div>
        </div>
    </section>;

    return <section ref={element} className={`ob-goal ob-graphic ${disallowed ? "ob-disallowed" : ""}`}>
        <div className="ob-goal-flash" />
        <div className="ob-goal-speedlines" aria-hidden="true">
            <span className="ob-goal-speedline" /><span className="ob-goal-speedline" /><span className="ob-goal-speedline" />
        </div>
        <div className="ob-goal-type">
            <div className="ob-goal-team"><Crest team={team} /><span>{teamLabel(team.name)}</span></div>
            <h1 className="ob-goal-word" aria-label={headline}>
                {Array.from(headline).map((letter, index) => <span key={`${letter}-${index}`} aria-hidden="true" className={`ob-goal-letter ${letter === " " ? "ob-goal-space" : ""}`}>{letter === " " ? "\u00a0" : letter}</span>)}
            </h1>
            <div className="ob-goal-detail">
                <span>{disallowed ? "DECISION REVERSED" : penalty ? "PENALTY SCORED" : ownGoal ? "GOALSCORER (OG)" : "GOALSCORER"}</span>
                {!disallowed && <h2>{playerName}</h2>}
            </div>
        </div>
        {!ownGoal && !disallowed && <div className="ob-goal-portrait" aria-hidden="true">
            <div className="ob-goal-orbit" />
            <SafeImage src={goal.imageUrl ?? player?.image} fallbackSrc={fallback} alt="" className="ob-goal-photo" />
        </div>}
    </section>;
}
