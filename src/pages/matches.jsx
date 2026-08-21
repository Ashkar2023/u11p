import { useEffect, useState } from "react";
import { useSearchParams } from "wouter";
import MatchCard from "../components/match.card";
import data from "../data.json";
import { PageLayout } from "../layout";
import { getMatchVotingPeriodStatus, isMatchTodayOrStarted } from "../utils/date.util";

const ALL_TIME = "all";
const teamsById = new Map(data.teams.map((team) => [team.id, team]));
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

function formatMonth(month) {
    return new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    }).format(new Date(`${month}-01T12:00:00+05:30`));
}

export const Matches = () => {
    const [now, setNow] = useState(() => new Date());
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get("period");
    const startedMatches = data.matches
        .filter((match) => isMatchTodayOrStarted(match, now))
        .sort((a, b) => b.date.localeCompare(a.date));
    const availableMonths = [...new Set(startedMatches.map((match) => getMonthKey(match.date)))];
    const period = availableMonths.includes(requestedPeriod) ? requestedPeriod : ALL_TIME;

    const setPeriod = (nextPeriod) => {
        setSearchParams((currentParams) => {
            const nextParams = new URLSearchParams(currentParams);

            if (nextPeriod === ALL_TIME) {
                nextParams.delete("period");
            } else {
                nextParams.set("period", nextPeriod);
            }

            return nextParams;
        }, { replace: true });
    };

    const visibleMatches = period === ALL_TIME
        ? startedMatches
        : startedMatches.filter((match) => getMonthKey(match.date) === period);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <PageLayout>
            <div className="mx-auto w-full max-w-3xl">
                <header className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold sm:text-2xl text-amber-400">Matches</h1>
                        <p className="mt-1 text-sm text-zinc-400">
                            {visibleMatches.length} {visibleMatches.length === 1 ? "match" : "matches"}
                        </p>
                    </div>
                    <select
                        className="max-w-36 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-400 sm:text-sm"
                        value={period}
                        onChange={(event) => setPeriod(event.target.value)}
                        aria-label="Matches period"
                    >
                        <option value={ALL_TIME}>All time</option>
                        {availableMonths.map((month) => (
                            <option value={month} key={month}>{formatMonth(month)}</option>
                        ))}
                    </select>
                </header>

                <div className="grid gap-4">
                    {visibleMatches.map((match) => {
                        const [homeResult, awayResult] = match.teams;

                        return (
                            <MatchCard
                                date={match.date}
                                teamA={teamsById.get(homeResult.teamId)}
                                teamB={teamsById.get(awayResult.teamId)}
                                scoreA={homeResult.score}
                                scoreB={awayResult.score}
                                motm={getMatchVotingPeriodStatus(match.date, now) === "closed"
                                    ? playersById.get(match.motmPlayerId)
                                    : null}
                                matchdayCount={match.id}
                                matchHref={`/matches/${match.id}`}
                                key={match.id}
                                posterFilename={match.poster_filename}
                            />
                        );
                    })}
                </div>
            </div>
        </PageLayout>
    );
};
