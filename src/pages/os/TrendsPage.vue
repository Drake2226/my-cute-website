<template>
  <div class="scene os-scene">
    <header class="os-head">
      <div>
        <h1 class="os-title">Trends</h1>
        <p class="os-note">{{ metric.blurb }}</p>
      </div>
    </header>

    <!-- Both filters in one row above the chart, so the thing being changed is
         never below the thing that changes. -->
    <div class="chiprow">
      <button
        v-for="option in METRICS"
        :key="option.key"
        type="button"
        class="chip"
        :class="{ 'chip--on': option.key === metricKey }"
        :aria-pressed="option.key === metricKey"
        @click="metricKey = option.key"
      >
        {{ option.icon }} {{ option.label }}
      </button>
    </div>

    <div class="chiprow trends__ranges">
      <button
        v-for="option in RANGES"
        :key="option.days"
        type="button"
        class="chip"
        :class="{ 'chip--on': option.days === range }"
        :aria-pressed="option.days === range"
        @click="range = option.days"
      >
        {{ option.label }}
      </button>
    </div>

    <section class="card">
      <h2 class="trends__title">
        <span class="trends__swatch" :style="{ background: metric.color }" aria-hidden="true" />
        {{ metric.icon }} {{ metric.label }}
      </h2>
      <p class="trends__lead">
        {{ average || '—' }}<span v-if="metric.unit">{{ metric.unit }}</span>
        <small>average over {{ range }} days</small>
      </p>

      <BarChart
        :series="series"
        :color="metric.color"
        :unit="metric.unit"
        :goal="metric.goal"
        :label="metric.label"
      />

      <p class="trends__legend">
        <span class="trends__dash" aria-hidden="true" />
        daily goal · {{ metric.goal }}{{ metric.unit }}
      </p>
    </section>

    <div class="grid-2">
      <div class="card trends__stat">
        <span class="trends__stat-label">BEST DAY</span>
        <span class="trends__stat-value">{{ best || '—' }}{{ best ? metric.unit : '' }}</span>
      </div>
      <div class="card trends__stat">
        <span class="trends__stat-label">TOTAL</span>
        <span class="trends__stat-value">{{ total || '—' }}</span>
      </div>
      <div class="card trends__stat">
        <span class="trends__stat-label">DAYS LOGGED</span>
        <span class="trends__stat-value">{{ logged }}/{{ range }}</span>
      </div>
      <div class="card trends__stat">
        <span class="trends__stat-label">GOAL MET</span>
        <span class="trends__stat-value">{{ metGoal }}×</span>
      </div>
    </div>

    <p v-if="!logged" class="emptynote">
      No readings in this window yet. Log a day or two and the chart will have something to say.
    </p>

    <section class="section">
      <h2 class="section__title">
        <span>THE NUMBERS</span>
        <button type="button" class="section__more trends__toggle" @click="showTable = !showTable">
          {{ showTable ? 'HIDE ›' : 'SHOW ›' }}
        </button>
      </h2>

      <!-- The chart is a picture; this is the same data as text, for anyone the
           picture does not work for. -->
      <div v-if="showTable" class="card trends__tablewrap">
        <table class="trends__table">
          <caption class="trends__caption">
            {{
              tableCaption
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{{ metric.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in reversedSeries" :key="point.key">
              <th scope="row">{{ point.full }}</th>
              <td>{{ point.value > 0 ? `${point.value}${metric.unit}` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BarChart from '@/components/os/BarChart.vue'
import { METRICS, METRIC_BY_KEY, averageOf, seriesFor, totalOf } from '@/lib/vitals.js'

const RANGES = [
  { days: 7, label: '7 DAYS' },
  { days: 30, label: '30 DAYS' },
]

const route = useRoute()
const router = useRouter()

// The summary cards deep-link here with ?metric=…, so the query is the source
// of truth and the chips write back to it: a tapped chip survives a reload and
// the back button steps through the metrics she looked at.
const metricKey = computed({
  get: () => (METRIC_BY_KEY[route.query.metric] ? route.query.metric : METRICS[0].key),
  set: (value) => router.replace({ query: { ...route.query, metric: value } }),
})

const range = ref(RANGES[0].days)
const showTable = ref(false)

const metric = computed(() => METRIC_BY_KEY[metricKey.value])
const series = computed(() => seriesFor(metricKey.value, range.value))
const values = computed(() => series.value.map((point) => point.value))

const average = computed(() => averageOf(values.value))
const best = computed(() => Math.max(0, ...values.value))
const total = computed(() => totalOf(values.value))
const logged = computed(() => values.value.filter((value) => value > 0).length)
const metGoal = computed(() => values.value.filter((value) => value >= metric.value.goal).length)

// Newest first reads better as a list even though the chart runs oldest to
// newest — a table is scanned from the top, a chart from the left.
const reversedSeries = computed(() => [...series.value].reverse())

const tableCaption = computed(() => `${metric.value.label} over the last ${range.value} days`)

// A 30-day table is a long scroll to leave open while switching metrics.
watch(range, () => {
  if (range.value > 7) showTable.value = false
})
</script>

<style scoped>
.trends__ranges {
  margin-top: -5px;
}

.trends__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--plum);
}

.trends__swatch {
  width: 10px;
  height: 10px;
  border: 2px solid var(--plum);
  border-radius: 3px;
}

.trends__lead {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin: 4px 0 12px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.9rem;
  line-height: 1;
  color: var(--plum);
}

.trends__lead small {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.62rem;
  color: rgba(74, 43, 61, 0.6);
}

.trends__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 0.62rem;
  color: rgba(74, 43, 61, 0.6);
}

.trends__dash {
  width: 18px;
  height: 0;
  border-top: 2px dashed rgba(74, 43, 61, 0.5);
}

.trends__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 11px;
}

.trends__stat-label {
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.1em;
  color: rgba(74, 43, 61, 0.6);
}

.trends__stat-value {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--plum);
}

.trends__toggle {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.trends__toggle:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 2px;
}

.trends__tablewrap {
  padding: 4px 10px 8px;
}

.trends__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.68rem;
}

.trends__caption {
  padding: 8px 0 6px;
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.1em;
  color: rgba(74, 43, 61, 0.55);
  text-align: left;
}

.trends__table th,
.trends__table td {
  padding: 5px 0;
  border-bottom: 1px solid rgba(74, 43, 61, 0.14);
  text-align: left;
  font-weight: 400;
  color: rgba(74, 43, 61, 0.85);
}

.trends__table thead th {
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.08em;
  color: rgba(74, 43, 61, 0.55);
}

.trends__table td {
  text-align: right;
  font-family: var(--font-hud);
  font-size: 8px;
}
</style>
