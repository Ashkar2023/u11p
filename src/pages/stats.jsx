import { useSearchParams } from "wouter";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import { PageLayout } from "../layout";

const ALL_TIME = "all";
const completedMatches = data.matches.filter(
    (match) => !match.isUpcoming && match.teams.every((team) => Number.isFinite(team.score)),
);
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

function calculateGoalScorers(matches) {
    return [...matches.reduce((totals, match) => {
        match.goals?.forEach((goal) => {
            if (!goal.ownGoal) {
                totals.set(goal.playerId, (totals.get(goal.playerId) ?? 0) + goal.count);
            }
        });
        return totals;
    }, new Map())]
        .map(([playerId, goals]) => ({ ...playersById.get(playerId), goals }))
        .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
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

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Top scorers
                </h2>
                <PeriodSelect value={period} onChange={setPeriod} label="Goal scorers period" />
            </div>

            {goalScorers.length > 0 ? (
                <ol>
                    {goalScorers.map((player, index) => (
                        <li
                            className="grid grid-cols-[1rem_2rem_1fr_auto] items-center gap-2 border-b border-white/10 py-1.5 last:border-b-0"
                            key={player.id}
                        >
                            <span className="text-xs font-semibold text-amber-400">{index + 1}</span>
                            <SafeImage
                                className="size-8 rounded-full border border-white/10 bg-zinc-800 object-cover"
                                src={player.image}
                                fallbackSrc="/user.png"
                                alt=""
                            />
                            <span className="truncate text-base font-medium text-zinc-100">
                                {player.name}
                            </span>
                            <span className="text-base text-white" aria-label={`${player.goals} goals`}>
                                {player.goals}
                            </span>
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
                    <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Players</h1>
                </div>
                <TeamStats />
                <GoalScorers />
            </div>
        </PageLayout>
    );
};
