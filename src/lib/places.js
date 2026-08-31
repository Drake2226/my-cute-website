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
 */
export const CATEGORIES = {
  cinema: {
    plural: 'movie theatres',
    selectors: ['["amenity"="cinema"]'],
  },
  restaurant: {
    plural: 'restaurants',
    selectors: ['["amenity"="restaurant"]'],
  },
  cafe: {
    plural: 'cafés',
    selectors: ['["amenity"="cafe"]', '["amenity"="coffee_shop"]'],
  },
  themepark: {
    plural: 'amusement parks',
    selectors: ['["tourism"="theme_park"]', '["leisure"="water_park"]'],
  },
  art: {
    plural: 'art studios',
    selectors: ['["amenity"="arts_centre"]', '["shop"="art"]', '["craft"="pottery"]'],
  },
  worship: {
    plural: 'churches',
    selectors: ['["amenity"="place_of_worship"]["religion"="christian"]'],
  },
  snacks: {
    // A night in still needs a snack run, so this points at the shops for it.
    plural: 'snack stops',
    selectors: ['["shop"="supermarket"]', '["shop"="convenience"]'],
  },
}

export const SEARCH_RADIUS_M = 8000
const MAX_RESULTS = 14
// Overpass goes down often enough that a hung request must not hold the level.
const REQUEST_TIMEOUT_MS = 12000

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

function buildQuery(selectors, center) {
  const around = `(around:${SEARCH_RADIUS_M},${center.lat},${center.lng})`
  const body = selectors
    .flatMap((sel) => [`  node${sel}${around};`, `  way${sel}${around};`])
    .join('\n')

  // "out center" gives buildings (ways) a single point to pin on the map.
  return `[out:json][timeout:20];\n(\n${body}\n);\nout center 80;`
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

  const query = buildQuery(category.selectors, center)

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const limit = timeLimited(signal)

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
      const seen = new Set()

      const places = elements
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
        .filter((place) => {
          if (!place) return false
          // Chains tag every branch separately; keep one per name per block.
          const key = `${place.name}@${place.lat.toFixed(3)},${place.lng.toFixed(3)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, MAX_RESULTS)

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
