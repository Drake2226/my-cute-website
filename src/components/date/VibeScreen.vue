<template>
  <div class="scene vibe">
    <DriftingHearts :count="8" :glyphs="['💗', '✨']" />

    <div class="vibe__head">
      <p class="eyebrow">CHOOSE YOUR ADVENTURE</p>
      <h1 class="headline vibe__headline">What are we doing?</h1>
      <p class="vibe__day">{{ dateLabel }}</p>
    </div>

    <div class="vibe__grid">
      <button
        v-for="option in OPTIONS"
        :key="option.label"
        class="tile"
        :class="{ 'tile--busy': sending === option.label }"
        :disabled="sending !== null"
        @click="choose(option)"
      >
        <span class="tile__icon" aria-hidden="true">{{ option.icon }}</span>
        <span class="tile__label">{{ option.label }}</span>
        <span v-if="sending === option.label" class="tile__status">SENDING…</span>
      </button>
    </div>

    <p v-if="error" class="vibe__error" role="alert">
      That did not send. Tap your pick again to try once more.
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DriftingHearts from './DriftingHearts.vue'
import { sendAnswer } from '@/config.js'

const props = defineProps({
  dateLabel: { type: String, required: true },
  dateIso: { type: String, required: true },
})

const emit = defineEmits(['done'])

const OPTIONS = [
  { icon: '🎬', label: 'Movie Night' },
  { icon: '🍝', label: 'Dinner Date' },
  { icon: '☕', label: 'Coffee & Chill' },
  { icon: '🌅', label: 'Sunset Picnic' },
  { icon: '🎢', label: 'Amusement Park' },
  { icon: '🎨', label: 'Paint & Sip' },
  { icon: '🥾', label: 'Nature Walk' },
  { icon: '🏠', label: 'Cozy Night In' },
]

const sending = ref(null)
const error = ref(false)

async function choose(option) {
  sending.value = option.label
  error.value = false

  try {
    await sendAnswer({
      dateLabel: props.dateLabel,
      dateIso: props.dateIso,
      dateType: option.label,
      dateIcon: option.icon,
    })
    emit('done', { dateType: option.label, icon: option.icon })
  } catch (err) {
    console.error('[love-machine] Could not send the answer:', err)
    error.value = true
    sending.value = null
  }
}
</script>

<style scoped>
.vibe {
  z-index: 1;
  gap: 14px;
}

.vibe__head,
.vibe__grid,
.vibe__error {
  position: relative;
  z-index: 1;
}

.vibe__headline {
  font-size: clamp(1.45rem, 6.4vw, 1.85rem);
}

.vibe__day {
  margin: 8px 0 0;
  font-family: var(--font-hud);
  font-size: 7px;
  letter-spacing: 0.1em;
  text-align: center;
  line-height: 1.7;
  color: rgba(74, 43, 61, 0.65);
}

/* The tiles stretch to fill whatever the screen has left, so the grid is the
   level rather than a block floating above dead space. */
.vibe__grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(76px, 1fr);
  gap: 10px;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 13px 6px;
  border: var(--ink);
  border-radius: 14px;
  background: var(--cream);
  color: var(--plum);
  cursor: pointer;
  box-shadow: 0 4px 0 var(--plum);
  transition:
    transform 0.14s ease,
    box-shadow 0.14s ease,
    background-color 0.2s ease;
}

.tile:hover:not(:disabled) {
  background: var(--cotton);
  transform: translateY(-3px);
  box-shadow: 0 7px 0 var(--plum);
}

.tile:active:not(:disabled) {
  transform: translateY(4px);
  box-shadow: 0 0 0 var(--plum);
}

.tile:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 3px;
}

.tile:disabled {
  cursor: default;
  opacity: 0.45;
}

.tile--busy {
  opacity: 1;
  background: var(--cotton);
}

.tile__icon {
  font-size: 1.5rem;
  line-height: 1;
}

.tile__label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.86rem;
  line-height: 1.15;
  text-align: center;
}

.tile__status {
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.1em;
  color: var(--bubblegum);
}

.vibe__error {
  margin: 2px 0 0;
  font-size: 0.75rem;
  text-align: center;
  color: var(--bubblegum);
}

@media (prefers-reduced-motion: reduce) {
  .tile:hover:not(:disabled) {
    transform: none;
  }
}
</style>
