<template>
  <div class="scene os-scene">
    <header class="os-head">
      <div>
        <h1 class="os-title">Us</h1>
        <p class="os-note">the profile card of this whole operation</p>
      </div>
    </header>

    <section class="card card--tint me__id">
      <span class="me__avatar" aria-hidden="true">🧸</span>
      <div class="me__idbody">
        <label class="me__field">
          <span class="me__label">HER NAME</span>
          <input
            v-model="vitals.name"
            class="field"
            type="text"
            maxlength="24"
            placeholder="lovey dovey"
          />
        </label>
        <label class="me__field">
          <span class="me__label">TOGETHER SINCE</span>
          <input v-model="vitals.since" class="field" type="date" :max="todayKey" />
        </label>

        <label class="me__field">
          <span class="me__label">LETTER GOES TO</span>
          <input
            v-model="emailDraft"
            class="field me__email"
            type="email"
            inputmode="email"
            autocomplete="email"
            spellcheck="false"
            placeholder="you@example.com"
            :aria-invalid="!emailValid && emailDraft.trim() !== ''"
          />
          <!-- Saving happens as she types, so the line under the box is the
               only thing that says whether it took. -->
          <span class="me__emailnote" :class="{ 'me__emailnote--warn': !emailSaved }">
            {{ emailNote }}
          </span>
        </label>
      </div>
    </section>

    <div class="pillrow">
      <span v-if="daysTogether > 0" class="pill"
        >💞 <b>{{ daysTogether }}</b> days so far</span
      >
      <span class="pill"
        >🔥 <b>{{ streak }}</b> day streak</span
      >
      <span class="pill"
        >🏅 <b>{{ earnedCount }}</b
        >/{{ badges.length }} badges</span
      >
    </div>

    <section class="section">
      <h2 class="section__title">THE NEXT DATE</h2>

      <div v-if="nextDate" class="card me__date">
        <p class="me__date-what">{{ nextDate.icon }} {{ nextDate.dateType }}</p>
        <p class="me__date-when">{{ nextDate.dateLabel }}</p>
        <p v-if="nextDate.place" class="me__date-where">
          📍 {{ nextDate.place.name
          }}<span v-if="nextDate.place.km !== null">
            · {{ nextDate.place.km.toFixed(1) }} km away</span
          >
        </p>
        <p class="me__date-count">{{ countdown }}</p>
        <router-link to="/" class="minibtn me__again">Plan another one 💌</router-link>
      </div>

      <p v-else class="emptynote">
        No date on the books. The invite is still sitting in the cartridge slot —
        <router-link to="/">go and ask her</router-link>. 💗
      </p>
    </section>

    <section class="section">
      <h2 class="section__title">ALL TIME</h2>
      <div class="grid-2">
        <div v-for="stat in totals" :key="stat.label" class="card me__stat">
          <span class="me__stat-icon" aria-hidden="true">{{ stat.icon }}</span>
          <span class="me__stat-value">{{ stat.value }}</span>
          <span class="me__stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">
        <span>BADGES</span>
        <span class="section__more">{{ earnedCount }}/{{ badges.length }}</span>
      </h2>

      <ul class="me__badges">
        <li
          v-for="badge in badges"
          :key="badge.id"
          class="card me__badge"
          :class="{ 'me__badge--locked': !badge.earned }"
          :title="badge.how"
        >
          <span class="me__badge-icon" aria-hidden="true">{{
            badge.earned ? badge.icon : '🔒'
          }}</span>
          <span class="me__badge-name">{{ badge.name }}</span>
          <span class="me__badge-how">{{ badge.earned ? 'earned' : badge.how }}</span>
        </li>
      </ul>
    </section>

    <InstallCard />

    <section class="section">
      <h2 class="section__title">THIS PHONE ONLY</h2>
      <div class="card me__danger">
        <p class="me__danger-note">
          Every reading lives in this browser and nowhere else. Clearing it here — or clearing your
          browser data — is the only copy gone.
        </p>
        <!-- Two taps, because the first one is sometimes a thumb in the wrong
             place and there is no undo behind it. -->
        <button
          type="button"
          class="minibtn"
          :class="armed ? 'minibtn--go' : 'minibtn--quiet'"
          @click="eraseStep"
        >
          {{ armed ? 'Tap again to erase everything' : 'Erase all my vitals' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import InstallCard from '@/components/os/InstallCard.vue'
import {
  allTime,
  badges,
  dayKey,
  daysToDate,
  daysTogether,
  isEmailish,
  resetVitals,
  setEmail,
  streak,
  vitals,
} from '@/lib/vitals.js'

const todayKey = dayKey()

// The address is edited through a draft rather than straight into storage: a
// half-typed one is not an address, and writing it would put the machine back
// into the state where the setup screen asks for it again. Only a whole one is
// committed, so the last good address survives being edited badly.
const emailDraft = ref(vitals.email)
const emailValid = computed(() => isEmailish(emailDraft.value))
const emailSaved = computed(() => emailValid.value && emailDraft.value.trim() === vitals.email)

const emailNote = computed(() => {
  if (emailSaved.value) return 'saved — her answer is posted here'
  if (!emailDraft.value.trim()) return 'no address saved, so the letter has nowhere to go'
  return 'not saved yet — finish the address'
})

watch(emailDraft, (value) => {
  if (isEmailish(value)) setEmail(value)
})

// Erasing everything clears the stored address; without this the box would go
// on showing an address that is no longer saved anywhere.
watch(
  () => vitals.email,
  (value) => {
    if (value !== emailDraft.value.trim()) emailDraft.value = value
  },
)

const nextDate = computed(() => vitals.nextDate)
const earnedCount = computed(() => badges.value.filter((badge) => badge.earned).length)

const countdown = computed(() => {
  const days = daysToDate.value
  if (days === null) return 'already happened — and it was good'
  if (days === 0) return 'today!'
  if (days === 1) return 'tomorrow!'
  return `${days} days to go`
})

const totals = computed(() => [
  { icon: '💋', label: 'kisses logged', value: allTime.value.kisses },
  { icon: '⏳', label: 'hours together', value: Math.round(allTime.value.minutes / 6) / 10 },
  { icon: '📅', label: 'days logged', value: allTime.value.days },
  { icon: '📖', label: 'moments saved', value: allTime.value.moments },
])

const armed = ref(false)
let disarmTimer = null

function eraseStep() {
  if (armed.value) {
    if (disarmTimer !== null) clearTimeout(disarmTimer)
    disarmTimer = null
    armed.value = false
    resetVitals()
    return
  }
  armed.value = true
  // Disarm itself, so a button left armed on a page she wandered away from is
  // not a live wire when she comes back.
  disarmTimer = setTimeout(() => {
    armed.value = false
    disarmTimer = null
  }, 4000)
}

onBeforeUnmount(() => {
  if (disarmTimer !== null) clearTimeout(disarmTimer)
})
</script>

<style scoped>
.me__id {
  display: flex;
  align-items: center;
  gap: 12px;
}

.me__avatar {
  flex: none;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--ink);
  border-radius: 50%;
  background: var(--cream);
  font-size: 25px;
}

.me__idbody {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.me__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.me__label {
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.1em;
  color: rgba(74, 43, 61, 0.6);
}

.me__email {
  /* 16px or larger, or iOS zooms the console in when the box takes focus. */
  font-size: 1rem;
}

.me__emailnote {
  font-size: 0.58rem;
  line-height: 1.3;
  color: rgba(74, 43, 61, 0.55);
}

.me__emailnote--warn {
  color: var(--bubblegum);
}

.me__date {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.me__date-what {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--plum);
}

.me__date-when {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(74, 43, 61, 0.8);
}

.me__date-where {
  margin: 0;
  font-size: 0.68rem;
  color: rgba(74, 43, 61, 0.65);
}

.me__date-count {
  margin: 4px 0 0;
  font-family: var(--font-hud);
  font-size: 8px;
  letter-spacing: 0.06em;
  color: var(--bubblegum);
}

.me__again {
  align-self: flex-start;
  margin-top: 10px;
  text-decoration: none;
}

.me__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 11px;
}

.me__stat-icon {
  font-size: 14px;
  line-height: 1;
}

.me__stat-value {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.3rem;
  line-height: 1.1;
  color: var(--plum);
}

.me__stat-label {
  font-size: 0.6rem;
  color: rgba(74, 43, 61, 0.6);
}

.me__badges {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.me__badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 6px;
  text-align: center;
}

.me__badge--locked {
  background: rgba(255, 246, 234, 0.5);
  border-style: dashed;
  box-shadow: none;
}

.me__badge-icon {
  font-size: 19px;
  line-height: 1;
}

.me__badge--locked .me__badge-icon {
  opacity: 0.55;
}

.me__badge-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.64rem;
  line-height: 1.15;
  color: var(--plum);
}

.me__badge-how {
  font-size: 0.54rem;
  line-height: 1.2;
  color: rgba(74, 43, 61, 0.55);
}

.me__danger {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.me__danger-note {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.5;
  color: rgba(74, 43, 61, 0.65);
}
</style>
