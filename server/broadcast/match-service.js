import { createHash, randomUUID } from "node:crypto";
import { broadcastService } from "./service.js";
import { getBroadcastDatabase } from "./firebase.js";
import { ApiError } from "./errors.js";
import { ownsLock, withOwnedLock } from "./lock.js";
import { createMatchFromFixture, resolveGoalscorer } from "./static-data.js";
import { getPresentation, lineupRemainingMs } from "../../src/broadcast/match.js";

function currentState(broadcast) {
    const activeMatchId = broadcast?.activeMatchId ?? null;
    return { activeMatchId, match: broadcast?.matches?.[activeMatchId] ?? null, serverNow: Date.now() };
}

function reject(message, code = "INVALID_ACTION", status = 400) {
    throw new ApiError(status, code, message);
}

function scorer(body) {
    if (body.type === "own_goal") return { type: "own_goal", playerId: null, playerName: null, imageUrl: null };
    if (!["normal", "penalty"].includes(body.type)) reject("Choose a player, Penalty or Own Goal.");
    return { type: body.type, ...resolveGoalscorer(body.playerId) };
}

export async function readBroadcastState(req) {
    const session = await broadcastService.requireSession(req);
    const database = getBroadcastDatabase();
    const lock = (await database.ref("admin/lock").get()).val();
    if (!ownsLock(lock, session, Date.now())) reject("Your control has expired. Sign in again.", "LOCK_LOST", 409);
    return currentState((await database.ref("broadcast").get()).val());
}

export async function changeBroadcastMatch(req) {
    const session = await broadcastService.requireSession(req);
    const body = req.body;
    if (typeof body.requestId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId)) reject("The request ID is missing.");
    const signature = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const initial = body.action === "select" ? createMatchFromFixture(body.sourceMatchId) : null;
    const selectedScorer = ["add_goal", "correct_goal"].includes(body.action) ? scorer(body) : null;
    const goalId = randomUUID();
    const eventId = randomUUID();

    const snapshot = await withOwnedLock(getBroadcastDatabase(), session, (state, now) => {
        const receipts = state.admin.requests ??= {};
        for (const [id, record] of Object.entries(receipts)) {
            if (record.expiresAt <= now) delete receipts[id];
        }
        const receiptId = `${session.sessionId}_${body.requestId}`;
        if (receipts[receiptId]) {
            if (receipts[receiptId].signature !== signature) reject("This request ID was already used for another change.");
            return state;
        }
        const broadcast = state.broadcast ??= {};
        if ((broadcast.activeMatchId ?? null) !== body.activeMatchId) reject("The active match changed. Refresh and try again.", "CONFLICT", 409);
        broadcast.matches ??= {};
        const remaining = lineupRemainingMs(broadcast.matches[broadcast.activeMatchId], now);
        if (remaining > 0) reject(`Lineups are playing. Wait ${Math.ceil(remaining / 1000)} seconds before changing the broadcast.`, "LINEUP_PLAYING", 409);
        if (body.action === "select") {
            const id = `match_${initial.sourceMatchId}`;
            broadcast.matches[id] ??= initial;
            broadcast.activeMatchId = id;
        } else {
            const match = broadcast.matches[broadcast.activeMatchId];
            if (!match) reject("Load a match first.");
            if (body.revision !== match.revision) reject("The match changed. Review the latest score and try again.", "CONFLICT", 409);
            const presentation = match.presentation = { ...match.presentation, ...getPresentation(match, now) };
            const goals = match.goals ??= {};
            const liveGoals = () => Object.entries(goals).filter(([, goal]) => !goal.voided);
            function emit(type, id, goal) {
                match.events ??= {};
                match.events[eventId] = { sequence: match.nextEventSequence++, type, goalId: id, goal: { ...goal }, createdAt: now };
            }
            switch (body.action) {
                case "start":
                    if (match.status !== "upcoming") reject("Only an upcoming match can be started.");
                    match.status = "live";
                    presentation.showKickoff = false;
                    presentation.showLineup = false;
                    presentation.showScorebug = true;
                    presentation.showFinalScore = false;
                    break;
                case "full_time":
                    if (match.status !== "live") reject("Only a live match can be ended.");
                    match.status = "full_time";
                    presentation.showKickoff = false;
                    presentation.showLineup = false;
                    presentation.showScorebug = false;
                    presentation.showFinalScore = true;
                    break;
                case "presentation": {
                    const { field, visible } = body;
                    if (!["showKickoff", "showLineup", "showScorebug", "showFinalScore"].includes(field) || typeof visible !== "boolean") reject("Choose a valid graphic toggle.");
                    if (visible && ["showKickoff", "showLineup"].includes(field) && match.status !== "upcoming") reject("This graphic is only available before kick-off.");
                    if (visible && field === "showFinalScore" && match.status !== "full_time") reject("End the match before showing the final score.");
                    if (visible && field === "showScorebug" && match.status !== "live") reject("The scorebug is only available during a live match.");
                    presentation[field] = visible;
                    if (visible && field === "showKickoff") presentation.showLineup = false;
                    if (visible && field === "showLineup") {
                        presentation.showKickoff = false;
                        presentation.lineupStartedAt = now;
                        presentation.lineupRunId = body.requestId;
                    }
                    if (visible && field === "showFinalScore") presentation.showScorebug = false;
                    if (visible && field === "showScorebug") presentation.showFinalScore = false;
                    break;
                }
                case "add_goal":
                    if (!["live", "full_time"].includes(match.status)) reject("Start the match before adding goals.");
                    if (!["home", "away"].includes(body.team)) reject("Choose a valid team.");
                    goals[goalId] = { sequence: match.nextGoalSequence++, team: body.team, ...selectedScorer, createdAt: now, voided: false };
                    if (match.status === "live") emit("goal", goalId, goals[goalId]);
                    break;
                case "void_goal": {
                    if (!["live", "full_time"].includes(match.status)) reject("The match has not started.");
                    if (!["home", "away"].includes(body.team)) reject("Choose a valid team.");
                    const latest = liveGoals().filter(([, goal]) => goal.team === body.team).sort((a, b) => b[1].sequence - a[1].sequence)[0];
                    if (!latest || latest[0] !== body.goalId) reject("The latest goal changed. Review it again.", "CONFLICT", 409);
                    latest[1].voided = true;
                    latest[1].voidedAt = now;
                    if (match.status === "live") emit("goal_disallowed", latest[0], latest[1]);
                    break;
                }
                case "correct_goal": {
                    if (!["live", "full_time"].includes(match.status)) reject("The match has not started.");
                    const goal = goals[body.goalId];
                    if (!goal || goal.voided) reject("This goal is no longer available.", "CONFLICT", 409);
                    goals[body.goalId] = { ...goal, ...selectedScorer, correctedAt: now };
                    break;
                }
                default: reject("Unknown match action.");
            }
            match.score = { home: 0, away: 0 };
            for (const [, goal] of liveGoals()) match.score[goal.team]++;
            match.revision++;
            match.updatedAt = now;
        }
        receipts[receiptId] = { signature, expiresAt: session.exp * 1000 };
        return state;
    });
    return currentState(snapshot.child("broadcast").val());
}
