// ---------------------------------------------------------------------------
// LOVE VITALS — the little health-app half of the console.
//
// One reactive object, mirrored into localStorage, holding a day-keyed diary of
// four love metrics plus a list of moments. There is no server: the phone that
// logged it is the only copy, which is also why every read is defensive — a
// half-written or hand-edited blob must degrade to "no data yet" rather than
// take the whole app down.
//
// This is deliberately NOT a Pinia store. The date flow keeps its state in
// DateInvite.vue and the project rule is that flow state never moves into a
// store; keeping the vitals in the same plain-module shape means there is one
// pattern to learn instead of two.
// ---------------------------------------------------------------------------

import { computed, reactive, watch } from 'vue'

const STORAGE_KEY = 'love-machine-vitals-v1'

// Bumping this throws away shapes older code wrote. There is nothing precious
// in here that is worth a migration path.
const SCHEMA = 1

// ---------------------------------------------------------------------------
// The metrics
//
// `color` is the mark colour for this metric's chart. The four were picked
// against the cream screen (#fff6ea) with the palette validator rather than by
// eye: the console's own mint and butter are far too light to read as bars on
// cream. Every chart draws ONE metric, and every card names its metric in text
// beside an emoji, so identity never rests on hue alone.
// ---------------------------------------------------------------------------

export const METRICS = [
  {
    key: 'crush',
    icon: '💗',
    label: 'Crush Level',
    unit: '%',
    goal: 100,
    max: 100,
    step: 5,
    color: 'var(--chart-crush)',
    blurb: 'how hard I am falling today',
    ring: true,
  },
  {
    key: 'butterflies',
    icon: '🦋',
    label: 'Butterflies',
    unit: 'bpm',
    goal: 120,
    max: 200,
    step: 5,
    color: 'var(--chart-butterfly)',
    blurb: 'wings per minute when you text back',
    ring: true,
  },
  {
    key: 'minutes',
    icon: '⏳',
    label: 'Time Together',
    unit: 'min',
    goal: 120,
    max: 600,
    step: 15,
    color: 'var(--chart-together)',
    blurb: 'minutes in the same room, or on the same call',
    ring: true,
  },
  {
    key: 'kisses',
    icon: '💋',
    label: 'Kisses',
    unit: '',
    goal: 10,
    max: 60,
    step: 1,
    color: 'var(--chart-kiss)',
    blurb: 'counted honestly, mostly',
    ring: false,
  },
]

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]))

export const MOODS = ['🥰', '😊', '😌', '🥺', '😴', '😤']

const BLANK_DAY = { crush: 0, butterflies: 0, minutes: 0, kisses: 0, mood: '', note: '' }

function blankState() {
  return {
    schema: SCHEMA,
    name: '',
    since: '',
    unlocked: false,
    // Where the letter gets posted. Asked for once, on the screen between the
    // boot sequence and the question, and editable afterwards on the Us page.
    // Empty means it has never been asked, which is what makes that screen
    // appear — so erasing the vitals asks again, on purpose.
    email: '',
    nextDate: null,
    days: {},
    moments: [],
    // Where the invite was left, and which tab the app was last on. Both exist
    // because an installed app is closed the way a phone closes things — by
    // being switched away from — and reopening should not mean starting the
    // question again.
    flow: null,
    lastTab: '',
  }
}

// ---------------------------------------------------------------------------
// Dates. Everything is keyed by a LOCAL calendar day (YYYY-MM-DD). Going
// through toISOString() here would file an 11pm kiss under tomorrow for anyone
// east of UTC, which is most of the people this was written for.
// ---------------------------------------------------------------------------

export function dayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return dayKey(date)
}

// The last `count` day keys, oldest first, ending today.
export function recentKeys(count) {
  const today = dayKey()
  return Array.from({ length: count }, (_, i) => shiftDays(today, i - (count - 1)))
}

export function shortDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' })
}

export function longDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

function load() {
  const fresh = blankState()
  let raw
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing on iOS throws on the very first read. An app with no
    // memory is still a working app, so carry on with the blank one.
    return fresh
  }
  if (!raw) return fresh

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    return fresh
  }
  if (!saved || typeof saved !== 'object' || saved.schema !== SCHEMA) return fresh

  return {
    ...fresh,
    ...saved,
    days: saved.days && typeof saved.days === 'object' ? saved.days : {},
    moments: Array.isArray(saved.moments) ? saved.moments : [],
  }
}

export const vitals = reactive(load())

let saveTimer = null

// Sliders fire on every pixel of a drag; writing localStorage on each one is a
// synchronous main-thread write per frame. One write a beat later is plenty.
watch(
  vitals,
  () => {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vitals))
      } catch {
        // Full quota or a locked-down browser. Nothing useful to say to her
        // about it, and the session in front of her still works.
      }
    }, 250)
  },
  { deep: true },
)

// ---------------------------------------------------------------------------
// Reading days
// ---------------------------------------------------------------------------

export function dayEntry(key) {
  return { ...BLANK_DAY, ...(vitals.days[key] || {}) }
}

// Only days she actually touched exist in `days`, so an untouched day reads as
// zero everywhere without ever being stored. `hasEntry` is the difference
// between "nothing happened" and "nothing logged", which the streak needs.
export function hasEntry(key) {
  const day = vitals.days[key]
  if (!day) return false
  return Boolean(day.crush || day.butterflies || day.minutes || day.kisses || day.mood || day.note)
}

function touchDay(key) {
  if (!vitals.days[key]) vitals.days[key] = { ...BLANK_DAY }
  return vitals.days[key]
}

export function setMetric(metricKey, value, key = dayKey()) {
  const metric = METRIC_BY_KEY[metricKey]
  if (!metric) return
  const clamped = Math.max(0, Math.min(metric.max, Math.round(Number(value) || 0)))
  touchDay(key)[metricKey] = clamped
}

export function bumpMetric(metricKey, delta, key = dayKey()) {
  setMetric(metricKey, dayEntry(key)[metricKey] + delta, key)
}

export function setMood(mood, key = dayKey()) {
  const day = touchDay(key)
  // Tapping the mood already showing clears it, so a mis-tap is undoable
  // without a second control.
  day.mood = day.mood === mood ? '' : mood
}

export function setNote(note, key = dayKey()) {
  touchDay(key).note = note
}

// ---------------------------------------------------------------------------
// The address the letter goes to
// ---------------------------------------------------------------------------

// Deliberately loose. The only real test of an address is whether mail arrives,
// and a strict pattern's failure mode is rejecting somebody's perfectly good
// address on the one screen standing between her and the question.
export function isEmailish(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim())
}

export function setEmail(value) {
  vitals.email = String(value || '').trim()
}

export const hasEmail = computed(() => isEmailish(vitals.email))

// ---------------------------------------------------------------------------
// Moments — the freeform half. A short line of text, newest first.
// ---------------------------------------------------------------------------

const MOMENT_CAP = 200

export function addMoment(text, icon = '💗') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return
  vitals.moments.unshift({
    id: `${Date.now()}-${vitals.moments.length}`,
    at: new Date().toISOString(),
    day: dayKey(),
    icon,
    text: trimmed.slice(0, 140),
  })
  // Nothing paginates this list, so cap it rather than let a year of daily
  // notes turn the summary page into a scroll marathon.
  if (vitals.moments.length > MOMENT_CAP) vitals.moments.length = MOMENT_CAP
}

export function removeMoment(id) {
  const at = vitals.moments.findIndex((m) => m.id === id)
  if (at !== -1) vitals.moments.splice(at, 1)
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------

export function seriesFor(metricKey, count) {
  return recentKeys(count).map((key) => ({
    key,
    value: dayEntry(key)[metricKey],
    label: shortDayLabel(key),
    full: longDayLabel(key),
  }))
}

export function averageOf(values) {
  const real = values.filter((v) => v > 0)
  if (!real.length) return 0
  return Math.round(real.reduce((sum, v) => sum + v, 0) / real.length)
}

export function totalOf(values) {
  return values.reduce((sum, v) => sum + v, 0)
}

// Days logged in a row, counting back from today. Today being empty does not
// break the streak until the day is over — she may simply not have logged yet —
// so the walk starts at yesterday when today is blank.
export const streak = computed(() => {
  let cursor = dayKey()
  if (!hasEntry(cursor)) cursor = shiftDays(cursor, -1)
  let run = 0
  while (hasEntry(cursor) && run < 3650) {
    run += 1
    cursor = shiftDays(cursor, -1)
  }
  return run
})

export const loggedDays = computed(() => Object.keys(vitals.days).filter(hasEntry).length)

export const allTime = computed(() => {
  const keys = Object.keys(vitals.days)
  const sum = (metricKey) =>
    keys.reduce((total, key) => total + (vitals.days[key][metricKey] || 0), 0)
  return {
    kisses: sum('kisses'),
    minutes: sum('minutes'),
    moments: vitals.moments.length,
    days: loggedDays.value,
  }
})

// How far today has got towards each ring's goal, 0..1 and never past 1 so the
// ring geometry cannot overdraw itself.
export const ringProgress = computed(() => {
  const today = dayEntry(dayKey())
  return METRICS.filter((m) => m.ring).map((m) => ({
    ...m,
    value: today[m.key],
    progress: Math.min(1, m.goal ? today[m.key] / m.goal : 0),
  }))
})

export const daysTogether = computed(() => {
  if (!vitals.since) return 0
  const [y, m, d] = vitals.since.split('-').map(Number)
  if (!y || !m || !d) return 0
  const start = new Date(y, m - 1, d)
  const diff = Date.now() - start.getTime()
  return diff > 0 ? Math.floor(diff / 86400000) : 0
})

// Days until the date she picked in the invite. Null when there is no date, or
// when it has already happened.
export const daysToDate = computed(() => {
  const iso = vitals.nextDate?.dateIso
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  return diff >= 0 ? diff : null
})

// ---------------------------------------------------------------------------
// Badges — the reason to come back tomorrow.
// ---------------------------------------------------------------------------

export const BADGES = [
  {
    id: 'yes',
    icon: '💌',
    name: 'She Said Yes',
    how: 'Finish the invite',
    test: (s) => s.unlocked,
  },
  { id: 'first', icon: '🌱', name: 'First Reading', how: 'Log one day', test: (s) => s.days >= 1 },
  {
    id: 'week',
    icon: '🔥',
    name: 'Seven Day Streak',
    how: 'Log 7 days in a row',
    test: (s) => s.streak >= 7,
  },
  {
    id: 'month',
    icon: '🏅',
    name: 'Thirty Day Streak',
    how: 'Log 30 days in a row',
    test: (s) => s.streak >= 30,
  },
  {
    id: 'smitten',
    icon: '💯',
    name: 'Fully Smitten',
    how: 'Hit 100% crush level',
    test: (s) => s.bestCrush >= 100,
  },
  {
    id: 'swarm',
    icon: '🦋',
    name: 'Butterfly Swarm',
    how: 'Pass 150 bpm in a day',
    test: (s) => s.bestButterflies >= 150,
  },
  {
    id: 'hundred',
    icon: '💋',
    name: 'A Hundred Kisses',
    how: 'Log 100 kisses in total',
    test: (s) => s.kisses >= 100,
  },
  {
    id: 'day',
    icon: '⏳',
    name: 'A Whole Day',
    how: '24 hours together in total',
    test: (s) => s.minutes >= 1440,
  },
  {
    id: 'diary',
    icon: '📖',
    name: 'Diary Keeper',
    how: 'Save 10 moments',
    test: (s) => s.moments >= 10,
  },
]

export const badges = computed(() => {
  const keys = Object.keys(vitals.days)
  const best = (metricKey) =>
    keys.reduce((top, key) => Math.max(top, vitals.days[key][metricKey] || 0), 0)
  const stats = {
    unlocked: vitals.unlocked,
    streak: streak.value,
    days: loggedDays.value,
    kisses: allTime.value.kisses,
    minutes: allTime.value.minutes,
    moments: vitals.moments.length,
    bestCrush: best('crush'),
    bestButterflies: best('butterflies'),
  }
  return BADGES.map((badge) => ({ ...badge, earned: badge.test(stats) }))
})

// ---------------------------------------------------------------------------
// The invite hands its answer over here
// ---------------------------------------------------------------------------

export function rememberDate(answer) {
  vitals.unlocked = true
  vitals.nextDate = {
    dateIso: answer.dateIso,
    dateLabel: answer.dateLabel,
    dateType: answer.dateType,
    icon: answer.icon,
    place: answer.place ? { name: answer.place.name, km: answer.place.km ?? null } : null,
  }
  addMoment(`Said yes to ${answer.dateType} on ${answer.dateLabel}`, answer.icon || '💌')
}

export function resetVitals() {
  Object.assign(vitals, blankState())
}

// ---------------------------------------------------------------------------
// Resuming — the part that makes it behave like an installed app
//
// The invite keeps its own state in DateInvite.vue and that has not changed;
// these two functions only mirror it to disk so closing the app in the middle
// of the question is not the same as answering it again. The state still lives
// in the component — this is a copy, not a store.
// ---------------------------------------------------------------------------

// Half a day. Coming back to a half-answered invite an hour later should carry
// on; coming back next week should start at the boot screen, because by then
// the moment has passed and a stale half-answer is just confusing.
const FLOW_TTL_MS = 12 * 60 * 60 * 1000

export function rememberFlow(step, answer) {
  vitals.flow = { at: Date.now(), step, answer: { ...answer } }
}

export function forgetFlow() {
  vitals.flow = null
}

// The saved step if it is still worth resuming, otherwise null — and a stale
// one is dropped here rather than left to rot in storage.
export function resumableFlow() {
  const flow = vitals.flow
  if (!flow || !flow.step || !flow.answer) return null
  if (!flow.at || Date.now() - flow.at > FLOW_TTL_MS) {
    vitals.flow = null
    return null
  }
  return flow
}

export function rememberTab(path) {
  vitals.lastTab = path
}
