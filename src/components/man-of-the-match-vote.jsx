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
}) {
    const [votedPlayerIds, setVotedPlayerIds] = useState([]);
    const [fetchVotedError, setFetchVotedError] = useState("");

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
    const eligibleVoters = useMemo(() => {
        const votedIds = new Set(votedPlayerIds);
        return allPlayers.filter(
            (player) => !player.hidden && !votedIds.has(String(player.id)),
        );
    }, [allPlayers, votedPlayerIds]);

    const initialIndex = 0;
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const [selectedVoter, setSelectedVoter] = useState("");
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isMoving, setIsMoving] = useState(true);
    const [unlockProgress, setUnlockProgress] = useState(0);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        snapTo(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
    };

    const candidate = candidates[selectedIndex];
    const canVote = isUnlocked && !isMoving && !isDragging && !isSubmitting
        && Boolean(selectedVoter) && Boolean(candidate);

    useEffect(() => {
        if (!successfulVote) return undefined;

        const timer = window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("motm-voted", {
                detail: {
                    matchId: String(matchId),
                    voter: successfulVote.voter.name,
                    candidate: successfulVote.candidate.name,
                },
            }));
        }, 2500);

        return () => window.clearTimeout(timer);
    }, [matchId, successfulVote]);

    const submitVote = async () => {
        if (!canVote) return;
        setIsSubmitting(true);
        setVoteError("");

        try {
            if (!APPSCRIPT_URL) {
                throw new Error("VITE_APPSCRIPT_URL is not configured.");
            }

            const voter = allPlayers.find(
                (player) => String(player.id) === String(selectedVoter),
            );
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

            localStorage.setItem(`voted_match_${matchId}`, "true");
            setSuccessfulVote({ voter, candidate });
            setIsSubmitting(false);
        } catch (error) {
            setVoteError(error instanceof Error ? error.message : "Vote could not be saved.");
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

        if (canVote) submitVote();
    };

    const buttonLabel = isSubmitting
        ? "Submitting vote…"
        : isUnlocked
            ? candidate ? `Vote for ${candidate.name}` : "No players available"
            : `Unlocking · ${Math.ceil((1 - unlockProgress) * 5)}s`;

    if (successfulVote) {
        const votedFor = successfulVote.candidate;

        return (
            <section className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-emerald-400/20 bg-zinc-900 px-6 py-10 text-center shadow-2xl shadow-black/40" role="status">
                <span className="flex size-16 items-center justify-center rounded-full bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25">
                    <svg className="size-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 4 4L19 6" />
                    </svg>
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-emerald-400">Vote recorded</p>
                <SafeImage
                    className="mt-6 size-32 rounded-full border-2 border-amber-300 bg-zinc-800 object-cover object-top shadow-xl shadow-amber-500/15"
                    src={votedFor.image}
                    fallbackSrc="/user.png"
                    alt={votedFor.name}
                />
                <h2 className="mt-4 text-2xl font-black text-white">{votedFor.name}</h2>
                <p className="mt-1 text-sm font-semibold text-zinc-400">Player ID #{votedFor.id}</p>
                <p className="mt-6 text-xs text-zinc-500">Opening current votes…</p>
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

                <label className="mt-4 block text-left text-xs font-semibold uppercase tracking-widest text-zinc-400" htmlFor={`voter-${matchId}`}>
                    Who are you?
                </label>
                <div className="relative mt-2">
                    <select
                        ref={voterSelectRef}
                        id={`voter-${matchId}`}
                        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-zinc-950 px-4 pr-10 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:text-zinc-600"
                        value={selectedVoter}
                        onChange={(event) => setSelectedVoter(event.target.value)}
                        disabled={eligibleVoters.length === 0 || isSubmitting}
                    >
                        <option value="">{eligibleVoters.length ? "Select your name" : "Everyone has voted"}</option>
                        {eligibleVoters.map((player) => (
                            <option value={String(player.id)} key={player.id ?? player.name}>{player.name}</option>
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
                        return (
                            <div
                                id={`candidate-${player.id}`}
                                className="flex h-full shrink-0 items-center justify-center px-1.5"
                                style={{ width: `${100 / candidates.length}%` }}
                                role="option"
                                aria-selected={isSelected}
                                key={player.id}
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
                                        <SafeImage
                                            className="size-full rounded-full bg-zinc-800 object-cover object-top"
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

            {/* <div className="flex items-center justify-center gap-2 px-5" aria-hidden="true">
                <span className="h-px w-8 bg-zinc-700" />
                <span className={`size-1.5 rounded-full ${isMoving ? "bg-zinc-600" : "bg-amber-400"}`} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {isMoving ? "Choosing..." : "Locked In"}
                </span>
                <span className="h-px w-8 bg-zinc-700" />
            </div> */}
            <p className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <svg className="size-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M8 9l-3 3 3 3m8-6 3 3-3 3" />
                </svg>
                Drag to choose player
            </p>
            {voteError && <p className="px-5 text-center text-sm text-red-400" role="alert">{voteError}</p>}
            {fetchVotedError && <p className="px-5 text-center text-sm text-red-400" role="alert">{fetchVotedError}</p>}
        </section>
    );
}
