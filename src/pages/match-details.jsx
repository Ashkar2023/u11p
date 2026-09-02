import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import ManOfTheMatchVote from "../components/man-of-the-match-vote";
import MatchCard from "../components/match.card";
import MotmVotes from "../components/motm-votes";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { getMatchVotingPeriodStatus } from "../utils/date.util";
import user_png from "../assets/user.png";
import lineup_ground_png from "../assets/lineup-ground.png"
import fifa_shield from "../assets/fifa-player-shield.png";

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
        <header className="flex items-center justify-center gap-2 border-b border-white/10 pb-3 pt-2 text-center">
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
                    <section className="min-w-0 first:pl-0 last:pr-0" key={team.id}>
                        <TeamHeading team={team} />
                        {goals.length > 0 ? (
                            <ul className="mt-2 space-y-1 px-2">
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

function getPositionMap(count) {
    if (count >= 11) {
        // 4-3-3
        return [
            [90, 50],
            [68, 15], [71, 38], [71, 62], [68, 85],
            [44, 22], [46, 50], [44, 78],
            [20, 22], [16, 50], [20, 78],
        ];
    } else if (count === 10) {
        // 4-3-2
        return [
            [90, 50],
            [68, 15], [71, 38], [71, 62], [68, 85],
            [45, 33], [45, 67],
            [20, 22], [16, 50], [20, 78],
        ];
    } else if (count === 9) {
        // 3-2-3 (GK + 3 DEF + 2 MID + 2 FWD)
        return [
            [90, 50],
            [68, 15], [71, 38], [71, 62], [68, 85],
            [44, 33], [44, 67],
            [20, 33], [20, 67],
        ];
    } else if (count === 8) {
        // 3-2-2 (GK + 3 DEF + 2 MID + 2 FWD)
        return [
            [90, 50],
            [65, 20], [68, 50], [65, 80],
            [43, 33], [43, 67],
            [20, 30], [20, 70],
        ];
    } else {
        // 7 players: 2-2-2 (GK + 2 DEF + 2 MID + 2 FWD)
        return [
            [90, 50],
            [65, 20], [68, 50], [65, 80],
            [44, 50],
            [20, 70], [20, 30],
        ];
    }
}

function Lineup({ match, teams }) {
    const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id);

    const lineups = teams.map((team) => ({
        team,
        playerIds: match.lineup?.find((e) => e.teamId === team.id)?.playerIds ?? [],
    }));

    const hideToggle = lineups.some((l) => l.playerIds.length < 7);
    const [isListView, setIsListView] = useState(hideToggle);

    if (lineups.every((l) => !l.playerIds.length)) {
        return <p className="py-5 text-center text-xs text-zinc-500">Lineup not yet available</p>;
    }

    const selectedLineup = lineups.find((l) => l.team.id === selectedTeamId) ?? lineups[0];

    return (
        <>
            {

                !hideToggle &&
                <div className={`flex ${isListView && "border-b border-white/30"} `}>
                    <button
                        type="button"
                        disabled={isListView}
                        onClick={() => setSelectedTeamId(teams[0]?.id)}
                        className={`flex flex-1 items-center justify-center gap-2 px-3 py-2.5 transition-colors
                        ${isListView ? "cursor-not-allowed opacity-90" : ""}
                        ${!isListView && selectedTeamId === teams[0]?.id ? "border-b-2 border-amber-400" : "border-b-2 border-transparent"}`}
                    >
                        <SafeImage className="size-9 object-contain" src={teams[0]?.logo} alt="" />
                        <h3 className="text-sm font-semibold text-zinc-100">{teams[0]?.name}</h3>
                    </button>
                    <div className="flex flex-col items-center justify-center px-3 gap-0.5">
                        <label className="flex cursor-pointer flex-col items-center gap-1">
                            <span className="text-[10px] text-zinc-500">List view</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isListView}
                                onClick={() => setIsListView((v) => !v)}
                                className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${isListView ? "bg-amber-400" : "bg-zinc-700"}`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 ${isListView ? "translate-x-4" : "translate-x-0"}`}
                                />
                            </button>
                        </label>
                    </div>
                    <button
                        type="button"
                        disabled={isListView}
                        onClick={() => setSelectedTeamId(teams[1]?.id)}
                        className={`flex flex-1 items-center justify-center gap-2 px-3 py-2.5 transition-colors
                        ${isListView ? "cursor-not-allowed opacity-90" : ""}
                        ${!isListView && selectedTeamId === teams[1]?.id ? "border-b-2 border-amber-400" : "border-b-2 border-transparent"}`}
                    >
                        <SafeImage className="size-9 object-contain" src={teams[1]?.logo} alt="" />
                        <h3 className="text-sm font-semibold text-zinc-100">{teams[1]?.name}</h3>
                    </button>
                </div>
            }

            {isListView ? (
                /* ── LIST VIEW (unchanged) ── */
                <div className="grid grid-cols-2 divide-x divide-white/10">
                    {lineups.map(({ team, playerIds }) => (
                        <section className="min-w-0 first:pl-0 last:pr-0" key={team.id}>
                            {hideToggle && <TeamHeading team={team} />}
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
                                                    fallbackSrc={user_png}
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
            ) : (
                /* ── PITCH VIEW ── */
                selectedLineup.playerIds.length > 0 ? (
                    <div className="relative w-full select-none aspect-3/4">
                        {/* Ground image */}
                        <img
                            src={lineup_ground_png}
                            alt="Football pitch"
                            className="absolute inset-0 w-full object-contain object-center"
                            draggable={false}
                        />

                        {/* Players */}
                        {selectedLineup.playerIds.slice(0, 11).map((playerId, idx) => {
                            const player = playersById.get(playerId);
                            const positionMap = getPositionMap(selectedLineup.playerIds.length);
                            const [top, left] = positionMap[idx] ?? [50, 50];
                            const isHomeTeam = selectedLineup.team.id === teams[0]?.id;

                            return (
                                <Link
                                    key={playerId}
                                    href={`/players/${playerId}`}
                                    aria-label={`View ${player?.name ?? `Player ${playerId}`}`}
                                    className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 animate-player-in"
                                    style={{
                                        top: `${top}%`,
                                        left: `${left}%`,
                                        animationDelay: `${idx * 80}ms`,
                                    }}
                                >
                                    <div className="relative w-16 aspect-[2/2.7] sm:w-24 md:w-32">
                                        {/* Shield */}
                                        <img
                                            src={fifa_shield}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-contain drop-shadow-md drop-shadow-gray-800"
                                            aria-hidden="true"
                                        />

                                        {/* Player image */}
                                        <div
                                            className="absolute overflow-hidden"
                                            style={{
                                                top: "5%",
                                                left: "7%",
                                                width: "85%",
                                                height: "72%",
                                            }}
                                        >
                                            <SafeImage
                                                className="h-full w-full object-cover object-top"
                                                src={player?.image}
                                                fallbackSrc={user_png}
                                                alt=""
                                                style={{
                                                    maskImage:
                                                        "linear-gradient(to bottom, black 70%, transparent 100%)",
                                                    WebkitMaskImage:
                                                        "linear-gradient(to bottom, black 70%, transparent 100%)",
                                                }}
                                            />
                                        </div>

                                        {/* Name */}
                                        <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center">
                                            <span className="w-full truncate text-center font-ddin text-[clamp(7px,10px,14px)] font-bold uppercase text-[#1A1A1A]">
                                                {player?.name?.split(" ")[0]}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <p className="py-5 text-center text-xs text-zinc-500">No lineup recorded</p>
                )
            )}
        </>
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
    const canShowFacts = votingPeriodStatus === "open" || votingPeriodStatus === "closed";
    const canShowVotes = votingPeriodStatus === "open" || votingPeriodStatus === "closed";
    const isFactsDefault = votingPeriodStatus === "closed";
    const canShowVoting = votingPeriodStatus === "open" && !(hasVoted && hasRevoted);
    const canShowMotmTab = canShowVoting || canShowVotes;
    const tabColumnClass = canShowVoting && canShowVotes
        ? canShowFacts ? "grid-cols-4" : "grid-cols-3"
        : canShowMotmTab
            ? canShowFacts ? "grid-cols-3" : "grid-cols-2"
            : canShowFacts ? "grid-cols-2" : "grid-cols-1";


    useEffect(() => {
        if (activeTab === "facts" && !canShowFacts) setTab("lineup");
        if (activeTab === "vote" && !canShowVoting) setTab(canShowVotes ? "votes" : canShowFacts ? "facts" : "lineup");
        if (activeTab === "votes" && !canShowVotes) setTab(canShowVoting ? "vote" : canShowFacts ? "facts" : "lineup");
    }, [activeTab, canShowVotes, canShowVoting, canShowFacts]);

    useEffect(() => {
        const requestedTab = new URLSearchParams(window.location.search).get("tab");

        if (requestedTab === "vote" && canShowVoting) { setActiveTab("vote"); return; }
        if (requestedTab === "votes" && canShowVotes) { setActiveTab("votes"); return; }
        if (requestedTab === "lineup") { setActiveTab("lineup"); return; }
        if (requestedTab === "facts" && canShowFacts) { setActiveTab("facts"); return; }

        // Default tab logic (no ?tab= param or invalid)
        if (isFactsDefault) {
            setActiveTab("facts");
        } else if (canShowVoting && !hasVoted) {
            setActiveTab("vote");
        } else if (canShowVotes) {
            setActiveTab("votes");
        } else {
            setActiveTab("lineup"); // before match ends
        }
    }, [canShowVotes, canShowVoting, canShowFacts, isFactsDefault, params?.id]);

    const goBack = () => window.history.back();

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
            <div className="pb-3">
                <button
                    className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition-colors"
                    type="button"
                    onClick={goBack}
                >
                    <BackIcon /> Back
                </button>
            </div>
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
                    homeCaptain={playersById.get(homeResult.captainPlayerId)}
                    awayCaptain={playersById.get(awayResult.captainPlayerId)}
                />

                <section className="mt-5">
                    <div className={`grid ${tabColumnClass} border-b border-white/10`} role="tablist" aria-label="Match details">
                        {canShowFacts && (
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
                        )}
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

                    <div className={`pb-4 ${activeTab === "votes" || activeTab === "vote" ? "mt-4" : ""} `} role="tabpanel">
                        {activeTab === "facts" && canShowFacts && <MatchFacts match={match} teams={teams} />}
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
