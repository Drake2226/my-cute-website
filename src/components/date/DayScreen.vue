<template>
  <div class="scene day">
    <DriftingHearts :count="8" :glyphs="['🌸', '✨']" />

    <div class="day__head">
      <p class="eyebrow">SLOT SELECTION</p>
      <h1 class="headline day__headline">Pick our day</h1>
      <p class="subline">Any day works. I already cleared my schedule.</p>
    </div>

    <div class="day__card">
      <q-date
        v-model="selected"
        class="retro-cal"
        minimal
        flat
        color="primary"
        text-color="white"
        :options="allowed"
      />
    </div>

    <div class="day__foot">
      <p class="day__ticket" :class="{ 'day__ticket--empty': !selected }">
        {{ selected ? dateLabel : 'no day picked yet' }}
      </p>

      <button class="btn btn--yes" :disabled="!selected" @click="confirm">Confirm the day →</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { date } from 'quasar'
import DriftingHearts from './DriftingHearts.vue'

const emit = defineEmits(['pick'])

// QDate hands the options callback a 'YYYY/MM/DD' string, so the model uses the
// same mask and today can be compared as plain text.
const today = date.formatDate(new Date(), 'YYYY/MM/DD')
const selected = ref(null)

function allowed(day) {
  return day >= today
}

const asDate = computed(() =>
  selected.value ? date.extractDate(selected.value, 'YYYY/MM/DD') : null,
)

const dateLabel = computed(() =>
  asDate.value ? date.formatDate(asDate.value, 'dddd, MMMM D, YYYY') : '',
)

function confirm() {
  if (!asDate.value) return
  emit('pick', {
    dateIso: date.formatDate(asDate.value, 'YYYY-MM-DD'),
    dateLabel: dateLabel.value,
  })
}
</script>

<style scoped>
.day {
  z-index: 1;
  justify-content: center;
  gap: 12px;
}

.day__head,
.day__card,
.day__foot {
  position: relative;
  z-index: 1;
}

.day__headline {
  font-size: clamp(1.5rem, 6.6vw, 1.9rem);
}

.day__card {
  border: var(--ink);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 4px 4px 0 rgba(74, 43, 61, 0.2);
  padding: 8px 6px;
}

.day__foot {
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.day__ticket {
  margin: 0;
  font-family: var(--font-hud);
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-align: center;
  line-height: 1.7;
  color: var(--plum);
}

.day__ticket--empty {
  color: rgba(74, 43, 61, 0.4);
}
</style>
