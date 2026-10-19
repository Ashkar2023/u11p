import { lazy, Suspense, useLayoutEffect } from "react";
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
import { PaymentTracker } from "./pages/payment-tracker";
import { PosterKit } from "./pages/poster-kit";
import { isLocalHost } from "./utils/is-local-host";
import AwardDetailsPage from "./pages/award-details";
import { ErrorBoundary } from "./components/error.boundary";

const BroadcastConsole = lazy(() => import("./pages/broadcast-console.jsx"));
const BroadcastOverlay = lazy(() => import("./pages/broadcast-overlay.jsx"));

export function App() {
    const [location] = useLocation();
    const overlay = location.replace(/\/$/, "") === "/broadcast/overlay";
    useLayoutEffect(() => {
        document.documentElement.classList.toggle("broadcast-overlay", overlay);
        return () => document.documentElement.classList.remove("broadcast-overlay");
    }, [overlay]);
    if (overlay) return <ErrorBoundary fallback={null}><Suspense fallback={null}><BroadcastOverlay /></Suspense></ErrorBoundary>;
    return <WebsiteApp />;
}

function BroadcastConsoleRoute() {
    return (
        <Suspense fallback={<p className="p-6 text-zinc-400" role="status">Loading Broadcast Console…</p>}>
            <BroadcastConsole />
        </Suspense>
    );
}

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

const WebsiteApp = () => {
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
        <Route path="/tools/payment-tracker" component={PaymentTracker} />
        <Route path="/tools/poster-kit" component={PosterKit} />
        <Route path="/tools/broadcast" component={BroadcastConsoleRoute} />
        <Route path="/tools" component={Tools} />
        <Route path="/awards/:year/:month/:type" component={AwardDetailsPage} />
        {showDevtools && <Route path="/devtools" component={Devtools} />}
        <Analytics />
    </ErrorBoundary>
};
