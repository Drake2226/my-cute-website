<template>
  <div class="chart" @pointerleave="hover = -1">
    <svg
      class="chart__svg"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="summary"
    >
      <!-- Baseline and the goal line are the only rules on the plot. Anything
           more and a 300px-wide chart is mostly furniture. -->
      <line class="chart__base" :x1="0" :y1="PLOT_H" :x2="VIEW_W" :y2="PLOT_H" />

      <line
        v-if="goalY !== null"
        class="chart__goal"
        :x1="0"
        :y1="goalY"
        :x2="VIEW_W"
        :y2="goalY"
      />

      <g v-for="bar in bars" :key="bar.key">
        <!-- A day with no reading gets a stub on the baseline, so a gap reads
             as "nothing logged" instead of a chart that failed to draw. -->
        <rect
          v-if="bar.empty"
          class="chart__empty"
          :x="bar.x"
          :y="PLOT_H - 2"
          :width="bar.width"
          height="2"
        />
        <path
          v-else
          class="chart__bar"
          :class="{ 'chart__bar--dim': hover !== -1 && hover !== bar.index }"
          :d="bar.path"
          :fill="color"
        />
        <rect
          class="chart__hit"
          :x="bar.x - 1"
          :y="0"
          :width="bar.width + 2"
          :height="PLOT_H"
          @pointerenter="hover = bar.index"
          @pointerdown="hover = bar.index"
        />
      </g>
    </svg>

    <p class="chart__labels" aria-hidden="true">
      <span
        v-for="bar in bars"
        :key="bar.key"
        class="chart__label"
        :style="{ left: bar.centerPct }"
      >
        {{ bar.showLabel ? bar.label : '' }}
      </span>
    </p>

    <!-- The tooltip is the reason the bars carry no printed numbers: a value on
         every bar at this width is a wall of digits. -->
    <div v-if="hovered" class="chart__tip" :style="{ left: hovered.centerPct }" role="status">
      <span class="chart__tip-day">{{ hovered.full }}</span>
      <span class="chart__tip-value">{{ hovered.value }}{{ unit }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  series: { type: Array, required: true },
  color: { type: String, default: 'var(--chart-crush)' },
  unit: { type: String, default: '' },
  // Drawn as a dashed rule when it fits inside the plotted range.
  goal: { type: Number, default: 0 },
  label: { type: String, default: '' },
})

// A fixed viewBox scaled to the container: the console is only ever a few
// hundred pixels wide, so there is nothing to gain from measuring it.
const VIEW_W = 320
const PLOT_H = 96
const VIEW_H = PLOT_H + 2

const hover = ref(-1)

const peak = computed(() => {
  const highest = Math.max(0, ...props.series.map((point) => point.value))
  // An all-zero week would divide by zero; a lone small value would otherwise
  // fill the whole plot and read as a record day.
  return Math.max(highest, props.goal || 0, 1)
})

const bars = computed(() => {
  const count = props.series.length || 1
  const slot = VIEW_W / count
  // 2px of surface between neighbours, and no bar so wide it reads as a block.
  const width = Math.min(slot - 2, 26)

  return props.series.map((point, index) => {
    const x = index * slot + (slot - width) / 2
    const height = (point.value / peak.value) * (PLOT_H - 6)
    const y = PLOT_H - height
    const r = Math.min(4, width / 2, height)

    return {
      ...point,
      index,
      x,
      width,
      empty: point.value <= 0,
      // Rounded at the data end only — the baseline end stays square so the
      // bar sits on the axis instead of floating above it.
      path: `M${x} ${PLOT_H} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + width - r} Q${
        x + width
      } ${y} ${x + width} ${y + r} V${PLOT_H} Z`,
      centerPct: `${((x + width / 2) / VIEW_W) * 100}%`,
      showLabel: count <= 10 || index % 5 === 0 || index === count - 1,
    }
  })
})

const goalY = computed(() => {
  if (!props.goal) return null
  const y = PLOT_H - (props.goal / peak.value) * (PLOT_H - 6)
  return y > 2 && y < PLOT_H - 2 ? y : null
})

const hovered = computed(() => bars.value[hover.value] || null)

const summary = computed(() => {
  const parts = props.series.map((point) => `${point.full}: ${point.value}${props.unit}`)
  return `${props.label} — ${parts.join('. ')}`
})
</script>

<style scoped>
.chart {
  position: relative;
  padding-bottom: 16px;
}

.chart__svg {
  display: block;
  width: 100%;
  height: 98px;
  overflow: visible;
}

.chart__base {
  stroke: rgba(74, 43, 61, 0.35);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.chart__goal {
  stroke: rgba(74, 43, 61, 0.4);
  stroke-width: 2;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}

.chart__bar {
  transition: opacity 0.15s ease;
}

.chart__bar--dim {
  opacity: 0.45;
}

.chart__empty {
  fill: rgba(74, 43, 61, 0.22);
}

.chart__hit {
  fill: transparent;
  cursor: pointer;
}

.chart__labels {
  position: relative;
  height: 12px;
  margin: 4px 0 0;
}

.chart__label {
  position: absolute;
  transform: translateX(-50%);
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.02em;
  color: rgba(74, 43, 61, 0.55);
  white-space: nowrap;
}

.chart__tip {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 8px;
  border: 2px solid var(--plum);
  border-radius: 8px;
  background: var(--cream);
  box-shadow: 3px 3px 0 rgba(74, 43, 61, 0.25);
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;
}

.chart__tip-day {
  font-size: 0.6rem;
  color: rgba(74, 43, 61, 0.7);
}

.chart__tip-value {
  font-family: var(--font-hud);
  font-size: 9px;
  color: var(--plum);
}

@media (prefers-reduced-motion: reduce) {
  .chart__bar {
    transition: none;
  }
}
</style>
