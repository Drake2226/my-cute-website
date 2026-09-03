// config.js imports this module for formatDistance and mapLink, so this import
// closes a cycle. It is safe because neither side touches the other while its
// own module body runs: the key is read inside askGeoapify, long after both
// have finished loading.
import { GEOAPIFY_KEY, isGeoapifyConfigured } from '@/config.js'

// ---------------------------------------------------------------------------
// The map level's data layer: what counts as "nearby" for each date type, how
// to ask OpenStreetMap for those places, and how far apart two points are.
//
// Everything here is free and needs no API key. Overpass finds the places and
// Nominatim names a spot she taps herself; both are community-run servers, so
// every call is small, capped, and degrades into something still usable when
// the server does not answer.
// ---------------------------------------------------------------------------

/**
 * One entry per date type that has a "nearby" idea of itself. `selectors` are
 * raw Overpass tag filters — https://wiki.openstreetmap.org/wiki/Map_features.
 * Date types missing from here (Sunset Picnic, Nature Walk, Road Trip) let her
 * pick any point on the map instead.
 *
 * `radiusM` and `max` widen a category past the defaults below. A city the size
 * of Tacloban has its malls, hotels and churches spread across neighbouring
 * towns, and the default 8 km circle cuts most of them off — so the categories
 * worth browsing search wide and keep more of what they find. Categories with
 * neither key stay at the defaults.
 */
export const CATEGORIES = {
  cinema: {
    plural: 'movie theatres',
    geo: ['entertainment.cinema'],
    selectors: ['["amenity"="cinema"]'],
  },
  restaurant: {
    plural: 'restaurants',
    // Dinner is worth driving for, so this reaches into the next towns over.
    // Fast food is deliberately not here: it would bury the actual restaurants
    // under every burger counter in the province.
    radiusM: 25000,
    max: 60,
    geo: ['catering.restaurant'],
    selectors: ['["amenity"~"^(restaurant|food_court)$"]'],
  },
  cafe: {
    plural: 'cafés',
    radiusM: 25000,
    max: 60,
    // Milk tea shops are usually amenity=cafe with a cuisine tag, so the first
    // selector already has them; the second is for the few mapped as shops.
    geo: ['catering.cafe'],
    selectors: ['["amenity"~"^(cafe|coffee_shop)$"]', '["shop"="bubble_tea"]'],
  },
  study: {
    // "Somewhere we can both open a laptop." The study hubs proper — libraries,
    // co-working desks, internet cafés — are thin on the ground outside the big
    // cities, and on their own this category would answer "nothing nearby" in
    // most towns. So the cafés that get used as study hubs ride along in the
    // same regex, which is free: values of one key grouped into one selector
    // are a single scan of the circle, not four. That overlaps Coffee & Chill
    // on purpose — the same café is both, and which one she meant is the tile
    // she tapped, not the pin.
    plural: 'study spots',
    radiusM: 25000,
    max: 60,
    // `office=coworking` is the current tag; `amenity=coworking_space` is
    // deprecated but still all over the map, so both are asked for. This one
    // is the second scan and earns it — co-working desks are the places most
    // squarely meant by "work date", and nothing else here would find them.
    //
    // Measured over 25 km around Tacloban: 6.4s, 77 named places — 9 libraries,
    // 7 internet cafés, 1 co-working desk and 60 cafés carrying the rest. Well
    // inside WIDE_TIMEOUT_MS, and nowhere near OVERPASS_OUT_CAP.
    geo: ['education.library', 'office.coworking', 'catering.cafe'],
    selectors: [
      '["amenity"~"^(library|coworking_space|internet_cafe|cafe)$"]',
      '["office"="coworking"]',
    ],
  },
  themepark: {
    plural: 'amusement parks',
    // The rarest category by far — outside the big cities the nearest one is
    // often a province away, so this searches wider than anything else here.
    radiusM: 60000,
    max: 20,
    areas: true,
    geo: ['entertainment.theme_park', 'entertainment.water_park'],
    selectors: ['["tourism"="theme_park"]', '["leisure"="water_park"]'],
  },
  art: {
    plural: 'art studios',
    geo: ['entertainment.culture.arts_centre', 'entertainment.culture.gallery'],
    selectors: ['["amenity"="arts_centre"]', '["shop"="art"]', '["craft"="pottery"]'],
  },
  mall: {
    plural: 'malls',
    radiusM: 25000,
    max: 60,
    areas: true,
    geo: ['commercial.shopping_mall', 'commercial.department_store'],
    selectors: ['["shop"~"^(mall|department_store)$"]'],
  },
  hotel: {
    plural: 'hotels',
    radiusM: 25000,
    max: 60,
    areas: true,
    // Every kind of place you can book a room in, not just the ones calling
    // themselves hotels. `["building"="hotel"]` used to be here too, for rooms
    // mapped as a building and never given a tourism tag — measured over 25 km
    // around Tacloban it cost 3.5s against 1.9s without, and found 142 named
    // places against 141. One extra hotel is not worth doubling the wait on a
    // level that is already the slowest thing here.
    geo: ['accommodation.hotel', 'accommodation.motel', 'accommodation.guest_house'],
    selectors: [
      '["tourism"~"^(hotel|motel|guest_house|hostel|apartment)$"]',
      '["leisure"="resort"]',
    ],
  },
  worship: {
    plural: 'churches',
    radiusM: 25000,
    max: 60,
    geo: ['religion.place_of_worship.christianity'],
    // Ask for every place of worship and sift afterwards, rather than asking
    // for churches specifically. Timed over 25 km around Tacloban:
    //
    //   ["amenity"="place_of_worship"]["religion"="christian"]   2.5s,  81 named
    //   ["building"~"^(church|cathedral|chapel)$"]              never finished
    //   both together, as this used to ship                     never finished
    //   ["amenity"="place_of_worship"]                           2.1s, 105 named
    //
    // The building regex was here because plenty of churches carry no religion
    // tag and were being skipped — a real problem, fixed at a price that made
    // the level unusable, since matching on `building` means scanning every
    // building in the circle. Dropping the religion filter fixes the same
    // problem and is *faster* than the narrow query was.
    //
    // `keep` then does the narrowing for free, on data already in hand: an
    // untagged place of worship stays (that was the whole point), and one
    // explicitly tagged as something else does not.
    selectors: ['["amenity"="place_of_worship"]'],
    keep: (tags) => !tags.religion || tags.religion === 'christian',
  },
  snacks: {
    // A night in still needs a snack run, so this points at the shops for it.
    plural: 'snack stops',
    radiusM: 25000,
    max: 60,
    geo: ['commercial.supermarket', 'commercial.convenience', 'catering.ice_cream'],
    selectors: ['["shop"~"^(supermarket|convenience|bakery)$"]', '["amenity"="ice_cream"]'],
  },
}

export const SEARCH_RADIUS_M = 8000
const MAX_RESULTS = 14

/** How far out a category looks, and how much of it she gets to choose from. */
function rangeFor(category) {
  const radiusM = category.radiusM ?? SEARCH_RADIUS_M

  return {
    radiusM,
    max: category.max ?? MAX_RESULTS,
    // A wide search is legitimately slower, not stuck: the mirror answers a
    // 25 km mall query in 12–18 s, which the default limit would abort as a
    // failure and blame on the town having no malls.
    timeoutMs: radiusM > SEARCH_RADIUS_M ? WIDE_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  }
}
// Overpass goes down often enough that a hung request must not hold the level.
const REQUEST_TIMEOUT_MS = 12000
// Allowed to the wide categories only. PlaceScreen drops its veil long before
// this, so the wait happens over a usable map rather than behind a curtain.
const WIDE_TIMEOUT_MS = 22000

// Tried in order until one answers. The first is the canonical server; the rest
// are public mirrors, and every one of them sees the search coordinates when it
// is asked. Delete any line you would rather never be asked — the level still
// works with none of them, it just falls back to picking the spot by hand.
//
// There are four because two was not enough. These are free, shared servers: a
// run of searches from one address earns a 429 from the busiest of them, and
// the next one along is often mid-timeout at the same moment. Each extra mirror
// is another chance that somebody answers before she gives up.
//
// **A mirror belongs here only after `node scripts/check-overpass.mjs` passes it**,
// and that script checks two separate things because this list has been wrong
// twice for two different reasons.
//
// Reachability: kumi.systems and private.coffee went on unverified and turned
// out to be unreachable from a page — one timed out, the other failed outright,
// and since neither returned a response there was no CORS header either, so
// every attempt also spat a red cross-origin error into the console. Fetching
// from Node proves nothing here, because Node does not enforce CORS.
//
// Coverage, which is the nastier one: overpass.osm.ch is the Swiss chapter's
// instance and holds **only Switzerland**. It answered 200 in about two seconds
// with an empty `elements` array for everywhere else on earth, won the race
// against slower planet servers, and had the level telling people there were no
// cinemas in their city. A server that is merely down is obvious; a server that
// confidently answers "nothing" is not. The script asks each candidate for
// cafés in both Manila and Zurich — a real instance finds plenty of both.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

// How long a server that just turned us away is left alone for. A 429 says so
// in as many words and earns the longest bench. A 5xx is the server itself in
// trouble, which tends to last minutes rather than seconds. A timeout or a
// refused connection might just as easily be this phone's signal, so that one
// stays short — benching a good server over a moment of bad wifi would be the
// worse mistake.
const COOL_OFF_RATE_MS = 5 * 60 * 1000
const COOL_OFF_SICK_MS = 3 * 60 * 1000
const COOL_OFF_BUSY_MS = 60 * 1000
const COOL_OFF_MAX_MS = 10 * 60 * 1000

// endpoint -> the time it is worth asking again. Module-level, so it survives
// the level unmounting: the next search should not have to rediscover that the
// first server is still rate-limiting this address.
const coolingOff = new Map()

// ...and written down, so a reload does not rediscover it either. A throttle
// lasts minutes and she may open the level several times inside one; without
// this, the first search of every visit pays the full timeout of a server that
// is known to be turning us away.
const COOL_OFF_KEY = 'love-machine-overpass-coolof-v1'

function saveCoolOffs() {
  try {
    localStorage.setItem(COOL_OFF_KEY, JSON.stringify(Object.fromEntries(coolingOff)))
  } catch {
    // Private browsing, or a full disk. Forgetting is only a lost optimisation.
  }
}

function loadCoolOffs() {
  let saved
  try {
    saved = JSON.parse(localStorage.getItem(COOL_OFF_KEY) || '{}')
  } catch {
    return
  }
  if (!saved || typeof saved !== 'object') return

  const now = Date.now()
  for (const [endpoint, until] of Object.entries(saved)) {
    // Only endpoints still on the list, only benches still running, and never
    // longer than the cap — a stale or hand-edited entry must not be able to
    // sideline a server for a week.
    if (OVERPASS_ENDPOINTS.includes(endpoint) && typeof until === 'number' && until > now) {
      coolingOff.set(endpoint, Math.min(until, now + COOL_OFF_MAX_MS))
    }
  }
}

loadCoolOffs()

function benchEndpoint(endpoint, ms) {
  coolingOff.set(endpoint, Date.now() + Math.min(ms, COOL_OFF_MAX_MS))
  saveCoolOffs()
}

function clearBench(endpoint) {
  if (coolingOff.delete(endpoint)) saveCoolOffs()
}

/**
 * The endpoints worth asking right now, in order.
 *
 * If every one of them is benched the whole list comes back anyway. A cooldown
 * is a guess about somebody else's server, and a wrong guess must never be the
 * reason a search fails — better a wasted request than a map that refuses to
 * look.
 */
function endpointsToTry() {
  const now = Date.now()
  const ready = OVERPASS_ENDPOINTS.filter((e) => (coolingOff.get(e) ?? 0) <= now)
  return ready.length ? ready : OVERPASS_ENDPOINTS
}

/** Seconds from a Retry-After header, when the server bothered to send one. */
function retryAfterMs(res) {
  const raw = res.headers.get('retry-after')
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : COOL_OFF_RATE_MS
}

/**
 * A signal that gives up on its own, but still obeys the caller's. Leaving the
 * level has to cancel the request; a dead server only has to stop blocking it.
 */
function timeLimited(signal, ms = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)

  signal?.addEventListener('abort', () => ctrl.abort(), { once: true })

  return {
    signal: ctrl.signal,
    done: () => clearTimeout(timer),
    // For giving up on an attempt that has been overtaken by a faster one.
    abort: () => ctrl.abort(),
  }
}

/** Great-circle distance in kilometres. */
export function distanceKm(a, b) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

/** "850 m", "4.2 km", "17 km" — short enough for the console screen. */
export function formatDistance(km) {
  if (!Number.isFinite(km)) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/** A link anyone can open, in the email, without an account. */
export function mapLink({ lat, lng }) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}

/** Squash OSM's addr:* tags into one readable line. */
function addressFromTags(tags = {}) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const line = [street, tags['addr:city'] || tags['addr:suburb'], tags['addr:state']]
    .filter(Boolean)
    .join(', ')

  return line || tags['addr:full'] || ''
}

// Overpass truncates to this before we ever see it, and it truncates in its own
// order — not by distance. So it has to stay comfortably above what a wide
// search actually returns, or the "nearest first" sort below is sorting an
// arbitrary slice and the closest mall can be missing from it.
const OVERPASS_OUT_CAP = 400

// One building is often three things in OSM at once: a POI node for the shop, a
// closed way for the building, and a relation for the site. All three carry the
// name, so all three come back as separate pins unless they are folded together
// — and a mall is big enough that its node and its centre can sit a few hundred
// metres apart. Two branches of the same chain further apart than this stay
// separate, which is the point: they are genuinely different options.
const SAME_PLACE_KM = 0.6

/** Nearest-first in, one pin per real place out. */
function dropDuplicates(sorted) {
  const kept = []

  for (const place of sorted) {
    const already = kept.some(
      (other) => other.name === place.name && distanceKm(other, place) < SAME_PLACE_KM,
    )
    // The list arrives nearest-first, so the survivor is the closest copy.
    if (!already) kept.push(place)
  }

  return kept
}

function buildQuery(selectors, center, radiusM, areas) {
  const around = `(around:${radiusM},${center.lat},${center.lng})`
  // Every line here is a separate spatial scan of the whole circle, and at
  // 25 km those are what the search costs. So the selectors above group values
  // of one key into a single regex rather than a line each, and relations —
  // multipolygon malls, resort grounds, theme parks — are only asked for by the
  // categories that are actually mapped that way. A café is never a relation,
  // and asking anyway made the query half as likely to come back at all.
  const types = areas ? ['node', 'way', 'relation'] : ['node', 'way']
  const body = selectors
    .flatMap((sel) => types.map((type) => `  ${type}${sel}${around};`))
    .join('\n')

  // "out center" gives areas (ways and relations) a single point to pin.
  return `[out:json][timeout:25];\n(\n${body}\n);\nout center ${OVERPASS_OUT_CAP};`
}

// ---------------------------------------------------------------------------
// Remembering a search
//
// The level asks for the same thing more than once — PlaceScreen re-searches
// whenever the fix sharpens — and these are free servers being asked a 25 km
// question. Answers are kept for a few minutes, keyed by category and a rounded
// centre.
// ---------------------------------------------------------------------------

const SEARCH_TTL_MS = 5 * 60 * 1000
const SEARCH_CACHE_MAX = 20

// Three decimals is a little over a hundred metres. Move further than that and
// the question is genuinely different, which is exactly when a sharper fix
// deserves a fresh answer rather than the old one.
function searchKey(categoryKey, center, radiusM) {
  return `${categoryKey}|${center.lat.toFixed(3)}|${center.lng.toFixed(3)}|${radiusM}`
}

const searchCache = new Map()

// A search where nobody answered is not cached — a dead server is not an
// answer about the world — but it must not be repeated on the spot either. The
// warm search and the level's own ask are seconds apart, and without this every
// endpoint got asked twice in a row at exactly the moment they were all saying
// no. An explicit retry passes `force` and ignores this entirely.
const FAILURE_QUIET_MS = 15 * 1000
const failedAt = new Map()

// key -> the promise of a search already on its way. Emptied as each settles.
const inFlight = new Map()

function cachedSearch(categoryKey, center, radiusM) {
  const hit = searchCache.get(searchKey(categoryKey, center, radiusM))
  return hit && Date.now() - hit.at < SEARCH_TTL_MS ? hit.found : null
}

function rememberSearch(categoryKey, center, radiusM, found) {
  searchCache.set(searchKey(categoryKey, center, radiusM), { at: Date.now(), found })
  // Oldest first out. Nothing here is worth more than anything else, and the
  // map only ever needs the last handful.
  while (searchCache.size > SEARCH_CACHE_MAX) {
    searchCache.delete(searchCache.keys().next().value)
  }
}

/**
 * Measure a set of places from where she is now, nearest first.
 *
 * Distance is not stored with the result, it is applied on the way out: a
 * cached answer is reused from a slightly different spot, and `dropDuplicates`
 * relies on the list already being sorted nearest-first to keep the closest
 * copy of a place that arrived three times over.
 */
function rankFrom(center, found, max) {
  const measured = found
    .map((place) => ({ ...place, km: distanceKm(center, place) }))
    .sort((a, b) => a.km - b.km)

  return dropDuplicates(measured).slice(0, max)
}

/**
 * Named places of one category around a point, nearest first.
 *
 * Resolves to `{ places, ok }` rather than throwing when a server is
 * unreachable — an empty map with a "tap anywhere" fallback beats an error on a
 * screen this small. `ok` is false only when no server answered at all, which
 * is a very different thing from a town with no cinemas in it: the caller has
 * to be able to say "the search broke" instead of "there is nothing near you."
 */
export async function findNearby(categoryKey, center, signal, { force = false } = {}) {
  const category = CATEGORIES[categoryKey]
  if (!category) return { places: [], ok: true }

  const { radiusM, max, timeoutMs } = rangeFor(category)

  // An answer from a minute ago about the same corner of the world is still the
  // right answer, and the level asks more than once: PlaceScreen re-searches
  // quietly whenever the GPS fix sharpens. Without this, standing still with a
  // drifting fix is enough to earn a rate-limit on its own.
  const cached = cachedSearch(categoryKey, center, radiusM)
  if (cached) return { places: rankFrom(center, cached, max), ok: true }

  // Two callers can want the same search at once — warmup.js starts one as she
  // picks the date type, and the level asks for itself a moment later. The
  // cache cannot catch that, because neither has finished; without joining the
  // one already running, the head start would cost a duplicate query instead of
  // saving a wait.
  const key = searchKey(categoryKey, center, radiusM)

  if (!force) {
    const failed = failedAt.get(key)
    if (failed && Date.now() - failed < FAILURE_QUIET_MS) return { places: [], ok: false }
  }

  let job = inFlight.get(key)

  if (!job) {
    job = askForPlaces(category, center, radiusM, max, timeoutMs, signal)
    inFlight.set(key, job)
    job.catch(() => {}).then(() => inFlight.delete(key))
  }

  let found
  try {
    found = await job
  } catch (err) {
    // Only the caller leaving the level should stop the search; anything else
    // is a dead server, which is a result of its own.
    if (signal?.aborted) throw err
    return { places: [], ok: false }
  }

  if (!found) {
    failedAt.set(key, Date.now())
    return { places: [], ok: false }
  }

  failedAt.delete(key)
  rememberSearch(categoryKey, center, radiusM, found)
  return { places: rankFrom(center, found, max), ok: true }
}

// Geoapify serves the same OpenStreetMap data as Overpass, from servers that
// are paid for rather than donated. Its circle filter has a radius ceiling, so
// the one category that reaches further than that (theme parks, 60 km) is
// clamped here and leans on Overpass for the rest of its range.
const GEOAPIFY_URL = 'https://api.geoapify.com/v2/places'
const GEOAPIFY_MAX_RADIUS_M = 50000

/**
 * Ask Geoapify. Resolves with the raw list of places, or null if it could not
 * answer — which is the signal to fall through to the Overpass mirrors.
 *
 * Null covers a wrong key, a spent quota, and a category id this taxonomy does
 * not have. That last one matters: the ids come from Geoapify's documented list
 * rather than from a live key, so a wrong one shows up as that single category
 * quietly using Overpass instead of as a broken level.
 */
async function askGeoapify(category, center, radiusM, max, signal) {
  if (!isGeoapifyConfigured() || !category.geo?.length) return null

  const limit = timeLimited(signal, REQUEST_TIMEOUT_MS)

  const url = new URL(GEOAPIFY_URL)
  url.searchParams.set('categories', category.geo.join(','))
  url.searchParams.set(
    'filter',
    `circle:${center.lng},${center.lat},${Math.min(radiusM, GEOAPIFY_MAX_RADIUS_M)}`,
  )
  // Nearest-first from the source rather than whatever order it felt like
  // sending. The caller re-measures anyway, but this decides which places make
  // the cut when there are more matches than `limit`.
  url.searchParams.set('bias', `proximity:${center.lng},${center.lat}`)
  url.searchParams.set('limit', String(max))
  url.searchParams.set('apiKey', GEOAPIFY_KEY)

  try {
    const res = await fetch(url, { signal: limit.signal })

    if (!res.ok) {
      console.warn(`[love-machine] Geoapify answered ${res.status}; falling back to Overpass.`)
      return null
    }

    const { features = [] } = await res.json()

    return features
      .map((feature) => {
        const props = feature.properties ?? {}
        const [lon, lat] = feature.geometry?.coordinates ?? []
        const placeLat = props.lat ?? lat
        const placeLng = props.lon ?? lon
        if (!props.name || typeof placeLat !== 'number') return null

        return {
          id: `geoapify-${props.place_id ?? `${placeLat},${placeLng}`}`,
          name: props.name,
          // address_line2 is the street and city without the name repeated back
          // at us, which is what the pin bubble wants.
          address: props.address_line2 ?? props.formatted ?? '',
          lat: placeLat,
          lng: placeLng,
        }
      })
      .filter(Boolean)
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn(`[love-machine] Geoapify did not answer (${err.message}); using Overpass.`)
    return null
  } finally {
    limit.done()
  }
}

/**
 * How long one server gets on its own before the next is asked alongside it.
 *
 * Strict one-at-a-time was costing the full request timeout every time the
 * server at the front of the list was merely slow rather than broken — twelve
 * seconds of nothing before the next was even tried, on a level where the veil
 * lifts at nine. Racing them all from the start would be the burst that gets
 * this address banned; letting a stalled attempt be overtaken costs one extra
 * request only when one is actually stalling.
 */
const HEDGE = Symbol('hedge')

const HEDGE_MS = 3500

/**
 * One request to one server.
 *
 * Never throws for a server's sake — a refusal comes back as `why`, because a
 * dead endpoint is an expected outcome here, not an exception. It throws only
 * for the caller's own abort, which is the level unmounting and does mean stop.
 */
function askOne(endpoint, query, timeoutMs, signal, keep) {
  const limit = timeLimited(signal, timeoutMs)
  let overtaken = false

  const promise = (async () => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: limit.signal,
      })

      if (!res.ok) {
        // 429 is the server saying "not you, not now" — asking it again in ten
        // seconds only digs the hole deeper, so it goes on the bench and the
        // next mirror gets the question.
        benchEndpoint(endpoint, res.status === 429 ? retryAfterMs(res) : COOL_OFF_SICK_MS)
        return { endpoint, why: `${endpoint} answered ${res.status}` }
      }

      const { elements = [] } = await res.json()

      // It answered, so whatever it was busy with is over.
      clearBench(endpoint)

      return {
        endpoint,
        found: elements
          .map((el) => {
            const point = el.center ?? el
            const tags = el.tags ?? {}
            if (!tags.name || typeof point.lat !== 'number') return null
            // Narrowing that would have been ruinous to ask the server for, done
            // here for nothing on data already fetched.
            if (keep && !keep(tags)) return null

            return {
              id: `${el.type}-${el.id}`,
              name: tags.name,
              address: addressFromTags(tags),
              lat: point.lat,
              lng: point.lon,
            }
          })
          .filter(Boolean),
      }
    } catch (err) {
      if (signal?.aborted) throw err
      // Cancelled because somebody else won. That says nothing about this
      // server, so it earns neither a bench nor a place in the complaints.
      if (overtaken) return { endpoint, quiet: true }

      benchEndpoint(endpoint, COOL_OFF_BUSY_MS)
      return { endpoint, why: `${endpoint} did not answer (${err.message})` }
    } finally {
      limit.done()
    }
  })()

  return {
    promise,
    overtake() {
      overtaken = true
      limit.abort()
    },
  }
}

/**
 * A list of places from whichever provider can supply one.
 *
 * Geoapify first when a key is configured, because it answers reliably.
 * Overpass behind it, because it needs no key and is therefore what most copies
 * of this run on. A Geoapify failure falls through rather than erroring: the
 * level must never end up worse off for having a key.
 */
async function askForPlaces(category, center, radiusM, max, timeoutMs, signal) {
  const fromGeoapify = await askGeoapify(category, center, radiusM, max, signal)
  if (fromGeoapify) return fromGeoapify

  return askTheServers(category, center, radiusM, timeoutMs, signal)
}

/**
 * Ask the servers until one answers, giving each a head start of its own.
 *
 * Resolves with the raw list of named places, or null when nobody answered at
 * all. Kept separate from findNearby so the promise can be shared: everything
 * about caching, ranking and joining a search already in flight belongs to the
 * caller, and this only knows how to get an answer out of a server.
 */
async function askTheServers(category, center, radiusM, timeoutMs, signal) {
  const query = buildQuery(category.selectors, center, radiusM, category.areas)
  const queue = endpointsToTry()

  // One mirror refusing is routine — that is what the others are for — so the
  // attempts are collected and only spoken about if every one of them fails. A
  // console warning per fallback reads like a broken app on a level that is
  // working exactly as designed.
  const refusals = []
  const running = new Map()
  let started = 0

  // A server answering "nothing here" is only believed once there is nobody
  // left who might disagree. One regional extract in the list was enough to
  // have the map denying that a city had cinemas, and an empty answer looks
  // exactly like a good one — 200, well formed, just wrong. Costs an extra
  // request only on searches that genuinely find nothing.
  let sawEmpty = false

  const startNext = () => {
    if (started >= queue.length) return
    const endpoint = queue[started++]
    const attempt = askOne(endpoint, query, timeoutMs, signal, category.keep)
    running.set(endpoint, attempt)
  }

  const stopTheRest = () => {
    for (const attempt of running.values()) attempt.overtake()
    running.clear()
  }

  startNext()

  try {
    while (running.size) {
      // Whichever settles first, or the hedge timer if they are all still out.
      let hedge
      const waitToHedge =
        started < queue.length
          ? new Promise((resolve) => {
              hedge = setTimeout(() => resolve(HEDGE), HEDGE_MS)
            })
          : null

      const settled = await Promise.race(
        [...[...running.values()].map((a) => a.promise), waitToHedge].filter(Boolean),
      )
      clearTimeout(hedge)

      if (settled === HEDGE) {
        // Nobody has answered yet and there is another server to ask. The slow
        // one keeps going: it may still win, and cancelling it would throw away
        // the head start it already has.
        startNext()
        continue
      }

      running.delete(settled.endpoint)

      if (settled.found?.length) {
        stopTheRest()
        return settled.found
      }

      if (settled.found) sawEmpty = true
      else if (settled.why) refusals.push(settled.why)

      if (!running.size) startNext()
    }
  } catch (err) {
    stopTheRest()
    throw err
  }

  // Everyone who answered agreed there is nothing of this kind around her,
  // which is a real answer and not a failure — the level should say "no cinemas
  // nearby", not "the search broke".
  if (sawEmpty) return []

  console.warn(
    '[love-machine] No Overpass server answered, so there are no pins to show. ' +
      'She can still pick the spot by tapping the map.',
    refusals,
  )
  return null
}

/**
 * Name a point she tapped. Falls back to plain coordinates, which still tell
 * her exactly where to go once the email lands.
 */
export async function describePoint({ lat, lng }, signal) {
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const limit = timeLimited(signal)

  try {
    // zoom=18 is the building/POI level. Anything lower answers with the street
    // the spot sits on — tap a cinema at zoom 17 and Nominatim names the road.
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18' + `&lat=${lat}&lon=${lng}`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: limit.signal })
    if (!res.ok) throw new Error(`status ${res.status}`)

    const data = await res.json()
    const address = addressFromTags({
      'addr:housenumber': data.address?.house_number,
      'addr:street': data.address?.road,
      'addr:city': data.address?.city || data.address?.town || data.address?.village,
      'addr:state': data.address?.state,
    })

    return {
      name: data.name || address || coords,
      address: address || data.display_name || '',
    }
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('[love-machine] Could not name that spot:', err.message)
    return { name: coords, address: '' }
  } finally {
    limit.done()
  }
}
