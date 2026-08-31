<template>
  <div class="scene place">
    <div class="place__head">
      <p class="eyebrow">LOCATION LOCK</p>
      <h1 class="headline place__headline">{{ icon }} {{ dateType }}</h1>
      <p class="place__hint">{{ hint }}</p>

      <button v-if="searchFailed && !busy" class="place__retry" @click="runSearch">
        ↻ SEARCH AGAIN
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
// Metres the device is unsure by, or null once she has placed herself by hand.
const accuracy = ref(null)

const meLabel = computed(() => {
  if (!located.value) return ''
  return accuracy.value
    ? `mint dot = you (±${formatDistance(accuracy.value / 1000)}) · drag to fix`
    : 'mint dot = you · drag to fix'
})

const plural = computed(() => CATEGORIES[props.category]?.plural ?? '')

const hint = computed(() => {
  if (busy.value) return 'hold on…'
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
let stopLocating = null
// Bumped on every tap so a slow reverse-geocode cannot overwrite a newer pick.
let pickSeq = 0

// How long to let the fix sharpen, and the point past which it is pointless.
const ACCURACY_WAIT_MS = 8000
const GOOD_ENOUGH_M = 40

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

/**
 * She dragged her own dot. A hand-placed position is better than anything the
 * browser guessed, so the ring of uncertainty goes away and every distance is
 * measured again from the new spot.
 */
function onMeMoved() {
  if (accuracyRing) {
    map.removeLayer(accuracyRing)
    accuracyRing = null
  }
  accuracy.value = null

  const me = userMarker.getLatLng()
  const from = { lat: me.lat, lng: me.lng }

  // The markers close over these objects, so updating them in place keeps a
  // later tap on a pin honest too.
  placeList.forEach((place) => {
    place.km = distanceKm(from, place)
  })

  if (picked.value) picked.value = { ...picked.value, km: distanceKm(from, picked.value) }
  drawLine()
}

function showPlaces(places) {
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

  if (places.length) {
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

// Kept callable so the retry button can run it again without reloading Leaflet
// or asking for her location a second time.
async function runSearch() {
  const me = userMarker?.getLatLng()
  if (!props.category || !me) return

  busy.value = `LOOKING FOR ${plural.value.toUpperCase()}`
  searchFailed.value = false

  try {
    const { places, ok } = await findNearby(
      props.category,
      { lat: me.lat, lng: me.lng },
      abort.signal,
    )
    if (!alive) return
    searchFailed.value = !ok
    showPlaces(places)
  } catch (err) {
    if (err.name === 'AbortError') return
    console.warn('[love-machine] Search failed:', err.message)
    searchFailed.value = true
  } finally {
    if (alive) busy.value = ''
  }
}

/**
 * Where she is, as well as the device will say.
 *
 * The first fix a browser hands back is usually the coarse one — the phone
 * answers from wifi and cell towers while the GPS is still warming up, and it
 * sharpens over the next few seconds. So this watches for a moment and keeps
 * the sharpest reading instead of trusting the first, and asks for a fresh fix
 * rather than accepting a cached one from wherever she was earlier today.
 */
function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)

    let best = null
    let watchId = null
    let timer = null

    const finish = () => {
      clearTimeout(timer)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      stopLocating = null
      resolve(best)
    }

    stopLocating = finish
    timer = setTimeout(finish, ACCURACY_WAIT_MS)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }

        if (!best || (fix.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = fix
        // Already street-level. Waiting the rest of the window buys nothing.
        if (best.accuracy !== null && best.accuracy <= GOOD_ENOUGH_M) finish()
      },
      (err) => {
        console.warn('[love-machine] No location:', err.message)
        finish()
      },
      { enableHighAccuracy: true, timeout: ACCURACY_WAIT_MS, maximumAge: 0 },
    )
  })
}

onMounted(async () => {
  abort = new AbortController()

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
  // The console screen finishes laying out a tick after this runs.
  setTimeout(() => map?.invalidateSize(), 60)

  busy.value = 'FINDING YOU'
  const me = await locate()
  if (!alive) return

  if (me) {
    located.value = true
    accuracy.value = me.accuracy

    // How sure the device is, drawn to scale. A dot alone claims a precision
    // that wifi-based fixes do not have.
    if (me.accuracy && me.accuracy > GOOD_ENOUGH_M) {
      accuracyRing = L.circle([me.lat, me.lng], {
        radius: me.accuracy,
        color: '#7bd8c4',
        weight: 2,
        opacity: 0.75,
        fillColor: '#7bd8c4',
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(map)
    }

    // Draggable, because no browser gets this right indoors and she knows
    // where she is better than it does.
    userMarker = L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: 'mappin-wrap', html: '<span class="mepin"></span>' }),
      draggable: true,
      zIndexOffset: -100,
    })
      .addTo(map)
      .on('dragend', onMeMoved)

    userMarker.getElement()?.setAttribute('title', 'you — drag me if this is not right')
    map.setView([me.lat, me.lng], accuracy.value && accuracy.value < 200 ? 16 : 14)
  }

  await runSearch()
  if (alive) busy.value = ''
})

onBeforeUnmount(() => {
  alive = false
  abort?.abort()
  stopLocating?.()
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
