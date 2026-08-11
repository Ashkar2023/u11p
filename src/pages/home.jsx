import { useEffect, useState } from "react";
import MatchCard from "../components/match.card";
import SafeImage from "../components/safe-image";
import data from "../data.json";
import Layout from "../layout";
import { Link } from "wouter";
import { formatDate, getMatchVotingStatus, hasMatchResult } from "../utils/date.util";

const completedMatches = [...data.matches]
    .filter(hasMatchResult)
    .sort((a, b) => a.date.localeCompare(b.date));

const recentMatch = completedMatches[completedMatches.length - 1];
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
const currentMonthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    timeZone: "Asia/Kolkata",
}).format(new Date());
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
                    {formatDate(match.date)}
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
                    Top scorers ({currentMonthLabel})
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
                        className="border-b border-white/10 last:border-b-0"
                        key={player.id}
                    >
                        <Link
                            className="grid grid-cols-[1rem_2.5rem_1fr_auto] items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-400"
                            href={`/players/${player.id}`}
                            aria-label={`View ${player.name}`}
                        >
                            <span className="text-xs font-semibold text-amber-400">{index + 1}</span>
                            <SafeImage
                                className="size-10 rounded-full border border-white/10 bg-zinc-600 object-cover object-top"
                                src={player.image}
                                fallbackSrc="/user.png"
                                alt=""
                            />
                            <span className="truncate text-base font-medium text-zinc-100">
                                {player.name}
                            </span>
                            <span className="text-base font-normal text-white" aria-label={`${player.goals} goals`}>
                                {player.goals}
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export const Home = () => {
    const [now, setNow] = useState(() => new Date());
    const votingMatch = [...data.matches]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find((match) => getMatchVotingStatus(match.date, now) === "open");
    const nextMatch = [...data.matches]
        .filter((match) => new Date(match.date) > now)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    const [hasVotedForOpenMatch, setHasVotedForOpenMatch] = useState(false);
    const [homeResult, awayResult] = recentMatch.teams;
    const homeTeam = teamsById.get(homeResult.teamId);
    const awayTeam = teamsById.get(awayResult.teamId);
    const recentMotm = getMatchVotingStatus(recentMatch.date, now) === "closed"
        ? playersById.get(recentMatch.motmPlayerId)
        : null;

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!votingMatch) {
            setHasVotedForOpenMatch(false);
            return undefined;
        }

        const storageKey = `voted_match_${votingMatch.id}`;
        setHasVotedForOpenMatch(localStorage.getItem(storageKey) === "true");

        const handleVote = (event) => {
            if (event.detail?.matchId === String(votingMatch.id)) {
                setHasVotedForOpenMatch(true);
            }
        };
        const handleStorage = (event) => {
            if (event.key === storageKey) {
                setHasVotedForOpenMatch(event.newValue === "true");
            }
        };
        window.addEventListener("motm-voted", handleVote);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("motm-voted", handleVote);
            window.removeEventListener("storage", handleStorage);
        };
    }, [votingMatch?.id]);

    return (
        <Layout>
            <div className="mx-auto grid w-full max-w-3xl gap-5">
                {
                    nextMatch && <NextMatchCard match={nextMatch} />
                }
                {votingMatch && !hasVotedForOpenMatch && (
                    <Link
                        className="group flex min-h-16 items-center justify-between gap-4 rounded-xl border border-amber-300/40 bg-amber-400 px-4 py-3 text-zinc-950 shadow-lg shadow-amber-500/15 transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                        href={`/matches/${votingMatch.id}?tab=vote`}
                        aria-label="Vote for Man of the Match"
                    >
                        <span className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-amber-400">
                                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="m12 2.75 2.73 5.53 6.1.89-4.42 4.3 1.04 6.08L12 16.68l-5.45 2.87 1.04-6.08-4.42-4.3 6.1-.89L12 2.75Z" />
                                </svg>
                            </span>
                            <span>
                                <span className="block text-sm font-black uppercase tracking-wide">Vote for MOTM</span>
                                <span className="block text-xs font-medium text-zinc-800">Voting closes at midnight</span>
                            </span>
                        </span>
                        <svg className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </Link>
                )}
                <MatchCard
                    date={recentMatch.date}
                    teamA={homeTeam}
                    teamB={awayTeam}
                    scoreA={homeResult.score}
                    scoreB={awayResult.score}
                    title="Recent Match"
                    motm={recentMotm}
                    matchdayCount={recentMatch.id}
                    hideMatchdayCount
                    matchHref={`/matches/${recentMatch.id}`}
                />
                <TopScorersPreview />
            </div>
        </Layout>
    );
};
