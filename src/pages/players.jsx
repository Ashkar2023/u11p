import data from "../data.json";
import { PageLayout } from "../layout";
import { Link } from "wouter";
import SafeImage from "../components/safe-image";
import user_png from "../assets/user.webp";
import fifa_shield from "../assets/fifa-player-shield.webp";

const visiblePlayers = data.players.filter((player) => !player.hidden);

export const Players = () => {
    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Players</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        {visiblePlayers.length} players
                    </p>
                </div>

                <ul className="grid grid-cols-3 gap-2 sm:gap-3">
                    {visiblePlayers.map((player, idx) => (
                        <li key={player.id}>
                            <Link
                                className="group block animate-player-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                href={`/players/${player.id}`}
                                aria-label={`View ${player.name}`}
                                style={{ animationDelay: `${idx * 30}ms` }}
                            >
                                <div className="relative mx-auto w-full max-w-40 aspect-[2/2.7]">
                                    <img
                                        src={fifa_shield}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-contain"
                                        aria-hidden="true"
                                    />

                                    {/* Player image with bottom fade */}
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
                                            src={player.image}
                                            fallbackSrc={user_png}
                                            alt={`${player.name} profile`}
                                            style={{
                                                maskImage:
                                                    "linear-gradient(to bottom, black 70%, transparent 100%)",
                                                WebkitMaskImage:
                                                    "linear-gradient(to bottom, black 70%, transparent 100%)",
                                            }}
                                        />
                                    </div>

                                    {/* Name */}
                                    <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center">
                                        <span className="w-full truncate text-center font-ddin text-[clamp(11px,3vw,16px)] font-bold uppercase tracking-wide text-[#1A1A1A]">
                                            {player.name.split(" ")[0]}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </PageLayout>
    );
};
