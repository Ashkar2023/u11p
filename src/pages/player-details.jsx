import { useLocation, useRoute } from "wouter";
import data from "../data.json";
import SafeImage from "../components/safe-image";
import { hasMatchResult } from "../utils/date.util";
import user_png from "../assets/user.png";

import fifa_shield from "../assets/fifa-player-shield.png";
import { BackIcon } from "../icons";
import { useBrowserLocation } from "wouter/use-browser-location";

const STAT_LABELS = {
    pace: "SPD",
    shooting: "FIN",
    passing: "PAS",
    dribbling: "DRI",
    defending: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
};

const STAT_ORDER_OUTFIELD = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
const STAT_ORDER_GK = ["pace", "shooting", "passing", "dribbling", "defending", "goalkeeping"];

export const PlayerDetails = () => {
    const [, params] = useRoute("/players/:id");
    const [, navigate] = useLocation();
    const player = data.players.find((item) => String(item.id) === params?.id);

    const goBack = () => window.history.back();

    const totalGoals = data.matches.reduce((total, match) => {
        const playerGoals = match.goals
            ?.filter((goal) => goal.playerId === player?.id && !goal.ownGoal)
            .reduce((sum, goal) => sum + goal.count, 0) ?? 0;
        return total + playerGoals;
    }, 0);

    const matchesPlayed = data.matches.filter((match) =>
        hasMatchResult(match) && match.lineup?.some((entry) =>
            (entry.playerIds ?? []).includes(player?.id),
        ),
    ).length;

    const motmWins = data.matches.filter(
        (match) => hasMatchResult(match) && match.motmPlayerId === player?.id,
    ).length;

    if (!player || player.hidden) {
        return (
            <main className="min-h-dvh px-4 py-6 text-white">
                <div className="mx-auto max-w-3xl">
                    <button className="flex items-center gap-1 text-sm text-zinc-300" type="button" onClick={goBack}>
                        <BackIcon /> Back
                    </button>
                    <p className="mt-10 text-center text-zinc-500">Player not found.</p>
                </div>
            </main>
        );
    }

    const attrs = player.attributes;
    const isGK = attrs?.position === "GK";
    const statOrder = isGK ? STAT_ORDER_GK : STAT_ORDER_OUTFIELD;
    const leftStats = statOrder.slice(0, 3);
    const rightStats = statOrder.slice(3, 6);

    const overall = attrs?.overall;
    const position = attrs?.position ?? "";
    const secondaryPosition = attrs?.secondaryPosition ?? null;

    return (
        <main className="min-h-dvh text-white">
            {/* Back button */}
            <div className="absolute top-4 left-4 z-20">
                <button
                    className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
                    type="button"
                    onClick={goBack}
                >
                    <BackIcon /> Back
                </button>
            </div>

            {/* FUT Card Hero — 80vh */}
            <section
                className="relative flex items-center justify-center"
                style={{ height: "70vh", minHeight: 480 }}
            >
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(120deg, transparent 0, transparent 10px, rgba(255,255,255,0.07) 10px, rgba(255,255,255,0.05) 11px)",
                    }}
                />

                {/* Card container */}
                <div
                    className="relative z-10 flex items-center justify-center"
                    style={{ height: "80%", maxHeight: 560 }}
                >
                    {/* The shield image as base */}
                    <div className="relative" style={{ height: "100%", aspectRatio: "2/3" }}>
                        <img
                            src={fifa_shield}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]"
                            aria-hidden="true"
                        />

                        {/* Overlaid content absolutely positioned over shield */}
                        <div className="absolute inset-0 flex flex-col h-full font-ddin text-[#1A1A1A]">

                            {/* Top row: overall + position (top-left), player photo fills upper half */}
                            <div className="relative h-[53%] ">
                                {/* Overall + position top-left */}
                                {overall !== undefined && (
                                    <div className="absolute top-[22%] left-[12%] z-10 flex flex-col items-center leading-none">
                                        <span className="text-6xl">
                                            {overall}
                                        </span>
                                        <span className="font-bold text-3xl tracking-wider leading-none mt-0.5">
                                            {position}
                                        </span>
                                        {
                                            secondaryPosition &&
                                            <span className="font-bold text-sm tracking-wider leading-none mt-0.5">
                                                {secondaryPosition}
                                            </span>
                                        }
                                        {player.teamId && (() => {
                                            const team = data.teams.find(t => t.id === player.teamId);
                                            return team?.logo ? (
                                                <img
                                                    src={team.logo}
                                                    alt={team.name ?? ""}
                                                    className="max-w-14 md:max-w-10 object-contain"
                                                />
                                            ) : null;
                                        })()}
                                    </div>
                                )}

                                {/* Player photo — fills upper portion, object-top */}
                                <div className="absolute bottom-0 top-[15%] right-4 overflow-hidden">
                                    <SafeImage
                                        className="h-[115%] object-cover object-top"
                                        src={player.image}
                                        fallbackSrc={user_png}
                                        alt={`${player.name}`}
                                    />
                                </div>
                            </div>

                            {/* Name + Stats grid */}
                            <div className="flex flex-col px-4 pb-2">
                                {/* Name row */}
                                <div className="text-center mt-2 mb-1">
                                    <h1 className="font-bold uppercase tracking-widest leading-none text-2xl whitespace-nowrap">
                                        {player.name}
                                    </h1>
                                </div>

                                {attrs && (
                                    <div className="flex items-center gap-2 w-2/3 mx-auto border-t border-zinc-500/20 pt-2">
                                        {/* Left col */}
                                        <div className="flex flex-col gap-2 flex-1 pr-4">
                                            {[leftStats[0], leftStats[1], leftStats[2]].map((key) => {
                                                if (!key) return null;
                                                const val = attrs[key];
                                                if (val === undefined) return null;
                                                return (
                                                    <div key={key} className="flex items-baseline justify-center gap-2 text-[22px]">
                                                        <span className="font-bold">{val}</span>
                                                        <span className="font-normal uppercase">{STAT_LABELS[key]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Vertical divider */}
                                        <div className="self-stretch border-l border-zinc-600/20 rounded-full" />

                                        {/* Right col */}
                                        <div className="flex flex-col gap-2 flex-1 pl-4">
                                            {[rightStats[0], rightStats[1], rightStats[2]].map((key) => {
                                                if (!key) return null;
                                                const val = attrs[key];
                                                if (val === undefined) return null;
                                                return (
                                                    <div key={key} className="flex items-baseline justify-center gap-2 text-[22px]">
                                                        <span className="font-bold">{val}</span>
                                                        <span className="font-normal uppercase">{STAT_LABELS[key]}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats section — scrollable below */}
            <section className="px-4 py-8 max-w-lg mx-auto space-y-8">

                {/* Match stats */}
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Season Stats</h2>
                    <dl className="space-y-3">
                        {[
                            { label: "Appearances", value: matchesPlayed },
                            { label: "Goals", value: totalGoals },
                            { label: "MOTM Awards", value: motmWins },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between border-b border-white/5 pb-3">
                                <dt className="text-sm text-zinc-400">{label}</dt>
                                <dd className="text-2xl font-black text-amber-400">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                {/* Top scorer months */}
                {player.topScorerMonths?.length ? (
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Top Scorer Months</h2>
                        <div className="flex flex-wrap gap-2">
                            {player.topScorerMonths.map((month) => (
                                <span
                                    key={month}
                                    className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300 tracking-wide"
                                >
                                    {month}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>
        </main>
    );
};