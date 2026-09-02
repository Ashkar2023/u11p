import { Link, useSearchParams } from "wouter";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { PageLayout } from "../layout";
import { hasMatchResult } from "../utils/date.util";
import { useState } from "react";
import user_png from "../assets/user.png";

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

const awardLabels = {
    "ultimate-team": "Ultimate Team",
    "top-scorer": "Golden Boot Winner",
    "best-midfielder": "Best Midfielder",
    "best-defender": "Best Defender",
    "golden-glove": "Golden Glove Winner",
};

const awardMonths = Object.keys(data.awards ?? {}).sort().reverse();

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

function usePeriodFilter(paramName, defaultPeriod = ALL_TIME) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get(paramName);
    const period = requestedPeriod === ALL_TIME || availableMonths.includes(requestedPeriod)
        ? requestedPeriod
        : defaultPeriod;

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
    const len = Math.max(a.goalsByMatch.length, b.goalsByMatch.length);
    for (let i = 0; i < len; i++) {
        const diff = (b.goalsByMatch[i] ?? 0) - (a.goalsByMatch[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
};

export function calculateGoalScorers(matches) {
    const appearanceCount = new Map();
    matches.forEach((match) => {
        match.lineup?.flatMap((entry) => entry.playerIds).forEach((playerId) => {
            appearanceCount.set(playerId, (appearanceCount.get(playerId) ?? 0) + 1);
        });
    });

    return [...matches.reduce((totals, match) => {
        match.goals?.forEach((goal) => {
            if (!goal.ownGoal) {
                const existing = totals.get(goal.playerId) ?? { goals: 0, goalsByMatch: [] };
                totals.set(goal.playerId, {
                    goals: existing.goals + goal.count,
                    goalsByMatch: [...existing.goalsByMatch, goal.count].sort((a, b) => b - a),
                });
            }
        });
        return totals;
    }, new Map())]
        .map(([playerId, data]) => ({
            ...playersById.get(playerId),
            ...data,
            matchesPlayed: appearanceCount.get(playerId) ?? 0,
            GPM: data.goals / (appearanceCount.get(playerId) ?? 1),
        }))
        .sort((a, b) =>
            b.goals - a.goals ||
            b.GPM - a.GPM ||
            compareGoalsByMatch(a, b) ||
            a.name?.localeCompare(b.name)
        );
}

function TeamStats() {
    const [period, setPeriod] = usePeriodFilter("teamPeriod", availableMonths[0] ?? ALL_TIME);
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
    const [period, setPeriod] = usePeriodFilter("scorersPeriod", availableMonths[0] ?? ALL_TIME);
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
                        <span className="text-xs text-zinc-400 text-end">Goals breakdown</span>
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
                                className="grid h-16 grid-cols-[1rem_4rem_1fr_auto] items-center gap-2 rounded-md transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                                href={`/players/${player.id}`}
                                aria-label={`View ${player.name}`}
                            >
                                <span className="text-xs font-semibold text-amber-400">
                                    {index + 1}
                                </span>

                                <div className="flex h-16 shrink-0 items-start justify-center overflow-clip">
                                    <SafeImage
                                        className="h-20 pt-1.5 w-auto max-w-full object-contain object-top"
                                        src={player.image}
                                        fallbackSrc={user_png}
                                        alt=""
                                    />
                                </div>

                                <div className="min-w-0">
                                    <span className="truncate text-base font-medium text-zinc-100">
                                        {player.name}
                                    </span>

                                    {showGBM && (
                                        <div className="mt-0.5 flex gap-1">
                                            {player.goalsByMatch.map((g, i) => (
                                                <span
                                                    key={i}
                                                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
                                                >
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-bold text-white">{player.goals}</span>
                                    <p className="text-[10px] text-zinc-500">
                                        <span className="text-zinc-400">{player.matchesPlayed}</span> apps
                                        <span className="mx-1 text-zinc-300">·</span>
                                        <span className="text-zinc-400">{player.GPM.toFixed(2)}</span> avg
                                    </p>
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

function Awards() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedMonth = searchParams.get("awardsPeriod");
    const selectedMonth = awardMonths.includes(requestedMonth)
        ? requestedMonth
        : awardMonths[0] ?? "";
    const awards = data.awards?.[selectedMonth] ?? {};

    const setSelectedMonth = (month) => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.set("awardsPeriod", month);
            return nextParams;
        }, { replace: true });
    };

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 mb-12 shadow-2xl shadow-black/25" id="awards">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Awards
                </h2>
                {awardMonths.length > 0 && (
                    <select
                        className="max-w-36 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-400 sm:text-sm"
                        value={selectedMonth}
                        onChange={(event) => setSelectedMonth(event.target.value)}
                        aria-label="Awards month"
                    >
                        {awardMonths.map((month) => (
                            <option value={month} key={month}>{formatMonth(month)}</option>
                        ))}
                    </select>
                )}
            </div>

            {Object.keys(awards).length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    {Object.keys(awards).map((type) => (
                        <Link
                            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-200 transition-colors hover:border-amber-400/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                            href={`/awards/${selectedMonth.slice(0, 4)}/${formatMonth(selectedMonth).split(" ")[0].toLowerCase()}/${type}`}
                            key={type}
                        >
                            <span>{awardLabels[type] ?? type}</span>
                            <svg className="size-4 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Link>
                    ))}
                </div>
            ) : (
                <p className="py-5 text-center text-sm text-zinc-500">No awards for this month.</p>
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
                <Awards />
            </div>
        </PageLayout>
    );
};
