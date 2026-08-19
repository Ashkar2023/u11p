import data from "../data.json";
import { PageLayout } from "../layout";
import { Link } from "wouter";
import SafeImage from "../components/safe-image";

const visiblePlayers = data.players.filter((player) => !player.hidden);

function PlayerAvatar({ player }) {
    return (
        <SafeImage
            className="h-[70%] w-full shrink-0 bg-motm object-cover object-top"
            src={player.image}
            fallbackSrc="/user.png"
            alt={`${player.name} profile`}
            loading="lazy"
        />
    );
}

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

                <ul className="grid grid-cols-3 gap-x-px">
                    {visiblePlayers.map((player) => (
                        <li key={player.id}>
                            <Link
                                className="flex h-36 flex-col overflow-hidden bg-zinc-950 transition-opacity active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:h-48"
                                href={`/players/${player.id}`}
                                aria-label={`View ${player.name}`}
                            >
                                <PlayerAvatar player={player} />
                                <span className="flex h-[30%] items-center justify-center px-1 text-center text-xs font-medium leading-tight text-zinc-100 sm:px-2 sm:text-sm">
                                    {player.name}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </PageLayout>
    );
};
