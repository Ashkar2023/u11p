export const LINEUP_SIZES = [11, 10, 9, 8, 7];
export const LINEUP_STEPS = ["pool", "lineup"];

function parseIds(value) {
    if (!value) return [];

    return value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((id) => Number.isInteger(id));
}

function parseSlots(value, visibleIds) {
    if (!value) return null;

    return value
        .split(",")
        .slice(0, 11)
        .map((entry) => {
            const id = Number(entry.trim());
            return Number.isInteger(id) && visibleIds.has(id) ? id : null;
        });
}

function uniqueVisibleIds(ids, visibleIds, usedIds = new Set()) {
    const result = [];

    ids.forEach((id) => {
        if (!visibleIds.has(id) || usedIds.has(id)) return;
        usedIds.add(id);
        result.push(id);
    });

    return result;
}

export function readLineupState(searchParams, players, teams) {
    const visibleIds = new Set(players.filter((player) => !player.hidden).map((player) => player.id));
    const usedIds = new Set();
    const requestedTarget1 = Number(searchParams.get("target1"));
    const requestedTarget2 = Number(searchParams.get("target2"));
    const target1 = LINEUP_SIZES.includes(requestedTarget1) ? requestedTarget1 : 11;
    const target2 = LINEUP_SIZES.includes(requestedTarget2) ? requestedTarget2 : 11;
    const parsedSlots1 = parseSlots(searchParams.get("slots1"), visibleIds);
    const parsedSlots2 = parseSlots(searchParams.get("slots2"), visibleIds);
    const team1 = uniqueVisibleIds(parsedSlots1 ?? parseIds(searchParams.get("team1")), visibleIds, usedIds);
    const team2 = uniqueVisibleIds(parsedSlots2 ?? parseIds(searchParams.get("team2")), visibleIds, usedIds);
    const slots1 = parsedSlots1 ?? [...team1, ...Array(11 - team1.length).fill(null)];
    const slots2 = parsedSlots2 ?? [...team2, ...Array(11 - team2.length).fill(null)];
    const assignedIds = new Set([...team1, ...team2]);
    const pool = uniqueVisibleIds(parseIds(searchParams.get("pool")), visibleIds, assignedIds);
    const requestedStep = searchParams.get("step");
    const step = LINEUP_STEPS.includes(requestedStep) ? requestedStep : "pool";

    return {
        step,
        pool,
        targets: [target1, target2],
        slots: [slots1, slots2],
        lineups: [
            { teamId: teams[0].id, playerIds: team1 },
            { teamId: teams[1].id, playerIds: team2 },
        ],
    };
}

export function writeLineupState(state) {
    const params = new URLSearchParams();
    params.set("step", state.step);
    params.set("pool", state.pool.join(","));
    params.set("target1", String(state.targets[0]));
    params.set("target2", String(state.targets[1]));
    params.set("team1", state.lineups[0].playerIds.join(","));
    params.set("team2", state.lineups[1].playerIds.join(","));
    params.set("slots1", state.slots[0].map((id) => id ?? "").join(","));
    params.set("slots2", state.slots[1].map((id) => id ?? "").join(","));
    return params;
}

export async function copyToClipboard(value) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // Fall through to the legacy browser path.
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch {
        copied = false;
    }
    textarea.remove();
    return copied;
}

export function getLineupText(state, teams) {
    return state.lineups
        .map(({ playerIds }, index) => `${teams[index].name}: ${playerIds.join(", ")}`)
        .join("\n");
}

export function normalizePastedName(value) {
    return value
        .replace(/^\s*\d+\s*[.)-]\s*/, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase();
}

function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = Math.min(
                current[column - 1] + 1,
                previous[column] + 1,
                previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
            );
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
}

export function findBestPlayerMatch(value, players) {
    const normalized = normalizePastedName(value);
    if (normalized.length < 3) return null;

    const exact = players.find((player) => normalizePastedName(player.name) === normalized);
    if (exact) return exact;

    const scored = players
        .map((player) => {
            const name = normalizePastedName(player.name);
            const nameTokens = name.split(" ");
            const queryTokens = normalized.split(" ");
            const tokenScore = queryTokens.reduce((total, queryToken) => {
                const bestToken = Math.max(...nameTokens.map((nameToken) => {
                    if (nameToken === queryToken) return 1;
                    if (queryToken.length >= 4 && nameToken.startsWith(queryToken)) return 0.88;
                    if (queryToken.length >= 5 && nameToken.includes(queryToken)) return 0.78;
                    const distance = editDistance(queryToken, nameToken);
                    return distance <= 2 && queryToken.length >= 5 ? 0.68 : 0;
                }));
                return total + bestToken;
            }, 0) / queryTokens.length;

            return { player, score: tokenScore, distance: editDistance(normalized, name) };
        })
        .filter(({ score }) => score >= 0.68)
        .sort((left, right) => right.score - left.score || left.distance - right.distance);

    if (!scored.length) return null;
    if (scored[1] && scored[0].score - scored[1].score < 0.12) return null;
    return scored[0].player;
}

export function getPositionMap(count) {
    if (count >= 11) {
        return [[90, 50], [68, 15], [71, 38], [71, 62], [68, 85], [44, 22], [46, 50], [44, 78], [20, 22], [16, 50], [20, 78]];
    }
    if (count === 10) {
        return [[90, 50], [68, 15], [71, 38], [71, 62], [68, 85], [45, 33], [45, 67], [20, 22], [16, 50], [20, 78]];
    }
    if (count === 9) {
        return [[90, 50], [68, 15], [71, 38], [71, 62], [68, 85], [44, 33], [44, 67], [20, 33], [20, 67]];
    }
    if (count === 8) {
        return [[90, 50], [65, 20], [68, 50], [65, 80], [43, 33], [43, 67], [20, 30], [20, 70]];
    }
    return [[90, 50], [65, 20], [68, 50], [65, 80], [44, 50], [20, 70], [20, 30]];
}
