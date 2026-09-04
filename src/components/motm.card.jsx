import { formatDate } from "../utils/date.util";
import SafeImage from "./safe-image";
import user_png from "../assets/user.webp";

function StarIcon() {
    return (
        <svg className="size-5 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2.75 2.73 5.53 6.1.89-4.42 4.3 1.04 6.08L12 16.68l-5.45 2.87 1.04-6.08-4.42-4.3 6.1-.89L12 2.75Z" />
        </svg>
    );
}

export default function MotmCard({ player, matchDate }) {
    if (!player) return null;

    return (
        <section className="relative overflow-hidden rounded-lg border border-amber-300/20 bg-gradient-to-br from-amber-400/10 via-zinc-900 to-zinc-950 p-4 shadow-2xl shadow-black/25 sm:p-5">
            <div className="absolute -right-12 -top-16 size-40 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
                <div className="relative shrink-0">
                    <span className="absolute -inset-1 rounded-full bg-amber-400/20 blur-md" aria-hidden="true" />
                    <SafeImage
                        className="relative size-20 rounded-full border-2 border-amber-300/70 bg-zinc-800 object-cover object-top sm:size-24"
                        src={player.image}
                        fallbackSrc={user_png}
                        alt={player.name}
                    />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <StarIcon />
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">Man of the Match</p>
                    </div>
                    <h2 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{player.name}</h2>
                    <p className="mt-1 text-xs text-zinc-500">Latest match · {formatDate(matchDate)}</p>
                </div>
            </div>
        </section>
    );
}
