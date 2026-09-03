<template>
  <div class="scene vibe">
    <DriftingHearts :count="8" :glyphs="['💗', '✨']" />

    <div class="vibe__head">
      <p class="eyebrow">CHOOSE YOUR ADVENTURE</p>
      <h1 class="headline vibe__headline">What are we doing?</h1>
      <p class="vibe__day">{{ dateLabel }}</p>
    </div>

    <div class="vibe__grid">
      <button v-for="option in OPTIONS" :key="option.label" class="tile" @click="choose(option)">
        <span class="tile__icon" aria-hidden="true">{{ option.icon }}</span>
        <span class="tile__label">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import DriftingHearts from './DriftingHearts.vue'

defineProps({
  dateLabel: { type: String, required: true },
})

const emit = defineEmits(['done'])

// `spot` is the category the map level searches for around her. The three with
// no category are the ones you pick a point for yourself — a picnic spot, a
// trail, a place worth driving to — so they hand the map a blank pin instead.
const OPTIONS = [
  { icon: '🎬', label: 'Movie Night', spot: 'cinema' },
  { icon: '🍝', label: 'Dinner Date', spot: 'restaurant' },
  { icon: '☕', label: 'Coffee & Chill', spot: 'cafe' },
  { icon: '💻', label: 'Work Date', spot: 'study' },
  { icon: '🌅', label: 'Sunset Picnic', spot: '' },
  { icon: '🎢', label: 'Amusement Park', spot: 'themepark' },
  { icon: '🛍️', label: 'Mall Day', spot: 'mall' },
  { icon: '🎨', label: 'Paint & Sip', spot: 'art' },
  { icon: '🥾', label: 'Nature Walk', spot: '' },
  { icon: '⛪', label: 'Church Date', spot: 'worship' },
  { icon: '🏨', label: 'Quality Time', spot: 'hotel' },
  { icon: '🚗', label: 'Road Trip', spot: '' },
  { icon: '🏠', label: 'Cozy Night In', spot: 'snacks' },
]

function choose(option) {
  emit('done', { dateType: option.label, icon: option.icon, category: option.spot })
}
</script>

<style scoped>
.vibe {
  z-index: 1;
  gap: 8px;
}

.vibe__head,
.vibe__grid {
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
  /* Seven rows of tiles have to clear the screen without it scrolling, so the
     rows are shorter than the tiles want to be and stretch into what is left. */
  grid-auto-rows: minmax(56px, 1fr);
  gap: 5px;
}

/* Thirteen tiles is an odd number, so the last one would sit alone in a
   half-empty row. It takes the whole row instead — a deliberate-looking end to
   the grid rather than a gap that reads as a missing option. */
.vibe__grid .tile:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
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

.tile__icon {
  font-size: 1.35rem;
  line-height: 1;
}

.tile__label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.15;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .tile:hover:not(:disabled) {
    transform: none;
  }
}
</style>
