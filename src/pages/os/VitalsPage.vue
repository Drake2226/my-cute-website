<template>
  <div class="scene os-scene">
    <header class="os-head">
      <div>
        <h1 class="os-title">{{ greeting }}</h1>
        <p class="os-note">{{ subtitle }}</p>
      </div>
      <span class="vitals__mood" aria-hidden="true">{{ today.mood || '💗' }}</span>
    </header>

    <!-- The countdown is the one card that is about the invite rather than the
         diary, so it sits above everything else and only when there is a date.
         It follows the *soonest* date, not the last one planned. -->
    <router-link v-if="nextDate" to="/os/me" class="card card--tint vitals__date">
      <span class="vitals__date-icon" aria-hidden="true">{{ nextDate.icon }}</span>
      <span class="vitals__date-body">
        <span class="vitals__date-label">{{ countdown }}</span>
        <span class="vitals__date-what">{{ nextDate.dateType }} · {{ nextDate.dateLabel }}</span>
        <span v-if="nextDate.place" class="vitals__date-where">📍 {{ nextDate.place.name }}</span>
      </span>
    </router-link>

    <section class="card">
      <VitalRings :rings="rings" />
    </section>

    <!-- Three grey rings are a dead end on a first visit: they say nothing has
         happened without saying where to make something happen. -->
    <router-link v-if="!loggedToday" to="/os/log" class="emptynote vitals__nudge">
      Nothing logged today yet — take a reading ✍️
    </router-link>

    <div class="pillrow">
      <span class="pill"
        >🔥 <b>{{ streak }}</b> {{ streak === 1 ? 'day' : 'days' }} in a row</span
      >
      <span v-if="daysTogether > 0" class="pill"
        >💞 <b>{{ daysTogether }}</b> {{ daysTogether === 1 ? 'day' : 'days' }} together</span
      >
      <span class="pill"
        >📖 <b>{{ vitals.moments.length }}</b>
        {{ vitals.moments.length === 1 ? 'moment' : 'moments' }}</span
      >
    </div>

    <section class="section">
      <h2 class="section__title">
        <span>HIGHLIGHTS</span>
        <router-link class="section__more" to="/os/trends">ALL TRENDS ›</router-link>
      </h2>

      <div class="grid-2">
        <StatCard
          v-for="metric in METRICS"
          :key="metric.key"
          :metric="metric"
          :series="week[metric.key]"
          :to="`/os/trends?metric=${metric.key}`"
        />
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">
        <span>RECENT MOMENTS</span>
        <router-link class="section__more" to="/os/log">ADD ONE ›</router-link>
      </h2>

      <p v-if="!recent.length" class="emptynote">
        Nothing written down yet. The little things are the ones you forget first — go and put one
        in. ✍️
      </p>

      <ul v-else class="vitals__moments">
        <li v-for="moment in recent" :key="moment.id" class="card vitals__moment">
          <span class="vitals__moment-icon" aria-hidden="true">{{ moment.icon }}</span>
          <span class="vitals__moment-body">
            <span class="vitals__moment-text">{{ moment.text }}</span>
            <span class="vitals__moment-day">{{ longDayLabel(moment.day) }}</span>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import VitalRings from '@/components/os/VitalRings.vue'
import StatCard from '@/components/os/StatCard.vue'
import {
  METRICS,
  dayEntry,
  dayKey,
  daysToDate,
  daysTogether,
  hasEntry,
  longDayLabel,
  nextDate,
  ringProgress,
  seriesFor,
  streak,
  vitals,
} from '@/lib/vitals.js'

const today = computed(() => dayEntry(dayKey()))
const rings = computed(() => ringProgress.value)

const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = vitals.name.trim() || 'lovey'
  if (hour < 12) return `Morning, ${name}`
  if (hour < 18) return `Afternoon, ${name}`
  return `Evening, ${name}`
})

const subtitle = computed(() => {
  const closed = rings.value.filter((ring) => ring.progress >= 1).length
  if (!closed) return 'Three rings to close today.'
  if (closed === rings.value.length) return 'Every ring closed. Look at you two. 💖'
  return `${closed} of ${rings.value.length} rings closed.`
})

const countdown = computed(() => {
  const days = daysToDate.value
  if (days === null) return 'That date already happened 💕'
  if (days === 0) return 'The date is TODAY'
  if (days === 1) return 'The date is TOMORROW'
  return `${days} days to the date`
})

// Every card wants the same seven days, so build them once rather than let
// four StatCards each walk the diary.
const week = computed(() =>
  Object.fromEntries(METRICS.map((metric) => [metric.key, seriesFor(metric.key, 7)])),
)

const recent = computed(() => vitals.moments.slice(0, 3))

const loggedToday = computed(() => hasEntry(dayKey()))
</script>

<style scoped>
.vitals__nudge {
  display: block;
  text-decoration: none;
  color: var(--bubblegum);
}

.vitals__nudge:hover {
  background: rgba(255, 194, 221, 0.3);
}

.vitals__mood {
  font-size: 26px;
  line-height: 1;
}

.vitals__date {
  display: flex;
  align-items: center;
  gap: 11px;
  text-decoration: none;
  color: inherit;
}

.vitals__date-icon {
  font-size: 24px;
  line-height: 1;
}

.vitals__date-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vitals__date-label {
  font-family: var(--font-hud);
  font-size: 8.5px;
  letter-spacing: 0.06em;
  color: var(--bubblegum);
}

.vitals__date-what {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--plum);
}

.vitals__date-where {
  font-size: 0.66rem;
  color: rgba(74, 43, 61, 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vitals__moments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vitals__moment {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 11px;
}

.vitals__moment-icon {
  font-size: 15px;
  line-height: 1.3;
}

.vitals__moment-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vitals__moment-text {
  font-size: 0.76rem;
  line-height: 1.4;
  color: var(--plum);
}

.vitals__moment-day {
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.08em;
  color: rgba(74, 43, 61, 0.5);
}
</style>
