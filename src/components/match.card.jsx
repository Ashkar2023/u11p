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

function StarIcon() {
    return (
        <svg className="size-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2.75 2.73 5.53 6.1.89-4.42 4.3 1.04 6.08L12 16.68l-5.45 2.87 1.04-6.08-4.42-4.3 6.1-.89L12 2.75Z" />
        </svg>
    );
}

export default function MatchCard({ date, teamA, teamB, scoreA, scoreB, title, motm, matchdayCount, hideMatchdayCount }) {
    const hasResult = Number.isFinite(scoreA) && Number.isFinite(scoreB);
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
                {!hideMatchdayCount && <h4 className="text-xs text-zinc-500 sm:text-sm">Match {matchdayCount}</h4>}
                <time className="text-xs text-zinc-400 sm:text-sm" dateTime={date}>
                    {formatDate(date)}
                </time>
            </div>

            <div className="flex items-center justify-between gap-3 sm:gap-8">
                <Team team={teamA} />

                <div
                    className={`flex shrink-0 items-center font-bold tracking-tight text-white ${hasResult ? "gap-6 text-4xl sm:gap-4 sm:text-6xl" : "text-center text-sm sm:text-base"}`}
                    aria-label={hasResult
                        ? `${teamA.name} ${scoreA}, ${teamB.name} ${scoreB}`
                        : "Match result awaiting update"}
                >
                    {hasResult ? (
                        <>
                            <span className={scoreColor(scoreA, scoreB)}>{scoreA}</span>
                            <span className="text-4xl font-bold text-zinc-400">–</span>
                            <span className={scoreColor(scoreB, scoreA)}>{scoreB}</span>
                        </>
                    ) : (
                        <span className="max-w-20 text-zinc-500">Awaiting result</span>
                    )}
                </div>

                <Team team={teamB} />
            </div>

            {motm && (
                <div className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 border-t border-white/10 pt-3 text-xs text-zinc-300 sm:text-sm">
                    <StarIcon />
                    <span><span className="font-semibold text-amber-400">MOTM:</span> {motm.name ?? motm}</span>
                </div>
            )}
        </section>
    );
}
