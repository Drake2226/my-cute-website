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
    selectors: ['["amenity"="cinema"]'],
  },
  restaurant: {
    plural: 'restaurants',
    // Dinner is worth driving for, so this reaches into the next towns over.
    // Fast food is deliberately not here: it would bury the actual restaurants
    // under every burger counter in the province.
    radiusM: 25000,
    max: 60,
    selectors: ['["amenity"~"^(restaurant|food_court)$"]'],
  },
  cafe: {
    plural: 'cafés',
    radiusM: 25000,
    max: 60,
    // Milk tea shops are usually amenity=cafe with a cuisine tag, so the first
    // selector already has them; the second is for the few mapped as shops.
    selectors: ['["amenity"~"^(cafe|coffee_shop)$"]', '["shop"="bubble_tea"]'],
  },
  themepark: {
    plural: 'amusement parks',
    // The rarest category by far — outside the big cities the nearest one is
    // often a province away, so this searches wider than anything else here.
    radiusM: 60000,
    max: 20,
    areas: true,
    selectors: ['["tourism"="theme_park"]', '["leisure"="water_park"]'],
  },
  art: {
    plural: 'art studios',
    selectors: ['["amenity"="arts_centre"]', '["shop"="art"]', '["craft"="pottery"]'],
  },
  mall: {
    plural: 'malls',
    radiusM: 25000,
    max: 60,
    areas: true,
    selectors: ['["shop"~"^(mall|department_store)$"]'],
  },
  hotel: {
    plural: 'hotels',
    radiusM: 25000,
    max: 60,
    areas: true,
    // Every kind of place you can book a room in, not just the ones calling
    // themselves hotels. `building=hotel` catches the ones mapped as a building
    // and never given a tourism tag, which is common outside the city centre.
    selectors: [
      '["tourism"~"^(hotel|motel|guest_house|hostel|apartment)$"]',
      '["leisure"="resort"]',
      '["building"="hotel"]',
    ],
  },
  worship: {
    plural: 'churches',
    radiusM: 25000,
    max: 60,
    // Plenty of churches carry no `religion` tag at all, so asking only for
    // religion=christian silently skips them — including small barangay
    // chapels. The building tags are how those come back.
    selectors: [
      '["amenity"="place_of_worship"]["religion"="christian"]',
      '["building"~"^(church|cathedral|chapel)$"]',
    ],
  },
  snacks: {
    // A night in still needs a snack run, so this points at the shops for it.
    plural: 'snack stops',
    radiusM: 25000,
    max: 60,
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

// Tried in order until one answers. The main server is the canonical one; the
// second is a public mirror, run by VK, that sees the search coordinates when
// the first is down. Delete that line if you would rather it never be asked —
// the level still works, it just falls back to picking the spot by hand.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/**
 * A signal that gives up on its own, but still obeys the caller's. Leaving the
 * level has to cancel the request; a dead server only has to stop blocking it.
 */
function timeLimited(signal, ms = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)

  signal?.addEventListener('abort', () => ctrl.abort(), { once: true })

  return { signal: ctrl.signal, done: () => clearTimeout(timer) }
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

/**
 * Named places of one category around a point, nearest first.
 *
 * Resolves to `{ places, ok }` rather than throwing when a server is
 * unreachable — an empty map with a "tap anywhere" fallback beats an error on a
 * screen this small. `ok` is false only when no server answered at all, which
 * is a very different thing from a town with no cinemas in it: the caller has
 * to be able to say "the search broke" instead of "there is nothing near you."
 */
export async function findNearby(categoryKey, center, signal) {
  const category = CATEGORIES[categoryKey]
  if (!category) return { places: [], ok: true }

  const { radiusM, max, timeoutMs } = rangeFor(category)
  const query = buildQuery(category.selectors, center, radiusM, category.areas)

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const limit = timeLimited(signal, timeoutMs)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: limit.signal,
      })
      if (!res.ok) {
        // 429 means the shared server is busy with someone else; the mirror
        // usually is not. Worth saying out loud when a search comes back empty.
        console.warn(`[love-machine] ${endpoint} answered ${res.status}`)
        continue
      }

      const { elements = [] } = await res.json()

      const found = elements
        .map((el) => {
          const point = el.center ?? el
          const tags = el.tags ?? {}
          if (!tags.name || typeof point.lat !== 'number') return null

          return {
            id: `${el.type}-${el.id}`,
            name: tags.name,
            address: addressFromTags(tags),
            lat: point.lat,
            lng: point.lon,
            km: distanceKm(center, { lat: point.lat, lng: point.lon }),
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.km - b.km)

      const places = dropDuplicates(found).slice(0, max)

      return { places, ok: true }
    } catch (err) {
      // Only the caller leaving the level should stop the search; a server
      // that timed out or refused just means it is the next one's turn.
      if (signal?.aborted) throw err
      console.warn(`[love-machine] ${endpoint} did not answer:`, err.message)
    } finally {
      limit.done()
    }
  }

  return { places: [], ok: false }
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
