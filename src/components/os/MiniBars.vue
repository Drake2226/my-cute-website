<template>
  <!-- A seven-day glance, not a chart: no axis, no numbers, no hover. The card
       around it carries the value and the label, and Trends carries the real
       chart. Plain flex boxes rather than SVG because at 26px tall the geometry
       is one rule. -->
  <div class="mini" role="img" :aria-label="summary">
    <span
      v-for="point in series"
      :key="point.key"
      class="mini__bar"
      :class="{ 'mini__bar--empty': point.value <= 0, 'mini__bar--today': point.today }"
      :style="{ height: barHeight(point.value), background: point.value > 0 ? color : undefined }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, required: true },
  color: { type: String, default: 'var(--chart-crush)' },
  label: { type: String, default: '' },
})

const peak = computed(() => Math.max(1, ...props.series.map((point) => point.value)))

function barHeight(value) {
  if (value <= 0) return '3px'
  return `${Math.max(14, (value / peak.value) * 100)}%`
}

const summary = computed(() => {
  const values = props.series.map((point) => point.value)
  return `${props.label} over the last ${values.length} days: ${values.join(', ')}`
})
</script>

<style scoped>
.mini {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 26px;
}

.mini__bar {
  flex: 1;
  min-width: 0;
  border-radius: 3px 3px 0 0;
  background: rgba(74, 43, 61, 0.2);
}

.mini__bar--empty {
  border-radius: 2px;
}

.mini__bar--today {
  outline: 2px solid var(--plum);
  outline-offset: 1px;
}
</style>
