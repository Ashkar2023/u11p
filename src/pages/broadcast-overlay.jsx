import { useEffect, useState } from "react";
import { useOverlayFeed } from "../broadcast/use-overlay-feed.js";
import { FinalScore, GoalAnimation, Kickoff, Lineups, LiveIndicator, Scorebug } from "../broadcast/overlay-graphics.jsx";
import "../broadcast/overlay.css";
import { getPresentation } from "../broadcast/match.js";

export function OverlayCanvas({ match, event, finishEvent, diagnostic, serverOffset = 0 }) {
    const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    useEffect(() => {
        const resize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);
    const validMatch = match?.info?.homeTeam && match?.info?.awayTeam && match?.score;
    const presentation = match ? getPresentation(match, Date.now() + serverOffset) : {};

    return <main className="ob-viewport" aria-label="United XI broadcast overlay">
        <div className="ob-frame" style={{ width: 1920 * scale, height: 1080 * scale }}>
            <div className="ob-stage" style={{ transform: `scale(${scale})` }}>
                {validMatch && <>
                    <Scorebug match={match} visible={presentation.showScorebug} />
                    <Kickoff match={match} visible={presentation.showKickoff} />
                    <Lineups match={match} visible={presentation.showLineup} serverOffset={serverOffset} />
                    <FinalScore match={match} visible={presentation.showFinalScore} />
                    <LiveIndicator visible={match.status !== "live" && (presentation.showKickoff || presentation.showLineup || presentation.showFinalScore)} />
                    {event && match.status === "live" && <GoalAnimation key={event.id} event={event} match={match} onComplete={finishEvent} />}
                </>}
                {diagnostic && <aside className="ob-diagnostic">{diagnostic}</aside>}
            </div>
        </div>
    </main>;
}

export default function BroadcastOverlay() {
    const feed = useOverlayFeed();
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    const diagnostic = debug ? feed.error || (!feed.connected ? "Connecting to Firebase…" : !feed.match ? "Connected · Load a match in the Broadcast Console" : `Connected · ${feed.activeMatchId} · ${feed.match.status}`) : null;
    return <OverlayCanvas match={feed.match} event={feed.event} finishEvent={feed.finishEvent} diagnostic={diagnostic} serverOffset={feed.serverOffset} />;
}
