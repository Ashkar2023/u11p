import { useLayoutEffect } from "react";
import { Route, useLocation } from "wouter";
import { Home } from "./pages/home";
import { Matches } from "./pages/matches";
import { MatchDetails } from "./pages/match-details";
import { PlayerDetails } from "./pages/player-details";
import { Players } from "./pages/players";
import { Stats } from "./pages/stats";
import { Devtools } from "./pages/devtools";
import { isLocalHost } from "./utils/is-local-host";
import AwardDetailsPage from "./pages/award-details";

function ScrollToTop() {
    const [location] = useLocation();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [location]);

    return null;
}

export const App = () => {
    const showDevtools = isLocalHost();

    return <>
        <ScrollToTop />
        <Route path="/" component={Home} />
        <Route path="/matches" component={Matches} />
        <Route path="/matches/:id" component={MatchDetails} />
        <Route path="/players" component={Players} />
        <Route path="/players/:id" component={PlayerDetails} />
        <Route path="/stats" component={Stats} />
        <Route path="/awards/:year/:month/:type" component={AwardDetailsPage}/>
        {showDevtools && <Route path="/devtools" component={Devtools} />}
    </>
};
