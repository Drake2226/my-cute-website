<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to || undefined"
    class="card statcard"
    :class="{ 'statcard--link': Boolean(to) }"
  >
    <div class="statcard__head">
      <span class="statcard__icon" aria-hidden="true">{{ metric.icon }}</span>
      <span class="statcard__label">{{ metric.label }}</span>
      <span v-if="to" class="statcard__chev" aria-hidden="true">›</span>
    </div>

    <p class="statcard__value">
      {{ display }}<span v-if="metric.unit" class="statcard__unit">{{ metric.unit }}</span>
    </p>

    <MiniBars :series="series" :color="metric.color" :label="metric.label" />

    <p class="statcard__foot">{{ foot }}</p>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import MiniBars from './MiniBars.vue'

const props = defineProps({
  metric: { type: Object, required: true },
  series: { type: Array, required: true },
  to: { type: String, default: '' },
})

// Today is the last point in the series — the summary is always about now, and
// the bars behind it are the week that led here.
const today = computed(() => props.series[props.series.length - 1]?.value ?? 0)

const display = computed(() => (today.value > 0 ? today.value : '—'))

const foot = computed(() => {
  const week = props.series.filter((point) => point.value > 0)
  if (!week.length) return 'no readings yet'
  const average = Math.round(week.reduce((sum, point) => sum + point.value, 0) / week.length)
  return `7-day average ${average}${props.metric.unit}`
})
</script>

<style scoped>
.statcard {
  display: block;
  text-decoration: none;
  color: inherit;
}

.statcard--link {
  cursor: pointer;
}

.statcard--link:hover {
  background: #fffdf8;
  transform: translateY(-2px);
}

.statcard__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.statcard__icon {
  font-size: 13px;
  line-height: 1;
}

.statcard__label {
  flex: 1;
  min-width: 0;
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.1em;
  color: rgba(74, 43, 61, 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statcard__chev {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(74, 43, 61, 0.45);
}

.statcard__value {
  margin: 6px 0 8px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 1;
  color: var(--plum);
}

.statcard__unit {
  margin-left: 2px;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(74, 43, 61, 0.6);
}

.statcard__foot {
  margin: 7px 0 0;
  font-size: 0.62rem;
  color: rgba(74, 43, 61, 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .statcard--link:hover {
    transform: none;
  }
}
</style>
