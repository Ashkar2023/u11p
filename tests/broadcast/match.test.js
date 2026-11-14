import assert from "node:assert/strict";
import test from "node:test";
import data from "../../src/data.json" with { type: "json" };
import { createMatchState, getPresentation, getScorer, getScorerSections } from "../../src/broadcast/match.js";
import { LINEUP_DURATION_MS } from "../../src/broadcast/constants.js";
import { createMatchFromFixture, resolveGoalscorer } from "../../server/broadcast/static-data.js";

test("broadcast initialization does not copy historical scores or change static fixtures", () => {
    const before = structuredClone(data);
    for (const fixture of data.matches) {
        const state = createMatchFromFixture(fixture.id);
        assert.deepEqual(state.score, { home: 0, away: 0 });
        assert.equal(state.status, "upcoming");
        assert.deepEqual(state.presentation, { showKickoff: true, showLineup: false, showScorebug: false, showFinalScore: false });
        assert.equal(state.info.homeTeam.id, fixture.teams[0].teamId);
        assert.equal(state.info.awayTeam.id, fixture.teams[1].teamId);
        assert.equal(state.sourceMatchId, fixture.id);
        assert.deepEqual(state.goals, {});
        assert.deepEqual(state.events, {});
        state.info.homeTeam.name = "Changed broadcast snapshot";
    }
    assert.deepEqual(data, before);
});

test("scorer search keeps both lineup groups, removes duplicates and allows teamless players", () => {
    const fixture = {
        teams: [{ id: 1, name: "Home", shortName: "H" }, { id: 2, name: "Away", shortName: "A" }],
        players: [{ id: 1, name: "Ali" }, { id: 2, name: "Amir" }, { id: 3, name: "Aju" }, { id: 4, name: "Hidden", hidden: true }],
        matches: [{ id: 7, teams: [{ teamId: 2 }, { teamId: 1 }], lineup: [{ teamId: 1, playerIds: [1, 4, 999] }, { teamId: 2, playerIds: [2, 1] }] }],
    };
    const sections = getScorerSections(fixture, 7, "a");
    assert.deepEqual(sections.lineup.map((player) => player.id), [1, 2]);
    assert.deepEqual(sections.others.map((player) => player.id), [3]);
    assert.deepEqual(getScorerSections(fixture, 7, "Aju").lineup, []);
    assert.equal(getScorer(fixture, 3).id, 3);
    assert.equal(createMatchState(fixture, 7).info.homeTeam.id, 2);
    assert.throws(() => getScorer(fixture, 4));
    assert.throws(() => getScorer(fixture, "3"));
    assert.throws(() => getScorer(fixture, 999));
});

test("a fixture without lineups still offers all visible players", () => {
    const fixture = data.matches.find((match) => !match.lineup?.length);
    const sections = getScorerSections(data, fixture.id);
    assert.deepEqual(sections.lineup, []);
    assert.deepEqual(sections.others, data.players.filter((player) => !player.hidden));
});

test("lineup presentation automatically hides when its shared timeline ends", () => {
    const startedAt = 10_000;
    const match = { status: "upcoming", presentation: { showLineup: true, lineupStartedAt: startedAt } };
    assert.equal(getPresentation(match, startedAt + LINEUP_DURATION_MS - 1).showLineup, true);
    assert.equal(getPresentation(match, startedAt + LINEUP_DURATION_MS).showLineup, false);
});

test("the server rejects unknown IDs and resolves player identity from static data", () => {
    for (const id of ["1", -1, null, 1.5, 999999]) {
        assert.throws(() => createMatchFromFixture(id), { status: 400, code: "INVALID_MATCH" });
    }
    const player = data.players.find((entry) => !entry.hidden);
    assert.deepEqual(resolveGoalscorer(player.id), {
        playerId: player.id, playerName: player.name, imageUrl: player.image ?? null,
    });
    assert.throws(() => resolveGoalscorer(0), { status: 400, code: "INVALID_PLAYER" });
});
