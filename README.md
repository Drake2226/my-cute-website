# LOVE-MACHINE 3000

A pink retro handheld console, rendered in the browser, that asks one question and
emails you a matching letter with her answer. Built with Quasar (Vue 3 + Vite) as a
single-page app that runs as a short sequence of screens:

Opening it opens **Love Vitals**, the diary. The invite is a room off it — the 💌 in
the header, *Plan another one* on the Us tab, or the card on the summary when nothing
is planned. Every level of the invite has a back button, so a wrong turn is one tap to
undo.

1. **Boot** — a pixel heart fills from the tip up, then `PRESS START`.
2. **Where to?** — the first time only, a box asking which inbox the letter should be
   posted to. It is remembered afterwards, so it never appears again; change it any
   time on the **Us** tab.
3. **The Ask** — "Will you go on a date with me?" The No button runs away and the
   Yes button grows a little every time it does.
4. **Pick the Day** — a calendar limited to today and later.
5. **Pick the Vibe** — ten date types as tiles.
6. **Pick the Spot** — a map of where she is, with the nearby places that match the
   date type she chose. Picking one sends the letter.
7. **You Win** — the closing message, plus a ticket showing the day, the plan and
   the place. After thirty seconds the console resets itself to the boot screen.

## Love Vitals

Once she has answered, the same console runs a second thing: a little health-app-style
diary of the two of you, at `#/os`. Four tabs — today's rings and the countdown to the
date, a page to log the day, trends with charts, and a profile page with badges. It is
offered on the You Win screen and from a quiet link under `PRESS START` after that.

Everything it remembers lives in the browser's own storage on her phone: nothing is
uploaded, there is no account, and no server ever sees it. The other side of that coin
is that clearing the browser's data clears the diary too.

## Making the map reliable (optional)

Out of the box the map asks the free, shared Overpass servers — the same ones the
whole internet uses. They answer often enough to be useful and refuse often enough
to be annoying, and when they all refuse the level falls back to "tap the map
yourself", which still works but is not the nice version.

To fix that, put a **Geoapify** key in `src/config.js`:

1. Sign up at [geoapify.com](https://www.geoapify.com/) — email only, no card.
2. Create a project and copy its API key.
3. Paste it over `YOUR_GEOAPIFY_KEY` in `src/config.js`.
4. In their dashboard, restrict the key to your own domain. It is visible in browser
   code, exactly like the EmailJS key, and that restriction is what stops anyone else
   spending your allowance.

The free tier is a few thousand requests a day, far more than this will use. It is the
same OpenStreetMap data, just served properly. Leave the key alone and nothing breaks —
the map carries on with Overpass.

## The map level

Level 4 asks the browser for her location, drops her on a
[Leaflet](https://leafletjs.com) map, and searches OpenStreetMap for the places
that match her pick — cinemas for Movie Night, restaurants for Dinner Date, cafés,
theme parks, art studios, churches, and the nearest shops for the snack run before
a Cozy Night In. Tapping one shows how far it is from her. **Sunset Picnic**,
**Nature Walk** and **Road Trip** have no obvious list to search, so those let her
tap any point on the map instead — and every other date type allows that too, as a
way out when nothing nearby fits.

Once she picks somewhere, a dotted line runs from her to it, so the distance is
something to see rather than just read. She is the mint dot, drawn inside a ring
the size of the device's own uncertainty — a phone indoors is often out by a few
hundred metres, and the ring says so instead of pretending otherwise. If the dot
is in the wrong place she can drag it, which measures every distance again from
where she actually is.

On a phone this takes a few seconds to settle. The first answer comes from wifi
and cell towers while the GPS is still warming up, so the level keeps listening
and moves the dot in as the fix sharpens — the ring shrinking is that happening.
If it stays wide, the phone is guessing rather than measuring, and the caption
says so: on iOS that is usually Precise Location switched off for the browser,
under Settings — Privacy & Security — Location Services. Dragging the dot always
wins over whatever the device thinks.

There is nothing to sign up for and no key to paste: the search uses the public
[Overpass API](https://overpass-api.de) and names her own pins with
[Nominatim](https://nominatim.openstreetmap.org). Both are volunteer-run and
sometimes busy, so each request gives up after twelve seconds and the level falls
back to "tap anywhere" rather than showing an error.

Two things worth knowing:

- **Location needs HTTPS.** `quasar dev` on localhost counts, and so does any real
  host. If she says no to the permission prompt, the level still works — it just
  cannot measure the distance or search around her.
- **If the main Overpass server is down**, the search falls back to a public mirror
  run by VK, which then sees the search coordinates. The endpoint list is at the
  top of `src/lib/places.js`; delete the second line if you would rather it were
  never asked.

## Set up the letter

`RECIPIENT_EMAIL` in `src/config.js` is the starting suggestion, not the final answer:
the setup screen asks for an address on the first run and keeps it in the browser, and
that one wins. Change it later on the **Us** tab of Love Vitals. Everything below is
still needed — the address is only where the letter goes, not what sends it.

Everything you fill in is in **`src/config.js`**. Your email address is the first
thing in the file:

```js
export const RECIPIENT_EMAIL = 'you@example.com'
```

The words of the letter are right below it — `LOVE_NOTE`, `LOVE_NOTE_2` and
`CLOSING_LINE`. Edit them so they sound like you.

A website cannot send email on its own, so the letter goes out through
[EmailJS](https://www.emailjs.com), which is free for 200 emails a month and lets
you use your own HTML design.

1. Sign up at emailjs.com.
2. **Email Services → Add New Service.** Connect the Gmail (or Outlook) account the
   letter should be sent _from_. Copy the **Service ID**.
3. **Email Templates → Create New Template.** Open the **Content** tab, switch it to
   code view (the `<>` button), and paste in the entire contents of
   **`email/letter-template.html`**. Then set:
   - **Subject:** `{{subject}}`
   - **To Email:** `{{to_email}}`
   - **Bcc:** `{{copy_email}}` — only if you want your own copy, see below
   - **From Name:** anything you like, e.g. `Love-Machine 3000`

   Copy the **Template ID**.

4. **Account → General.** Copy the **Public Key**.
5. Paste all three into the `EMAILJS` block in `src/config.js`.
6. **Account → Security.** Turn on the domain allow-list and add the domain you
   deploy to, so the key cannot be used from anywhere else.

### Send yourself a copy

`COPY_TO_EMAIL` in `src/config.js` gets the identical letter — same design, same
words, same map link — at the same moment hers goes out:

```js
export const COPY_TO_EMAIL = 'you@example.com' // '' to send only to her
```

It travels as a **Bcc**, so your address never appears in her email; she sees a
letter addressed only to her. Two things make it work:

- The template's **Bcc** field on emailjs.com must be `{{copy_email}}`. That field
  lives in the dashboard, not in `email/letter-template.html`, so setting the
  constant alone changes nothing until you add it there once.
- Set it to `''` and the field renders empty, which EmailJS treats as no Bcc at
  all. The template is the same either way — there is nothing to undo.

It is one send, not two, so the retry on the map level can never deliver her
letter twice while chasing your copy.

> **Already set this up before the map level existed?** Re-paste
> `email/letter-template.html` into your EmailJS template. The letter now also
> carries `{{place_name}}`, `{{place_address}}`, `{{place_distance}}`,
> `{{place_coords}}` and `{{place_map_url}}`, and an older template will simply
> leave the place out.

To preview the letter without sending anything, open
`email/letter-template.html` in a browser. The `{{placeholders}}` show as literal
text until EmailJS fills them in.

Until step 5 is done the site still runs end to end — the answer is logged to the
browser console instead of being emailed, so nothing looks broken while you test.

### Formspree instead

If you would rather use Formspree, fill in `FORMSPREE_ENDPOINT` in `src/config.js`
and leave the EmailJS block untouched. It is used only when EmailJS is not
configured. Note that Formspree's free plan sends a plain notification listing the
values — the designed letter is an EmailJS-only feature.

## Run it

```bash
pnpm install
pnpm install --dir src-pwa   # the service worker's own dependencies
quasar dev                   # plain dev server
quasar dev -m pwa            # with the service worker, to test installing and offline
```

## Put it on her phone

The built site is a PWA, so it installs like an app — its own icon on the home screen,
no address bar, and it opens with no connection at all.

- **Android / Chrome**: open the link, then the browser menu → **Install app**. The
  **Us** tab also has an install button that does the same thing.
- **iPhone / Safari**: open the link, tap **Share**, then **Add to Home Screen**. iOS
  gives no button for this — Apple only offers it through the share sheet — so the
  **Us** tab spells out those steps there instead.

Installing needs HTTPS, which GitHub Pages gives you. It will not offer to install over
plain `http://`, apart from on `localhost` while you are developing.

## Build and deploy

```bash
quasar build         # -> dist/pwa, the installable build
quasar build -m spa  # -> dist/spa, no service worker, not installable
```

The output lands in `dist/pwa` and is plain static files, so it can go on Netlify,
Vercel, GitHub Pages, or any static host. Send her the link.

This repository already does that on every push: `.github/workflows/deploy.yml`
builds the site and publishes `dist/pwa` to GitHub Pages. It only works while
**Settings — Pages — Source** is set to **GitHub Actions**. On "Deploy from a
branch" GitHub publishes the source tree instead, which serves an index.html full
of unreplaced template placeholders, and the page comes up blank. A project page
is served from a subfolder, so `publicPath` in `quasar.config.js` carries the
`/my-cute-website/` prefix those builds need.

## Format and lint

```bash
pnpm run lint        # fix
pnpm run lint:check  # check only
```

## Where things live

- `src/config.js` — your email address, the words of the letter, the service keys.
- `email/letter-template.html` — the letter's design, to paste into EmailJS.
- `src/pages/DateInvite.vue` — the flow: which level is showing and what she picked.
- `src/components/date/ConsoleShell.vue` — the plastic shell, screen, and HUD.
- `src/components/date/*Screen.vue` — one file per level.
- `src/lib/vitals.js` - the diary: the metrics, the streak, and what goes in storage.
- `src/pages/os/*.vue` - one file per tab of Love Vitals.
- `src-pwa/manifest.json` - the app's name, icon and colours when it is installed.
- `public/icons/` - the Meet Dawn badge at every size, built by `node scripts/make-icons.mjs`.
- `src/lib/places.js` — which places each date type looks for, and how far away.
- `src/css/app.scss` — palette, type, buttons, animations, QDate and Leaflet restyling.
#   m y - c u t e - w e b s i t e  
 