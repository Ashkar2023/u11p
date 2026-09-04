import { useEffect, useMemo, useState } from "react";
import data from "../data.json";
import SafeImage from "./safe-image";
import user_png from "../assets/user.webp";

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

function groupVotes(votes, allPlayers) {
    const playersById = new Map(
        allPlayers.map((player) => [String(player.id), player]),
    );
    const groupsByCandidate = new Map();

    votes.forEach((vote) => {
        const candidateId = String(vote.candidateId);
        const player = playersById.get(candidateId);
        const existing = groupsByCandidate.get(candidateId) ?? {
            candidateId,
            candidateName: player?.name ?? vote.candidateName ?? `Player ${candidateId}`,
            image: player?.image,
            voters: [],
        };

        existing.voters.push({
            id: vote.voterId,
            name: vote.voterName,
            timestamp: vote.timestamp,
        });
        groupsByCandidate.set(candidateId, existing);
    });

    return [...groupsByCandidate.values()]
        .map((group) => ({
            ...group,
            voters: group.voters.sort((a, b) => (
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )),
        }))
        .sort((a, b) => (
            b.voters.length - a.voters.length
            || a.candidateName.localeCompare(b.candidateName)
        ));
}

export default function MotmVotes({ matchId, allPlayers = data.players, isFinal = false }) {
    const [votes, setVotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function fetchVotes() {
            setIsLoading(true);
            setError("");

            try {
                if (!APPSCRIPT_URL) {
                    throw new Error("VITE_APPSCRIPT_URL is not configured.");
                }

                const separator = APPSCRIPT_URL.includes("?") ? "&" : "?";
                const response = await fetch(
                    `${APPSCRIPT_URL}${separator}match_id=${encodeURIComponent(matchId)}`,
                    { signal: controller.signal },
                );
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.reason || result.error || "Could not load votes.");
                }

                if (!Array.isArray(result.votes)) {
                    throw new Error("The voting service returned an invalid response.");
                }

                setVotes(result.votes);
            } catch (fetchError) {
                if (fetchError.name !== "AbortError") {
                    setError(fetchError instanceof Error ? fetchError.message : "Could not load votes.");
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }

        fetchVotes();
        return () => controller.abort();
    }, [matchId]);

    const groups = useMemo(
        () => groupVotes(votes, allPlayers),
        [allPlayers, votes],
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
                <span className="size-7 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" aria-hidden="true" />
                <p className="text-center text-sm text-zinc-500">Loading current votes…</p>
            </div>
        );
    }

    if (error) {
        return <p className="py-12 text-center text-sm text-red-400" role="alert">{error}</p>;
    }

    if (groups.length === 0) {
        return <p className="py-12 text-center text-sm text-zinc-500">No votes have been recorded yet.</p>;
    }

    return (
        <section aria-label={isFinal ? "Final Man of the Match vote results" : "Current Man of the Match votes"}>
            <header className="mb-4 px-1 flex items-end justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">
                        {isFinal ? "Final ranking" : "Live ranking"}
                    </p>
                    <h2 className="text-xl font-black text-white">
                        {isFinal ? "Vote results" : "Current votes"}
                    </h2>
                </div>
                <p className="text-sm font-semibold text-zinc-400">{votes.length} total</p>
            </header>

            <ol className="space-y-3">
                {groups.map((group) => {
                    const rank = groups.findIndex(
                        (candidate) => candidate.voters.length === group.voters.length,
                    ) + 1;

                    return (
                        <li className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900" key={group.candidateId}>
                            <div className="flex items-center gap-3 px-4 py-4">
                                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${rank === 1 ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}>
                                    {rank}
                                </span>
                                <SafeImage
                                    className="size-14 shrink-0 rounded-full bg-zinc-800 object-cover object-top"
                                    src={group.image}
                                    fallbackSrc={user_png}
                                    alt=""
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate font-bold text-white">{group.candidateName}</h3>
                                    <p className="text-xs text-zinc-500">Player ID #{group.candidateId}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-amber-400">{group.voters.length}</span>
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                                        {group.voters.length === 1 ? "vote" : "votes"}
                                    </p>
                                </div>
                            </div>

                            <ul className="border-t border-white/10 bg-zinc-950/50 px-4 py-3">
                                {group.voters.map((voter, voterIndex) => (
                                    <li className="flex items-center justify-between gap-3 py-1.5 text-sm" key={`${voter.id}-${voterIndex}`}>
                                        <span className="truncate text-zinc-300">{voter.name}</span>
                                        <span className="shrink-0 text-xs text-zinc-600">ID #{voter.id}</span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
