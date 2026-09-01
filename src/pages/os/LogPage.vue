<template>
  <div class="scene os-scene">
    <header class="os-head">
      <div>
        <h1 class="os-title">Log today</h1>
        <p class="os-note">{{ longDayLabel(key) }}</p>
      </div>
      <span class="log__saved" role="status">{{ savedNote }}</span>
    </header>

    <section class="card">
      <h2 class="section__title log__cardtitle">HOW ARE YOU FEELING</h2>
      <div class="log__moods">
        <button
          v-for="mood in MOODS"
          :key="mood"
          type="button"
          class="log__mood"
          :class="{ 'log__mood--on': today.mood === mood }"
          :aria-pressed="today.mood === mood"
          :aria-label="`Mood ${mood}`"
          @click="pickMood(mood)"
        >
          {{ mood }}
        </button>
      </div>
    </section>

    <section v-for="metric in METRICS" :key="metric.key" class="card log__metric">
      <div class="log__metric-head">
        <span class="log__metric-icon" aria-hidden="true">{{ metric.icon }}</span>
        <span class="log__metric-name">
          {{ metric.label }}
          <small>{{ metric.blurb }}</small>
        </span>
      </div>

      <div class="stepper">
        <button
          type="button"
          class="stepper__btn"
          :disabled="today[metric.key] <= 0"
          :aria-label="`Less ${metric.label}`"
          @click="nudge(metric, -1)"
        >
          −
        </button>
        <span class="stepper__read">
          {{ today[metric.key] }}<small v-if="metric.unit">{{ metric.unit }}</small>
        </span>
        <button
          type="button"
          class="stepper__btn"
          :disabled="today[metric.key] >= metric.max"
          :aria-label="`More ${metric.label}`"
          @click="nudge(metric, 1)"
        >
          +
        </button>
      </div>

      <input
        class="slider"
        type="range"
        min="0"
        :max="metric.max"
        :step="metric.step"
        :value="today[metric.key]"
        :aria-label="metric.label"
        :style="{ accentColor: metric.color }"
        @input="setMetric(metric.key, $event.target.value)"
      />

      <p class="log__goal">
        goal {{ metric.goal }}{{ metric.unit }} ·
        <b>{{ Math.round((today[metric.key] / metric.goal) * 100) }}%</b>
      </p>
    </section>

    <section class="card">
      <h2 class="section__title log__cardtitle">A LINE ABOUT TODAY</h2>
      <textarea
        class="field log__note"
        rows="2"
        placeholder="what today felt like…"
        :value="today.note"
        maxlength="200"
        @input="setNote($event.target.value)"
      />
    </section>

    <section class="section">
      <h2 class="section__title">SAVE A MOMENT</h2>

      <div class="card">
        <div class="log__icons">
          <button
            v-for="icon in MOMENT_ICONS"
            :key="icon"
            type="button"
            class="log__icon"
            :class="{ 'log__icon--on': draftIcon === icon }"
            :aria-pressed="draftIcon === icon"
            :aria-label="`Icon ${icon}`"
            @click="draftIcon = icon"
          >
            {{ icon }}
          </button>
        </div>

        <form class="log__momentform" @submit.prevent="saveMoment">
          <input
            v-model="draft"
            class="field"
            type="text"
            maxlength="140"
            placeholder="the thing you want to remember…"
          />
          <button type="submit" class="minibtn minibtn--go" :disabled="!draft.trim()">Save</button>
        </form>
      </div>

      <p v-if="!todaysMoments.length" class="emptynote">Nothing saved today. Yet. 💗</p>

      <ul v-else class="log__list">
        <li v-for="moment in todaysMoments" :key="moment.id" class="card log__item">
          <span aria-hidden="true">{{ moment.icon }}</span>
          <span class="log__item-text">{{ moment.text }}</span>
          <button
            type="button"
            class="log__remove"
            :aria-label="`Delete moment: ${moment.text}`"
            @click="removeMoment(moment.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  METRICS,
  MOODS,
  addMoment,
  bumpMetric,
  dayEntry,
  dayKey,
  longDayLabel,
  removeMoment,
  setMetric,
  setMood,
  setNote,
  vitals,
} from '@/lib/vitals.js'

const MOMENT_ICONS = ['💗', '😂', '🍜', '🎶', '🌙', '☕', '🚗', '✨']

// The page only ever writes to today. Editing an older day would need a date
// picker and a second screen of history, and nothing here is worth backfilling.
const key = dayKey()
const today = computed(() => dayEntry(key))

const draft = ref('')
const draftIcon = ref(MOMENT_ICONS[0])

function nudge(metric, direction) {
  bumpMetric(metric.key, direction * metric.step)
}

function pickMood(mood) {
  setMood(mood)
}

function saveMoment() {
  addMoment(draft.value, draftIcon.value)
  draft.value = ''
}

const todaysMoments = computed(() => vitals.moments.filter((moment) => moment.day === key))

// Everything on this page saves itself the instant it is touched, which leaves
// nothing on screen to say so. This is that acknowledgement — and the only
// reason the page has a "saved" state at all.
const savedNote = ref('')
let clearTimer = null

watch(
  () => JSON.stringify(vitals.days[key] || {}) + vitals.moments.length,
  () => {
    savedNote.value = 'saved ✓'
    if (clearTimer !== null) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      savedNote.value = ''
      clearTimer = null
    }, 1400)
  },
)
</script>

<style scoped>
.log__saved {
  font-family: var(--font-hud);
  font-size: 7px;
  letter-spacing: 0.1em;
  color: var(--mint);
  min-width: 46px;
  text-align: right;
}

.log__cardtitle {
  margin-bottom: 9px;
}

.log__moods {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
}

.log__mood {
  padding: 7px 0;
  border: 2px solid rgba(74, 43, 61, 0.35);
  border-radius: 10px;
  background: transparent;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  filter: grayscale(0.7);
  transition:
    filter 0.16s ease,
    background-color 0.16s ease;
}

.log__mood--on {
  border-color: var(--plum);
  background: var(--cotton);
  filter: none;
}

.log__mood:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 2px;
}

.log__metric {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.log__metric-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log__metric-icon {
  font-size: 16px;
  line-height: 1;
}

.log__metric-name {
  display: flex;
  flex-direction: column;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--plum);
}

.log__metric-name small {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.62rem;
  color: rgba(74, 43, 61, 0.6);
}

.log__goal {
  margin: 0;
  text-align: right;
  font-size: 0.62rem;
  color: rgba(74, 43, 61, 0.6);
}

.log__note {
  resize: none;
}

.log__icons {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  margin-bottom: 9px;
}

.log__icon {
  padding: 5px 0;
  border: 2px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  filter: grayscale(0.7);
}

.log__icon--on {
  border-color: var(--plum);
  background: var(--cotton);
  filter: none;
}

.log__icon:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 1px;
}

.log__momentform {
  display: flex;
  gap: 7px;
}

.log__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.log__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
}

.log__item-text {
  flex: 1;
  min-width: 0;
  font-size: 0.74rem;
  line-height: 1.35;
}

.log__remove {
  flex: none;
  width: 22px;
  height: 22px;
  border: 2px solid rgba(74, 43, 61, 0.4);
  border-radius: 50%;
  background: transparent;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
  color: rgba(74, 43, 61, 0.65);
  cursor: pointer;
}

.log__remove:hover {
  background: var(--cotton);
  color: var(--plum);
}

.log__remove:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .log__mood {
    transition: none;
  }
}
</style>
