import MatchCard from "../components/match.card";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import Layout from "../layout";
import { Link } from "wouter";

const completedMatches = [...data.matches]
    .filter((match) => !match.isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date));

const recentMatch = data.matches.findLast(match => !match.isUpcoming);
const nextMatch = data.matches.find(match => match.isUpcoming);
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
const currentMonth = getMonthKey(new Date());
const currentMonthMatches = completedMatches.filter(
    (match) => getMonthKey(match.date) === currentMonth,
);

const topScorers = [...currentMonthMatches.reduce((totals, match) => {
    match.goals?.forEach((goal) => {
        if (!goal.ownGoal) {
            totals.set(goal.playerId, (totals.get(goal.playerId) ?? 0) + goal.count);
        }
    });
    return totals;
}, new Map())]
    .map(([playerId, goals]) => ({ ...playersById.get(playerId), goals }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 5);



function NextMatchCard({ match }) {
    const formatted = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    }).format(new Date(match.date));

    return (
        <section className="flex items-center gap-4 rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25 sm:p-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-100 sm:size-16">
                <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
                    <path d="M8 13h3v3H8z" />
                </svg>
            </div>
            <div className="min-w-0">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Next match
                </h2>
                <time className="block text-sm font-semibold text-zinc-100 sm:text-lg" dateTime={match.date}>
                    {formatted}
                </time>
                <p className="text-zinc-500 text-sm">Thavalam turf</p>
            </div>
        </section>
    );
}

function TopScorersPreview() {
    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-1 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                    Top scorers
                </h2>
                <Link
                    className="flex items-center gap-1 font-light text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    href="/stats"
                >
                    <span className="text-sm">View all</span>
                    <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </Link>
            </div>
            <ol>
                {topScorers.map((player, index) => (
                    <li
                        className="grid grid-cols-[1rem_2rem_1fr_auto] items-center gap-2 border-b border-white/10 py-1.5 last:border-b-0"
                        key={player.id}
                    >
                        <span className="text-xs font-semibold text-amber-400">{index + 1}</span>
                        <SafeImage
                            className="size-8 rounded-full border border-white/10 bg-zinc-800 object-cover"
                            src="/user.png"
                            alt=""
                        />
                        <span className="truncate text-base font-medium text-zinc-100">
                            {player.name}
                        </span>
                        <span className="text-base font-normal text-white" aria-label={`${player.goals} goals`}>
                            {player.goals}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export const Home = () => {
    const [homeResult, awayResult] = recentMatch.teams;
    const homeTeam = teamsById.get(homeResult.teamId);
    const awayTeam = teamsById.get(awayResult.teamId);

    return (
        <Layout>
            <div className="mx-auto grid w-full max-w-3xl gap-5">
                {
                    nextMatch && <NextMatchCard match={nextMatch} />
                }
                <Link
                    className="block rounded-lg transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    href={`/matches/${recentMatch.id}`}
                    aria-label="View recent match details"
                >
                    <MatchCard
                        date={recentMatch.date}
                        teamA={homeTeam}
                        teamB={awayTeam}
                        scoreA={homeResult.score}
                        scoreB={awayResult.score}
                        title="Recent Match"
                    />
                </Link>
                <TopScorersPreview />
            </div>
        </Layout>
    );
};
