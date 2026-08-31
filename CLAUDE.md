# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LOVE-MACHINE 3000 — a single-page Quasar (Vue 3 + Vite) app that renders a pink retro
handheld console asking one question ("Will you go on a date with me?"), then emails the
answer as a designed letter. There is no backend and no test suite; the built output is
plain static files in `dist/spa`.

## Commands

```bash
npm install          # a package-lock.json is committed, despite the README saying pnpm
npx quasar dev       # dev server, opens a browser automatically (devServer.open)
npx quasar build     # -> dist/spa
npm run lint         # prettier --write, then eslint --fix
npm run lint:check   # check only
```

Lint also runs inside `quasar dev` via `vite-plugin-checker` (build-time only, `server: false`),
so ESLint errors surface in the dev build output.

## Architecture

**One route, six "levels."** `src/router/routes.js` maps `/` to `src/pages/DateInvite.vue`;
everything else is a 404. `DateInvite.vue` is the only stateful component: a `step` ref
(`boot | ask | day | vibe | place | win`) selects which `*Screen.vue` renders inside a
`<Transition name="warp">`, and a `reactive` `answer` object accumulates `dateIso`, `dateLabel`,
`dateType`, `icon`, `category` and `place` as screens emit upward. The `LEVELS` map drives the
HUD counter, and `BLANK` is the shape `onRestart()` resets to when the win screen times out.

Screens never talk to each other or to a store — each emits one event (`start`, `yes`, `pick`,
`done`, `restart`) that `DateInvite.vue` handles. Pinia is installed and `src/stores/` exists,
but it only holds the untouched scaffold; do not introduce a store for flow state.

**`ConsoleShell.vue` is chrome only.** It draws the plastic cabinet, screws, screen glass and
HUD pips, and renders the active screen through a `<slot>`. Every screen's root element carries
the shared `.scene` class (defined in `app.scss`) so it fills the screen area consistently.

**`src/config.js` is both user-facing config and the send layer.** It exports the recipient
address, the letter's prose (`LOVE_NOTE`, `LOVE_NOTE_2`, `CLOSING_LINE`), the EmailJS/Formspree
credentials, and `sendAnswer()`. `sendAnswer()` tries EmailJS first (dynamically importing
`@emailjs/browser` so the SDK stays out of the initial bundle), falls back to Formspree, and
otherwise logs a warning and resolves with `{ sent: false }` — deliberately silent so an
unconfigured deploy never shows an error to its reader. `DateInvite.vue` compensates by showing
a dev-only setup banner (`import.meta.env.DEV`). `PlaceScreen.vue` is the only caller — the map
is the last thing picked — and it awaits the send before emitting `done`, so a rejection keeps
the user on the map with a retry rather than advancing to the win screen.

**The map level (`PlaceScreen.vue` + `src/lib/places.js`) is the one piece with a network
dependency.** `VibeScreen`'s `OPTIONS` carry a `spot` key naming a category in `CATEGORIES`;
an empty `spot` (picnic, nature walk, road trip) means "no list to search, tap the map instead."
Leaflet and its CSS are dynamically imported so the 145 KB chunk only loads on this level, and
markers are `divIcon`s holding an emoji — never Leaflet's default image markers, which would
need bundled assets. Because Leaflet builds its own DOM inside the container, its styling lives
in `app.scss` (`.retro-map`, `.mappin`, `.mepin`), not in the component's scoped block — the
same reason QDate is restyled there.

Everything about the search degrades instead of failing: Overpass endpoints are tried in order
with a per-request timeout (12 s, or `WIDE_TIMEOUT_MS` for the wide categories below), and
`describePoint()` falls back to raw coordinates when
Nominatim refuses. Only the caller's abort signal (the level unmounting) propagates as an error
— a dead server just means the next endpoint's turn. When touching this file, keep that shape: a
failed search must never block picking a spot.

Two details there are load-bearing and easy to undo by accident:

- **Every line of the Overpass query is another spatial scan of the whole circle**, and at the
  25 km `radiusM` the wide categories use, those scans are the entire cost of the search. So
  values of one key are grouped into a single regex selector (`["tourism"~"^(hotel|motel|…)$"]`)
  rather than one line each, and `relation` is only queried for categories with `areas: true` —
  malls, hotels, theme parks, the things actually mapped as multipolygons. Splitting a regex back
  into separate selectors, or adding relations to cafés, multiplies the scans and the query stops
  coming back at all. Public Overpass servers also throttle hard: a burst of wide queries from one
  IP gets 429s, then 504s, then refused connections for a while, so test these sparingly.
- `findNearby()` returns `{ places, ok }`, where `ok: false` means **no server answered** — as
  opposed to a town that genuinely has no cinemas. `PlaceScreen` needs the difference to choose
  between "No X nearby" and "The map search did not answer" plus a retry button. Collapsing it
  back to a bare array reintroduces a UI that blames the town for a network outage.
- `describePoint()` asks Nominatim at `zoom=18`. That is the building/POI level; at 17 or lower
  it answers with the road instead, so tapping a cinema names the street it sits on.
- **`OVERPASS_OUT_CAP` is not a result limit — it is a truncation guard.** Overpass cuts to it in
  its own order, not by distance, so it has to stay well above what a wide search returns or the
  nearest-first sort is sorting an arbitrary slice and the closest mall can be missing. The
  user-visible limit is the per-category `max`, applied after sorting.
- One place arrives as up to three elements — a POI node, a building way, a site relation — all
  carrying the same name, and a mall's node and centre can be hundreds of metres apart. That is
  what `dropDuplicates()` folds together, by name within `SAME_PLACE_KM`; a coordinate-string key
  is too tight for it. Two branches of a chain further apart than that stay separate on purpose.
- **Only three things may move the map, and picking a spot is not one of them:** the world view
  at mount, the first location fix (`applyFix`'s `center`, never a later one), and a search she
  asked for (`showPlaces`'s `refit`, which is off for quiet re-searches and once she has picked).
  `drawLine()` used to pull the view out whenever an end of the trail was off screen; with a
  25 km search radius her dot usually is, so every tap on a pin undid the zooming she did to
  find it. Recentring on the spot she just chose is always the wrong instinct here — she is
  looking right at it.
- **The search veil is time-boxed to `SEARCH_PATIENCE_MS`**, the same bargain the location veil
  makes: a 25 km search can take twenty seconds, and she gets the map back at nine while it
  finishes behind her. `stillLooking` exists to keep the hint honest in that window — otherwise
  the screen says "No malls nearby" about a search that has not answered yet.
- **`startLocating()` must be called before the first `await` in `onMounted`.** Safari grants the
  geolocation prompt off the user gesture that opened the level, and awaiting the dynamic Leaflet
  import first spends that activation — the prompt never appears and the level simply never finds
  anyone. It also asks via `getCurrentPosition` before subscribing with `watchPosition`, because
  Safari can sit on a watch for a long time before its first callback; watch-only looked like a
  permanent "FINDING YOU" on every Apple device. Both were regressions, so keep the order.
- **The FIND ME button is the only ask iOS reliably answers.** A request made at mount is
  one Safari may decline to prompt for, and a denial or a timeout there is otherwise final —
  nothing on the page can raise the prompt a second time. `relocate()` is deliberately not
  `async`: the `getCurrentPosition` call has to happen before the handler yields, or the tap
  that authorised it is already spent. The button also appears for a fix looser than `ROUGH_M`
  ("SHARPEN MY DOT"), because a wifi-sized reading is the other thing waiting never fixes.
- **The veil is time-boxed to `PATIENCE_MS`, not to the location timeout.** iOS can spend the
  full 20 s deciding it has nothing, and a level that says "FINDING YOU" for half a minute reads
  as hung. Past the box she gets the map and the button, and the ask carries on: a fix that lands
  late still centres her and still runs `searchAroundMe()`, which nothing else would do by then.
- The user marker — not the geolocation reading — is the source of truth for every distance.
  `startLocating()` resolves on the first fix so the map appears quickly, then stays subscribed
  via `watchPosition`: on a phone the opening answer is a wifi/cell guess and the GPS lock can be
  20 s behind it, so `applyFix()` keeps taking sharper readings and `remeasure()` rewrites `km`
  on the `placeList` objects the marker click handlers close over. Dragging the marker sets
  `manualPosition`, which stops the watch for good — a hand-placed dot must never be overridden.
- Automatic re-searches triggered by an improved fix pass `{ quiet: true }`: no veil over the
  map, no refitting the view, and `runSearch()` skips `showPlaces()` entirely when the search
  failed but pins are already displayed. A background refresh that cannot reach a server must
  leave the existing results alone rather than blanking a map she is in the middle of using.

**The email template is a contract.** Every `{{placeholder}}` in `email/letter-template.html`
must have a matching key in `letterParams()` in `src/config.js`. That HTML is pasted by hand
into the EmailJS dashboard — it is not bundled or imported — so changing one side requires
re-pasting the other.

Two `letterParams()` keys have no placeholder in that HTML because they fill dashboard *fields*
instead: `to_email` (the template's To) and `copy_email` (its Bcc, the `COPY_TO_EMAIL` copy of
the letter). Neither is visible in the repo, so a missing Bcc field looks exactly like a working
send that quietly drops the copy. The Bcc route is deliberate over a second `emailjs.send()`:
`lockItIn()` retries the whole send on failure, and two calls would let a retry deliver her
letter twice.

## Styling conventions

`src/css/app.scss` (~465 lines) is the whole design system: CSS custom-property tokens under
`:root` (`--bubblegum`, `--plum`, `--ink`, `--drop`, `--press`, the three font stacks), then the
console shell, then shared classes (`.scene`, `.eyebrow`, `.headline`, `.subline`, `.btn`,
`.tile`, `.drift`). Component `<style>` blocks are `scoped` and only hold layout specific to
that screen; reach for an existing token or shared class before adding a new color or button.

- `src/css/quasar.variables.scss` mirrors the palette for Quasar's Sass variables — keep the two
  in sync when a color changes.
- Quasar components are restyled rather than replaced: `.retro-cal.q-date` in `app.scss` dresses
  QDate for the console.
- A `prefers-reduced-motion` block at the bottom of `app.scss` disables the decorative
  animations; new animated decoration should be added to that list.
- `.warp-leave-active` is `pointer-events: none`. The outgoing screen sits over the incoming one
  at opacity 0, so without it every tap in that window lands on the level she just left — and a
  transition that never finishes (a backgrounded tab) leaves that invisible sheet there for good.
- Fonts (Baloo 2, Courier Prime, Press Start 2P) load from Google Fonts in `index.html`, not npm.

## Checking it in a browser

There is no test suite, so the way to verify a flow change is to drive it. Playwright cannot
download its own browsers in this environment, but `playwright-core` can drive the installed
Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Serve `dist/spa` over plain
HTTP (hash routing needs no rewrites), grant `geolocation` with a fixed `geolocation` coordinate
in the browser context, and route `**://*.emailjs.com/**` to a fulfilled 200 so no real letter
goes out. Buttons on the boot and win screens animate, so clicks need `force: true` — otherwise
Playwright waits forever for the element to be "stable."

## Gotchas

- `vueRouterMode` is `'hash'` (`quasar.config.js`), so URLs look like `/#/` — this keeps the
  static build working on hosts without SPA rewrites.
- `@/` aliases `src/` (generated into `.quasar/tsconfig.json`, which is gitignored and rebuilt by
  `quasar prepare` on postinstall).
- `QDate`'s `options` callback receives `'YYYY/MM/DD'` strings, so `DayScreen.vue` keeps the model
  in that mask and compares dates as plain strings before converting to ISO for the email.
- Prettier config is unusual for the ecosystem: no semicolons, single quotes, 100-column width.
- Geolocation needs a secure context, so the map level only locates on `localhost` or HTTPS.
- `README.md` ends with a UTF-16 fragment from a PowerShell `echo`, which makes `grep` call it a
  binary file — use `grep -a`.
- **`src/config.js` holds live EmailJS credentials**, so anything that reaches `sendAnswer()`
  emails a real person. When driving the app end to end, intercept requests to `*.emailjs.com`
  (see the browser-check note below) rather than clicking through the final button.
