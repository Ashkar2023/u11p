import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "wouter";
import data from "../data.json";
import SafeImage from "../components/safe-image";
import user_png from "../assets/user.webp";
import lineup_ground_png from "../assets/lineup-ground.webp";
import fifa_shield from "../assets/fifa-player-shield.webp";
import { PageLayout } from "../layout";
import {
    getLineupText,
    getPositionMap,
    copyToClipboard,
    findBestPlayerMatch,
    LINEUP_SIZES,
    normalizePastedName,
    readLineupState,
    writeLineupState,
} from "../utils/lineup-creator.util";
import { BackIcon } from "../icons";

const players = data.players.filter((player) => !player.hidden);
const playersById = new Map(players.map((player) => [player.id, player]));

const imageStyle = {
    maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
    WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
};

function ToolHeader() {
    return (
        <header className="mb-5">
            <Link href="/tools" className="text-xs text-zinc-500 hover:text-white">Tools</Link>
            <h1 className="mt-1 text-xl font-semibold text-amber-400 sm:text-2xl">Lineup creator</h1>
            <p className="mt-1 text-sm text-zinc-400">Build and share both team lineups.</p>
        </header>
    );
}

function ShieldPlayer({ player, selected, onClick, animationDelay = 0 }) {
    return (
        <button
            type="button"
            className={`group block w-full animate-player-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${selected ? "opacity-45" : ""}`}
            style={{ animationDelay: `${animationDelay}ms` }}
            onClick={onClick}
            aria-pressed={selected}
            aria-label={`${selected ? "Remove" : "Add"} ${player.name}`}
        >
            <div className="relative mx-auto aspect-[2/2.7] w-full max-w-40">
                <img src={fifa_shield} alt="" className="absolute inset-0 h-full w-full object-contain" aria-hidden="true" />
                <div className="absolute overflow-hidden" style={{ top: "5%", left: "7%", width: "85%", height: "72%" }}>
                    <SafeImage className="h-full w-full object-cover object-top" src={player.image} fallbackSrc={user_png} alt={`${player.name} profile`} style={imageStyle} />
                </div>
                <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center">
                    <span className="w-full truncate text-center font-ddin text-[clamp(10px,3vw,16px)] font-bold uppercase tracking-wide text-[#1A1A1A]">{player.name.split(" ")[0]}</span>
                </div>
            </div>
            <span className={`mt-1 block truncate text-center text-[11px] ${selected ? "text-zinc-500" : "text-zinc-300"}`}>{selected ? "Selected" : player.name}</span>
        </button>
    );
}

function ClipboardIcon() {
    return <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="4" width="12" height="16" rx="2" /><path d="M16 4V3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" /></svg>;
}

function ShareIcon() {
    return <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6m-7.6 7 7.6 4.6" /></svg>;
}

function CloseIcon() {
    return <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function TrashIcon() {
    return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
}

function ArrowRightIcon() {
    return <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function SelectedPool({ pool, removeFromPool }) {
    return (
        <section className="mb-4 border-y border-white/10 py-3" aria-label="Selected players">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Selected players</h2>
                <span className="text-xs text-zinc-500">{pool.length}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
                {pool.length ? pool.map((playerId) => {
                    const player = playersById.get(playerId);
                    return player ? (
                        <div className="relative w-20 shrink-0" key={player.id}>
                            <button
                                type="button"
                                onClick={() => removeFromPool(player.id)}
                                className="absolute right-0 top-0 z-10 flex size-6 items-center justify-center rounded-full border border-red-400/30 bg-zinc-950/90 text-red-300 shadow-lg transition-colors hover:bg-red-400/20 focus-visible:outline-2 focus-visible:outline-red-400"
                                aria-label={`Remove ${player.name} from pool`}
                                title={`Remove ${player.name}`}
                            >
                                <TrashIcon />
                            </button>
                            <div className="pointer-events-none scale-90">
                                <ShieldPlayer player={player} selected onClick={() => { }} />
                            </div>
                        </div>
                    ) : null;
                }) : <p className="py-4 text-xs text-zinc-500">No players selected yet.</p>}
            </div>
        </section>
    );
}

function PastePlayersModal({ paste, setPaste, addPasted, onClose, message }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
            <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black" role="dialog" aria-modal="true" aria-labelledby="paste-players-title" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">Quick add</p><h2 id="paste-players-title" className="mt-1 text-xl font-black text-white">Paste player names</h2></div>
                    <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close paste dialog"><CloseIcon /></button>
                </div>
                <p className="mt-3 text-sm text-zinc-400">One name per line. Numbered WhatsApp lists are supported.</p>
                <textarea autoFocus className="mt-4 min-h-40 w-full resize-y rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'Ashkar\n1. Sulaiman\n2. Miqu'} />
                <p className="mt-2 min-h-5 text-sm text-zinc-400" aria-live="polite">{message}</p>
                <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-white/10 bg-zinc-800 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-700">Cancel</button><button type="button" onClick={addPasted} className="h-11 rounded-xl bg-amber-400 text-sm font-black text-zinc-950 transition-colors hover:bg-amber-300">Add players</button></div>
            </section>
        </div>
    );
}

function PoolSelection({ pool, search, setSearch, addToPool, removeFromPool, paste, setPaste, addPasted, message, continueToLineup }) {
    const poolSet = new Set(pool);
    const filteredPlayers = players.filter((player) => !poolSet.has(player.id) && player.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-3xl">
                <ToolHeader />
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-zinc-100">Select player pool</h2>
                        <p className="mt-1 text-sm text-zinc-400">Tap players to add or remove them.</p>
                    </div>
                    <button type="button" disabled={!pool.length} onClick={continueToLineup} className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-zinc-950 shadow-xl shadow-amber-500/10 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">Continue <ArrowRightIcon /></button>
                </div>
                {pool.length >= 22 && <p className="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200" role="status">22 players are selected. You can continue or add more.</p>}
                <SelectedPool pool={pool} removeFromPool={removeFromPool} />
                <div className="mb-4 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <input className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 pr-10 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players" aria-label="Search players" />
                        {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white" aria-label="Clear player search"><CloseIcon /></button>}
                    </div>
                    <button type="button" onClick={() => setIsPasteModalOpen(true)} className="h-12 shrink-0 rounded-xl border border-white/10 bg-zinc-800 px-3 text-xs font-bold text-zinc-200 transition-colors hover:bg-zinc-700">Paste names</button>
                </div>
                <ul className="grid grid-cols-4 gap-2 sm:gap-3">
                    {filteredPlayers.map((player, index) => (
                        <li key={player.id}>
                            <ShieldPlayer player={player} selected={poolSet.has(player.id)} onClick={() => poolSet.has(player.id) ? removeFromPool(player.id) : addToPool(player.id)} animationDelay={index * 25} />
                        </li>
                    ))}
                </ul>
                {message && <p className="mt-3 text-sm text-zinc-400" aria-live="polite">{message}</p>}
            </section>
            {isPasteModalOpen && <PastePlayersModal paste={paste} setPaste={setPaste} addPasted={() => { addPasted(); setIsPasteModalOpen(false); }} onClose={() => setIsPasteModalOpen(false)} message={message} />}
        </PageLayout>
    );
}

function PitchPlayer({ player, top, left, delay, selected, onSelect, onRemove, onPointerDragStart, slotTeamIndex, slotIndex }) {
    return (
        <div data-lineup-slot={`${slotTeamIndex}:${slotIndex}`} className={`absolute -translate-x-1/2 -translate-y-1/2 ${selected ? "z-20" : "z-10"}`} style={{ top: `${top}%`, left: `${left}%` }}>
            <button type="button" onPointerDown={(event) => { event.preventDefault(); onPointerDragStart(event, slotTeamIndex, slotIndex, player); }} onClick={onSelect} className={`flex touch-none flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-amber-400 ${selected ? "lineup-player-selected" : ""}`} aria-label={`Select ${player.name} position for replacement`} aria-pressed={selected}>
                <div className="flex flex-col items-center">
                    <div className="relative aspect-[2/2.7] w-16 sm:w-24 md:w-32">
                        <img src={fifa_shield} alt="" className="absolute inset-0 h-full w-full object-contain drop-shadow-md drop-shadow-gray-800" aria-hidden="true" />
                        <div className="absolute overflow-hidden" style={{ top: "5%", left: "7%", width: "85%", height: "72%" }}><SafeImage className="h-full w-full object-cover object-top" src={player.image} fallbackSrc={user_png} alt="" style={imageStyle} /></div>
                        <div className="absolute inset-x-[10%] bottom-[11%] flex justify-center"><span className="w-full truncate text-center font-ddin text-[clamp(7px,10px,14px)] font-bold uppercase text-[#1A1A1A]">{player.name.split(" ")[0]}</span></div>
                    </div>
                </div>
            </button>
            <button type="button" onClick={onRemove} className="absolute right-0 top-0 flex size-6 items-center justify-center rounded-full border border-red-400/30 bg-zinc-950/90 text-red-300 shadow-lg hover:bg-red-400/20 focus-visible:outline-2 focus-visible:outline-red-400" aria-label={`Remove ${player.name} from lineup`} title={`Remove ${player.name}`}><TrashIcon /></button>
        </div>
    );
}

function LineupEditor({ pool, slots, targets, selectedTeamIndex, setSelectedTeamIndex, setTarget, assignToSlot, swapSlots, moveToSlot, removeFromTeam, resetLineups, setStep, copy, message }) {
    const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
    const [selectedSlotTeamIndex, setSelectedSlotTeamIndex] = useState(null);
    const [draggingSlot, setDraggingSlot] = useState(null);
    const [dragPreview, setDragPreview] = useState(null);
    const editorRef = useRef(null);
    const pointerDragRef = useRef(null);
    const suppressClickRef = useRef(false);
    const selectedSlots = slots[selectedTeamIndex];
    const target = targets[selectedTeamIndex];
    const positions = getPositionMap(target);
    const selectedIds = selectedSlots.slice(0, target);
    const extraIds = selectedSlots.slice(target).filter(Boolean);
    const assigned = new Set(slots.flatMap((teamSlots) => teamSlots.filter(Boolean)));
    const availablePlayers = pool.map((id) => playersById.get(id)).filter((player) => player && !assigned.has(player.id));
    const assignedCount = selectedSlots.filter(Boolean).length;

    const clearSelection = () => {
        setSelectedSlotIndex(null);
        setSelectedSlotTeamIndex(null);
    };

    useEffect(() => {
        const handleOutsidePointerDown = (event) => {
            if (!editorRef.current?.contains(event.target) || !event.target.closest("[data-lineup-slot], [data-available-player]")) clearSelection();
        };
        const handlePointerMove = (event) => {
            const drag = pointerDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
            if (distance > 8) {
                drag.isDragging = true;
                event.preventDefault();
                setDragPreview({ player: drag.player, x: event.clientX, y: event.clientY });
            }
            if (drag.isDragging) setDragPreview({ player: drag.player, x: event.clientX, y: event.clientY });
        };
        const handlePointerUp = (event) => {
            const drag = pointerDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            pointerDragRef.current = null;
            setDragPreview(null);
            if (!drag.isDragging) return;

            const target = Array.from(editorRef.current?.querySelectorAll("[data-lineup-slot]") ?? [])
                .find((slot) => {
                    const rect = slot.getBoundingClientRect();
                    return event.clientX >= rect.left && event.clientX <= rect.right
                        && event.clientY >= rect.top && event.clientY <= rect.bottom;
                });
            const targetValue = target?.getAttribute("data-lineup-slot")?.split(":").map(Number);
            if (targetValue?.length === 2 && !targetValue.some(Number.isNaN)) {
                const [toTeam, toSlot] = targetValue;
                if (drag.fromTeam === toTeam && drag.fromSlot !== toSlot) {
                    if (slots[toTeam]?.[toSlot]) swapSlots(drag.fromTeam, drag.fromSlot, toTeam, toSlot);
                    else moveToSlot(drag.fromTeam, drag.fromSlot, toTeam, toSlot);
                }
            }
            clearSelection();
            suppressClickRef.current = true;
            window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [slots, swapSlots, moveToSlot]);

    const beginPointerDrag = (event, teamIndex, slotIndex, player) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pointerDragRef.current = {
            pointerId: event.pointerId,
            fromTeam: teamIndex,
            fromSlot: slotIndex,
            startX: event.clientX,
            startY: event.clientY,
            player,
            isDragging: false,
        };
    };

    const selectTeam = (index) => {
        setSelectedTeamIndex(index);
        clearSelection();
    };

    const selectAvailable = (playerId) => {
        if (selectedSlotIndex === null || selectedSlotTeamIndex === null || selectedSlotIndex >= targets[selectedSlotTeamIndex]) {
            return;
        }
        assignToSlot(playerId, selectedSlotTeamIndex, selectedSlotIndex);
        setSelectedSlotIndex(null);
        setSelectedSlotTeamIndex(null);
    };

    const selectSlot = (index) => {
        if (selectedSlotIndex === null) {
            setSelectedSlotIndex(index);
            setSelectedSlotTeamIndex(selectedTeamIndex);
            return;
        }
        if (selectedSlotIndex === index) {
            setSelectedSlotIndex(null);
            return;
        }
        if (selectedSlotTeamIndex !== selectedTeamIndex) {
            setSelectedSlotIndex(null);
            setSelectedSlotTeamIndex(null);
            return;
        }
        if (slots[selectedSlotTeamIndex][selectedSlotIndex] && selectedSlots[index]) {
            moveToSlot(selectedSlotTeamIndex, selectedSlotIndex, selectedTeamIndex, index);
        } else if (slots[selectedSlotTeamIndex][selectedSlotIndex] && !selectedSlots[index]) {
            moveToSlot(selectedSlotTeamIndex, selectedSlotIndex, selectedTeamIndex, index);
            setSelectedSlotTeamIndex(null);
        }
        setSelectedSlotIndex(null);
    };

    const selectPlayer = (teamIndex, slotIndex) => {
        if (selectedSlotIndex === null) {
            setSelectedTeamIndex(teamIndex);
            setSelectedSlotIndex(slotIndex);
            setSelectedSlotTeamIndex(teamIndex);
            return;
        }
        if (selectedSlotTeamIndex === teamIndex && selectedSlotIndex === slotIndex) {
            setSelectedSlotIndex(null);
            setSelectedSlotTeamIndex(null);
            return;
        }
        if (slots[selectedSlotTeamIndex][selectedSlotIndex] && slots[teamIndex][slotIndex]) {
            swapSlots(selectedSlotTeamIndex, selectedSlotIndex, teamIndex, slotIndex);
            setSelectedSlotIndex(null);
            setSelectedSlotTeamIndex(null);
        }
    };

    const lineupText = {
        lineups: slots.map((teamSlots, index) => ({
            teamId: data.teams[index].id,
            playerIds: teamSlots.filter(Boolean),
        })),
    };

    return (
        <PageLayout>
            <section ref={editorRef} className="mx-auto w-full max-w-3xl">
                <ToolHeader />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => setStep("pool")} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition-colors">
                        <BackIcon />
                        Back to pool selection
                    </button>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => resetLineups()} className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700">Reset</button>
                        <button type="button" onClick={() => copy(getLineupText(lineupText, data.teams), "Lineup copied.")} className="flex size-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 shadow-xl shadow-amber-500/10 transition-colors hover:bg-amber-300" aria-label="Copy lineup" title="Copy lineup"><ClipboardIcon /></button>
                        <button type="button" onClick={() => copy(window.location.href, "Share URL copied.")} className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-zinc-200 transition-colors hover:bg-zinc-700" aria-label="Copy share URL" title="Copy share URL"><ShareIcon /></button>
                    </div>
                </div>
                <div className="flex border-b border-white/10" role="tablist" aria-label="Lineup teams">
                    {data.teams.map((team, index) => <button key={team.id} type="button" role="tab" aria-selected={selectedTeamIndex === index} onClick={() => selectTeam(index)} className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 transition-colors ${selectedTeamIndex === index ? "border-amber-400 text-amber-400" : "border-transparent text-zinc-500"}`}><SafeImage className="size-9 object-contain" src={team.logo} alt="" /><span className="text-sm font-semibold">{team.name}</span></button>)}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-zinc-200">{assignedCount} assigned</h2><label className="flex items-center gap-2 text-xs text-zinc-500">Formation<select className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-zinc-200 outline-none focus:border-amber-400" value={target} onChange={(event) => { setTarget(selectedTeamIndex, Number(event.target.value)); setSelectedSlotIndex(null); setSelectedSlotTeamIndex(null); }} aria-label={`${data.teams[selectedTeamIndex].name} formation size`}>{LINEUP_SIZES.map((size) => <option value={size} key={size}>{size} players</option>)}</select></label></div>
                <div className="relative mt-2 aspect-3/4 w-full select-none"><img src={lineup_ground_png} alt="Football pitch" className="absolute inset-0 h-full w-full object-contain object-center" draggable={false} />{Array.from({ length: target }, (_, index) => { const id = selectedIds[index]; const player = id === null ? null : playersById.get(id); const [top, left] = positions[index] ?? [50, 50]; const isSelected = selectedSlotTeamIndex === selectedTeamIndex && selectedSlotIndex === index; const dropPlayer = (event) => { event.preventDefault(); const value = event.dataTransfer?.getData("text/lineup-slot")?.split(":"); const source = value?.length === 2 ? value.map(Number) : draggingSlot; if (source?.length === 2 && source[0] === selectedTeamIndex && !Number.isNaN(source[0])) moveToSlot(source[0], source[1], selectedTeamIndex, index); setDraggingSlot(null); }; return player ? <PitchPlayer key={id} player={player} top={top} left={left} delay={0} selected={isSelected} onSelect={() => { if (!suppressClickRef.current) selectPlayer(selectedTeamIndex, index); }} onPointerDragStart={beginPointerDrag} slotTeamIndex={selectedTeamIndex} slotIndex={index} onRemove={() => removeFromTeam(index, selectedTeamIndex)} /> : <button data-lineup-slot={`${selectedTeamIndex}:${index}`} type="button" key={`empty-${index}`} onClick={() => { if (!suppressClickRef.current) selectSlot(index); }} onPointerUp={dropPlayer} onDragOver={(event) => event.preventDefault()} onDrop={dropPlayer} className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed bg-zinc-950/30 text-xl font-semibold text-white/70 focus-visible:outline-2 focus-visible:outline-amber-400 ${isSelected ? "lineup-slot-selected text-amber-300" : "border-white/40"}`} style={{ top: `${top}%`, left: `${left}%` }} aria-label={`Select empty position ${index + 1}`} aria-pressed={isSelected}>?</button>; })}</div>
                {dragPreview && <div className="pointer-events-none fixed z-60 w-24 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]" style={{ left: dragPreview.x, top: dragPreview.y }}><div className="relative aspect-[2/2.7] w-full"><img src={fifa_shield} alt="" className="absolute inset-0 h-full w-full object-contain" /><div className="absolute overflow-hidden" style={{ top: "5%", left: "7%", width: "85%", height: "72%" }}><SafeImage className="h-full w-full object-cover object-top" src={dragPreview.player.image} fallbackSrc={user_png} alt="" style={imageStyle} /></div><div className="absolute inset-x-[10%] bottom-[11%] flex justify-center"><span className="w-full truncate text-center font-ddin text-[10px] font-bold uppercase text-[#1A1A1A]">{dragPreview.player.name.split(" ")[0]}</span></div></div></div>}
                {extraIds.length > 0 && <p className="border-t border-white/10 py-2 text-xs text-zinc-500">Extra: {extraIds.map((id) => playersById.get(id)?.name).filter(Boolean).join(", ")}</p>}
                <div className="mt-3 border-t border-white/10 pt-3"><p className="mb-2 text-xs font-semibold text-zinc-400">Available players</p><div className="flex gap-3 overflow-x-auto pb-2">{availablePlayers.length ? availablePlayers.map((player) => <div data-available-player="true" className="w-20 shrink-0" key={player.id}><ShieldPlayer player={player} onClick={() => selectAvailable(player.id)} /></div>) : <span className="text-xs text-zinc-500">No available players.</span>}</div></div>
                <p className="mt-3 min-h-5 text-sm text-zinc-400" aria-live="polite">{message}</p>
            </section>
        </PageLayout>
    );
}

export function LineupCreator() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initial = useMemo(() => readLineupState(searchParams, players, data.teams), []);
    const [step, setStep] = useState(initial.step);
    const [pool, setPool] = useState(initial.pool);
    const [targets, setTargets] = useState(initial.targets);
    const [slots, setSlots] = useState(initial.slots);
    const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
    const [search, setSearch] = useState("");
    const [paste, setPaste] = useState("");
    const [message, setMessage] = useState("");

    const lineups = useMemo(() => slots.map((teamSlots, index) => ({ teamId: data.teams[index].id, playerIds: teamSlots.filter(Boolean) })), [slots]);
    useEffect(() => {
        const params = writeLineupState({ step, pool, targets, slots, lineups });
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
    }, [step, pool, targets, slots, lineups]);
    const assigned = useMemo(() => new Set(slots.flatMap((teamSlots) => teamSlots.filter(Boolean))), [slots]);
    const addToPool = (id) => setPool((current) => current.includes(id) || assigned.has(id) ? current : [...current, id]);
    const removeFromPool = (id) => setPool((current) => current.filter((playerId) => playerId !== id));
    const assignToSlot = (id, teamIndex, slotIndex) => {
        if (assigned.has(id) || slotIndex === null) return;
        const replacedId = slots[teamIndex][slotIndex];
        setSlots((current) => current.map((teamSlots, index) => index === teamIndex ? teamSlots.map((playerId, positionIndex) => positionIndex === slotIndex ? id : playerId) : teamSlots));
        setPool((current) => {
            const withoutPlayer = current.filter((playerId) => playerId !== id);
            return replacedId && !withoutPlayer.includes(replacedId) ? [...withoutPlayer, replacedId] : withoutPlayer;
        });
    };
    const removeFromTeam = (slotIndex, teamIndex) => {
        const removedId = slots[teamIndex][slotIndex];
        if (!removedId) return;
        setSlots((current) => current.map((teamSlots, index) => index === teamIndex ? teamSlots.map((playerId, positionIndex) => positionIndex === slotIndex ? null : playerId) : teamSlots));
        setPool((current) => current.includes(removedId) ? current : [...current, removedId]);
    };
    const swapSlots = (fromTeam, fromSlot, toTeam, toSlot) => {
        setSlots((current) => current.map((teamSlots, teamIndex) => teamSlots.map((playerId, slotIndex) => {
            if (teamIndex === fromTeam && slotIndex === fromSlot) return current[toTeam][toSlot];
            if (teamIndex === toTeam && slotIndex === toSlot) return current[fromTeam][fromSlot];
            return playerId;
        })));
    };
    const moveToSlot = (fromTeam, fromSlot, toTeam, toSlot) => {
        const movingId = slots[fromTeam][fromSlot];
        if (!movingId || slots[toTeam][toSlot]) return;
        setSlots((current) => current.map((teamSlots, teamIndex) => teamSlots.map((playerId, slotIndex) => {
            if (teamIndex === fromTeam && slotIndex === fromSlot) return null;
            if (teamIndex === toTeam && slotIndex === toSlot) return movingId;
            return playerId;
        })));
    };
    const resetLineups = () => {
        const assignedPlayers = slots.flatMap((teamSlots) => teamSlots.filter(Boolean));
        setSlots([Array(11).fill(null), Array(11).fill(null)]);
        setPool((current) => [...current, ...assignedPlayers.filter((id) => !current.includes(id))]);
        setMessage("Lineups reset. The player pool was kept.");
    };
    const addPasted = () => { const names = paste.split("\n").map(normalizePastedName).filter(Boolean); const added = []; const missing = []; names.forEach((name) => { const player = findBestPlayerMatch(name, players); if (!player) missing.push(name); else if (!pool.includes(player.id) && !assigned.has(player.id) && !added.includes(player.id)) added.push(player.id); }); if (added.length) setPool((current) => [...current, ...added]); setMessage(`${added.length ? `Added ${added.length} player${added.length === 1 ? "" : "s"}. ` : "No new players added. "}${missing.length ? `Not found or ambiguous: ${missing.join(", ")}.` : ""}`); setPaste(""); };
    const copy = async (value, success) => { setMessage(await copyToClipboard(value) ? success : "Clipboard access is unavailable in this browser."); };

    if (step === "pool") return <PoolSelection pool={pool} search={search} setSearch={setSearch} addToPool={addToPool} removeFromPool={removeFromPool} paste={paste} setPaste={setPaste} addPasted={addPasted} message={message} clearPool={() => setPool([])} continueToLineup={() => setStep("lineup")} />;
    return <LineupEditor pool={pool} slots={slots} targets={targets} selectedTeamIndex={selectedTeamIndex} setSelectedTeamIndex={setSelectedTeamIndex} setTarget={(index, value) => setTargets((current) => current.map((target, targetIndex) => targetIndex === index ? value : target))} assignToSlot={assignToSlot} swapSlots={swapSlots} moveToSlot={moveToSlot} removeFromTeam={removeFromTeam} resetLineups={resetLineups} setStep={setStep} copy={copy} message={message} />;
}
