import { Link, useSearchParams } from "wouter";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { PageLayout } from "../layout";
import { hasMatchResult } from "../utils/date.util";
import { useState } from "react";

const ALL_TIME = "all";
const completedMatches = data.matches.filter(hasMatchResult);
const playersById = new Map(data.players.map((player) => [player.id, player]));
const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
});
const getMonthKey = (date) => {
    const parts = Object.fromEntries(
        monthKeyFormatter.formatToParts(new Date(date)).map(({ type, value }) => [type, value]),
    );
    return `${parts.year}-${parts.month}`;
};
const availableMonths = [...new Set(completedMatches.map((match) => getMonthKey(match.date)))]
    .sort()
    .reverse();

const statItems = [
    ["Win", "wins"],
    ["Loss", "losses"],
    ["GF", "goalsFor"],
    ["GD", "goalDifference"],
    ["GA", "goalsAgainst"],
];

function matchesForPeriod(period) {
    return period === ALL_TIME
        ? completedMatches
        : completedMatches.filter((match) => getMonthKey(match.date) === period);
}

function formatMonth(month) {
    return new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    }).format(new Date(`${month}-01T12:00:00+05:30`));
}

function PeriodSelect({ value, onChange, label }) {
    return (
        <select
            className="max-w-36 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-400 sm:text-sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
        >
            <option value={ALL_TIME}>All time</option>
            {availableMonths.map((month) => (
                <option value={month} key={month}>{formatMonth(month)}</option>
            ))}
        </select>
    );
}

function usePeriodFilter(paramName) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get(paramName);
    const period = availableMonths.includes(requestedPeriod) ? requestedPeriod : ALL_TIME;

    const setPeriod = (nextPeriod) => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);

            if (nextPeriod === ALL_TIME) {
                nextParams.delete(paramName);
            } else {
                nextParams.set(paramName, nextPeriod);
            }

            return nextParams;
        }, { replace: true });
    };

    return [period, setPeriod];
}

function calculateTeamStats(matches) {
    return data.teams.map((team) => {
        const stats = { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

        matches.forEach((match) => {
            const teamResult = match.teams.find((result) => result.teamId === team.id);
            const opponentResult = match.teams.find((result) => result.teamId !== team.id);

            if (!teamResult || !opponentResult) return;

            stats.goalsFor += teamResult.score;
            stats.goalsAgainst += opponentResult.score;

            if (teamResult.score > opponentResult.score) stats.wins += 1;
            if (teamResult.score < opponentResult.score) stats.losses += 1;
        });

        return {
            ...team,
            ...stats,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
        };
    });
}

const compareGoalsByMatch = (a, b) => {
    for (let i = 0; i < a.goalsByMatch.length; i++) {
        const diff = b.goalsByMatch[i] - a.goalsByMatch[i]
        if (diff !== 0) return diff;
    }
    return 0;
}

export function calculateGoalScorers(matches) {
    return [...matches.reduce((totals, match) => {
        const appearances = new Set();
        match.goals?.forEach((goal) => {
            if (!goal.ownGoal) {
                const existing = totals.get(goal.playerId) ?? { goals: 0, matchesPlayed: 0, goalsByMatch: [], GPM: 0 };
                const isNew = !appearances.has(goal.playerId);
                if (isNew) appearances.add(goal.playerId);

                totals.set(goal.playerId, {
                    goals: existing.goals + goal.count,
                    matchesPlayed: existing.matchesPlayed + (isNew ? 1 : 0),
                    goalsByMatch: [...existing.goalsByMatch, goal.count].sort((a, b) => b - a)
                });
            }
        });
        return totals;
    }, new Map())]
        .map(([playerId, data]) => ({ ...playersById.get(playerId), ...data, GPM: (data.goals / data.matchesPlayed) }))
        .sort((a, b) => b.goals - a.goals ||
            b.GPM - a.GPM ||
            compareGoalsByMatch(a, b) ||
            a.name?.localeCompare(b.name));
}

function TeamStats() {
    const [period, setPeriod] = usePeriodFilter("teamPeriod");
    const teamStats = calculateTeamStats(matchesForPeriod(period));

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Team stats
                </h1>
                <PeriodSelect value={period} onChange={setPeriod} label="Team stats period" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                {teamStats.map((team) => (
                    <article className="rounded-lg border border-white/10 bg-black/20 p-3" key={team.id}>
                        <header className="mb-3 flex flex-col items-center gap-2 border-b border-white/10 pb-3 text-center">
                            <SafeImage className="size-16 object-contain" src={team.logo} alt={`${team.name} logo`} />
                            <h2 className="text-sm font-semibold text-zinc-100">{team.name}</h2>
                        </header>

                        <dl className="space-y-1.5">
                            {statItems.map(([label, key]) => (
                                <div className="flex items-center justify-between gap-2" key={key}>
                                    <dt className="text-xs text-zinc-400 sm:text-sm">{label}</dt>
                                    <dd className="text-sm font-semibold text-white sm:text-base">
                                        {key === "goalDifference" && team[key] > 0 ? "+" : ""}
                                        {team[key]}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </article>
                ))}
            </div>
        </section>
    );
}

function GoalScorers() {
    const [period, setPeriod] = usePeriodFilter("scorersPeriod");
    const goalScorers = calculateGoalScorers(matchesForPeriod(period));
    const [showGBM, setShowGBM] = useState(false);

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Top scorers
                </h2>
                <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                        <span className="text-xs text-zinc-400 text-end">Match breakdown</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showGBM}
                            onClick={() => setShowGBM(v => !v)}
                            className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showGBM ? "bg-amber-400" : "bg-zinc-700"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 ${showGBM ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </label>
                    <PeriodSelect value={period} onChange={setPeriod} label="Goal scorers period" />
                </div>
            </div>

            {goalScorers.length > 0 ? (
                <ol>
                    {goalScorers.map((player, index) => (
                        <li className="border-b border-white/10 last:border-b-0" key={player.id}>
                            <Link
                                className="grid grid-cols-[1rem_2.5rem_1fr_auto] items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                                href={`/players/${player.id}`}
                                aria-label={`View ${player.name}`}
                            >
                                <span className="text-xs font-semibold text-amber-400">{index + 1}</span>
                                <SafeImage
                                    className="size-10 rounded-full border border-white/10 bg-motm object-cover object-top"
                                    src={player.image}
                                    fallbackSrc="/user.png"
                                    alt=""
                                />
                                <div className="min-w-0">
                                    <span className="truncate text-base font-medium text-zinc-100">{player.name}</span>
                                    {showGBM && (
                                        <div className="mt-0.5 flex gap-1">
                                            {player.goalsByMatch.map((g, i) => (
                                                <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-bold text-white">{player.goals}</span>
                                    <p className="text-[10px] text-zinc-500">{player.GPM.toFixed(2)} GPM</p>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="py-5 text-center text-sm text-zinc-500">No goal records for this period.</p>
            )}
        </section>
    );
}

export const Stats = () => {
    return (
        <PageLayout>
            <div className="mx-auto grid w-full max-w-3xl gap-5">
                <div className="mb-2">
                    <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Stats</h1>
                </div>
                <TeamStats />
                <GoalScorers />
            </div>
        </PageLayout>
    );
};
