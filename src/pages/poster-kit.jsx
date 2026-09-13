import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import data from "../data.json";
import u11p_logo from "../assets/u11p-logo.webp";
import { PageLayout } from "../layout";
import { hasMatchResult } from "../utils/date.util";

const allPlayers = data.players.filter((player) => !player.hidden);
const playersById = new Map(allPlayers.map((player) => [String(player.id), player]));
const teamMap = new Map(data.teams.map((team) => [team.id, team]));
const FALLBACK_VENUE = "Thavalam turf";
const POSTER_PROMPT_TEMPLATE = `Create a new United XI Pallilamkara matchday poster using the two attached images.

IMAGE 1 is an existing matchday poster. Use it strictly as a visual and design 
reference — preserve its premium football-poster identity, overall visual language, 
cinematic lighting, atmosphere, typography hierarchy, graphic treatment, and branding 
style. Redesign and adapt the composition for this new match. Do not simply recreate 
the previous poster unchanged.

IMAGE 2 is a mapped reference sheet containing the exact visual assets to use in 
this poster. Follow the reference mapping below precisely.

REFERENCE IMAGE MAPPING:
[DYNAMIC REFERENCE MAPPING]

Player 1 represents Paappan FC.
Player 2 represents Cheppu Fighters.

---

POSTER CONTENT — REPRODUCE EXACTLY AS WRITTEN BELOW

Main title: MATCHDAY
Teams: Paappan FC VS Cheppu Fighters
Date: [DYNAMIC DATE]
Time: [DYNAMIC TIME] IST
Venue: [DYNAMIC VENUE]

Include the United XI parent-club logo from the reference sheet.

---

COMPOSITION

Feature the two supplied players as the main subjects. Compose them naturally and 
dramatically within the established style of the existing poster. Adapt the layout, 
poses, and framing as needed to suit the new players — do not force a composition 
that does not fit.

---

CRITICAL — DO NOT ALTER ANY OF THE FOLLOWING

- Player faces and identities: preserve the actual facial features of both players 
  exactly as supplied. Do not generate replacement or idealised faces.
- Jersey designs: preserve supplied jersey designs exactly where jersey references 
  are provided.
- United XI parent-club logo: reproduce accurately from the reference sheet.
- Team names: must appear exactly as "Paappan FC" and "Cheppu Fighters" — no 
  abbreviations, alternate spellings, or invented branding.
- Match details: date, time, and venue must appear exactly as specified above.

The image model may integrate, position, scale, mask, light, shade, and compose 
the supplied assets, but must not redesign, replace, or significantly alter them.

---

DO NOT ADD

- Extra players or people
- Fictional or altered team names
- Fake sponsors or invented logos
- Unnecessary slogans or taglines
- Fabricated or altered match information
- Replacement or AI-generated faces

---

The final poster should feel like a professionally designed football matchday poster — 
strong visual hierarchy, cinematic stadium-style lighting, premium textures, depth, 
contrast, and clean typography — consistent with the existing poster's identity, 
customised for this match, with all supplied assets faithfully preserved.`;

function ToolHeader() {
    return (
        <header className="mb-5">
            <Link href="/tools" className="text-xs text-zinc-500 hover:text-white">Tools</Link>
            <h1 className="mt-1 text-xl font-semibold text-amber-400 sm:text-2xl">Poster Kit</h1>
            <p className="mt-1 text-sm text-zinc-400">Build the next matchday reference sheet and image prompt.</p>
        </header>
    );
}

function CopyIcon() {
    return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="m7.5 20.5 4.5 4.5 4.5-4.5" />
            <path d="M4 20.5h16" />
        </svg>
    );
}

function SelectorArrow() {
    return (
        <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" />
        </svg>
    );
}

function getDefaultVisiblePlayer(teamId) {
    return allPlayers.find((player) => Number(player.teamId) === Number(teamId)) ?? null;
}

function buildReferenceList({ player1Id, player2Id, includeJerseys }) {
    const refs = [];
    const p1 = playersById.get(String(player1Id)) ?? getDefaultVisiblePlayer(1);
    const p2 = playersById.get(String(player2Id)) ?? getDefaultVisiblePlayer(2);

    refs.push({
        number: refs.length + 1,
        label: `Player 1 (${teamMap.get(1)?.name ?? "Paappan FC"})`,
        image: p1?.image ?? "/players/user.webp",
        name: p1?.name ?? "Player 1",
    });

    refs.push({
        number: refs.length + 1,
        label: `Player 2 (${teamMap.get(2)?.name ?? "Cheppu Fighters"})`,
        image: p2?.image ?? "/players/user.webp",
        name: p2?.name ?? "Player 2",
    });

    if (includeJerseys) {
        refs.push({
            number: refs.length + 1,
            label: `${teamMap.get(1)?.name ?? "Paappan FC"} jersey`,
            image: "/jerseys/pfc-v1.png",
            name: `${teamMap.get(1)?.name ?? "Paappan FC"} jersey`,
        });

        refs.push({
            number: refs.length + 1,
            label: `${teamMap.get(2)?.name ?? "Cheppu Fighters"} jersey`,
            image: "/jerseys/cf-v1.png",
            name: `${teamMap.get(2)?.name ?? "Cheppu Fighters"} jersey`,
        });
    }

    refs.push({
        number: refs.length + 1,
        label: "United XI parent-club logo",
        image: u11p_logo,
        name: "United XI parent-club logo",
    });

    return refs;
}

function loadImage(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

function drawContainedImage(ctx, drawImage, x, y, width, height) {
    if (!drawImage) {
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "#374151";
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = "#e4e4e7";
        ctx.font = "600 26px sans-serif";
        ctx.fillText("No image", x + 24, y + height / 2 + 8);
        return;
    }

    const scale = Math.min(width / drawImage.width, height / drawImage.height);
    const drawWidth = drawImage.width * scale;
    const drawHeight = drawImage.height * scale;
    const offsetX = x + (width - drawWidth) / 2;
    const offsetY = y + (height - drawHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(drawImage, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();
}

function drawReferenceGrid(ctx, references) {
    const width = 1600;
    const height = 1200;
    const marginX = 20;
    const marginY = 18;
    const gapX = 12;
    const gapY = 12;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, width, height);

    const playerTopRows = references.slice(0, 2);
    const lowerRows = references.slice(2);

    const topHeight = Math.round(height * 0.6);
    const bottomHeight = height - topHeight;
    const topY = 12;
    const bottomY = topHeight + 12;

    const playerCellWidth = (width - marginX * 2 - gapX) / 2;
    const playerCellHeight = topHeight - marginY * 2;

    const bottomCellCount = lowerRows.length || 1;
    const bottomCellWidth = (width - marginX * 2 - gapX * (bottomCellCount - 1)) / bottomCellCount;
    const bottomCellHeight = bottomHeight - marginY * 2;

    const drawCell = (reference, x, y, w, h, labelSize = 46) => {
        const imagePadding = 18;
        const imageWidth = w - 120;
        const imageHeight = h - 18;
        const imageX = x + 12;
        const imageY = y + 8;

        ctx.fillStyle = "#111827";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#374151";
        ctx.strokeRect(x, y, w, h);

        drawContainedImage(ctx, reference.image, imageX, imageY, imageWidth, imageHeight);

        ctx.fillStyle = "#fbbf24";
        ctx.font = `700 ${labelSize}px sans-serif`;
        ctx.fillText(String(reference.number), x + w - 52, y + 50);
    };

    playerTopRows.forEach((reference, index) => {
        const x = marginX + index * (playerCellWidth + gapX);
        const y = topY + 8;
        drawCell(reference, x, y, playerCellWidth, playerCellHeight, 58);
    });

    lowerRows.forEach((reference, index) => {
        const x = marginX + index * (bottomCellWidth + gapX);
        const y = bottomY + 8;
        drawCell(reference, x, y, bottomCellWidth, bottomCellHeight, 40);
    });
}

function formatDisplayDate(dateValue) {
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        weekday: "short",
        timeZone: "Asia/Kolkata",
    }).format(date);
}

function formatDisplayTime(dateValue) {
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    }).format(date);
}

export function PosterKit() {
    const upcomingMatches = useMemo(() => {
        const now = Date.now();
        return [...data.matches]
            .filter((match) => Number.isFinite(new Date(match.date).getTime()) && !hasMatchResult(match) && new Date(match.date).getTime() > now)
            .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
    }, []);

    const defaultMatch = upcomingMatches[0] ?? data.matches[data.matches.length - 1] ?? data.matches[0];
    const [selectedMatchId, setSelectedMatchId] = useState(defaultMatch?.id ?? null);
    const [includeJerseys, setIncludeJerseys] = useState(true);
    const [player1Id, setPlayer1Id] = useState(String(getDefaultVisiblePlayer(1)?.id ?? ""));
    const [player2Id, setPlayer2Id] = useState(String(getDefaultVisiblePlayer(2)?.id ?? ""));
    const [copyStatus, setCopyStatus] = useState("Copy prompt");
    const [canvasReady, setCanvasReady] = useState(false);
    const canvasRef = useRef(null);

    const selectedMatch = data.matches.find((match) => match.id === selectedMatchId) ?? defaultMatch ?? null;
    const selectedPlayer1 = playersById.get(String(player1Id)) ?? getDefaultVisiblePlayer(1);
    const selectedPlayer2 = playersById.get(String(player2Id)) ?? getDefaultVisiblePlayer(2);

    const availablePlayer1Options = allPlayers.filter((player) => player.id !== Number(player2Id));
    const availablePlayer2Options = allPlayers.filter((player) => player.id !== Number(player1Id));

    const [references, setReferences] = useState(() => buildReferenceList({
        player1Id: Number(player1Id || selectedPlayer1?.id || 0),
        player2Id: Number(player2Id || selectedPlayer2?.id || 0),
        includeJerseys
    }));

    useEffect(() => {
        setReferences(buildReferenceList({
            player1Id: Number(player1Id || selectedPlayer1?.id || 0),
            player2Id: Number(player2Id || selectedPlayer2?.id || 0),
            includeJerseys,
        }));
    }, [player1Id, player2Id, includeJerseys, selectedPlayer1, selectedPlayer2]);

    useEffect(() => {
        const renderCanvas = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext("2d");
            if (!context) return;

            const width = 1600;
            const height = 1200;
            canvas.width = width;
            canvas.height = height;

            const loadedImages = await Promise.all(references.map((reference) => loadImage(reference.image)));
            const mappedRefs = references.map((reference, index) => ({ ...reference, image: loadedImages[index] }));

            drawReferenceGrid(context, mappedRefs);
            setCanvasReady(true);
        };

        renderCanvas();
    }, [references]);

    const matchDate = selectedMatch ? formatDisplayDate(selectedMatch.date) : "Date unavailable";
    const matchTime = selectedMatch ? formatDisplayTime(selectedMatch.date) : "Time unavailable";
    const matchVenue = selectedMatch?.venue || FALLBACK_VENUE;

    const promptText = useMemo(() => {
        const mapping = references.map((reference) => `${reference.number} — ${reference.label}`).join("\n");
        return POSTER_PROMPT_TEMPLATE.replace("[DYNAMIC REFERENCE MAPPING]", mapping)
            .replace("[DYNAMIC DATE]", matchDate)
            .replace("[DYNAMIC TIME]", matchTime)
            .replace("[DYNAMIC VENUE]", matchVenue);
    }, [matchDate, matchTime, matchVenue, references]);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(promptText);
            setCopyStatus("Copied!");
        } catch (error) {
            setCopyStatus("Clipboard blocked");
        }

        window.setTimeout(() => setCopyStatus("Copy prompt"), 1800);
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (canvas.toBlob) {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "poster-kit-reference.png";
                link.click();
                URL.revokeObjectURL(url);
            }, "image/png");
            return;
        }

        const link = document.createElement("a");
        link.download = "poster-kit-reference.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-4xl">
                <ToolHeader />

                <div className="space-y-4">
                    <section className="rounded-2xl border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/20 sm:p-4">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">1. Player selectors</h2>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
                                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Paappan FC</label>
                                <div className="relative">
                                    <select
                                        className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-900 px-3 pr-8 text-sm text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                        value={player1Id}
                                        onChange={(event) => setPlayer1Id(event.target.value)}
                                        aria-label="Select Paappan FC player"
                                    >
                                        <option value="">Select player</option>
                                        {availablePlayer1Options.map((player) => (
                                            <option key={player.id} value={String(player.id)}>{player.name}</option>
                                        ))}
                                    </select>
                                    <SelectorArrow />
                                </div>
                                {selectedPlayer1 && (
                                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/70 p-2">
                                        <img src={selectedPlayer1.image || "/players/user.webp"} alt={selectedPlayer1.name} className="size-9 rounded-md object-cover" />
                                        <div className="min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Selected</div>
                                            <div className="truncate text-sm font-medium text-zinc-100">{selectedPlayer1.name}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
                                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Cheppu Fighters</label>
                                <div className="relative">
                                    <select
                                        className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-900 px-3 pr-8 text-sm text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                        value={player2Id}
                                        onChange={(event) => setPlayer2Id(event.target.value)}
                                        aria-label="Select Cheppu Fighters player"
                                    >
                                        <option value="">Select player</option>
                                        {availablePlayer2Options.map((player) => (
                                            <option key={player.id} value={String(player.id)}>{player.name}</option>
                                        ))}
                                    </select>
                                    <SelectorArrow />
                                </div>
                                {selectedPlayer2 && (
                                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/70 p-2">
                                        <img src={selectedPlayer2.image || "/players/user.webp"} alt={selectedPlayer2.name} className="size-9 rounded-md object-cover" />
                                        <div className="min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Selected</div>
                                            <div className="truncate text-sm font-medium text-zinc-100">{selectedPlayer2.name}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-zinc-900/75 p-3 shadow-2xl shadow-black/20 sm:p-4">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">2. Jersey kit</h2>

                        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
                            <div>
                                <div className="text-sm font-semibold text-zinc-100">Include jerseys</div>
                                <div className="text-[11px] text-zinc-400">Use both shirts in the reference image.</div>
                            </div>
                            <button
                                type="button"
                                aria-pressed={includeJerseys}
                                onClick={() => setIncludeJerseys((current) => !current)}
                                className={`relative h-7 w-14 rounded-full border transition-colors ${includeJerseys ? "border-amber-400 bg-amber-400/35" : "border-zinc-600 bg-zinc-800"}`}
                            >
                                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${includeJerseys ? "left-8" : "left-1"}`} />
                            </button>
                        </div>

                        {includeJerseys && (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {[
                                    { teamId: 1, name: teamMap.get(1)?.name ?? "Paappan FC", src: "/jerseys/pfc-v1.png" },
                                    { teamId: 2, name: teamMap.get(2)?.name ?? "Cheppu Fighters", src: "/jerseys/cf-v1.png" },
                                ].map(({ teamId, name, src }) => (
                                    <div key={teamId} className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
                                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{name}</label>
                                        <div className="flex items-center justify-center rounded-lg border border-white/10 bg-zinc-900 p-3">
                                            <img src={src} alt={`${name} jersey`} className="h-32 w-full object-contain" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-2xl shadow-black/20 sm:p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">3. Match details</h2>
                        {upcomingMatches.length > 1 && (
                            <div className="mt-4">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Upcoming match</label>
                                <div className="relative">
                                    <select
                                        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-zinc-900 px-3 pr-10 text-sm text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                        value={selectedMatchId ?? ""}
                                        onChange={(event) => setSelectedMatchId(Number(event.target.value))}
                                        aria-label="Select upcoming match"
                                    >
                                        {upcomingMatches.map((match) => (
                                            <option key={match.id} value={match.id}>
                                                {formatDisplayDate(match.date)}
                                            </option>
                                        ))}
                                    </select>
                                    <SelectorArrow />
                                </div>
                            </div>
                        )}

                        {selectedMatch ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Selected fixture</div>
                                <div className="mt-2 text-lg font-semibold text-zinc-100">{matchDate}</div>
                                <div className="mt-1 text-sm text-zinc-300">{matchTime} IST</div>
                                <div className="mt-3 text-sm text-zinc-400">Venue: {matchVenue}</div>
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-zinc-500">No upcoming match available.</p>
                        )}
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-2xl shadow-black/20 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">4. Mapped reference image</h2>
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950 shadow-xl shadow-amber-500/15 transition-colors hover:bg-amber-300"
                            >
                                <DownloadIcon />
                                Download PNG
                            </button>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-2">
                            <canvas
                                ref={canvasRef}
                                width={1600}
                                height={1200}
                                className="block h-auto w-full rounded-xl bg-zinc-950"
                                aria-label="Poster reference preview"
                            />
                            {!canvasReady && <div className="py-10 text-center text-sm text-zinc-500">Preparing reference image…</div>}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-2xl shadow-black/20 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">5. Generated prompt</h2>
                            <button
                                type="button"
                                onClick={handleCopyPrompt}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-800"
                            >
                                <CopyIcon />
                                {copyStatus}
                            </button>
                        </div>

                        <textarea
                            readOnly
                            value={promptText}
                            className="mt-4 min-h-52 w-full resize-y rounded-2xl border border-white/10 bg-zinc-950 p-3 text-sm leading-6 text-zinc-100 outline-none"
                            aria-label="Generated image prompt"
                        />
                    </section>
                </div>
            </section>
        </PageLayout>
    );
}
