import data from "../../src/data.json" with { type: "json" };
import { createMatchState, getScorer } from "../../src/broadcast/match.js";
import { ApiError } from "./errors.js";

export function createMatchFromFixture(matchId) {
    try {
        return createMatchState(data, matchId);
    } catch (error) {
        throw new ApiError(400, "INVALID_MATCH", error.message);
    }
}

export function resolveGoalscorer(playerId) {
    try {
        const player = getScorer(data, playerId);
        return { playerId: player.id, playerName: player.name, imageUrl: player.image ?? null };
    } catch (error) {
        throw new ApiError(400, "INVALID_PLAYER", error.message);
    }
}
