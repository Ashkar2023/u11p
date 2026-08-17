import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import ManOfTheMatchVote from "../components/man-of-the-match-vote";
import MatchCard from "../components/match.card";
import MotmVotes from "../components/motm-votes";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { getMatchVotingPeriodStatus } from "../utils/date.util";

const teamsById = new Map(data.teams.map((team) => [team.id, team]));
const playersById = new Map(data.players.map((player) => [player.id, player]));

function BackIcon() {
    return (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

function GoalIcon() {
    return (
        <svg className="size-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7ZM10.1 12.7 7 15m6.9-2.3L17 15M9 9.2 6.6 7.5m8.4 1.7 2.4-1.7M7 15l.5 3.3M17 15l-.5 3.3" />
        </svg>
    );
}

function TeamHeading({ team }) {
    return (
        <header className="flex items-center justify-center gap-2 border-b border-white/10 pb-3 text-center">
            <SafeImage className="size-9 object-contain" src={team.logo} alt="" />
            <h3 className="text-sm font-semibold text-zinc-100">{team.name}</h3>
        </header>
    );
}

function MatchFacts({ match, teams }) {
    return (
        <div className="grid grid-cols-2 divide-x divide-white/10">
            {teams.map((team) => {
                const goals = match.goals?.filter((goal) => goal.teamId === team.id) ?? [];

                return (
                    <section className="min-w-0 px-3 first:pl-0 last:pr-0" key={team.id}>
                        <TeamHeading team={team} />
                        {goals.length > 0 ? (
                            <ul className="mt-2 space-y-1">
                                {goals.map((goal, index) => {
                                    const player = playersById.get(goal.playerId);
                                    return (
                                        <li key={`${goal.playerId}-${index}`}>
                                            <Link
                                                className="flex min-w-0 items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                                                href={`/players/${goal.playerId}`}
                                                aria-label={`View ${player?.name ?? `Player ${goal.playerId}`}`}
                                            >
                                                <GoalIcon />
                                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                                                    {player?.name ?? `Player ${goal.playerId}`}
                                                    {goal.ownGoal ? " (OG)" : ""}
                                                </span>
                                                {goal.count > 1 && (
                                                    <span className="text-xs font-semibold text-zinc-400">×{goal.count}</span>
                                                )}
                                                {goal.penaltiesCount > 0 && (
                                                    <span className="text-[10px] text-zinc-500">{goal.penaltiesCount}P</span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="py-5 text-center text-xs text-zinc-500">No goal records</p>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

function Lineup({ match, teams }) {
    const lineups = teams.map((team) => ({
        team,
        playerIds: match.lineup?.find((e) => e.teamId === team.id)?.playerIds ?? [],
    }));

    if (lineups.every((l) => !l.playerIds.length)) {
        return <p className="py-5 text-center text-xs text-zinc-500">Lineup not yet available</p>;
    }

    return (
        <div className="grid grid-cols-2 divide-x divide-white/10">
            {lineups.map(({ team, playerIds }) => (
                <section className="min-w-0 first:pl-0 last:pr-0" key={team.id}>
                    <TeamHeading team={team} />
                    {playerIds.length > 0 ? (
                        <ul>
                            {playerIds.map((playerId) => {
                                const player = playersById.get(playerId);
                                return (
                                    <li
                                        className={`relative h-16 overflow-hidden border-b border-white/10 bg-gradient-to-r ${team.id === 1 ? "from-blue-500/60 via-blue-700/30" : "from-yellow-400/80 via-yellow-600/50"} to-transparent last:border-b-0`}
                                        key={playerId}
                                    >
                                        <Link
                                            className="relative z-10 flex h-full items-center px-3 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                                            href={`/players/${playerId}`}
                                            aria-label={`View ${player?.name ?? `Player ${playerId}`}`}
                                        >
                                            <span className="min-w-0 text-sm max-w-7/12 truncate font-medium text-zinc-100">
                                                {player?.name ?? `Player ${playerId}`}
                                            </span>
                                        </Link>
                                        <SafeImage
                                            className="pointer-events-none absolute right-0 top-0 h-28 w-auto max-w-none object-contain object-top"
                                            src={player?.image}
                                            fallbackSrc="/user.png"
                                            alt=""
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="py-5 text-center text-xs text-zinc-500">No lineup recorded</p>
                    )}
                </section>
            ))}
        </div>
    );
}

export const MatchDetails = () => {
    const [, params] = useRoute("/matches/:id");
    const [, navigate] = useLocation();
    const [activeTab, setActiveTab] = useState("facts");
    const [now, setNow] = useState(() => new Date());
    const match = data.matches.find((item) => String(item.id) === params?.id);
    const [hasVoted, setHasVoted] = useState(() => (
        params?.id ? localStorage.getItem(`voted_match_${params.id}`) === "true" : false
    ));
    const [hasRevoted, setHasRevoted] = useState(() => {
        return params?.id ? localStorage.getItem(`revoted_match_${params.id}`) === "true" : false
    })
    const [isVoteFeedbackVisible, setIsVoteFeedbackVisible] = useState(false);
    const setTab = (tab) => {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url.toString());
        setActiveTab(tab);
    };

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setIsVoteFeedbackVisible(false);
        setHasVoted(params?.id
            ? localStorage.getItem(`voted_match_${params.id}`) === "true"
            : false);
        setHasRevoted(params?.id
            ? localStorage.getItem(`revoted_match_${params.id}`) === "true"
            : false);
        const handleVote = (event) => {
            if (event.detail?.matchId !== String(params?.id)) return;
            setIsVoteFeedbackVisible(false);
            if (hasVoted) {
                setHasRevoted(true);
            }
            setHasVoted(true);
            setTab("votes");
        }; window.addEventListener("motm-voted", handleVote);
        return () => window.removeEventListener("motm-voted", handleVote);
    }, [params?.id, hasVoted]);

    const votingPeriodStatus = match ? getMatchVotingPeriodStatus(match.date, now) : "closed";
    const canShowVoting = votingPeriodStatus === "open" && !(hasVoted && hasRevoted);
    const canShowVotes = votingPeriodStatus === "open" || votingPeriodStatus === "closed";
    const canShowMotmTab = canShowVoting || canShowVotes;
    const tabColumnClass = canShowVoting && canShowVotes
        ? "grid-cols-4"
        : canShowMotmTab
            ? "grid-cols-3"
            : "grid-cols-2";

    useEffect(() => {
        if (activeTab === "vote" && !canShowVoting) {
            setTab(canShowVotes ? "votes" : "facts");
        }
        if (activeTab === "votes" && !canShowVotes) {
            setTab(canShowVoting ? "vote" : "facts");
        }
    }, [activeTab, canShowVotes, canShowVoting]);

    useEffect(() => {
        const requestedTab = new URLSearchParams(window.location.search).get("tab");
        if (requestedTab === "vote" && canShowVoting) setActiveTab("vote");
        else if (requestedTab === "votes" && canShowVotes) setActiveTab("votes");
        else if (requestedTab === "lineup") setActiveTab("lineup");
        else setActiveTab("facts"); // default
    }, [canShowVotes, canShowVoting, params?.id]);

    const goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate("/matches");
        }
    };

    if (!match) {
        return (
            <main className="min-h-dvh bg-zinc-950 px-4 py-6 text-white">
                <div className="mx-auto max-w-3xl">
                    <p className="mt-10 text-center text-zinc-100 text-lg mb-2">Match not found.</p>
                    <button className="mx-auto flex items-center gap-1 text-sm text-zinc-400" type="button" onClick={goBack}>
                        <BackIcon /> Back
                    </button>
                </div>
            </main>
        );
    }

    const [homeResult, awayResult] = match.teams;
    const homeTeam = teamsById.get(homeResult.teamId);
    const awayTeam = teamsById.get(awayResult.teamId);
    const teams = [homeTeam, awayTeam];
    const motm = votingPeriodStatus === "closed" ? playersById.get(match.motmPlayerId) : null;

    return (
        <main className="min-h-dvh bg-zinc-950 px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-white">
            <div className="mx-auto w-full max-w-3xl">
                <MatchCard
                    date={match.date}
                    teamA={homeTeam}
                    teamB={awayTeam}
                    scoreA={homeResult.score}
                    scoreB={awayResult.score}
                    motm={motm}
                    matchdayCount={match.id}
                    posterFilename={match.poster_filename}
                />

                <section className="mt-5">
                    <div className={`grid ${tabColumnClass} border-b border-white/10`} role="tablist" aria-label="Match details">
                        <button
                            className={`border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === "facts" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                            type="button"
                            disabled={isVoteFeedbackVisible}
                            role="tab"
                            aria-selected={activeTab === "facts"}
                            onClick={() => setTab("facts")}
                        >
                            Match facts
                        </button>
                        <button
                            className={`border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === "lineup" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                            type="button"
                            disabled={isVoteFeedbackVisible}
                            role="tab"
                            aria-selected={activeTab === "lineup"}
                            onClick={() => setTab("lineup")}
                        >
                            Lineup
                        </button>
                        {canShowVoting && (
                            <button
                                className={`border-b-2 px-2 py-3 text-sm font-semibold transition-colors ${activeTab === "vote" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                                type="button"
                                disabled={isVoteFeedbackVisible}
                                role="tab"
                                aria-selected={activeTab === "vote"}
                                onClick={() => setTab("vote")}
                            >
                                Vote MOTM
                            </button>
                        )}
                        {canShowVotes && (
                            <button
                                className={`border-b-2 px-2 py-3 text-sm font-semibold transition-colors ${activeTab === "votes" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                                type="button"
                                disabled={isVoteFeedbackVisible}
                                role="tab"
                                aria-selected={activeTab === "votes"}
                                onClick={() => setTab("votes")}
                            >
                                Votes
                            </button>
                        )}
                    </div>

                    <div className="py-4" role="tabpanel">
                        {activeTab === "facts" && <MatchFacts match={match} teams={teams} />}
                        {activeTab === "lineup" && <Lineup match={match} teams={teams} />}
                        {activeTab === "vote" && canShowVoting && (
                            <ManOfTheMatchVote
                                matchId={String(match.id)}
                                lineup={match.lineup}
                                allPlayers={data.players}
                                onFeedbackShown={() => setIsVoteFeedbackVisible(true)}
                                hasVoted={hasVoted}
                                hasRevoted={hasRevoted}
                                setHasVoted={setHasVoted}
                                setHasRevoted={setHasRevoted}
                            />
                        )}
                        {activeTab === "votes" && canShowVotes && (
                            <MotmVotes
                                matchId={String(match.id)}
                                allPlayers={data.players}
                                isFinal={votingPeriodStatus === "closed"}
                            />
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};
