<template>
  <div class="scene place">
    <div class="place__head">
      <p class="eyebrow">LOCATION LOCK</p>
      <h1 class="headline place__headline">{{ icon }} {{ dateType }}</h1>
      <p class="place__hint">{{ hint }}</p>

      <button v-if="searchFailed && !busy" class="place__retry" @click="runSearch()">
        ↻ SEARCH AGAIN
      </button>

      <button v-if="showLocate" class="place__retry" :disabled="locating" @click="relocate">
        {{ locating ? 'FINDING YOU…' : locateLabel }}
      </button>
    </div>

    <div class="place__stage">
      <div ref="mapEl" class="place__map retro-map" />

      <p v-if="busy" class="place__veil">{{ busy }}<span class="blink">_</span></p>
    </div>

    <p v-if="meLabel && !busy" class="place__me">{{ meLabel }}</p>

    <div class="place__pick">
      <template v-if="picked">
        <p class="place__name">{{ picked.name }}</p>
        <p v-if="picked.address" class="place__meta">{{ picked.address }}</p>
        <p v-if="picked.km !== null" class="place__far">{{ formatDistance(picked.km) }} away</p>
      </template>
      <p v-else class="place__meta place__meta--empty">nothing picked yet</p>
    </div>

    <button class="btn btn--yes place__go" :disabled="!picked || sending" @click="lockItIn">
      {{ sending ? 'SENDING…' : 'Lock it in →' }}
    </button>

    <p v-if="error" class="place__error" role="alert">
      That did not send. Tap the button to try once more.
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { sendAnswer } from '@/config.js'
import { CATEGORIES, describePoint, distanceKm, findNearby, formatDistance } from '@/lib/places.js'

const props = defineProps({
  dateLabel: { type: String, required: true },
  dateIso: { type: String, required: true },
  dateType: { type: String, required: true },
  icon: { type: String, default: '💗' },
  // Empty for the date types she pins anywhere: picnic, nature walk, road trip.
  category: { type: String, default: '' },
})

const emit = defineEmits(['done'])

const mapEl = ref(null)
const busy = ref('WAKING THE MAP')
const picked = ref(null)
const sending = ref(false)
const error = ref(false)
const found = ref(0)
const located = ref(false)
const searchFailed = ref(false)
// True once we have asked for her location and come away with nothing.
const geoFailed = ref(false)
// The last PositionError code: 1 denied, 2 unavailable, 3 timed out. Denial is
// the one she has to leave the page to undo, so it gets its own wording.
const geoError = ref(null)
// A hand-driven ask is in flight.
const locating = ref(false)
// Metres the device is unsure by, or null once she has placed herself by hand.
const accuracy = ref(null)

const meLabel = computed(() => {
  if (!located.value) return ''
  if (!accuracy.value) return 'mint dot = you · drag to fix'

  const off = formatDistance(accuracy.value / 1000)

  // Past a few hundred metres the phone is guessing from wifi, and on iOS that
  // usually means Precise Location is off — which no amount of waiting fixes.
  return accuracy.value > ROUGH_M
    ? `rough fix (±${off}) · allow precise location, or drag the dot`
    : `mint dot = you (±${off}) · drag to fix`
})

// A fix this loose is a wifi guess. Offering to try again is worth more than
// leaving her to wonder why the dot is in the next suburb.
const roughFix = computed(
  () => located.value && accuracy.value !== null && accuracy.value > ROUGH_M,
)

// Safari only reliably raises the location prompt for a request made inside a
// real tap. A prompt it declined to show at mount, a denial, or a fix that came
// back tower-sized are all dead ends otherwise — nothing on the page can ask a
// second time on its own. This button is that second ask.
const showLocate = computed(() => !busy.value && (!located.value || roughFix.value))

const locateLabel = computed(() => (located.value ? '◎ SHARPEN MY DOT' : '◎ FIND ME'))

const plural = computed(() => CATEGORIES[props.category]?.plural ?? '')

const hint = computed(() => {
  if (busy.value) return 'hold on…'
  // Saying it plainly beats a hint that reads as if nothing went wrong: she
  // may have declined the prompt, or it may never have been offered.
  if (geoFailed.value) {
    // Only Settings can undo a denial, so pointing at the button would be a
    // lie; every other failure is worth one more tap.
    return geoError.value === 1
      ? 'Location is blocked for this site. Allow it in Settings and tap FIND ME, or tap the map.'
      : 'Could not find you. Tap FIND ME, or tap the map to pick the spot.'
  }
  if (!props.category) return 'Tap anywhere on the map to drop our pin.'
  if (found.value) return `Nearest ${plural.value} to you — tap one, or tap anywhere else.`
  // "Nothing found" and "nobody answered" look identical on screen unless we
  // say which one happened, and the map search goes down often enough to care.
  if (searchFailed.value) return 'The map search did not answer. Tap anywhere to pick the spot.'
  return located.value
    ? `No ${plural.value} nearby. Tap anywhere to pick the spot yourself.`
    : 'Tap anywhere on the map to drop our pin.'
})

// Leaflet only exists on this level, so it stays out of the first download.
let L = null
let map = null
let userMarker = null
let placePins = []
let placeList = []
let customPin = null
let selectedEl = null
let accuracyRing = null
let trail = []
let abort = null
let alive = true
let geoWatchId = null
let currentFix = null
let manualPosition = false
let searchOrigin = null
let searching = false
let sizeWatcher = null
// Bumped on every tap so a slow reverse-geocode cannot overwrite a newer pick.
let pickSeq = 0

// A cold GPS on a phone can take this long to say anything at all.
const FIRST_FIX_TIMEOUT_MS = 20000
// But she should not be looking at a veil for anything like that long. iOS can
// spend the whole timeout deciding it has nothing, and half a minute of
// "FINDING YOU" reads as a level that has hung. Past this we hand her the map
// and the FIND ME button and let the ask finish in the background.
const PATIENCE_MS = 9000
// Told apart from a fix that came back empty.
const STILL_LOOKING = Symbol('still looking')
// Tight enough that the ring would be smaller than the dot.
const GOOD_ENOUGH_M = 40
// Past this, the fix is a guess from wifi and worth complaining about.
const ROUGH_M = 500
// A looser reading has to differ by this much before it counts as her moving.
const MOVED_M = 200
// And the search is only worth redoing if she turns out to be this far off.
const RESEARCH_SHIFT_KM = 0.4

function markSelected(el) {
  if (selectedEl) selectedEl.classList.remove('mappin--on')
  selectedEl = el ?? null
  if (selectedEl) selectedEl.classList.add('mappin--on')
}

function pinIcon(glyph) {
  return L.divIcon({
    className: 'mappin-wrap',
    // The glyph needs its own element: the pin is rotated into a teardrop and
    // the inner one turns the emoji back upright.
    html: `<span class="mappin"><i>${glyph}</i></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function farFromUser(latlng) {
  const me = userMarker?.getLatLng()
  return me ? distanceKm({ lat: me.lat, lng: me.lng }, latlng) : null
}

/**
 * The dotted run between her and the spot. Two lines on the same path: a thick
 * plum one under a thinner pink one, which is how everything else in the
 * console is drawn.
 */
function drawLine() {
  const me = userMarker?.getLatLng()
  const to = picked.value

  if (!me || !to) {
    trail.forEach((line) => map.removeLayer(line))
    trail = []
    return
  }

  const path = [
    [me.lat, me.lng],
    [to.lat, to.lng],
  ]

  if (!trail.length) {
    const shared = { dashArray: '2 12', lineCap: 'round', interactive: false }
    trail = [
      L.polyline(path, { ...shared, color: '#4a2b3d', weight: 8, opacity: 0.9 }).addTo(map),
      L.polyline(path, { ...shared, color: '#ff5fa2', weight: 4, opacity: 1 }).addTo(map),
    ]
  } else {
    trail.forEach((line) => line.setLatLngs(path))
  }

  // Only pull the view when an end is off screen — she may be reading the map.
  const view = map.getBounds()
  if (!view.contains(path[0]) || !view.contains(path[1])) {
    map.fitBounds(L.latLngBounds(path).pad(0.25), { maxZoom: 16 })
  }
}

/** Every distance on screen, measured again from wherever she is now. */
function remeasure() {
  const me = userMarker?.getLatLng()
  if (!me) return

  const from = { lat: me.lat, lng: me.lng }

  // The markers close over these objects, so updating them in place keeps a
  // later tap on a pin honest too.
  placeList.forEach((place) => {
    place.km = distanceKm(from, place)
  })

  if (picked.value) picked.value = { ...picked.value, km: distanceKm(from, picked.value) }
  drawLine()
}

/**
 * She dragged her own dot. A hand-placed position beats anything the browser
 * guessed, so the ring goes away, the watch stops fighting her for the marker,
 * and everything is measured again from the new spot.
 */
function onMeMoved() {
  manualPosition = true
  stopWatching()
  clearRing()
  accuracy.value = null
  remeasure()
}

function clearRing() {
  if (accuracyRing) {
    map.removeLayer(accuracyRing)
    accuracyRing = null
  }
}

function stopWatching() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId)
    geoWatchId = null
  }
}

/**
 * Take a reading. Called for the first fix and for every sharper one after it,
 * because on a phone the first answer comes from wifi and cell towers while the
 * GPS is still warming up — the good one can be twenty seconds behind it.
 */
function applyFix(fix, { center = false } = {}) {
  if (!alive || !map || manualPosition) return

  const latlng = [fix.lat, fix.lng]
  located.value = true
  accuracy.value = fix.accuracy
  currentFix = fix

  if (!userMarker) {
    userMarker = L.marker(latlng, {
      icon: L.divIcon({ className: 'mappin-wrap', html: '<span class="mepin"></span>' }),
      draggable: true,
      zIndexOffset: -100,
    })
      .addTo(map)
      .on('dragend', onMeMoved)

    userMarker.getElement()?.setAttribute('title', 'you — drag me if this is not right')
  } else {
    userMarker.setLatLng(latlng)
  }

  // How sure the device is, drawn to scale. A bare dot claims a precision that
  // a wifi-based fix does not have.
  clearRing()
  if (fix.accuracy && fix.accuracy > GOOD_ENOUGH_M) {
    accuracyRing = L.circle(latlng, {
      radius: fix.accuracy,
      color: '#7bd8c4',
      weight: 2,
      opacity: 0.75,
      fillColor: '#7bd8c4',
      fillOpacity: 0.15,
      interactive: false,
    }).addTo(map)
  }

  // Only ever recentre on the first fix; after that she is reading the map.
  if (center) map.setView(latlng, fix.accuracy && fix.accuracy < 200 ? 16 : 14)

  remeasure()

  // A fix that lands far from where the search ran makes those results the
  // wrong ones. Only worth redoing while she has not chosen yet.
  if (
    props.category &&
    searchOrigin &&
    !picked.value &&
    !searching &&
    distanceKm(searchOrigin, fix) > RESEARCH_SHIFT_KM
  ) {
    runSearch({ quiet: true })
  }
}

/** Accept a sharper reading, or a looser one only if she has plainly moved. */
function worthTaking(fix) {
  if (!currentFix) return true
  if ((fix.accuracy ?? Infinity) <= (currentFix.accuracy ?? Infinity)) return true
  return distanceKm(currentFix, fix) * 1000 > MOVED_M
}

function showPlaces(places, { refit = true } = {}) {
  found.value = places.length

  // A retry starts from a clean map.
  placePins.forEach((pin) => map.removeLayer(pin))
  placePins = []
  placeList = places

  places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], { icon: pinIcon(props.icon) })
      .addTo(map)
      .on('click', () => {
        pickSeq += 1
        markSelected(marker.getElement())
        picked.value = { ...place }
        drawLine()
      })

    marker.getElement()?.setAttribute('title', place.name)
    placePins.push(marker)
  })

  if (places.length && refit) {
    const points = places.slice(0, 6).map((p) => [p.lat, p.lng])
    const me = userMarker?.getLatLng()
    if (me) points.push([me.lat, me.lng])
    map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 15 })
  }
}

// A tap on a spot with no name is still a valid answer, so every date type
// allows one — it is the only way to pick for picnics, walks and road trips.
async function pickPoint(latlng) {
  const seq = (pickSeq += 1)

  if (customPin) map.removeLayer(customPin)
  customPin = L.marker(latlng, { icon: pinIcon('📍') }).addTo(map)
  markSelected(customPin.getElement())

  const km = farFromUser(latlng)
  const coords = { lat: latlng.lat, lng: latlng.lng }
  picked.value = { name: 'that spot', address: '', ...coords, km }
  drawLine()

  try {
    const described = await describePoint(coords, abort?.signal)
    if (alive && seq === pickSeq) picked.value = { ...described, ...coords, km }
  } catch {
    // Coordinates alone still tell her where to go; leave the pick as it is.
  }
}

/**
 * Kept callable so the retry button, and a fix that turns out to be far from
 * where we searched, can run it again without reloading Leaflet or asking for
 * her location a second time.
 *
 * `quiet` is for those automatic refreshes: no veil over the map and no
 * refitting the view, because she is mid-choice and did not ask for either.
 */
async function runSearch({ quiet = false } = {}) {
  const me = userMarker?.getLatLng()
  if (!props.category || !me || searching) return

  searching = true
  if (!quiet) busy.value = `LOOKING FOR ${plural.value.toUpperCase()}`
  searchFailed.value = false
  searchOrigin = { lat: me.lat, lng: me.lng }

  try {
    const { places, ok } = await findNearby(
      props.category,
      { lat: me.lat, lng: me.lng },
      abort.signal,
    )
    if (!alive) return

    searchFailed.value = !ok
    // A refresh that reached nobody must not empty a map that already has
    // pins on it. Slightly stale places beat none at all.
    if (ok || !placeList.length) showPlaces(places, { refit: !quiet })
  } catch (err) {
    if (err.name === 'AbortError') return
    console.warn('[love-machine] Search failed:', err.message)
    searchFailed.value = true
  } finally {
    searching = false
    if (alive && !quiet) busy.value = ''
  }
}

/**
 * Look around the dot, if there is anything to look for and she has not already
 * chosen. Quiet only while there are pins worth not blanking — the first search
 * of the level should say what it is doing.
 */
function searchAroundMe() {
  if (props.category && !picked.value) runSearch({ quiet: placeList.length > 0 })
}

/** Resolves once the map stops moving, or shortly regardless. */
function whenStill() {
  return new Promise((resolve) => {
    if (!map) return resolve()

    let done = false
    const finish = () => {
      if (done) return
      done = true
      map?.off('moveend', finish)
      resolve()
    }

    map.once('moveend', finish)
    setTimeout(finish, 500)
  })
}

function toFix(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  }
}

/** One reading, resolving to null instead of rejecting. */
function askOnce(options) {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoError.value = null
        resolve(toFix(pos))
      },
      (err) => {
        console.warn(`[love-machine] Location (${err.code}):`, err.message)
        geoError.value = err.code
        resolve(null)
      },
      options,
    )
  })
}

/**
 * Start locating her, and keep at it.
 *
 * getCurrentPosition comes first because Safari can sit on a watchPosition for
 * a long time before its first callback — long enough to look like the level
 * never finds her at all. Something on the map beats a perfect answer that
 * never arrives.
 *
 * Then the watch runs anyway: on a phone the opening answer is the coarse one,
 * from wifi and cell towers, and the GPS lock that replaces it can be twenty
 * seconds behind. Every sharper reading moves the dot in place, so the position
 * tightens while she is choosing rather than being frozen at its worst.
 */
async function startLocating() {
  if (!navigator.geolocation) {
    geoFailed.value = true
    return null
  }

  let fix = await askOnce({
    enableHighAccuracy: true,
    timeout: FIRST_FIX_TIMEOUT_MS,
    maximumAge: 0,
  })

  // Nothing precise. A cached, tower-sized answer still puts her on the map
  // near enough to drag, which is worth more than an empty one.
  if (!fix && alive) {
    fix = await askOnce({ enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 })
  }

  if (!alive) return fix
  if (!fix) geoFailed.value = true

  startWatching()

  return fix
}

/** Subscribe to sharper readings, replacing whatever watch was running. */
function startWatching() {
  if (!navigator.geolocation) return

  stopWatching()
  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const next = toFix(pos)
      if (worthTaking(next)) applyFix(next, { center: !currentFix })
    },
    (err) => console.warn(`[love-machine] Location watch (${err.code}):`, err.message),
    { enableHighAccuracy: true, timeout: FIRST_FIX_TIMEOUT_MS, maximumAge: 0 },
  )
}

/**
 * Ask again, straight off her tap.
 *
 * The ask at mount is the one Safari is free to ignore: it can decline to show
 * the prompt at all, and a denial or a timeout there is final, because nothing
 * on the page raises it a second time. A request made inside a gesture handler
 * is the one iOS answers, which also makes this the only way out of a fix that
 * came back accurate to a kilometre — the GPS has had time to warm up by now.
 *
 * Deliberately not async: the call has to happen before this function yields,
 * or the tap that authorised it is already spent.
 */
function relocate() {
  if (locating.value || !navigator.geolocation) return

  locating.value = true
  askOnce({ enableHighAccuracy: true, timeout: FIRST_FIX_TIMEOUT_MS, maximumAge: 0 }).then(
    (fix) => {
      if (!alive) return
      locating.value = false

      if (!fix) {
        geoFailed.value = true
        return
      }

      geoFailed.value = false
      // She asked to be found, so a dot she dragged earlier is no longer the
      // answer, and this reading recentres the map the way the first one did.
      manualPosition = false
      currentFix = null
      applyFix(fix, { center: true })
      startWatching()
      searchAroundMe()
    },
  )
}

onMounted(async () => {
  abort = new AbortController()

  // Before anything is awaited. Safari grants the location prompt off the tap
  // that opened this level, and awaiting Leaflet first spends that permission
  // — the prompt never appears and she is simply never found. It also means
  // the fix and the map library load at the same time instead of in turn.
  const firstFix = startLocating()

  const leaflet = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  if (!alive) return

  L = leaflet.default ?? leaflet

  map = L.map(mapEl.value, { worldCopyJump: true }).setView([14.5995, 120.9842], 3)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  map.on('click', (e) => pickPoint(e.latlng))

  // Leaflet watches the window, which covers rotating the phone and Safari's
  // toolbar sliding away. It cannot see the map box changing on its own, and
  // here it does: the caption appears once she is located, the retry button
  // appears when a search fails, a long address grows the panel underneath.
  // Each of those resizes the map with the window untouched, and a Leaflet
  // that still believes the old size puts tiles and taps in the wrong place.
  // Observing fires once immediately, which also covers the first layout.
  // Deferred a frame: resizing mid-tap makes Leaflet read the gesture as a
  // drag and drop the tap, which showed up as the odd pin that never landed.
  sizeWatcher = new ResizeObserver(() => {
    requestAnimationFrame(() => map?.invalidateSize({ debounceMoveend: true }))
  })
  sizeWatcher.observe(mapEl.value)

  busy.value = 'FINDING YOU'
  const me = await Promise.race([
    firstFix,
    new Promise((resolve) => setTimeout(() => resolve(STILL_LOOKING), PATIENCE_MS)),
  ])
  if (!alive) return

  if (me === STILL_LOOKING) {
    // Out of patience, not out of hope: the ask is still running, and a fix
    // that turns up late still places her and still gets a search of its own,
    // which nothing else would do for it by then.
    firstFix.then((late) => {
      if (!alive || !late) return
      // Only pull the view if the watch has not already placed her; by now she
      // may be reading the map, and a recentre would yank it out from under her.
      applyFix(late, { center: !currentFix })
      searchAroundMe()
    })
  } else if (me) {
    applyFix(me, { center: true })
    // Centring is a movement, and Leaflet reads a tap during one as a drag and
    // throws it away. Hold the veil until the map has stopped, so the first
    // thing she taps actually lands.
    await whenStill()
  }

  await runSearch()
  if (alive) busy.value = ''
})

onBeforeUnmount(() => {
  alive = false
  abort?.abort()
  stopWatching()
  sizeWatcher?.disconnect()
  map?.remove()
  map = null
})

async function lockItIn() {
  if (!picked.value) return

  sending.value = true
  error.value = false

  const place = picked.value

  try {
    await sendAnswer({
      dateLabel: props.dateLabel,
      dateIso: props.dateIso,
      dateType: props.dateType,
      dateIcon: props.icon,
      place,
    })
    emit('done', { place })
  } catch (err) {
    console.error('[love-machine] Could not send the answer:', err)
    error.value = true
    sending.value = false
  }
}
</script>

<style scoped>
.place {
  gap: 10px;
}

.place__headline {
  font-size: clamp(1.3rem, 5.8vw, 1.6rem);
}

.place__hint {
  margin: 6px 0 0;
  font-family: var(--font-body);
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: center;
  color: rgba(74, 43, 61, 0.68);
}

.place__retry {
  display: block;
  margin: 8px auto 0;
  padding: 5px 12px;
  border: 2px solid var(--plum);
  border-radius: 8px;
  background: var(--cream);
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.12em;
  color: var(--plum);
  cursor: pointer;
  box-shadow: 0 3px 0 var(--plum);
}

.place__retry:active {
  transform: translateY(3px);
  box-shadow: none;
}

.place__retry:disabled {
  opacity: 0.55;
  cursor: default;
}

.place__stage {
  position: relative;
  flex: 1;
  min-height: 170px;
  border: var(--ink);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 4px 4px 0 rgba(74, 43, 61, 0.22);
}

.place__map {
  position: absolute;
  inset: 0;
  background: var(--blush);
}

/* Covers the tiles while we locate her and search, so the map reads as busy
   rather than broken. */
.place__veil {
  position: absolute;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  background: rgba(255, 246, 234, 0.92);
  font-family: var(--font-hud);
  font-size: 7px;
  letter-spacing: 0.12em;
  color: var(--plum);
}

.place__me {
  margin: -2px 0 0;
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.1em;
  text-align: center;
  line-height: 1.6;
  color: rgba(74, 43, 61, 0.5);
}

.place__pick {
  padding: 8px 10px;
  border: 2px dashed rgba(74, 43, 61, 0.35);
  border-radius: 10px;
  background: var(--cream);
  text-align: center;
}

.place__name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.98rem;
  line-height: 1.2;
  color: var(--plum);
}

.place__meta {
  margin: 3px 0 0;
  font-size: 0.7rem;
  line-height: 1.4;
  color: rgba(74, 43, 61, 0.65);
}

.place__meta--empty {
  font-style: italic;
}

.place__far {
  margin: 5px 0 0;
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.14em;
  color: var(--bubblegum);
}

.place__go {
  width: 100%;
}

.place__error {
  margin: 0;
  font-size: 0.72rem;
  text-align: center;
  color: var(--bubblegum);
}
</style>
