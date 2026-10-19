import data from "../data.json";

const playersById = new Map(data.players.map((player) => [player.id, player]));

const compareGoalsByMatch = (a, b) => {
    const length = Math.max(a.goalsByMatch.length, b.goalsByMatch.length);
    for (let index = 0; index < length; index++) {
        const difference = (b.goalsByMatch[index] ?? 0) - (a.goalsByMatch[index] ?? 0);
        if (difference !== 0) return difference;
    }
    return 0;
};

export function calculateGoalScorers(matches) {
    const appearanceCount = new Map();
    matches.forEach((match) => {
        match.lineup?.flatMap((entry) => entry.playerIds).forEach((playerId) => {
            appearanceCount.set(playerId, (appearanceCount.get(playerId) ?? 0) + 1);
        });
    });

    return [...matches.reduce((totals, match) => {
        match.goals?.forEach((goal) => {
            if (!goal.ownGoal) {
                const existing = totals.get(goal.playerId) ?? { goals: 0, goalsByMatch: [] };
                totals.set(goal.playerId, {
                    goals: existing.goals + goal.count,
                    goalsByMatch: [...existing.goalsByMatch, goal.count].sort((a, b) => b - a),
                });
            }
        });
        return totals;
    }, new Map())]
        .map(([playerId, scorer]) => ({
            ...playersById.get(playerId),
            ...scorer,
            matchesPlayed: appearanceCount.get(playerId) ?? 0,
            GPM: scorer.goals / (appearanceCount.get(playerId) ?? 1),
        }))
        .sort((a, b) =>
            b.goals - a.goals
            || b.GPM - a.GPM
            || compareGoalsByMatch(a, b)
            || a.name?.localeCompare(b.name)
        );
}
