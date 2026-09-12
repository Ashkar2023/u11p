import { useEffect, useMemo, useState } from "react";
import data from "../data.json";
import { PageLayout } from "../layout";

const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000;
const ADMIN_UNLOCK_STORAGE_KEY = "u11p-payment-admin-unlock-expiry";
const PAYMENT_TRACKER_URL = import.meta.env.VITE_PAYMENT_TRACKER_SHEET_URL;

function getStoredAdminUnlockExpiry() {
    try {
        const expiry = Number(localStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY) || "0");
        return Number.isFinite(expiry) ? expiry : 0;
    } catch {
        return 0;
    }
}

function hasValidAdminUnlockSession() {
    const expiry = getStoredAdminUnlockExpiry();
    return Boolean(expiry) && Date.now() < expiry;
}

function formatMoney(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function normalizePlayerName(value) {
    return String(value ?? "").trim().toLowerCase();
}

async function readJsonResponse(response) {
    const text = await response.text();

    if (!text) {
        return { success: false, reason: "Empty response from sheet." };
    }

    try {
        return JSON.parse(text);
    } catch {
        return { success: false, reason: text || "Invalid response from sheet." };
    }
}

function getUniqueMatchdays() {
    return [...(data.matches ?? [])]
        .filter((match) => match && typeof match.id !== "undefined")
        .sort((a, b) => Number(b.id) - Number(a.id));
}

function getCombinedLineupPlayers(matchdayId) {
    const match = (data.matches ?? []).find((entry) => String(entry.id) === String(matchdayId));
    if (!match || !match.lineup?.length) return [];

    const playerIds = match.lineup.flatMap((entry) => entry?.playerIds ?? []);
    const uniquePlayerIds = [...new Set(playerIds)];

    return uniquePlayerIds
        .map((playerId) => ({
            id: playerId,
            name: data.players?.find((player) => player.id === playerId)?.name ?? `Player ${playerId}`,
        }))
        .filter((player) => player && player.name && player.name !== "Unknown");
}

function PaymentToast({ message, state, onClose }) {
    useEffect(() => {
        if (!message) return undefined;

        const timer = window.setTimeout(() => {
            onClose();
        }, 2200);

        return () => window.clearTimeout(timer);
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-3">
            <div className={`pointer-events-auto w-full max-w-md rounded-xl border px-3 py-2.5 text-xs shadow-2xl ${state === "success" ? "border-emerald-400 bg-emerald-600 text-white" : "border-red-400 bg-red-600 text-white"}`}>
                <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{message}</span>
                    <button type="button" onClick={onClose} className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 hover:text-white">Close</button>
                </div>
            </div>
        </div>
    );
}

export function PaymentTracker() {
    const matches = useMemo(() => getUniqueMatchdays(), []);
    const [selectedMatchdayId, setSelectedMatchdayId] = useState(matches[0]?.id ?? "");
    const [paymentRecords, setPaymentRecords] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [adminPassword, setAdminPassword] = useState("");
    const [adminSessionPassword, setAdminSessionPassword] = useState("");
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => hasValidAdminUnlockSession());
    const [toast, setToast] = useState({ message: "", state: "success" });
    const [modalState, setModalState] = useState({ open: false, editing: false, form: { paid: true, amount_upi: 100, amount_cash: 0 } });
    const [submitState, setSubmitState] = useState({ status: "idle", message: "" });
    const [isLoading, setIsLoading] = useState(false);

    const lineupPlayers = useMemo(() => getCombinedLineupPlayers(selectedMatchdayId), [selectedMatchdayId]);
    const paymentMap = useMemo(() => {
        const map = new Map();
        paymentRecords.forEach((record) => {
            map.set(normalizePlayerName(record.player_name), record);
        });
        return map;
    }, [paymentRecords]);

    const canWrite = Boolean(PAYMENT_TRACKER_URL) && isAdminUnlocked && Boolean(adminSessionPassword);

    useEffect(() => {
        if (!isAdminUnlocked) {
            try {
                localStorage.removeItem(ADMIN_UNLOCK_STORAGE_KEY);
            } catch {
                // ignore storage access issues
            }
            return;
        }

        try {
            localStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, String(Date.now() + ADMIN_SESSION_TTL_MS));
        } catch {
            // ignore storage access issues
        }
    }, [isAdminUnlocked]);

    const loadPayments = async (matchdayId) => {
        if (!PAYMENT_TRACKER_URL || !matchdayId) return;

        setIsLoading(true);

        try {
            const params = new URLSearchParams({ matchday_id: String(matchdayId) });
            const response = await fetch(`${PAYMENT_TRACKER_URL}?${params.toString()}`);
            const result = await readJsonResponse(response);

            if (!result.success) {
                throw new Error(result.reason || "Failed to load payment records.");
            }

            setPaymentRecords(Array.isArray(result.rows) ? result.rows : []);
        } catch (error) {
            console.error(error);
            setPaymentRecords([]);
            setToast({ message: error instanceof Error ? error.message : "Unable to load payment records.", state: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedMatchdayId && matches.length > 0) {
            setSelectedMatchdayId(matches[0].id);
        }
    }, [matches, selectedMatchdayId]);

    useEffect(() => {
        if (!selectedMatchdayId) return;
        loadPayments(selectedMatchdayId);
    }, [selectedMatchdayId, isAdminUnlocked]);

    const derivedRows = useMemo(() => {
        return lineupPlayers
            .map((player) => {
                const record = paymentMap.get(normalizePlayerName(player.name));
                return {
                    player,
                    record,
                    paid: Boolean(record?.paid),
                    amount_upi: Number(record?.amount_upi ?? 0),
                    amount_cash: Number(record?.amount_cash ?? 0),
                };
            })
            .sort((left, right) => Number(right.paid) - Number(left.paid) || left.player.name.localeCompare(right.player.name));
    }, [lineupPlayers, paymentMap]);

    const paidCount = derivedRows.filter((row) => row.paid).length;
    const totalCount = derivedRows.length;
    const totalUpi = derivedRows.reduce((sum, row) => sum + Number(row.record ? row.record.amount_upi || 0 : 0), 0);
    const totalCash = derivedRows.reduce((sum, row) => sum + Number(row.record ? row.record.amount_cash || 0 : 0), 0);

    const unlockAdminAccess = async () => {
        if (!PAYMENT_TRACKER_URL || !adminPassword.trim()) {
            setToast({ message: "Enter the admin password.", state: "error" });
            return;
        }

        try {
            const params = new URLSearchParams({ action: "verify_password", password: adminPassword.trim() });
            const response = await fetch(`${PAYMENT_TRACKER_URL}?${params.toString()}`);
            const result = await readJsonResponse(response);

            if (!result.success || !result.valid) {
                throw new Error(result.reason || "Incorrect password. Read-only access enabled.");
            }

            setIsAdminUnlocked(true);
            setAdminSessionPassword(adminPassword.trim());
            setAdminPassword("");
            setToast({ message: "Admin session unlocked for 1 hour.", state: "success" });
        } catch (error) {
            setIsAdminUnlocked(false);
            setAdminSessionPassword("");
            setAdminPassword("");
            setToast({ message: error instanceof Error ? error.message : "Incorrect password. Read-only access enabled.", state: "error" });
        }
    };

    const openModal = (player, existingRecord = null) => {
        if (!canWrite) {
            setToast({ message: "Admin password required to save changes.", state: "error" });
            return;
        }

        const paid = existingRecord ? Boolean(existingRecord.paid) : true;
        setSelectedPlayer(player);
        setModalState({
            open: true,
            editing: Boolean(existingRecord),
            form: {
                paid,
                amount_upi: paid ? Number(existingRecord?.amount_upi || 100) : 0,
                amount_cash: paid ? Number(existingRecord?.amount_cash || 0) : 0,
            },
        });
    };

    const closeModal = () => {
        setSelectedPlayer(null);
        setModalState({ open: false, editing: false, form: { paid: true, amount_upi: 100, amount_cash: 0 } });
        setSubmitState({ status: "idle", message: "" });
    };

    const lockAdminAccess = () => {
        setIsAdminUnlocked(false);
        setAdminSessionPassword("");
        setToast({ message: "Admin access locked.", state: "success" });
    };

    const handleModalFieldChange = (field, value) => {
        setModalState((current) => {
            if (field === "paid") {
                return {
                    ...current,
                    form: {
                        ...current.form,
                        paid: value,
                        amount_upi: value ? Number(current.form.amount_upi || 0) : 0,
                        amount_cash: value ? Number(current.form.amount_cash || 0) : 0,
                    },
                };
            }

            return {
                ...current,
                form: {
                    ...current.form,
                    [field]: Number(value || 0),
                },
            };
        });
    };

    const handleSwapPaymentMethods = () => {
        setModalState((current) => ({
            ...current,
            form: {
                ...current.form,
                amount_upi: Number(current.form.amount_cash || 0),
                amount_cash: Number(current.form.amount_upi || 0),
            },
        }));
    };

    const handleReset = () => {
        setModalState((current) => ({
            ...current,
            form: { paid: true, amount_upi: 100, amount_cash: 0 },
        }));
    };

    const handleSubmitPayment = async (event) => {
        event.preventDefault();
        if (!selectedMatchdayId || !selectedPlayer || !canWrite || !PAYMENT_TRACKER_URL) {
            return;
        }

        setSubmitState({ status: "loading", message: "Saving payment..." });

        try {
            const payload = {
                matchday_id: Number(selectedMatchdayId),
                player_name: selectedPlayer.name,
                paid: Boolean(modalState.form.paid),
                amount_upi: Number(modalState.form.paid ? (modalState.form.amount_upi || 0) : 0),
                amount_cash: Number(modalState.form.paid ? (modalState.form.amount_cash || 0) : 0),
                password: adminSessionPassword,
            };

            const response = await fetch(PAYMENT_TRACKER_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload),
            });
            const result = await readJsonResponse(response);

            if (!result.success) {
                throw new Error(result.reason || "Payment could not be saved.");
            }

            await loadPayments(selectedMatchdayId);
            const successMessage = `${selectedPlayer.name} payment ${payload.paid ? "marked paid" : "updated"}.`;
            closeModal();
            setToast({ message: successMessage, state: "success" });
        } catch (error) {
            console.error(error);
            setSubmitState({ status: "error", message: error instanceof Error ? error.message : "Payment failed." });
            setToast({ message: error instanceof Error ? error.message : "Payment failed.", state: "error" });
        }
    };

    return (
        <PageLayout>
            <section className="mx-auto w-full max-w-4xl">
                <header className="mb-3">
                    <h1 className="text-xl font-semibold text-amber-400 sm:text-2xl">Payment tracker</h1>
                    <p className="mt-1 text-xs text-zinc-400">Track and balance matchday player payments.</p>
                </header>

                <div className="mb-3 rounded-xl border border-white/10 bg-zinc-900/75 p-3 shadow-lg shadow-black/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <label className="flex-1">
                            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">Matchday</span>
                            <select
                                value={selectedMatchdayId}
                                onChange={(event) => setSelectedMatchdayId(event.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                            >
                                {matches.map((match) => (
                                    <option key={match.id} value={match.id}>Matchday {match.id} • {new Date(match.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</option>
                                ))}
                            </select>
                        </label>

                        <div className="grid grid-cols-3 gap-2 sm:min-w-[240px]">
                            <div className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-center">
                                <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">Paid</div>
                                <div className="mt-1 text-sm font-semibold text-emerald-400">{paidCount}/{totalCount}</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-center">
                                <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">UPI</div>
                                <div className="mt-1 text-[11px] font-semibold text-amber-300">{formatMoney(totalUpi)}</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-center">
                                <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">Cash</div>
                                <div className="mt-1 text-[11px] font-semibold text-cyan-300">{formatMoney(totalCash)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-dashed border-amber-400/30 bg-amber-400/5 p-2.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-400">Access</p>
                                <p className="mt-1 text-xs text-zinc-200">{canWrite ? "Admin write access enabled" : "Read-only access"}</p>
                            </div>

                            {!canWrite ? (
                                <div className="flex w-full max-w-sm items-center gap-2">
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(event) => setAdminPassword(event.target.value)}
                                        placeholder="Admin password"
                                        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={unlockAdminAccess}
                                        className="rounded-lg bg-amber-400 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-950 transition-colors hover:bg-amber-300"
                                    >
                                        Unlock
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={lockAdminAccess}
                                    className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-amber-400/40 hover:text-white"
                                >
                                    Lock
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="mb-3 rounded-lg border border-white/10 bg-zinc-900/75 px-3 py-2 text-xs text-zinc-300">
                        Loading payment records...
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/75">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-zinc-950/70 text-zinc-300">
                                <tr>
                                    <th className="px-2.5 py-2 font-medium">Player</th>
                                    <th className="px-2.5 py-2 font-medium">Status</th>
                                    <th className="px-2.5 py-2 font-medium">UPI</th>
                                    <th className="px-2.5 py-2 font-medium">Cash</th>
                                    <th className="px-2.5 py-2 text-right font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {derivedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-2.5 py-8 text-center text-xs text-zinc-500">
                                            No lineup players available for this matchday.
                                        </td>
                                    </tr>
                                ) : (
                                    derivedRows.map(({ player, record, paid, amount_upi, amount_cash }) => {
                                        const playerData = data.players.find((entry) => entry.id === player.id);
                                        const imageSrc = playerData?.image ?? "/players/user.webp";

                                        return (
                                            <tr key={player.id} className={`border-t border-white/10 ${paid ? "bg-emerald-500/5" : "bg-transparent"}`}>
                                                <td className="pt-1">
                                                    <div className="flex items-center justify-center">
                                                        <img
                                                            src={imageSrc}
                                                            alt={player.name}
                                                            className="h-12 object-contain"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-2.5">
                                                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${paid ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-300"}`}>
                                                        {paid ? "Paid" : "Pending"}
                                                    </span>
                                                </td>
                                                <td className="px-2.5 py-2.5 text-zinc-200">{formatMoney(amount_upi)}</td>
                                                <td className="px-2.5 py-2.5 text-zinc-200">{formatMoney(amount_cash)}</td>
                                                <td className="px-2.5 py-2.5 text-right">
                                                    <button
                                                        type="button"
                                                        disabled={!canWrite}
                                                        onClick={() => openModal(player, record)}
                                                        className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {modalState.open && selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4" onClick={closeModal}>
                    <div
                        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl shadow-black/40"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <img src={data.players.find((player) => player.id === selectedPlayer.id)?.image ?? "/players/user.webp"} alt={selectedPlayer.name} className="h-10 w-10 rounded-full border border-white/10 object-cover bg-zinc-800" />
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Player payment</p>
                                    <h2 className="mt-1 text-lg font-semibold text-zinc-100">{selectedPlayer.name}</h2>
                                </div>
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white">Close</button>
                        </div>

                        <form onSubmit={handleSubmitPayment} className="space-y-4">
                            {!canWrite && (
                                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                    Admin write access is required to save changes.
                                </div>
                            )}

                            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
                                <div className="space-y-2">
                                    <label className="block text-sm text-zinc-300">UPI amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={modalState.form.amount_upi}
                                        onChange={(event) => handleModalFieldChange("amount_upi", event.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSwapPaymentMethods}
                                    aria-label="Swap UPI and cash values"
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 text-lg text-amber-200 shadow-inner shadow-amber-500/10 transition-colors hover:border-amber-300 hover:bg-amber-400/20"
                                >
                                    ⇄
                                </button>

                                <div className="space-y-2">
                                    <label className="block text-sm text-zinc-300">Cash amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={modalState.form.amount_cash}
                                        onChange={(event) => handleModalFieldChange("amount_cash", event.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 shadow-inner shadow-black/20">
                                <span className="text-sm text-zinc-300">Paid</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={modalState.form.paid}
                                    onClick={() => handleModalFieldChange("paid", !modalState.form.paid)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${modalState.form.paid ? "bg-emerald-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" : "bg-zinc-700"}`}
                                >
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${modalState.form.paid ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={handleReset} className="h-11 rounded-xl border border-white/10 bg-zinc-800 px-4 text-sm font-bold text-zinc-200 transition-colors hover:bg-zinc-700">Reset</button>
                                <button type="submit" disabled={submitState.status === "loading" || !canWrite} className="h-11 rounded-xl bg-amber-400 px-5 text-sm font-black text-zinc-950 shadow-xl shadow-amber-500/15 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                                    {submitState.status === "loading" ? "Saving..." : modalState.editing ? "Update" : "Submit"}
                                </button>
                            </div>

                            {submitState.message && (
                                <p className={`text-xs ${submitState.status === "error" ? "text-red-300" : "text-emerald-300"}`}>
                                    {submitState.message}
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            )}

            <PaymentToast message={toast.message} state={toast.state} onClose={() => setToast({ message: "", state: "success" })} />
        </PageLayout>
    );
}
