# Broadcast implementation

## Current checkpoint: Phase 4 MVP

The Firebase foundation, administrator authentication/locking, and match controls are implemented.

`/tools/broadcast` is linked from Tools and now supports password login, session restore,
automatic heartbeat, offline/expiry detection, and logout. The authenticated view shows
who owns control and the fixed sign-in expiry. It also supports fixture selection,
start/end, goals, scorer corrections, confirmed latest-goal removal, and graphics toggles.
The transparent GSAP overlay and its Firebase subscriptions are implemented at
`/broadcast/overlay`. The console includes an Open 16:9 overlay link.

The fixture picker suggests the earliest future fixture, using the same date rule as
the homepage. The operator must press Load match and confirm before it becomes active.
An existing active broadcast is loaded instead of replacing it with a new suggestion.
If there is no future fixture, choose one manually. New records start at 0–0; existing
records resume. The kickoff-soon graphic is enabled automatically when a fixture gets
its first broadcast record. Nothing is written back to `data.json`.

The normal website does not initialize Firebase or call broadcast APIs. The console's
authentication code is loaded only through its lazy route and uses same-origin API
requests. Neither Firebase SDK is needed by the browser for login. The public match
subscription and GSAP load only when the overlay route is opened.

## Using the overlay

1. Open `/tools/broadcast`, sign in, choose the fixture and load it.
2. Open `/broadcast/overlay` in a separate browser window or PRISM browser widget.
3. Set the browser-widget viewport to **1920×1080** (or **1280×720**) and fill the 16:9
   stream canvas. The design scales uniformly; other aspect ratios retain transparent
   space around the centered 16:9 canvas instead of stretching it.
4. Before kickoff, show kickoff soon or the lineup sequence. Turning one on automatically
   turns the other off. The 40-second sequence shows each team lineup for 12 seconds,
   followed by this month's top scorers for 8 seconds and the all-time top scorers for
   8 seconds. A large crest appears, settles larger at the top-center of the pitch, then
   upright FIFA cards reveal in the existing goalkeeper-to-striker array order on the
   horizontal black-and-gold pitch. Each scorer board shows at most five players from
   the website's completed-match data, with staggered slide-and-fade animation. Start
   Match hides the sequence and turns the scorebug on. While live, goal/removal
   animations can coexist with the scorebug.
5. Confirming End Match automatically shows the full-time board, hides the scorebug
   and cancels goal animations. The full-time board can then be toggled manually with
   no timeout. Hiding it leaves no score graphics; the scorebug is live-match only.
   Post-match corrections update the result without goal animations. Streaming is
   never stopped.

While the lineup sequence runs, the console shows a countdown and locks match/graphic
changes; the API also enforces the same 40-second window. Heartbeats and logout keep
working. Each completed formation holds before transitioning, and the all-time scorer
board automatically hides when the sequence ends. Use **Replay lineups and top scorers**
to run it again, without a one-play limit. A server start timestamp and run ID are stored
alongside the `showLineup` flag. Reconnecting overlays resume at the current point rather
than restarting the clock. These timings are shared constants in
`src/broadcast/constants.js`.

The clean overlay is intentionally blank until a match is loaded. Connection errors
and loading messages are not shown on air. Add `?debug=1` to the overlay URL when
setting up to see connection/configuration status; remove it before streaming.
On connection loss the last match graphics remain, temporary animations are cleared,
and reconnecting establishes a new event baseline without replaying missed goals.
No server credentials or admin session are needed in PRISM.

Graphics live in `src/broadcast/overlay-graphics.jsx`, styling in `overlay.css`, and
the read-only Firebase subscription in `use-overlay-feed.js`. Goal timelines use
GSAP context cleanup so replacing a goal with a disallowed graphic cancels its animation.
The timed pitch presentation lives in `src/broadcast/lineup-graphic.jsx` and reuses
the match-details formation mapping and `fifa-player-shield.webp` asset. Only the pitch
image is rotated; card elements stay upright.

## Local development

Use Node 24.12 or later within Node 24 (`nvm use` reads `.nvmrc`). The Firebase web SDK
requires this Node version, and `package.json` also selects Node 24 for Vercel.

```sh
npm ci
npm run dev
npm run test:broadcast
npm run build
```

Vite's development server runs the frontend only. Use `vercel dev` with the Vercel CLI
when exercising `/api` locally. Vercel serves these functions in deployments; the SPA
rewrite deliberately excludes `/api` so an API request cannot return `index.html`.

The unit tests use Node's built-in runner and require no credentials. They cover static
data isolation, goalscorer selection, request validation, password comparison, JWT
claims/expiry, cookie attributes, IP selection, and lazy server setup.

For database integration tests, start the Realtime Database emulator (Java and the
Firebase CLI are needed for this command):

```sh
firebase emulators:start --only database --project demo-u11p-broadcast-tests
```

Then, in another terminal:

```sh
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 npm run test:broadcast:database
```

These tests refuse non-loopback database hosts and use a fixed `demo-` project with
fake credentials. They clear only that local test namespace. They test simultaneous
lock acquisition, renewal from separate SDK instances, lease/JWT expiry, safe logout,
stale-session mutation rejection, concurrent rate limits, complete authentication
handlers, and actual public/private database rules. They do not read `.env`.

Phase 2 was also checked in headless Chrome at a mobile viewport against a local
emulator with dummy credentials and Vite environment-file loading disabled. Production
credentials and the live database have not been inspected or used for verification.

## Firebase and Vercel setup

1. Create a Firebase project and a Realtime Database in locked mode. Spark is sufficient
   to start. Leave the database's Data tab empty.
2. Register a Firebase Web app and copy its public configuration.
3. Generate a service-account private key in Project settings → Service accounts.
   Keep the downloaded credential file outside the repository.
4. Add the variables listed in `.env.example` to local `.env` and Vercel's environment
   settings. Keep existing MOTM/payment/poster variables as they are.
5. Publish `firebase.database.rules.json` in the Realtime Database Rules tab. If using
   the Firebase CLI, `firebase.json` points to that same file; specify the intended
   project explicitly when deploying rules.
6. Redeploy Vercel after changing `VITE_*` variables, because Vite embeds them at build
   time. Prefer a separate Firebase project for preview testing so preview and
   production consoles cannot control the same broadcast accidentally.

Only Realtime Database is used. Firebase Authentication, Firestore, Hosting, Storage,
and Cloud Functions do not need enabling.

| Variable | Source / purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Service-account JSON `project_id` |
| `FIREBASE_CLIENT_EMAIL` | Service-account JSON `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service-account JSON `private_key`; real newlines and literal `\n` are supported |
| `FIREBASE_DATABASE_URL` | Realtime Database instance URL |
| `BROADCAST_ADMIN_PASSWORD` | Chosen shared password, compared only on the server |
| `BROADCAST_JWT_SECRET` | Random session-signing secret, at least 32 bytes; also keys the private IP hash |
| `VITE_FIREBASE_API_KEY` | Web configuration `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web configuration `authDomain`; optional for this RTDB-only client |
| `VITE_FIREBASE_PROJECT_ID` | Web configuration `projectId` |
| `VITE_FIREBASE_DATABASE_URL` | The same RTDB instance URL as the server |
| `VITE_FIREBASE_APP_ID` | Web configuration `appId` |

Server credentials must never use the `VITE_` prefix. The API's origin check compares
the request origin with its own host and HTTPS protocol on Vercel; there is no
`BROADCAST_ALLOWED_ORIGINS` setting. Local HTTP is supported outside Vercel.

Rules allow public reads of `/broadcast/activeMatchId` and that match's
`/broadcast/matches/<matchId>` record. Reading the database root, the whole broadcast
tree, inactive matches, or `/admin` is denied. All browser writes are denied. The
Admin SDK performs server writes after authorization. Readers must subscribe
to the active ID first, then subscribe to the selected match path.

## Login, lock and rate limit

Login verifies the shared password, acquires `/admin/lock` in a transaction, then sends
a signed JWT in an HTTP-only `SameSite=Strict` cookie scoped to `/api/broadcast`. The
cookie is Secure on Vercel/HTTPS; local HTTP development is the only exception. The
browser never receives the password, JWT signing key, or service-account credentials
in API responses, and JavaScript cannot read the session cookie.

The JWT expires two hours after login. Its lifetime is not extended by refresh or
heartbeat. Repeated login in a browser that already owns the lock keeps its existing
session and expiry. Separate tabs in that browser share the same cookie/session.

The console renews its lock every ten seconds. The lease expires after twenty seconds
and is capped at the JWT's expiry. While the two-hour JWT remains valid, a heartbeat or
session check atomically renews the existing lease or reclaims an expired/free lease.
If another administrator acquired the lease first, the old cookie is cleared and that
operator must sign in again. Logout clears the cookie and deletes the lock only if it
still belongs to that session. An expired JWT cannot release a different session's lock.

Each client IP gets five login attempts during a fifteen-minute window starting with
its first attempt. All attempts count, including correct passwords and lock conflicts;
heartbeats, session checks and logout do not. The next attempt receives HTTP 429 with
`Retry-After`, and the UI displays a countdown. Requests while blocked do not prolong
the window. People sharing Wi-Fi/mobile carrier egress may share this allowance.

Counters are transactionally stored under `/admin/loginRateLimits`, keyed with an HMAC
of the IP. Raw IPs and passwords are not saved there. Expired counters are removed
on the next accepted attempt. The counter survives function restarts and page reloads;
no extra environment variable or service is needed. Production IPs come from Vercel's
overwritten forwarding headers; local requests use the socket address.

If a heartbeat fails or the browser goes offline, the console pauses mutations but
keeps the dashboard mounted. It attempts heartbeats in the background where the browser
permits, and returning to the page atomically reclaims an expired lease if the JWT is
still valid and no other administrator took control. Local deadlines use elapsed time
and subtract request duration, avoiding reliance on the phone's wall clock for
ownership. API requests time out after eight seconds.

For match mutations, `withOwnedLock` checks the verified session and lease inside the
same root transaction that changes match state. Its callback must be synchronous and
safe to retry. The transaction helper retains a Firebase value listener until commit,
because a one-shot read alone does not retain the SDK's transaction cache.

Reference: [Firebase web setup](https://firebase.google.com/docs/database/web/start),
[Admin setup](https://firebase.google.com/docs/admin/setup), and
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Agreed behaviour for subsequent phases

- JavaScript, with comments only where the reasoning needs explanation.
- `data.json` remains the website's source for fixtures, teams, players and lineups.
  Firebase is temporary broadcast state; it never writes results back to the website.
- Numeric player/team/fixture IDs are retained. Firebase record keys can be strings
  such as `match_18`; `sourceMatchId` links a record to its static fixture.
- `match.teams[0]` is home and `[1]` is away. Team `shortName` and `logo` are reused.
- Creating a broadcast match starts at `0–0/upcoming` regardless of the static score.
  Selecting an already initialized match must resume it, not call the factory again.
- Scorer search has lineup players from both sides first, then all remaining visible
  players. Filtering retains both groups. No player needs a permanent team assignment.
- The server resolves player identity and image from static data. Goal events will
  contain only the small content snapshot needed to play a reliable animation.
- Missing images use the website fallback. Own goals have no player image.
- Match records contain score, individual goals, events, sequence counters, presentation
  flags and a revision number. Revisions let confirmation requests detect a changed
  result. RTDB omits empty objects and null values: readers must default missing
  `goals`/`events` to `{}` and optional player/image fields to `null`.
- Session lifetime: two hours from login, not extended by heartbeat. Heartbeat: ten
  seconds. Lock lease: twenty seconds. Constants are in `src/broadcast/constants.js`.
- Authentication uses the server-only shared password and a signed HTTP-only cookie.
  JWT validity alone never authorizes a match mutation.
- The lock check and protected state change must occur in one transaction over their
  common ancestor. Do not add a read-lock-then-write-match implementation.
- Idempotency records and login-rate-limit records belong under private `/admin`,
  alongside the lock, and never inside publicly readable match records.
- Upcoming matches may show either the lineup or the small team-vs-team/kicking-off-soon
  graphic, never both. Starting hides both and automatically enables the live scorebug.
- Ending the match automatically shows the full-time board and disables the scorebug.
  Hiding the full-time board leaves the canvas clear of score graphics. Post-match
  corrections do not trigger goal/disallowed animations.
- Only `goal` and `goal_disallowed` are one-time events. There is no full-time event,
  five-second result timer, or presentation show/hide event.
- Corrections are allowed after full time and do not change match status.
- No YouTube control or forced administrator takeover.

## API surface

All paths are under `/api/broadcast`. Match commands share one endpoint to keep the
serverless API small; `action` selects the operation:

| Method / path | Purpose |
| --- | --- |
| `POST /login` | Verify password, acquire lease, issue two-hour session |
| `GET /session` | Validate the session and renew/reclaim the lease if available |
| `POST /heartbeat` | Renew/reclaim the lease for the valid session if available |
| `POST /logout` | Clear cookie and release only an owned lease |
| `GET /state` | Read the active match for the signed-in owner |
| `POST /match`, `action: "select"` | Initialize or resume a fixture's broadcast state |
| `POST /match`, `action: "start"` | Start match and hide pre-match graphics |
| `POST /match`, `action: "add_goal"` | Save goal, derived score and animation event together |
| `POST /match`, `action: "void_goal"` | Confirm and void the latest goal for a side |
| `POST /match`, `action: "correct_goal"` | Correct scorer/goal type without adding a goal or animation |
| `POST /match`, `action: "full_time"` | Confirm the reviewed result and set full-time status |
| `POST /match`, `action: "presentation"` | Toggle kickoff, lineup, scorebug or full-time result |

Match commands include `requestId`, `activeMatchId` and the reviewed `revision`.
The select command also includes `sourceMatchId`. Goal commands use `team` (`home` or
`away`), `type` (`normal`, `penalty` or `own_goal`) and `playerId` where applicable;
removal/correction identifies `goalId`. Penalties retain their selected scorer and can
be changed to or from another goal type through scorer correction.
Presentation commands use `field` and boolean `visible`. The server derives scores.
The console retains failed requests for safe retries and offers Refresh match to
resolve uncertain network outcomes. Request receipts expire with their session.

The console currently reads state through the API on opening, refreshing and saving.
The overlay subscribes to current match state directly from Firebase. All mutations
go through the API. The HTTP wrapper supplies method/origin/JSON checks and no-store
responses. Authentication and lock authorization are explicitly enforced by the
corresponding service operation; the wrapper alone never grants control.

The six basic graphics are implemented: small team-vs-team/kicking-off-soon, lineups,
goal/scorer, goal disallowed, scorebug, and full-time scoreboard. Further test tooling
and security expansion are deferred. Actual PRISM rendering and live Firebase
end-to-end operation remain to be checked on the user's devices.
