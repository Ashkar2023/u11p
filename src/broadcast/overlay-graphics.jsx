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
    const { homeTeam: home, awayTeam: away, sourceMatchId } = match.info;

    return <AnimatedGraphic visible={visible} className="ob-kickoff">
        <div className="ob-brand">UNITED XI PALLILAMKARA <span>MATCH {match.sourceMatchId}</span></div>
        <div className="ob-kickoff-teams"><Crest team={home} /><strong>{teamLabel(home.shortName)}</strong><span>VS</span><strong>{teamLabel(away.shortName)}</strong><Crest team={away} /></div>
        <div className="ob-kickoff-label">KICKING OFF SOON</div>
    </AnimatedGraphic>;
}

function scorers(match, side) {
    const totals = new Map();
    for (const goal of Object.values(match.goals ?? {}).filter((entry) => !entry.voided && entry.team === side).sort((a, b) => a.sequence - b.sequence)) {
        const key = goal.type === "own_goal" ? "own_goal" : `${goal.type}_${goal.playerId}`;
        const item = totals.get(key) ?? { name: goal.type === "own_goal" ? "Own goal" : `${goal.playerName}${goal.type === "penalty" ? " (P)" : ""}`, count: 0 };
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
    useLayoutEffect(() => {
        const context = gsap.context(() => {
            gsap.timeline({ onComplete: () => onComplete(event.id) })
                .fromTo(element.current, { autoAlpha: 0, x: -70 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "power3.out" })
                .from(".ob-goal-copy > *", { y: 14, autoAlpha: 0, stagger: 0.08, duration: 0.3 }, "<0.1")
                .to(element.current, { autoAlpha: 0, y: 20, duration: 0.3 }, `+=${disallowed ? 3 : 4.5}`);
        }, element);
        return () => context.revert();
    }, [event.id, disallowed, onComplete]);

    return <section ref={element} className={`ob-goal ob-graphic ${disallowed ? "ob-disallowed" : ""}`}>
        {!ownGoal && !disallowed && <SafeImage src={goal.imageUrl ?? player?.image} fallbackSrc={fallback} alt="" className="ob-goal-photo" />}
        <div className="ob-goal-copy">
            <div className="ob-goal-team"><Crest team={team} /><span>{teamLabel(team.name)}</span></div>
            <h1>{disallowed ? "GOAL DISALLOWED" : ownGoal ? "OWN GOAL" : penalty ? "PENALTY GOAL!" : "GOAL!"}</h1>
            {!ownGoal && <h2>{goal.playerName ?? player?.name ?? "Goalscorer"}</h2>}
            {ownGoal && <p>Credited to <span>{teamLabel(team.name)}</span></p>}
        </div>
        <div className="ob-goal-stripe" />
    </section>;
}
