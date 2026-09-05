import { useLayoutEffect } from "react";
import { Route, useLocation } from "wouter";
import { Analytics } from "@vercel/analytics/react";
import { Home } from "./pages/home";
import { Matches } from "./pages/matches";
import { MatchDetails } from "./pages/match-details";
import { PlayerDetails } from "./pages/player-details";
import { Players } from "./pages/players";
import { Stats } from "./pages/stats";
import { Devtools } from "./pages/devtools";
import { Tools } from "./pages/tools";
import { LineupCreator } from "./pages/lineup-creator";
import { isLocalHost } from "./utils/is-local-host";
import AwardDetailsPage from "./pages/award-details";
import { ErrorBoundary } from "./components/error.boundary";

function ScrollToTop() {
    const [location] = useLocation();

    useLayoutEffect(() => {
        const hash = window.location.hash.slice(1);
        const target = hash && document.getElementById(hash);

        if (target) {
            target.scrollIntoView({ block: "start", behavior:"smooth" });
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [location]);

    return null;
}

export const App = () => {
    const showDevtools = isLocalHost();
    
    useLayoutEffect(()=>{
        const currentUrl = window.location.href;

        if(window.location.pathname !== "/"){
            window.history.replaceState(null,"","/");
            window.history.pushState(null,"",currentUrl);
        }
    },[])


    return <ErrorBoundary>
        <ScrollToTop />
        <Route path="/" component={Home} />
        <Route path="/matches" component={Matches} />
        <Route path="/matches/:id" component={MatchDetails} />
        <Route path="/players" component={Players} />
        <Route path="/players/:id" component={PlayerDetails} />
        <Route path="/stats" component={Stats} />
        <Route path="/tools/lineup-creator" component={LineupCreator} />
        <Route path="/tools" component={Tools} />
        <Route path="/awards/:year/:month/:type" component={AwardDetailsPage} />
        {showDevtools && <Route path="/devtools" component={Devtools} />}
        <Analytics />
    </ErrorBoundary>
};
