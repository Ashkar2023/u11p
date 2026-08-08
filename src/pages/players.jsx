import data from "../data.json";
import { PageLayout } from "../layout";
import { Link } from "wouter";

const visiblePlayers = data.players.filter((player) => !player.hidden);

function PlayerAvatar({ player }) {
    const useFallback = (event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = "/user.png";
    };

    return (
        <img
            className="h-[70%] w-full shrink-0 bg-zinc-800 object-cover"
            src={player.image || "/user.png"}
            alt={`${player.name} profile`}
            onError={useFallback}
        />
    );
}

export const Players = () => {
    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold text-white sm:text-2xl">Players</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        {visiblePlayers.length} players
                    </p>
                </div>

                <ul className="grid grid-cols-3 gap-2 sm:gap-3">
                    {visiblePlayers.map((player) => (
                        <li key={player.id}>
                            <Link
                                className="flex h-36 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:h-48"
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
