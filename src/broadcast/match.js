import { LINEUP_DURATION_MS, MATCH_STATUS } from "./constants.js";

export function lineupRemainingMs(match, now) {
    if (match?.status !== MATCH_STATUS.UPCOMING || !match.presentation?.showLineup || !Number.isFinite(match.presentation.lineupStartedAt)) return 0;
    return Math.max(0, match.presentation.lineupStartedAt + LINEUP_DURATION_MS - now);
}

export function getPresentation(match, now = Date.now()) {
    const flags = match.presentation ?? {};
    const upcoming = match.status === MATCH_STATUS.UPCOMING;
    const fullTime = match.status === MATCH_STATUS.FULL_TIME;
    const showLineup = upcoming && flags.showLineup === true && lineupRemainingMs(match, now) > 0;
    const showFinalScore = fullTime && flags.showFinalScore === true;
    return {
        showKickoff: upcoming && !showLineup && flags.showKickoff === true,
        showLineup,
        showScorebug: match.status === MATCH_STATUS.LIVE && flags.showScorebug !== false,
        showFinalScore,
    };
}

export function getFixture(data, matchId) {
    if (!Number.isSafeInteger(matchId) || matchId < 1) {
        throw new Error("Choose a valid match.");
    }

    const match = data.matches.find((entry) => entry.id === matchId);
    if (!match) throw new Error("The selected match is not in the website data.");
    if (match.teams?.length !== 2 || match.teams[0].teamId === match.teams[1].teamId) {
        throw new Error("The selected match must have two different teams.");
    }

    for (const result of match.teams) {
        const team = data.teams.find((entry) => entry.id === result.teamId);
        if (!team?.name || !team.shortName) {
            throw new Error("Both match teams need a name and short name.");
        }
    }
    return match;
}

export function getScorer(data, playerId) {
    if (!Number.isSafeInteger(playerId) || playerId < 0) {
        throw new Error("Choose a valid goalscorer.");
    }
    const player = data.players.find((entry) => entry.id === playerId && !entry.hidden);
    if (!player) throw new Error("The selected goalscorer is unavailable.");
    return player;
}

export function getScorerSections(data, matchId, search = "") {
    const match = getFixture(data, matchId);
    const teamIds = new Set(match.teams.map((team) => team.teamId));
    const lineupIds = new Set(
        (match.lineup ?? [])
            .filter((entry) => teamIds.has(entry.teamId))
            .flatMap((entry) => entry.playerIds ?? []),
    );
    const visiblePlayers = data.players.filter((player) => !player.hidden);
    const playersById = new Map(visiblePlayers.map((player) => [player.id, player]));
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = (player) => player.name.toLocaleLowerCase().includes(query);

    return {
        lineup: [...lineupIds].map((id) => playersById.get(id)).filter(Boolean).filter(matchesSearch),
        others: visiblePlayers.filter((player) => !lineupIds.has(player.id)).filter(matchesSearch),
    };
}

export function createMatchState(data, matchId) {
    const match = getFixture(data, matchId);
    const [homeTeam, awayTeam] = match.teams.map(({ teamId }) => {
        const team = data.teams.find((entry) => entry.id === teamId);
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            logoUrl: team.logo ?? null,
        };
    });

    return {
        sourceMatchId: match.id,
        info: { homeTeam, awayTeam },
        status: MATCH_STATUS.UPCOMING,
        score: { home: 0, away: 0 },
        goals: {},
        presentation: { showKickoff: true, showLineup: false, showScorebug: false, showFinalScore: false },
        events: {},
        nextGoalSequence: 1,
        nextEventSequence: 1,
        revision: 0,
    };
}
