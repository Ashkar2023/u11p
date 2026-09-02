import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import data from "../data.json";
import lineup_ground_gold from "../assets/lineup-ground-gold.png";
import fifa_shield_white from "../assets/fifa-player-shield-white.png";
import SafeImage from "../components/safe-image";
import user_png from "../assets/user.png"
import { BackIcon } from "../icons";

const POSITION_MAP = [
    [90, 50], // GK
    [64, 20], // DEF
    [68, 50], // DEF
    [64, 80], // DEF
    [44, 50], // MID
    [25, 32], // FWD
    [25, 68], // FWD
];

const POSITION_LABELS = ["GK", "DEF", "DEF", "DEF", "MID", "FWD", "FWD"];

const playersById = new Map(
    data.players.map((player) => [player.id, player])
);

function UltimateTeamPitch({ players }) {
    return players.length > 0 ? (
        <div className="relative w-full select-none aspect-3/4 perspective-midrange mb-12">
            <img
                src={lineup_ground_gold}
                alt="Football pitch"
                className="absolute inset-0 w-full object-contain origin-center rotate-x-[40deg]"
                draggable={false}
            />

            {players.slice(0, 7).map((player, idx) => {
                const [top, left] = POSITION_MAP[idx] ?? [50, 50];

                return (
                    <Link
                        key={player.id}
                        href={`/players/${player.id}`}
                        className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 animate-player-in"
                        style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            animationDelay: `${idx * 100}ms`,
                        }}
                    >
                        <div className="relative w-18 aspect-[2/2.7] sm:w-24 md:w-32">
                            <img
                                src={fifa_shield_white}
                                alt=""
                                className="absolute inset-0 h-full w-full object-contain drop-shadow-md drop-shadow-gray-800"
                                aria-hidden="true"
                            />

                            <div
                                className="absolute overflow-hidden"
                                style={{
                                    top: "5%",
                                    left: "7%",
                                    width: "85%",
                                    height: "72%",
                                }}
                            >
                                <SafeImage
                                    className="h-full w-full object-cover object-top"
                                    src={player?.image}
                                    fallbackSrc={user_png}
                                    alt=""
                                    style={{
                                        maskImage:
                                            "linear-gradient(to bottom, black 70%, transparent 100%)",
                                        WebkitMaskImage:
                                            "linear-gradient(to bottom, black 70%, transparent 100%)",
                                    }}
                                />
                            </div>

                            <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center">
                                <span className="w-full truncate text-center font-ddin text-[clamp(7px,10px,14px)] font-bold uppercase text-[#1A1A1A]">
                                    {player?.name?.split(" ")[0]}
                                </span>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    ) : null;
}

const AWARD_CONFIG = {
    "ultimate-team": { label: "Ultimate Team" },
    "top-scorer": { label: "Golden Boot Winner", showScore: true },
    "best-midfielder": { label: "Best Midfielder" },
    "best-defender": { label: "Best Defender" },
    "golden-glove": { label: "Golden Glove Winner" },
};

export default function AwardDetailsPage() {
    const { year, month, type } = useParams();
    const [, navigate] = useLocation();

    const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const award_key = `${year}-${String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, "0")}`;

    const award = data.awards?.[award_key];
    const awardConfig = AWARD_CONFIG[type];
    const isUltimateTeam = type === "ultimate-team";
    const winner = award?.[type];

    const ultimateTeamPlayers = isUltimateTeam
        ? (award?.["ultimate-team"] ?? [])
            .map((playerId) => playersById.get(playerId))
            .filter(Boolean)
        : [];

    const subtitle = new Date(`${award_key}-01T00:00:00`).toLocaleDateString(
        "en-US",
        {
            month: "long",
            year: "numeric",
        }
    );

    if (!award || !awardConfig || !winner) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] px-4 py-12 text-center text-sm text-zinc-500">
                Award not found.
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#0d0d0d",
                color: "#f1f5f9",
            }}
        >
            <div
                style={{
                    pointerEvents: "none",
                    position: "absolute",
                    inset: "0 0 auto 0",
                    height: 180,
                    background:
                        "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(212,175,55,0.22) 0%, transparent 80%)",
                }}
            />

            <div className="text-center pt-8 pb-2 px-2">
                <h1 className="font-black uppercase text-3xl">
                    {awardConfig.label}
                </h1>
                <p className="uppercase text-yellow-400 font-semibold">
                    {subtitle}
                </p>
                {
                    isUltimateTeam &&
                    <p className="text-xs text-zinc-500">
                        The finest performer's of the month
                    </p>
                }
            </div>

            {
                isUltimateTeam && <UltimateTeamPitch players={ultimateTeamPlayers} />
            }

            {!isUltimateTeam && winner && (
                <div className="flex flex-col items-center px-4 py-10">
                    {(() => {
                        const player = playersById.get(winner.id);

                        if (!player) return null;

                        return (
                            <>
                                <Link
                                    href={`/players/${player.id}`}
                                    aria-label={`View ${player.name}`}
                                    className="block animate-player-in w-full max-w-80"
                                >
                                    <div className="relative w-full aspect-[2/2.7]">
                                        <img
                                            src={fifa_shield_white}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-contain drop-shadow-md drop-shadow-gray-800"
                                            aria-hidden="true"
                                        />

                                        <div
                                            className="absolute overflow-hidden"
                                            style={{
                                                top: "10%",
                                                left: "17%",
                                                width: "66%",
                                                height: "60%",
                                            }}
                                        >
                                            <SafeImage
                                                className="h-full w-full object-cover object-top"
                                                src={player.image}
                                                fallbackSrc={user_png}
                                                alt=""
                                                style={{
                                                    maskImage:
                                                        "linear-gradient(to bottom, black 80%, transparent 100%)",
                                                    WebkitMaskImage:
                                                        "linear-gradient(to bottom, black 80%, transparent 100%)",
                                                }}
                                            />
                                        </div>

                                        <div className="absolute bottom-[15%] left-[17%] right-[17%] text-center font-ddin">
                                            <p className="text-xl font-bold leading-tight text-[#d8a718]">
                                                {player.name.toUpperCase()}
                                            </p>
                                            {awardConfig.showScore && winner.goals != null && (
                                                <p className="text-sm uppercase tracking-[0.2em] text-zinc-700">
                                                    {winner.goals} GOALS
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            </>
                        );
                    })()}
                </div>
            )}
            <div className="flex w-full justify-center grow">
                <button
                    className="flex items-center gap-1 text-sm text-zinc-600 hover:text-white transition-colors"
                    type="button"
                    onClick={() => window.history.back()}
                >
                    <BackIcon /> Back
                </button>
            </div>
        </div>
    );
}