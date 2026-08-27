import { formatDate } from "../utils/date.util";
import { Link, useLocation } from "wouter";
import SafeImage from "./safe-image";
import MatchdayPoster from "./matchday-poster";
import user_png from "../assets/user.png";

function Team({ team, captainPlayer, away }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <div className="relative w-16 sm:w-20">
                <SafeImage
                    className="w-full object-cover overflow-visible object-top rounded-lg sm:h-24 sm:w-20"
                    src={captainPlayer?.image}
                    fallbackSrc={team.logo}
                    alt={captainPlayer?.name ?? team.name}
                    style={{
                        maskImage:
                            "linear-gradient(to bottom, black 90%, transparent 100%)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, black 90%, transparent 100%)",
                    }}
                />
                {
                    captainPlayer &&
                    <div className={`absolute ${away ? "-left-3" : "-right-3"} -bottom-2 size-10 drop-shadow-sm drop-shadow-zinc-500`}>
                        <SafeImage
                            className="size-full object-contain"
                            src={team.logo}
                            alt={team.name}
                        />
                    </div>
                }
            </div>
            <span className="mt-2 text-sm font-normal text-zinc-100 whitespace-normal break-normal max-w-16">
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

export default function MatchCard({ date, teamA, teamB, scoreA, scoreB, homeCaptain, awayCaptain, title, motm, matchdayCount, hideMatchdayCount, matchHref, posterFilename }) {
    const [, navigate] = useLocation();
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
        <section className="relative rounded-lg border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/25" onClick={() => matchHref && navigate(matchHref)}>
            <div className={matchHref ? "relative z-[1]" : undefined}>
                <div className="mb-2 flex items-center justify-between gap-4">
                    {
                        title &&
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 sm:text-lg">
                            {title}
                        </h2>
                    }
                    {!hideMatchdayCount && <h4 className="text-xs text-zinc-500 sm:text-sm">Match {matchdayCount}</h4>}
                    <time className="flex items-center gap-2 text-xs text-zinc-400 sm:text-sm" dateTime={date}>
                        {formatDate(date)}
                        {posterFilename && <MatchdayPoster filename={posterFilename} />}
                    </time>
                </div>

                <div className="flex items-center justify-between gap-3 sm:gap-8">
                    <Team team={teamA} captainPlayer={homeCaptain} />

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

                    <Team team={teamB} captainPlayer={awayCaptain} away />
                </div>
            </div>

            {motm && (
                <Link
                    className="relative z-10 mt-4 block overflow-hidden rounded-xl border border-amber-300/20 bg-gradient-to-r from-amber-400/10 via-zinc-950 to-zinc-950 transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    {...(motm?.id ? {
                        href: `/players/${motm.id}`,
                        "aria-label": `View ${motm.name} player profile`,
                    } : {})}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="absolute -left-8 -top-12 size-28 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />
                    <span className="absolute -bottom-10 right-2 size-24 rounded-full bg-amber-300/10 blur-2xl" aria-hidden="true" />
                    <div className="relative flex min-h-20 items-center gap-3 px-3 py-2.5 pr-20 sm:min-h-24 sm:px-4 sm:pr-28">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10 shadow-inner shadow-amber-300/10 sm:size-10">
                            <StarIcon />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400 sm:text-[10px]">
                                Man of the Match
                            </p>
                            <p className="mt-1 truncate text-lg font-black leading-none text-white sm:text-xl">
                                {motm.name ?? motm}
                            </p>
                        </div>
                    </div>
                    <SafeImage
                        className="absolute right-3 top-1/2 size-16 -translate-y-1/2 rounded-full border-2 border-amber-300/70 bg-motm object-cover object-top shadow-lg shadow-black/40 sm:right-5 sm:size-20"
                        src={motm.image}
                        fallbackSrc={user_png}
                        alt={motm.name ?? String(motm)}
                    />
                </Link>
            )}
        </section>
    );
}
