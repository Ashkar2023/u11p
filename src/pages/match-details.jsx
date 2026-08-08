import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import MatchCard from "../components/match.card";
import data from "../data.json";

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
            <img className="size-9 object-contain" src={team.logo} alt="" />
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
                                        <li className="flex min-w-0 items-center gap-2 py-1.5" key={`${goal.playerId}-${index}`}>
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
    const useFallback = (event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = "/user.png";
    };

    return (
        <div className="grid grid-cols-2 divide-x divide-white/10">
            {teams.map((team) => {
                const teamLineup = match.lineup?.find((entry) => entry.teamId === team.id);
                const playerIds = teamLineup?.players ?? teamLineup?.playerIds ?? [];

                return (
                    <section className="min-w-0 px-3 first:pl-0 last:pr-0" key={team.id}>
                        <TeamHeading team={team} />
                        {playerIds.length > 0 ? (
                            <ul className="mt-2">
                                {playerIds.map((playerId) => {
                                    const player = playersById.get(playerId);
                                    return (
                                        <li className="flex min-w-0 items-center gap-2 border-b border-white/10 py-2 last:border-b-0" key={playerId}>
                                            <img
                                                className="size-8 shrink-0 rounded-full bg-zinc-800 object-cover"
                                                src={player?.image || "/user.png"}
                                                alt=""
                                                onError={useFallback}
                                            />
                                            <span className="min-w-0 truncate text-sm text-zinc-200">
                                                {player?.name ?? `Player ${playerId}`}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="py-5 text-center text-xs text-zinc-500">No lineup recorded</p>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

export const MatchDetails = () => {
    const [, params] = useRoute("/matches/:id");
    const [, navigate] = useLocation();
    const [activeTab, setActiveTab] = useState("facts");
    const match = data.matches.find((item) => String(item.id) === params?.id);

    const goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate("/matches");
        }
    };

    if (!match || match.isUpcoming) {
        return (
            <main className="min-h-dvh bg-zinc-950 px-4 py-6 text-white">
                <div className="mx-auto max-w-3xl">
                    <button className="flex items-center gap-1 text-sm text-zinc-300" type="button" onClick={goBack}>
                        <BackIcon /> Back
                    </button>
                    <p className="mt-10 text-center text-zinc-500">Match not found.</p>
                </div>
            </main>
        );
    }

    const [homeResult, awayResult] = match.teams;
    const homeTeam = teamsById.get(homeResult.teamId);
    const awayTeam = teamsById.get(awayResult.teamId);
    const teams = [homeTeam, awayTeam];

    return (
        <main className="min-h-dvh bg-zinc-950 px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-white">
            <div className="mx-auto w-full max-w-3xl">
                <button
                    className="mb-5 flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-zinc-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
                    type="button"
                    onClick={goBack}
                >
                    <BackIcon />
                    <span>Back</span>
                </button>

                <MatchCard
                    date={match.date}
                    teamA={homeTeam}
                    teamB={awayTeam}
                    scoreA={homeResult.score}
                    scoreB={awayResult.score}
                />

                <section className="mt-5">
                    <div className="grid grid-cols-2 border-b border-white/10" role="tablist" aria-label="Match details">
                        <button
                            className={`border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === "facts" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "facts"}
                            onClick={() => setActiveTab("facts")}
                        >
                            Match facts
                        </button>
                        <button
                            className={`border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === "lineup" ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "lineup"}
                            onClick={() => setActiveTab("lineup")}
                        >
                            Lineup
                        </button>
                    </div>

                    <div className="py-4" role="tabpanel">
                        {activeTab === "facts"
                            ? <MatchFacts match={match} teams={teams} />
                            : <Lineup match={match} teams={teams} />}
                    </div>
                </section>
            </div>
        </main>
    );
};
