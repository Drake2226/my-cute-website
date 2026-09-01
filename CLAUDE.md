# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Meet Cute** is the product; **LOVE-MACHINE 3000** is the machine. The brand name is what the
outside world sees — the home-screen label, the manifest, the browser tab, the icon — and the
model name stays engraved on the plastic plate at the top of the cabinet, the way real hardware
carries both. Renaming one is not renaming the other.

LOVE-MACHINE 3000 — a single-page Quasar (Vue 3 + Vite) app that renders a pink retro
handheld console asking one question ("Will you go on a date with me?"), then emails the
answer as a designed letter. Once she has answered, the same console runs **Love Vitals**: a
health-app-shaped diary of the relationship (rings, trends, moments, badges) living at `/#/os`.
There is no backend and no test suite. It ships as an **installable PWA**: the built output is
plain static files in `dist/pwa` with a service worker and a manifest, and every byte of state it
keeps — the diary, where the invite was left, which tab was last open — is in the browser's
`localStorage`. Nothing about it needs a server once it has been opened once.

## Commands

```bash
npm install          # a package-lock.json is committed, despite the README saying pnpm
npm install --prefix src-pwa   # Workbox + the SW registrar; the PWA build needs these

npx quasar dev       # dev server, opens a browser automatically (devServer.open)
npm run dev:pwa      # same, with the service worker running — how to test offline
npm run build        # -> dist/pwa  (PWA: this is what gets deployed)
npm run build:spa    # -> dist/spa  (no service worker, no manifest, not installable)
npm run lint         # prettier --write, then eslint --fix
npm run lint:check   # check only
```

Lint also runs inside `quasar dev` via `vite-plugin-checker` (build-time only, `server: false`),
so ESLint errors surface in the dev build output.

## Architecture

**Two routes: the invite, and the app behind it.** `src/router/routes.js` maps `/` to
`src/pages/DateInvite.vue` and `/os/*` to the Love Vitals tabs (see below); everything else is a 404.

**The invite is six "levels."** `DateInvite.vue` is the only stateful component: a `step` ref
(`boot | mail | ask | day | vibe | place | win`) selects which `*Screen.vue` renders inside a
`<Transition name="warp">`, and a `reactive` `answer` object accumulates `dateIso`, `dateLabel`,
`dateType`, `icon`, `category` and `place` as screens emit upward. The `LEVELS` map drives the
HUD counter, and `BLANK` is the shape `onRestart()` resets to when the win screen times out.

Screens never talk to each other or to a store — each emits one event (`start`, `yes`, `pick`,
`done`, `restart`) that `DateInvite.vue` handles. Pinia is installed and `src/stores/` exists,
but it only holds the untouched scaffold; do not introduce a store for flow state.

**`ConsoleShell.vue` is chrome only.** It draws the plastic cabinet, screws, screen glass and
HUD pips, and renders the active screen through a `<slot>`. Every screen's root element carries
the shared `.scene` class (defined in `app.scss`) so it fills the screen area consistently.

**The letter's address is asked for, not compiled in.** `MailScreen.vue` sits between the boot
screen and the question and asks which inbox to post the answer to. It is a **level 0** entry in
the `LEVELS` map, like `boot`: numbering it would make the counter read "1/6" on the one visit
that shows it and "1/5" on every visit afterwards, because `onStart()` skips straight to `ask`
once `hasEmail` is true. It is never shown twice — the Us page is where it is changed after that.

`RECIPIENT_EMAIL` in `src/config.js` is now the *fallback and the suggestion*, not the
destination: `recipientEmail()` prefers `vitals.email` and `letterParams()` calls it at send
time, so an address edited on the Us page an hour ago is the one the next letter goes to.
`isEmailish()` is deliberately loose — the only real test of an address is whether mail arrives,
and a strict pattern's failure mode is rejecting a good address on the one screen standing
between her and the question.

The Us page edits that address through a **draft**, committing only when the draft is a whole
address. Writing every keystroke straight to storage would mean a half-typed one fails
`hasEmail`, and the setup screen would reappear on the next boot as though it had never been
answered. The note under the box is the only thing that says whether an edit took, since there
is no save button.

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

**It installs, so it has to survive being closed.** `quasar mode add pwa` put the service worker
and manifest under `src-pwa/`, and that folder carries **its own `package.json`** — Workbox is not
a root dependency, so a plain `npm ci` does not install it and the PWA build fails looking for
`workbox-build`. The deploy workflow runs `npm ci` twice for that reason.

- `src-pwa/manifest.json` is the app's identity: the name **Meet Cute**, `standalone` display,
  the pink `#ffe3ef` theme, and two shortcuts into `#/os/log` and `#/os/vitals`.
- **The icons come in three kinds, and the difference is load-bearing.** `scripts/make-icons.mjs`
  builds them all from `public/icons/icon-512x512.png` (the supplied badge artwork) using the
  same headless Chrome that drives the app. *Plain* keeps the artwork's transparent margins, for
  tabs and the manifest's default icons. *Maskable* is a separate drawing — badge shrunk into the
  middle 66% of a solid `#ff5fa2` square — because Android clips an adaptive icon to its own
  shape and anything relying on transparent corners loses its edges; declaring the plain icons
  `any maskable`, which an earlier version did, is exactly the mistake that crops the badge.
  *Apple* is opaque for the same reason in reverse: iOS composites a transparent touch icon onto
  black, which puts black corners around a pink badge.
- Safari pinned tabs take a one-colour **mask**, not a picture, so the badge cannot serve there —
  `safari-pinned-tab.svg` is a plain heart. Quasar injects its own `mask-icon` link coloured with
  the manifest theme, a pale blush that vanishes on the tab strip, so `index.html` writes one
  first in the badge pink and the first one wins.
- `start_url` and `scope` are `"."`, not `"/"`. The production build is served from
  `/my-cute-website/` on GitHub Pages, and an absolute `/` would put the scope above the app.
- The worker takes over immediately (`skipWaiting` + `clientsClaim`). There is no long-lived
  in-page state a swap could strand — the diary is on disk — and the alternative is a redeploy
  that never reaches a phone whose tab is never closed.
- Only map tiles get runtime caching, on a short leash (120 entries, a week). The fonts are
  bundled instead, for the reason in the styling notes; Overpass and Nominatim are never cached,
  because a stale answer to "what is near me" is worse than no answer.
- `index.html` carries no `apple-mobile-web-app-capable`: it is deprecated, Chrome warns about it
  in the console, and every iOS since 16.4 reads the unprefixed `mobile-web-app-capable` that
  Quasar injects. The only tag written by hand there is `apple-mobile-web-app-title`, because
  Quasar's injected one is the manifest `name` and iOS truncates a home-screen label at about
  twelve characters.
- `src/lib/install.js` registers the `beforeinstallprompt` listener **at import time**, and
  `App.vue` imports it for that side effect alone. The event fires once, early, and unprompted:
  anything that starts listening when a page mounts has already missed it. It is parked in a ref
  so `InstallCard.vue` on the Us page can offer the prompt as part of the app instead of letting
  Chrome drop its own bar over the console art. iOS has no such API at all, so that card falls
  back to naming the share-sheet steps.

**Closing the app is not the same as finishing it.** Two things in `vitals.js` exist only for
that: `flow` remembers which level the invite was on (with the answer so far) and `lastTab`
remembers which tab the app was on. `DateInvite.vue` still owns its own state — the project rule
that flow state never moves into a store has not changed — and only mirrors it, restoring on
mount if the copy is under twelve hours old. Only `ask`/`day`/`vibe`/`place` are resumable:
`boot` has nothing to resume, and `win` is over, since the letter is already sent and the answer
is already in her vitals. The `/os` redirect reads `lastTab` through a whitelist, because a
hand-edited blob in localStorage must not be able to aim a redirect anywhere it likes.

**The email template is a contract.** Every `{{placeholder}}` in `email/letter-template.html`
must have a matching key in `letterParams()` in `src/config.js`. That HTML is pasted by hand
into the EmailJS dashboard — it is not bundled or imported — so changing one side requires
re-pasting the other.

Two `letterParams()` keys have no placeholder in that HTML because they fill dashboard _fields_
instead: `to_email` (the template's To) and `copy_email` (its Bcc, the `COPY_TO_EMAIL` copy of
the letter). Neither is visible in the repo, so a missing Bcc field looks exactly like a working
send that quietly drops the copy. The Bcc route is deliberate over a second `emailjs.send()`:
`lockItIn()` retries the whole send on failure, and two calls would let a retry deliver her
letter twice.

**The other half of the cartridge: Love Vitals (`/#/os`).** The invite is still the entry — `/`
is unchanged, and a first visit is still the one question it always was. Once she has answered
it, the console also runs a small health-app-shaped diary of the relationship: four metrics
(crush level, butterflies, time together, kisses), a mood, freeform "moments", rings, trends and
badges. `src/pages/LoveOs.vue` is its shell and `src/pages/os/*.vue` are the four tabs
(`VitalsPage`, `LogPage`, `TrendsPage`, `MePage`), mounted as **children** of `/os` so the tab bar
and the cabinet mount once and only the page inside them swaps.

`ConsoleShell.vue` is still chrome only, but it now has two named slots beside its default one:
`#hud` (the date flow's level counter is the fallback content; Love OS passes its own bar) and
`#dock`, which is empty for the invite and holds the tab bar for the app. The tab bar sits
_inside_ `.screen`, above `.screen__glass` at `z-index: 6` — below that and the scanline overlay
eats every tap on it.

**`src/lib/vitals.js` is the data layer, and it is deliberately not a Pinia store.** Flow state
lives in `DateInvite.vue`; diary state lives in one `reactive` object in this module, mirrored
into `localStorage` under `love-machine-vitals-v1`. Things in there that are load-bearing:

- **Days are keyed by the local calendar date**, built by hand from `getFullYear/Month/Date`.
  `toISOString()` would file an 11pm kiss under tomorrow for everyone east of UTC, which is most
  of the people this was written for.
- **The save is debounced by 250 ms.** A slider drag fires an input per frame, and
  `localStorage.setItem` is a synchronous main-thread write; one write a beat after she stops is
  the whole point.
- **Every read is defensive and every failure degrades to "no data yet".** `localStorage` throws
  outright in iOS private browsing, and a `schema` mismatch or unparseable blob is discarded
  rather than migrated. An app with no memory is still a working app; an app that throws on boot
  is not.
- **`hasEntry()` is the difference between "nothing happened" and "nothing logged".** Untouched
  days are absent from `days` and read as zero everywhere, so the streak needs an explicit test
  for a day having been touched. The streak also starts its walk at yesterday when today is
  blank — she may simply not have logged yet, and breaking the streak at midnight would be a lie.
- `rememberDate()` is the one seam back to the invite: `onPickPlace()` in `DateInvite.vue` calls
  it, which stores the date for the countdown, writes the opening moment, and sets `unlocked` —
  the flag that makes the boot screen offer `♡ LOVE VITALS >` under PRESS START.

**The chart colours are not the console's palette, and that is on purpose.** `--chart-crush`,
`--chart-butterfly`, `--chart-together` and `--chart-kiss` in `app.scss` were run through a
palette validator against the cream screen (`#fff6ea`) for lightness, chroma, colour-blind
separation and contrast. The console's own `--mint` and `--butter` fail it badly — they are far
too light to read as bars on cream. Reaching for them because they are "the brand colours" is the
easy way to undo this. Two more rules hold the charts together:

- **Every chart draws exactly one metric**, and each is labelled with its name and emoji, so no
  reading depends on telling two hues apart. The adjacent-pair separation is in the acceptable-
  with-secondary-encoding band, which is only true while that stays so.
- `BarChart.vue` puts the value in a **hover tooltip rather than a label on every bar** — at ~300
  px wide, seven printed numbers are a wall of digits — and a zero day draws a 2px stub on the
  baseline so a gap reads as "nothing logged" instead of a chart that failed to draw. Trends
  keeps a table view of the same numbers for anyone the picture does not work for.

## Styling conventions

`src/css/app.scss` (~965 lines) is the whole design system: CSS custom-property tokens under
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
- Fonts (Baloo 2, Courier Prime, Press Start 2P) are **bundled, not fetched**. `src/css/_fonts.scss`
  and the woff2 files beside it are generated by `node scripts/fetch-fonts.mjs`; `app.scss` pulls
  them in with `@use 'fonts'` at the very top, where Sass requires it. They used to come from
  Google Fonts in `index.html` and cannot go back: a stylesheet requested from another origin
  during the initial parse goes out *before* the service worker controls the page, so runtime
  caching never catches it and the first offline launch renders the whole console in Trebuchet.
  Baloo is fetched as a weight range (`wght@500..800`), which is one variable file instead of four
  static ones — about 100 KB of difference.

## Checking it in a browser

There is no test suite, so the way to verify a flow change is to drive it. Playwright cannot
download its own browsers in this environment, but `playwright-core` can drive the installed
Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Serve `dist/pwa` over plain
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
