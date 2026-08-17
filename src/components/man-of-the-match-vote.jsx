import { useEffect, useMemo, useRef, useState } from "react";
import data from "../data.json";
import SafeImage from "./safe-image";

const UNLOCK_DELAY = 5_000;
const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

async function readJsonResponse(response) {
    const res = await response.json();

    if (!response.ok) {
        throw new Error(res?.reason || res?.error || `Request failed with status ${response.status}.`);
    }

    return res;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function resolveLineup(lineup, allPlayers) {
    const fallbackPlayers = allPlayers?.length ? allPlayers : data.players;
    const playersById = new Map(fallbackPlayers.map((player) => [String(player.id), player]));

    if (!lineup?.length) return fallbackPlayers.filter((player) => !player.hidden);

    // Supports the public Player[] prop as well as this project's existing
    // [{ teamId, players: number[] }] match-data shape.
    const entries = lineup.flatMap((entry) => entry?.playerIds ?? [entry]);
    const seen = new Set();

    return entries
        .map((entry) => (typeof entry === "object" ? entry : playersById.get(String(entry))))
        .filter((player) => {
            if (!player || player.hidden) return false;
            const key = String(player.id ?? player.name);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export default function ManOfTheMatchVote({
    matchId,
    lineup,
    allPlayers = data.players,
    onFeedbackShown,
    hasVoted,
    hasRevoted,
    setHasVoted,
    setHasRevoted,
}) {
    const [votedPlayerIds, setVotedPlayerIds] = useState([]);
    const [fetchVotedError, setFetchVotedError] = useState("");
    const [voteDetails, setVoteDetails] = useState(() => {
        if (!matchId) return null;
        try {
            const raw = localStorage.getItem(`match_${matchId}_vote_info`);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const controller = new AbortController();

        async function fetchVotedPlayerIds() {
            setFetchVotedError("");

            try {
                if (!APPSCRIPT_URL) {
                    throw new Error("VITE_APPSCRIPT_URL is not configured.");
                }

                const separator = APPSCRIPT_URL.includes("?") ? "&" : "?";
                const response = await fetch(
                    `${APPSCRIPT_URL}${separator}match_id=${encodeURIComponent(matchId)}`,
                    { signal: controller.signal },
                );
                const data = await readJsonResponse(response);

                if (!data.success) {
                    throw new Error(data.reason || data.error || "Could not load existing votes.");
                }

                if (!Array.isArray(data.votes)) {
                    throw new Error("The voting service returned an invalid response.");
                }

                setVotedPlayerIds(data.votes.map((vote) => String(vote.voterId)));
            } catch (error) {
                if (error.name !== "AbortError") {
                    setFetchVotedError(error instanceof Error ? error.message : "Could not load existing votes.");
                }
            }
        }

        fetchVotedPlayerIds();
        return () => controller.abort();
    }, [matchId]);

    const candidates = useMemo(
        () => resolveLineup(lineup, allPlayers),
        [lineup, allPlayers],
    );
    const voters = useMemo(() => {
        const votedIds = new Set(votedPlayerIds);
        return allPlayers
            .filter((player) => !player.hidden)
            .map((player) => ({
                ...player,
                hasVoted: votedIds.has(String(player.id)),
            }));
    }, [allPlayers, votedPlayerIds]);
    const eligibleVoterCount = voters.filter((player) => !player.hasVoted).length;

    const initialIndex = 0;
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const [selectedVoter, setSelectedVoter] = useState(() => hasVoted ? voteDetails?.voterId ?? "" : "");
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMoving, setIsMoving] = useState(true);
    const [unlockProgress, setUnlockProgress] = useState(0);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [voteError, setVoteError] = useState("");
    const [successfulVote, setSuccessfulVote] = useState(null);

    const viewportRef = useRef(null);
    const voterSelectRef = useRef(null);
    const animationRef = useRef(null);
    const offsetRef = useRef(0);
    const velocityRef = useRef(0);
    const dragRef = useRef({ pointerId: null, x: 0, startX: 0, time: 0 });
    const draggedRef = useRef(false);

    const getStep = () => (viewportRef.current?.clientWidth ?? 0) / 3;
    const targetFor = (index) => (1 - index) * getStep();

    const updateOffset = (nextOffset) => {
        offsetRef.current = nextOffset;
        setOffset(nextOffset);
    };

    const stopAnimation = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    };

    const snapTo = (nextIndex, startingVelocity = 0) => {
        stopAnimation();
        const index = clamp(nextIndex, 0, Math.max(0, candidates.length - 1));
        const target = targetFor(index);
        let position = offsetRef.current;
        let velocity = startingVelocity;
        let lastTime = performance.now();
        setSelectedIndex(index);
        setIsMoving(true);

        const tick = (time) => {
            const frame = clamp((time - lastTime) / 16.67, 0.35, 2);
            lastTime = time;
            velocity += (target - position) * 0.075 * frame;
            velocity *= Math.pow(0.72, frame);
            position += velocity * frame;
            updateOffset(position);

            if (Math.abs(target - position) < 0.35 && Math.abs(velocity) < 0.2) {
                updateOffset(target);
                velocityRef.current = 0;
                animationRef.current = null;
                setIsMoving(false);
                return;
            }
            animationRef.current = requestAnimationFrame(tick);
        };

        animationRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        const startedAt = performance.now();
        let frameId;
        const update = (time) => {
            const progress = clamp((time - startedAt) / UNLOCK_DELAY, 0, 1);
            setUnlockProgress(progress);
            if (progress === 1) {
                setIsUnlocked(true);
                return;
            }
            frameId = requestAnimationFrame(update);
        };
        frameId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        const placeCarousel = () => {
            const safeIndex = clamp(selectedIndex, 0, Math.max(0, candidates.length - 1));
            setSelectedIndex(safeIndex);
            updateOffset(targetFor(safeIndex));
            setIsMoving(false);
        };
        placeCarousel();
        window.addEventListener("resize", placeCarousel);
        return () => {
            window.removeEventListener("resize", placeCarousel);
            stopAnimation();
        };
    }, [candidates.length]);

    const handlePointerDown = (event) => {
        if (candidates.length < 2) return;
        stopAnimation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            startX: event.clientX,
            time: performance.now(),
        };
        draggedRef.current = false;
        velocityRef.current = 0;
        setIsDragging(true);
        setIsMoving(true);
    };

    const handlePointerMove = (event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        const now = performance.now();
        const delta = event.clientX - dragRef.current.x;
        const elapsed = Math.max(1, now - dragRef.current.time);
        const step = getStep();
        const maxOffset = targetFor(0);
        const minOffset = targetFor(candidates.length - 1);
        let nextOffset = offsetRef.current + delta;
        if (Math.abs(event.clientX - dragRef.current.startX) > 5) draggedRef.current = true;

        if (nextOffset > maxOffset) nextOffset = maxOffset + (nextOffset - maxOffset) * 0.2;
        if (nextOffset < minOffset) nextOffset = minOffset + (nextOffset - minOffset) * 0.2;

        velocityRef.current = velocityRef.current * 0.35 + (delta / elapsed) * 16.67 * 0.65;
        dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            startX: dragRef.current.startX,
            time: now,
        };
        updateOffset(nextOffset);
        setSelectedIndex(clamp(Math.round(1 - nextOffset / step), 0, candidates.length - 1));
    };

    const releasePointer = (event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        dragRef.current.pointerId = null;
        setIsDragging(false);
        const step = getStep();
        const projectedOffset = offsetRef.current + velocityRef.current * 7;
        const destination = clamp(
            Math.round(1 - projectedOffset / step),
            0,
            candidates.length - 1,
        );
        snapTo(destination, velocityRef.current);
    };

    const handleKeyDown = (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        let next = selectedIndex + direction;
        // skip the locked candidate
        while (
            next >= 0 && next < candidates.length &&
            voteDetails && hasVoted && !hasRevoted &&
            String(candidates[next]?.id) === String(voteDetails.candidateId)
        ) next += direction;
        snapTo(clamp(next, 0, candidates.length - 1));
    };

    const candidate = candidates[selectedIndex];
    const selectedVoterPlayer = allPlayers.find(
        (player) => String(player.id) === String(selectedVoter),
    );

    const isSameAsLastVote = hasVoted && !hasRevoted
        && voteDetails
        && String(candidate?.id) === String(voteDetails.candidateId);

    const canVote = isUnlocked && !isMoving && !isDragging && !isSubmitting
        && Boolean(selectedVoterPlayer) && Boolean(candidate)
        && !isSameAsLastVote;

    const submitVote = async () => {
        if (!canVote) return;
        const wasAlreadyVoted = hasVoted;

        if (isSameAsLastVote) {
            setVoteError("You cannot vote for the same player again.");
            return;
        }

        setIsSubmitting(true);
        setVoteError("");

        try {
            if (!APPSCRIPT_URL) {
                throw new Error("VITE_APPSCRIPT_URL is not configured.");
            }

            const voter = selectedVoterPlayer;
            if (!voter) {
                throw new Error("Please select a valid voter.");
            }

            const response = await fetch(APPSCRIPT_URL, {
                method: "POST",
                // text/plain keeps the Apps Script request CORS-simple while the
                // body itself remains valid JSON for e.postData.contents.
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    matchId,
                    voterId: voter.id,
                    voterName: voter.name,
                    candidateId: candidate.id,
                    candidateName: candidate.name,
                    isRevote: hasVoted
                }),
            });
            const result = await readJsonResponse(response);

            if (!result.success) {
                if (result.reason === "already_voted") {
                    setVotedPlayerIds((current) => [...new Set([...current, String(voter.id)])]);
                    setSelectedVoter("");
                    throw new Error("This player has already voted in this match.");
                }
                throw new Error(result.reason || result.error || "Vote could not be saved.");
            }

            const _voteDetails = {
                matchId,
                voterId: voter.id,
                voterName: voter.name,
                candidateId: candidate.id,
                candidateName: candidate.name
            };
            localStorage.setItem(`voted_match_${matchId}`, "true");
            localStorage.setItem(`match_${matchId}_vote_info`,
                JSON.stringify(_voteDetails)
            );

            if (hasVoted) {
                localStorage.setItem(`revoted_match_${matchId}`, "true");
            }

            if (wasAlreadyVoted) setHasRevoted(true);
            setVoteDetails(_voteDetails);
            setHasVoted(true);
            setSuccessfulVote({ voter, candidate });
            onFeedbackShown?.();
            setIsConfirmationOpen(false);
            setIsSubmitting(false);
        } catch (error) {
            setVoteError(error instanceof Error ? error.message : "Vote could not be saved.");
            setIsConfirmationOpen(false);
            setIsSubmitting(false);
        }
    };

    const handleVoteButtonClick = () => {
        if (!isUnlocked || isSubmitting) return;

        if (!selectedVoter) {
            voterSelectRef.current?.animate(
                [
                    { transform: "translateX(0)" },
                    { transform: "translateX(-7px)" },
                    { transform: "translateX(7px)" },
                    { transform: "translateX(-5px)" },
                    { transform: "translateX(5px)" },
                    { transform: "translateX(0)" },
                ],
                { duration: 360, easing: "ease-in-out" },
            );
            voterSelectRef.current?.focus();
            return;
        }

        if (canVote) setIsConfirmationOpen(true);
    };

    const goToVotes = () => {
        if (!successfulVote) return;
        window.dispatchEvent(new CustomEvent("motm-voted", {
            detail: {
                matchId: String(matchId),
                voter: successfulVote.voter.name,
                candidate: successfulVote.candidate.name,
            },
        }));
    };

    const buttonLabel = isSubmitting
        ? "Submitting vote…"
        : isUnlocked
            ? candidate ? `${hasVoted ? "Revote" : "Vote"} for ${candidate.name}` : "No players available"
            : `Unlocking · ${Math.ceil((1 - unlockProgress) * 5)}s`;

    if (successfulVote) {
        const votedFor = successfulVote.candidate;

        return (
            <section className="relative flex min-h-96 flex-col items-center justify-center rounded-3xl border border-emerald-400/20 bg-zinc-900 px-6 py-16 text-center shadow-2xl shadow-black/40" role="status">
                <button
                    className="absolute right-4 top-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    type="button"
                    onClick={goToVotes}
                >
                    Go to votes
                </button>
                <span className="flex size-16 items-center justify-center rounded-full bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25">
                    <svg className="size-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 4 4L19 6" />
                    </svg>
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-emerald-400">Vote recorded</p>
                <p className="mt-2 text-sm text-zinc-300">
                    <span className="font-bold text-white">{successfulVote.voter.name}</span> voted for
                </p>
                <SafeImage
                    className="mt-6 size-32 rounded-full border-2 border-amber-300 bg-zinc-800 object-cover object-top shadow-xl shadow-amber-500/15"
                    src={votedFor.image}
                    fallbackSrc="/user.png"
                    alt={votedFor.name}
                />
                <h2 className="mt-4 text-2xl font-black text-white">{votedFor.name}</h2>
                <p className="mt-1 text-sm font-semibold text-zinc-400">Player ID #{votedFor.id}</p>

                {!hasRevoted && (
                    <button
                        className="mt-6 rounded-xl border border-white/10 bg-zinc-800 px-5 py-2.5 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-700"
                        type="button"
                        onClick={() => setSuccessfulVote(null)}
                    >
                        Change vote
                    </button>
                )}
            </section>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-3xl border border-amber-300/15 bg-zinc-900 py-7 shadow-2xl shadow-black/40">
            <div className="px-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-amber-400">Man of the Match</p>
                <h2 className="text-2xl font-black tracking-tight text-white">Choose the game changer</h2>

                <button
                    className={`relative mt-2 flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl border text-sm font-black uppercase tracking-[0.16em] shadow-xl transition-colors ${canVote ? "border-amber-300 bg-amber-400 text-zinc-950 shadow-amber-500/25 active:bg-amber-300" : isUnlocked ? "cursor-not-allowed border-amber-300/40 bg-amber-400/20 text-amber-200 shadow-amber-500/10" : "cursor-not-allowed border-zinc-600 bg-zinc-900 text-zinc-400 shadow-black/40"}`}
                    type="button"
                    aria-disabled={!canVote}
                    onClick={handleVoteButtonClick}
                    aria-describedby="vote-status"
                >
                    {!isUnlocked && (
                        <span
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-600/70"
                            style={{ width: `${unlockProgress * 100}%` }}
                            aria-hidden="true"
                        />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                        {!isUnlocked && (
                            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="5" y="10" width="14" height="11" rx="2" />
                                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                        )}
                        <span>{buttonLabel}</span>
                    </span>
                </button>

                {hasVoted && !hasRevoted && voteDetails && candidate && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
                        <SafeImage
                            className="size-6 shrink-0 rounded-full bg-zinc-800 object-cover object-top"
                            src={allPlayers.find(p => String(p.id) === String(voteDetails.candidateId))?.image}
                            fallbackSrc="/user.png"
                            alt={voteDetails.candidateName}
                        />
                        <span className="truncate font-medium text-zinc-400">{voteDetails.candidateName}</span>
                        <svg className="size-3 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        <SafeImage
                            className="size-6 shrink-0 rounded-full bg-zinc-800 object-cover object-top"
                            src={candidate.image}
                            fallbackSrc="/user.png"
                            alt={candidate.name}
                        />
                        <span className="truncate font-medium text-zinc-400">{candidate.name}</span>
                    </div>
                )}

                <label className="mt-4 block text-left text-xs font-semibold uppercase tracking-widest text-zinc-400" htmlFor={`voter-${matchId}`}>
                    Who are you?
                </label>
                <div className="relative mt-2">
                    <select
                        ref={voterSelectRef}
                        id={`voter-${matchId}`}
                        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-zinc-950 px-4 pr-10 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:text-zinc-600"
                        value={hasVoted ? voteDetails?.voterId : selectedVoter}
                        onChange={(event) => setSelectedVoter(event.target.value)}
                        disabled={hasVoted || !isUnlocked || eligibleVoterCount === 0 || isSubmitting}
                    >
                        <option value="">{eligibleVoterCount ? "Select your name" : "Everyone has voted"}</option>
                        {voters.map((player) => (
                            <option
                                className={player.hasVoted ? "text-zinc-500 line-through" : undefined}
                                disabled={player.hasVoted}
                                value={String(player.id)}
                                key={player.id ?? player.name}
                            >
                                {player.name}{player.hasVoted ? " — Voted" : ""}
                            </option>
                        ))}
                    </select>
                    <svg className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            <div
                ref={viewportRef}
                className={`h-52 w-full overflow-hidden outline-none select-none touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                role="listbox"
                aria-label="Man of the Match candidates"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={releasePointer}
                onPointerCancel={releasePointer}
            >
                <div
                    className="flex h-full will-change-transform"
                    style={{ width: `${candidates.length * 33.333333}%`, transform: `translate3d(${offset}px, 0, 0)` }}
                >
                    {candidates.map((player, index) => {
                        const step = getStep() || 1;
                        const centerDistance = Math.min(1, Math.abs((offset + (index - 1) * step) / step));
                        const scale = 1 - centerDistance * 0.18;
                        const isSelected = index === selectedIndex;
                        const isPreviousVote = hasVoted && !hasRevoted
                            && voteDetails
                            && String(player.id) === String(voteDetails.candidateId);

                        return (
                            <div
                                id={`candidate-${player.id}`}
                                className="flex h-full shrink-0 items-center justify-center px-1.5"
                                style={{ width: `${100 / candidates.length}%` }}
                                role="option"
                                aria-selected={isSelected}
                                key={player.id}
                                onClick={() => !draggedRef.current && snapTo(index)}
                            >
                                <button
                                    className="flex w-full flex-col items-center outline-none"
                                    style={{
                                        opacity: 0.5 + (1 - centerDistance) * 0.5,
                                        transform: `scale(${scale})`,
                                        transition: isDragging ? "none" : "opacity 120ms linear",
                                    }}
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => !draggedRef.current && snapTo(index)}
                                >
                                    <span className={`relative block aspect-square w-full max-w-36 rounded-full overflow-hidden border-2 p-1.5 transition-colors ${isSelected && !isMoving ? "border-amber-300 bg-amber-400/10 shadow-[0_0_32px_rgba(251,191,36,.28)]" : "border-white/10 bg-zinc-800"}`}>
                                        {isPreviousVote && (
                                            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 z-10">
                                                <svg className="size-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="5" y="10" width="14" height="11" rx="2" />
                                                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                                </svg>
                                            </span>
                                        )}
                                        <SafeImage
                                            className="size-full rounded-full object-cover object-top bg-motm"
                                            src={player.image}
                                            fallbackSrc="/user.png"
                                            alt={player.name}
                                            draggable="false"
                                        />
                                    </span>
                                    <span className={`mt-3 w-full truncate text-center font-bold transition-colors ${isSelected ? "text-white" : "text-zinc-500"}`}>
                                        {player.name}
                                    </span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <svg className="size-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M8 9l-3 3 3 3m8-6 3 3-3 3" />
                </svg>
                Drag to choose player
            </p>
            {voteError && <p className="px-5 text-center text-sm text-red-400" role="alert">{voteError}</p>}
            {fetchVotedError && <p className="px-5 text-center text-sm text-red-400" role="alert">{fetchVotedError}</p>}

            {isConfirmationOpen && candidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="presentation">
                    <section
                        className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-5 text-center shadow-2xl shadow-black"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`confirm-vote-${matchId}`}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">Confirm your vote</p>
                        <h3 className="mt-1 text-xl font-black text-white" id={`confirm-vote-${matchId}`}>Are you sure?</h3>
                        <p className="mt-5 text-base text-zinc-300">
                            You are <span className="font-black text-white">“{selectedVoterPlayer?.name}”</span>
                        </p>
                        <div className="mt-5 border-t border-white/10 pt-5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Voting for</p>
                            <SafeImage
                                className="mx-auto mt-3 size-28 rounded-full border-2 border-amber-300 bg-zinc-800 object-cover object-top shadow-lg shadow-amber-500/15"
                                src={candidate.image}
                                fallbackSrc="/user.png"
                                alt={candidate.name}
                            />
                            <p className="mt-3 text-lg font-black text-amber-300">{candidate.name}</p>
                            <p className="mt-1 text-xs font-semibold text-zinc-500">Player ID #{candidate.id}</p>
                        </div>
                        {hasVoted && <p className="mt-5 text-sm text-zinc-400">You are revoting. You cannot change your vote after submitting.</p>}
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                className="h-11 rounded-xl border border-white/10 bg-zinc-800 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setIsConfirmationOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="h-11 rounded-xl bg-amber-400 text-sm font-black text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                                type="button"
                                disabled={isSubmitting}
                                onClick={submitVote}
                            >
                                {isSubmitting ? "Submitting…" : "Yes, submit"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </section>
    );
}
