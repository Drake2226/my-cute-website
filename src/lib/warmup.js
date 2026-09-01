// ---------------------------------------------------------------------------
// Doing the map level's waiting before she gets there.
//
// The spot level used to start from nothing: download Leaflet, ask where she
// is, then ask a shared server what is nearby — three waits stacked end to end,
// all of them beginning the moment she taps a date type. Every one of them can
// start earlier, and none of them needs her to be looking at the map.
//
// What is deliberately NOT done here is search every category up front. There
// are nine of them, the wide ones scan a 25 km circle, and firing that many
// queries at free servers in one breath is the exact burst that earns a 429 —
// after which nothing works for anyone. Only the category she actually picks is
// warmed, one level ahead of the map.
// ---------------------------------------------------------------------------

import { OVERPASS_ENDPOINTS, findNearby } from '@/lib/places.js'

// A fix older than this is not worth seeding the map with; she may be somewhere
// else by now, and the level's own watch will have a better answer shortly.
const FIX_TTL_MS = 3 * 60 * 1000

let fix = null
let fixAt = 0

/** The pre-warmed position, or null if there is none worth using. */
export function warmFix() {
  return fix && Date.now() - fixAt < FIX_TTL_MS ? fix : null
}

/**
 * Get the DNS lookup and TLS handshake for the map's hosts out of the way.
 *
 * Cheap — no payload — and it happens while she is still on the boot screen
 * rather than inside the first tile request. Only the two hosts the level hits
 * immediately: Nominatim is not touched until she taps a pin, by which point
 * there has been plenty of time.
 */
function preconnect() {
  const hosts = ['https://tile.openstreetmap.org', new URL(OVERPASS_ENDPOINTS[0]).origin]

  for (const href of hosts) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.append(link)
  }
}

/**
 * Pull Leaflet and its stylesheet into the browser cache.
 *
 * Same specifiers as PlaceScreen uses, so this is the same chunk and its own
 * import resolves off the cache instead of fetching 145 KB while she waits.
 */
export async function warmMap() {
  preconnect()

  try {
    await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
  } catch {
    // Offline, most likely. The level will try again and degrade on its own.
  }
}

/**
 * Take a position fix, but ONLY if permission has already been granted.
 *
 * This is the whole reason it is safe to do at app start. An ungranted
 * `getCurrentPosition` puts the browser's location prompt in front of her
 * before she has asked for anything, which is both rude and — on iOS, where a
 * denial is final and nothing on the page can raise the prompt again — a good
 * way to break the map level for good. Asking is the map level's job, on the
 * tap that opened it. This only collects an answer already given.
 */
export async function warmLocation() {
  if (!navigator.geolocation || !navigator.permissions?.query) return

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    if (status.state !== 'granted') return
  } catch {
    // Firefox used to throw on this name. Treat it as "do not know" and leave
    // the asking to the level.
    return
  }

  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }
        fixAt = Date.now()
        resolve()
      },
      () => resolve(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}

/**
 * Run the search for one category ahead of time.
 *
 * The answer is not returned anywhere — it goes into the cache inside
 * places.js, which is what the map level reads when it gets there. Called as
 * she picks the date type, so the query and her walk to the next screen happen
 * at the same time instead of one after the other.
 */
export function warmSearch(categoryKey) {
  const here = warmFix()
  if (!categoryKey || !here) return

  // Nothing awaits this and nothing shows an error for it: it is a head start,
  // and the level asks again for itself if it did not land.
  findNearby(categoryKey, here).catch(() => {})
}
