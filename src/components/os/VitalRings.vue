<template>
  <div class="rings">
    <svg class="rings__svg" viewBox="0 0 150 150" role="img" :aria-label="summary">
      <g transform="rotate(-90 75 75)">
        <template v-for="(ring, i) in rings" :key="ring.key">
          <!-- Track first, arc second: the arc has to sit on top of its own
               track, and one <g> per ring would cost a stacking context each. -->
          <circle
            class="rings__track"
            :cx="75"
            :cy="75"
            :r="radius(i)"
            :stroke-width="THICKNESS"
            fill="none"
          />
          <circle
            class="rings__arc"
            :cx="75"
            :cy="75"
            :r="radius(i)"
            :stroke="ring.color"
            :stroke-width="THICKNESS"
            :stroke-dasharray="circumference(i)"
            :stroke-dashoffset="circumference(i) * (1 - ring.progress)"
            stroke-linecap="round"
            fill="none"
          />
        </template>
      </g>
      <text class="rings__heart" x="75" y="75" text-anchor="middle" dominant-baseline="central">
        {{ allClosed ? '💖' : '🤍' }}
      </text>
    </svg>

    <!-- Three arcs is three series, so the legend is not optional: it is the
         only thing naming which ring is which without relying on colour. -->
    <ul class="rings__legend">
      <li v-for="ring in rings" :key="ring.key" class="rings__item">
        <span class="rings__swatch" :style="{ background: ring.color }" aria-hidden="true" />
        <span class="rings__name">{{ ring.icon }} {{ ring.label }}</span>
        <span class="rings__value"
          >{{ ring.value }}<span v-if="ring.unit">{{ ring.unit }}</span
          ><span class="rings__goal"> / {{ ring.goal }}</span></span
        >
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rings: { type: Array, required: true },
})

const THICKNESS = 11
const OUTER = 58
const GAP = 15

function radius(index) {
  return OUTER - index * GAP
}

function circumference(index) {
  return 2 * Math.PI * radius(index)
}

const allClosed = computed(() => props.rings.every((ring) => ring.progress >= 1))

const summary = computed(() =>
  props.rings.map((ring) => `${ring.label} ${ring.value} of ${ring.goal}`).join(', '),
)
</script>

<style scoped>
.rings {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rings__svg {
  flex: none;
  width: 128px;
  height: 128px;
}

.rings__track {
  stroke: rgba(74, 43, 61, 0.13);
}

.rings__arc {
  transition: stroke-dashoffset 0.6s cubic-bezier(0.34, 1.2, 0.64, 1);
}

.rings__heart {
  font-size: 19px;
}

.rings__legend {
  flex: 1;
  min-width: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.rings__item {
  display: grid;
  grid-template-columns: 10px 1fr;
  align-items: center;
  gap: 7px;
  font-size: 0.72rem;
  line-height: 1.25;
}

.rings__swatch {
  width: 10px;
  height: 10px;
  border: 2px solid var(--plum);
  border-radius: 3px;
  grid-row: span 2;
}

.rings__name {
  font-weight: 700;
  color: var(--plum);
  /* Wrapping, not truncating. On a 360px phone the ellipsis was eating the
     labels down to "Crush Lev…" and "Time Toge…", which is the one thing this
     legend exists to say. */
  line-height: 1.2;
}

.rings__value {
  grid-column: 2;
  font-family: var(--font-hud);
  font-size: 9px;
  color: rgba(74, 43, 61, 0.85);
  /* "70bpm / 120" is one reading and must not break across two lines. */
  white-space: nowrap;
}

.rings__goal {
  opacity: 0.5;
}

/* Narrow phones need the pixels for the words more than for the rings. */
@media (max-width: 380px) {
  .rings {
    gap: 10px;
  }

  .rings__svg {
    width: 104px;
    height: 104px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rings__arc {
    transition: none;
  }
}
</style>
