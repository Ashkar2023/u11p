import { Link, useSearchParams } from "wouter";
import MatchCard from "../components/match.card";
import data from "../data.json";
import { PageLayout } from "../layout";

const ALL_TIME = "all";
const teamsById = new Map(data.teams.map((team) => [team.id, team]));
const completedMatches = data.matches
    .filter(
        (match) => !match.isUpcoming && match.teams.every((team) => Number.isFinite(team.score)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

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

const availableMonths = [...new Set(completedMatches.map((match) => getMonthKey(match.date)))];

function formatMonth(month) {
    return new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    }).format(new Date(`${month}-01T12:00:00+05:30`));
}

export const Matches = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPeriod = searchParams.get("period");
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
        ? completedMatches
        : completedMatches.filter((match) => getMonthKey(match.date) === period);

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
                            <Link
                                className="block rounded-lg transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                href={`/matches/${match.id}`}
                                aria-label={`View match from ${match.date}`}
                                key={match.id}
                            >
                                <MatchCard
                                    date={match.date}
                                    teamA={teamsById.get(homeResult.teamId)}
                                    teamB={teamsById.get(awayResult.teamId)}
                                    scoreA={homeResult.score}
                                    scoreB={awayResult.score}
                                />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </PageLayout>
    );
};
