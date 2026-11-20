import { Link, useSearchParams } from "wouter";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { PageLayout } from "../layout";
import { hasMatchResult } from "../utils/date.util";
import { calculateGoalScorers } from "../utils/goal-scorers.util";
import { useState } from "react";
import user_png from "../assets/user.webp";

const ALL_TIME = "all";
const completedMatches = data.matches.filter(hasMatchResult);
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

    const period =
        requestedPeriod === ALL_TIME || availableMonths.includes(requestedPeriod)
            ? requestedPeriod
            : defaultPeriod;

    const setPeriod = (nextPeriod) => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.set(paramName, nextPeriod);
            return nextParams;
        }, { replace: true });
    };

    return [period, setPeriod];
}

function calculateTeamStats(matches) {
    return data.teams.map((team) => {
        const stats = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0 };

        matches.forEach((match) => {
            const teamResult = match.teams.find((result) => result.teamId === team.id);
            const opponentResult = match.teams.find((result) => result.teamId !== team.id);

            if (!teamResult || !opponentResult) return;

            stats.matchesPlayed += 1;
            stats.goalsFor += teamResult.score;
            stats.goalsAgainst += opponentResult.score;

            if (teamResult.score > opponentResult.score) stats.wins += 1;
            if (teamResult.score < opponentResult.score) stats.losses += 1;
            if (teamResult.score === opponentResult.score) stats.draws += 1;
        });

        return {
            ...team,
            ...stats,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
            points: stats.wins * 3 + stats.draws,
        };
    })
        .filter((team) => team.matchesPlayed > 0)
        .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

function calculateHeadToHead(matches, teamAId, teamBId) {
    const meetings = matches.filter((match) =>
        match.teams.some((team) => team.teamId === teamAId)
        && match.teams.some((team) => team.teamId === teamBId),
    );
    const stats = meetings.reduce((totals, match) => {
        const scoreA = match.teams.find((team) => team.teamId === teamAId).score;
        const scoreB = match.teams.find((team) => team.teamId === teamBId).score;
        totals.played += 1;
        totals.goalsFor += scoreA;
        totals.goalsAgainst += scoreB;
        if (scoreA > scoreB) totals.wins += 1;
        else if (scoreA < scoreB) totals.losses += 1;
        else totals.draws += 1;
        return totals;
    }, { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });

    return { ...stats, goalDifference: stats.goalsFor - stats.goalsAgainst, meetings };
}

function TeamStats() {
    const [period, setPeriod] = usePeriodFilter("teamPeriod", availableMonths[0] ?? ALL_TIME);
    const [showHeadToHead, setShowHeadToHead] = useState(false);
    const [showMatchHistory, setShowMatchHistory] = useState(false);
    const [teamAId, setTeamAId] = useState(data.teams[0]?.id);
    const [teamBId, setTeamBId] = useState(data.teams[1]?.id);
    const teamStats = calculateTeamStats(matchesForPeriod(period));
    const teamA = data.teams.find((team) => team.id === teamAId);
    const teamB = data.teams.find((team) => team.id === teamBId);
    const headToHead = calculateHeadToHead(matchesForPeriod(period), teamAId, teamBId);

    const selectTeamA = (nextTeamId) => {
        const nextId = Number(nextTeamId);
        setTeamAId(nextId);
        if (nextId === teamBId) setTeamBId(data.teams.find((team) => team.id !== nextId)?.id);
    };

    const selectTeamB = (nextTeamId) => {
        const nextId = Number(nextTeamId);
        setTeamBId(nextId);
        if (nextId === teamAId) setTeamAId(data.teams.find((team) => team.id !== nextId)?.id);
    };

    return (
        <section className="min-w-0 w-full rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Team stats
                </h1>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:gap-5">
                    <label className="flex cursor-pointer items-center gap-2">
                        <span className="text-xs text-zinc-400">H2H</span>
                        <button
                            type="button"
                            role="switch"
                            aria-label="Head-to-head stats"
                            aria-checked={showHeadToHead}
                            onClick={() => setShowHeadToHead((value) => !value)}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${showHeadToHead ? "bg-amber-400" : "bg-zinc-700"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 ${showHeadToHead ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </label>
                    <PeriodSelect value={period} onChange={setPeriod} label="Team stats period" />
                </div>
            </div>

            {showHeadToHead ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {[{ label: "Team A", team: teamA, onChange: selectTeamA, otherId: teamBId }, { label: "Team B", team: teamB, onChange: selectTeamB, otherId: teamAId }].map(({ label, team, onChange, otherId }) => (
                            <label className="min-w-0 space-y-1" key={label}>
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
                                <select
                                    className="w-full min-w-0 rounded-md border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none focus:border-amber-400 sm:text-sm"
                                    value={team?.id ?? ""}
                                    onChange={(event) => onChange(event.target.value)}
                                    aria-label={label}
                                >
                                    {data.teams.map((option) => <option value={option.id} key={option.id} disabled={option.id === otherId}>{option.name}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>

                    {teamA && teamB && <>
                        <div className="overflow-hidden rounded-lg border border-amber-400/20 bg-linear-to-br from-amber-400/10 via-zinc-950 to-sky-400/10">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-3 pt-4">
                                <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                                    <SafeImage className="size-12 object-contain" src={teamA.logo} alt="" />
                                    <span className="w-full truncate text-xs font-semibold text-zinc-100 sm:text-sm">{teamA.name}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">vs</span>
                                <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                                    <SafeImage className="size-12 object-contain" src={teamB.logo} alt="" />
                                    <span className="w-full truncate text-xs font-semibold text-zinc-100 sm:text-sm">{teamB.name}</span>
                                </div>
                            </div>
                            <div className="flex justify-center border-y border-white/10 bg-black/20 py-2">
                                <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Played <strong className="ml-1 text-sm text-amber-300">{headToHead.played}</strong></span>
                            </div>
                            <div className="bg-black/10 px-3 py-2">
                                <div className="divide-y divide-white/5">
                                    {[
                                        ["W", headToHead.wins, headToHead.losses],
                                        ["D", headToHead.draws, headToHead.draws],
                                        ["L", headToHead.losses, headToHead.wins],
                                        ["GF", headToHead.goalsFor, headToHead.goalsAgainst],
                                        ["GA", headToHead.goalsAgainst, headToHead.goalsFor],
                                        ["GD", headToHead.goalDifference, -headToHead.goalDifference],
                                    ].map(([label, valueA, valueB]) => (
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 py-1.5 text-sm" key={label}>
                                            <span className="text-center font-bold text-zinc-100">{label === "GD" && valueA > 0 ? "+" : ""}{valueA}</span>
                                            <span className="min-w-6 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
                                            <span className="text-center font-bold text-zinc-100">{label === "GD" && valueB > 0 ? "+" : ""}{valueB}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-md border border-white/10">
                            <button
                                type="button"
                                aria-expanded={showMatchHistory}
                                aria-controls="head-to-head-match-history"
                                onClick={() => setShowMatchHistory((value) => !value)}
                                className="flex w-full items-center justify-between gap-3 bg-zinc-800 px-3 py-2 text-left transition-colors hover:bg-zinc-700/80 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-400"
                            >
                                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Match history</span>
                                <span className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500">{headToHead.meetings.length} {headToHead.meetings.length === 1 ? "match" : "matches"}</span>
                                    <svg className={`size-4 text-zinc-400 transition-transform duration-200 ${showMatchHistory ? "rotate-180" : "rotate-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </span>
                            </button>
                            {showMatchHistory && headToHead.meetings.length ? (
                                <ol id="head-to-head-match-history" className="divide-y divide-white/10">
                                    {[...headToHead.meetings].reverse().map((match) => {
                                        const scoreA = match.teams.find((team) => team.teamId === teamAId).score;
                                        const scoreB = match.teams.find((team) => team.teamId === teamBId).score;
                                        const result = scoreA === scoreB
                                            ? "Draw"
                                            : `${scoreA > scoreB ? teamA.shortName ?? teamA.name : teamB.shortName ?? teamB.name} win`;
                                        const scoreColor = (score, opponentScore) => score > opponentScore
                                            ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]"
                                            : score < opponentScore
                                                ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                                                : "text-zinc-100";
                                        return <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-zinc-900 px-3 py-2 text-xs" key={match.id}>
                                            <span className="truncate text-zinc-400">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(match.date))}</span>
                                            <span className="flex items-center gap-1 font-bold" aria-label={`${teamA.name} ${scoreA}, ${teamB.name} ${scoreB}`}>
                                                <span className={scoreColor(scoreA, scoreB)}>{scoreA}</span>
                                                <span className="text-zinc-500">–</span>
                                                <span className={scoreColor(scoreB, scoreA)}>{scoreB}</span>
                                            </span>
                                            <span className={`text-right font-semibold ${result === "Draw" ? "text-zinc-400" : "text-amber-300"}`}>{result}</span>
                                        </li>;
                                    })}
                                </ol>
                            ) : showMatchHistory ? (
                                <p id="head-to-head-match-history" className="py-4 text-center text-sm text-zinc-500">No head-to-head results for this period.</p>
                            ) : null}
                        </div>
                    </>}
                </div>
            ) : teamStats.length > 0 ? (
                <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-white/10">
                    <table className="w-full min-w-72 md:min-w-155 border-separate border-spacing-0 text-left text-xs sm:text-sm">
                        <thead className="bg-zinc-700 text-[10px] uppercase tracking-wide text-zinc-400 sm:text-xs">
                            <tr>
                                {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((label) => (
                                    <th className={`px-2 py-2 font-semibold ${label === "#" ? "sticky left-0 bg-zinc-700 z-20 w-10 min-w-10" : ""} ${label === "Team" ? "sticky left-10 bg-zinc-700 z-20 w-14 min-w-14 border-r border-white/10 text-left sm:w-44 sm:min-w-44" : "text-center"} ${label === "GD" || label === "Pts" ? "text-amber-300" : ""}`} key={label} scope="col">{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {teamStats.map((team, index) => (
                                <tr className="bg-zinc-900 text-zinc-200" key={team.id}>
                                    <td className="sticky left-0 z-10 w-10 min-w-10 bg-zinc-900 px-2 py-2 text-center font-semibold text-zinc-500">{index + 1}</td>
                                    <th className="sticky left-10 z-10 w-14 min-w-14 border-r border-white/10 bg-zinc-900 px-2 py-2 text-left font-semibold text-zinc-100 sm:w-44 sm:min-w-44" scope="row">
                                        <span className="flex items-center gap-2 overflow-hidden">
                                            <SafeImage className="size-6 shrink-0 object-contain sm:size-7" src={team.logo} alt="" />
                                            <span className="hidden truncate sm:inline">{team.name}</span>
                                        </span>
                                    </th>
                                    {[team.matchesPlayed, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst].map((value, statIndex) => (
                                        <td className="px-1 py-1 text-center text-[11px] leading-tight sm:px-2 sm:py-2 sm:text-sm" key={statIndex}>{value}</td>
                                    ))}
                                    <td className="px-1 py-1 text-center text-[11px] font-bold leading-tight text-amber-300 sm:px-2 sm:py-2 sm:text-sm">{team.goalDifference > 0 ? "+" : ""}{team.goalDifference}</td>
                                    <td className="px-1 py-1 text-center text-[11px] font-bold leading-tight text-amber-300 sm:px-2 sm:py-2 sm:text-sm">{team.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="py-5 text-center text-sm text-zinc-500">No team results for this period.</p>
            )}
        </section>
    );
}

function GoalScorers() {
    const [period, setPeriod] = usePeriodFilter("scorersPeriod", availableMonths[0] ?? ALL_TIME);
    const goalScorers = calculateGoalScorers(matchesForPeriod(period));
    const [showGBM, setShowGBM] = useState(false);

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25" id="topscorers">
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
