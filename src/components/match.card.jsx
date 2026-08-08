import { formatDate } from "../utils/date.util";
import SafeImage from "./safe-image";

function Team({ team }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <SafeImage
                className="size-20 object-contain sm:size-24"
                src={team.logo}
                alt={`${team.name} logo`}
            />
            <span className="text-sm font-normal text-zinc-100 whitespace-normal break-normal max-w-16">
                {team.name}
            </span>
        </div>
    );
}

export default function MatchCard({ date, teamA, teamB, scoreA, scoreB, title }) {
    const scoreColor = (score, opponentScore) => {
        if (score > opponentScore) {
            return "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]";
        }
        if (score < opponentScore) {
            return "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]";
        }
        return "text-zinc-100";
    };

    return (
        <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25">
            <div className="mb-2 flex items-center justify-between gap-4">
                {
                    title && 
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                        {title}
                    </h2>
                }
                <time className="text-xs text-zinc-400 sm:text-sm" dateTime={date}>
                    {formatDate(date)}
                </time>
            </div>

            <div className="flex items-center justify-between gap-3 sm:gap-8">
                <Team team={teamA} />

                <div
                    className="flex shrink-0 items-center gap-6 text-4xl font-bold tracking-tight text-white sm:gap-4 sm:text-6xl"
                    aria-label={`${teamA.name} ${scoreA}, ${teamB.name} ${scoreB}`}
                >
                    <span className={scoreColor(scoreA, scoreB)}>{scoreA}</span>
                    <span className="text-4xl text-zinc-400 font-bold">–</span>
                    <span className={scoreColor(scoreB, scoreA)}>{scoreB}</span>
                </div>

                <Team team={teamB} />
            </div>
        </section>
    );
}
