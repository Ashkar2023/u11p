export const formatDate = (d) => {
    const date = new Date(d);
    const formattedDate = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        weekday:"short",
        timeZone: "Asia/Kolkata",
    });
    const startTime = date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    });

    return `${formattedDate} • ${startTime}`;
};

export function hasMatchResult(match) {
    return match?.teams?.length > 0
        && match.teams.every((team) => Number.isFinite(team.score));
}

export function hasMatchStarted(match, now = new Date()) {
    const startsAt = new Date(match?.date).getTime();
    return Number.isFinite(startsAt) && now.getTime() >= startsAt;
}

const matchDayFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
});

export function getMatchVotingWindow(date) {
    const startsAt = new Date(date);
    const parts = Object.fromEntries(
        matchDayFormatter.formatToParts(startsAt).map(({ type, value }) => [type, value]),
    );

    return {
        opensAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        closesAt: new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+05:30`),
    };
}

export function getMatchVotingPeriodStatus(date, now = new Date()) {
    const { opensAt, closesAt } = getMatchVotingWindow(date);
    const currentTime = now.getTime();

    if (currentTime < opensAt.getTime()) return "not-open";
    if (currentTime > closesAt.getTime()) return "closed";
    return "open";
}
