import { useLocation, useRoute } from "wouter";
import data from "../data.json";
import SafeImage from "../components/safe-image";

function BackIcon() {
    return (
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

export const PlayerDetails = () => {
    const [, params] = useRoute("/players/:id");
    const [, navigate] = useLocation();
    const player = data.players.find((item) => String(item.id) === params?.id);

    const totalGoals = data.matches.reduce((total, match) => {
        const playerGoals = match.goals
            ?.filter((goal) => goal.playerId === player?.id && !goal.ownGoal)
            .reduce((sum, goal) => sum + goal.count, 0) ?? 0;
        return total + playerGoals;
    }, 0);

    const matchesPlayed = data.matches.filter((match) =>
        !match.isUpcoming && match.lineup?.some((entry) =>
            (entry.players ?? entry.playerIds ?? []).includes(player?.id),
        ),
    ).length;

    const goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate("/players");
        }
    };

    if (!player || player.hidden) {
        return (
            <main className="min-h-dvh bg-zinc-950 px-4 py-6 text-white">
                <div className="mx-auto max-w-3xl">
                    <button className="flex items-center gap-1 text-sm text-zinc-300" type="button" onClick={goBack}>
                        <BackIcon /> Back
                    </button>
                    <p className="mt-10 text-center text-zinc-500">Player not found.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-zinc-950 px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-white">
            <div className="mx-auto w-full max-w-3xl">
                <button
                    className="mb-5 flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-zinc-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
                    type="button"
                    onClick={goBack}
                >
                    <BackIcon />
                    <span>Back</span>
                </button>

                <section>
                    <div className="aspect-5/6 overflow-hidden rounded-lg border border-white/10 bg-zinc-600">
                        <SafeImage
                            className="size-full bg-zinc-600 object-cover object-top"
                            src={player.image}
                            fallbackSrc="/user.png"
                            alt={`${player.name} profile`}
                        />
                    </div>

                    <h1 className="mt-4 text-center text-2xl font-semibold text-white sm:text-3xl">
                        {player.name}
                    </h1>

                    <div className="mt-6 border-y border-white/10 py-4">
                        <dl className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-sm text-zinc-400 sm:text-base">Matches played</dt>
                                <dd className="text-xl font-semibold text-amber-400 sm:text-2xl">
                                    {matchesPlayed}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-sm text-zinc-400 sm:text-base">Goals</dt>
                                <dd className="text-xl font-semibold text-amber-400 sm:text-2xl">
                                    {totalGoals}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </section>
            </div>
        </main>
    );
};
