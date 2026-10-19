import { useCallback, useEffect, useState } from "react";
import { get, onValue, ref } from "firebase/database";
import { getBroadcastDatabase } from "./firebase-client.js";

const eventSequence = (match) => Math.max(0, (match?.nextEventSequence ?? 1) - 1, ...Object.values(match?.events ?? {}).map((event) => event.sequence || 0));

export function useOverlayFeed() {
    const [match, setMatch] = useState(null);
    const [activeMatchId, setActiveMatchId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState("");
    const [queue, setQueue] = useState([]);
    const [serverOffset, setServerOffset] = useState(0);
    const finishEvent = useCallback((id) => setQueue((events) => events.filter((event) => event.id !== id)), []);

    useEffect(() => {
        let stopConnection = () => {};
        let stopActive = () => {};
        let stopMatch = () => {};
        let stopOffset = () => {};
        let generation = 0;
        let disposed = false;

        function disconnect() {
            generation++;
            stopActive();
            stopMatch();
            setQueue([]);
        }

        try {
            const database = getBroadcastDatabase();
            stopOffset = onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => setServerOffset(snapshot.val() ?? 0));
            stopConnection = onValue(ref(database, ".info/connected"), (connection) => {
                if (disposed) return;
                const online = connection.val() === true;
                setConnected(online);
                disconnect();
                if (!online) return;
                setError("");
                stopActive = onValue(ref(database, "broadcast/activeMatchId"), (active) => {
                    stopMatch();
                    const currentGeneration = ++generation;
                    const id = active.val();
                    setActiveMatchId(id);
                    setMatch(null);
                    setQueue([]);
                    if (typeof id !== "string" || !id) return;
                    const matchRef = ref(database, `broadcast/matches/${id}`);
                    let ready = false;
                    let cursor = 0;
                    let latestSequence = 0;
                    const current = () => !disposed && currentGeneration === generation;
                    stopMatch = onValue(matchRef, (snapshot) => {
                        if (!current()) return;
                        const next = snapshot.val();
                        setMatch(next);
                        setError("");
                        latestSequence = eventSequence(next);
                        if (next?.status !== "live") {
                            cursor = Math.max(cursor, latestSequence);
                            setQueue([]);
                            return;
                        }
                        if (!ready) return;
                        const events = Object.entries(next?.events ?? {})
                            .map(([eventId, event]) => ({ ...event, id: eventId }))
                            .filter((event) => event.sequence > cursor)
                            .sort((a, b) => a.sequence - b.sequence);
                        cursor = Math.max(cursor, latestSequence);
                        if (!events.length) return;
                        setQueue((previous) => {
                            let result = [...previous];
                            for (const event of events) {
                                const goal = event.goal ?? next?.goals?.[event.goalId];
                                if (!goal || !["home", "away"].includes(goal.team)) continue;
                                const item = { ...event, goal };
                                if (event.type === "goal" && !next?.goals?.[event.goalId]?.voided) result.push(item);
                                if (event.type === "goal_disallowed") {
                                    const replacesCurrent = result[0]?.type === "goal" && result[0]?.goalId === event.goalId;
                                    result = result.filter((queued) => queued.type !== "goal" || queued.goalId !== event.goalId);
                                    if (replacesCurrent) result.unshift(item);
                                    else result.push(item);
                                }
                            }
                            return result;
                        });
                    }, () => {
                        if (!current()) return;
                        setMatch(null);
                        setQueue([]);
                        setError("Cannot read this match. Check the published Firebase database rules.");
                    });
                    // A fresh server read establishes the baseline; cached/reconnected events never play on air.
                    get(matchRef).then((snapshot) => {
                        if (!current()) return;
                        cursor = Math.max(latestSequence, eventSequence(snapshot.val()));
                        ready = true;
                    }).catch(() => {
                        if (current()) setError("Unable to synchronize the broadcast. Reload after checking the connection.");
                    });
                }, () => setError("Cannot read the active match. Check the published Firebase database rules."));
            });
        } catch (failure) {
            setError(failure.message);
        }
        return () => {
            disposed = true;
            generation++;
            stopConnection();
            stopOffset();
            stopActive();
            stopMatch();
        };
    }, []);

    return { match, activeMatchId, connected, error, event: queue[0] ?? null, finishEvent, serverOffset };
}
