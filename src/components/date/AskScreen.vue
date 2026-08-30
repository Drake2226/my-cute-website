<template>
  <div class="scene ask">
    <DriftingHearts :count="14" />

    <div class="ask__head">
      <p class="eyebrow">PLAYER 2 REQUIRED</p>
      <h1 class="headline">Will you go on a date with me?</h1>
      <p class="ask__taunt" :key="taunt">{{ taunt }}</p>
    </div>

    <div ref="field" class="ask__field">
      <div class="ask__row">
        <button
          ref="yesBtn"
          class="btn btn--yes ask__yes"
          :style="{ transform: `scale(${yesScale})` }"
          @click="$emit('yes')"
        >
          Yes 💗
        </button>

        <button
          ref="noBtn"
          class="btn ask__no"
          :style="noStyle"
          @pointerenter="dodge"
          @click.prevent="dodge"
        >
          {{ noLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import DriftingHearts from './DriftingHearts.vue'

defineEmits(['yes'])

const field = ref(null)
const yesBtn = ref(null)
const noBtn = ref(null)

const dodges = ref(0)
const noStyle = ref({})

const TAUNTS = [
  'choose wisely — there is only one right answer',
  'the No button is feeling shy',
  'it moved. that counts as a yes, right?',
  'you cannot catch it. nobody can.',
  'the No button has left the building',
  'it is getting smaller. so is your resistance.',
  'seriously, just press the pink one 🥺',
]

const taunt = computed(() => TAUNTS[Math.min(dodges.value, TAUNTS.length - 1)])
const yesScale = computed(() => Math.min(1 + dodges.value * 0.13, 1.85))
const noLabel = computed(() => (dodges.value >= 5 ? '…fine' : 'No'))

// Overlap test in field-local coordinates, with a little breathing room so the
// No button never lands on top of the (growing) Yes button.
function hitsYes(x, y, box, fieldRect) {
  const yes = yesBtn.value?.getBoundingClientRect()
  if (!yes) return false

  const pad = 14
  const yl = yes.left - fieldRect.left - pad
  const yt = yes.top - fieldRect.top - pad
  const yr = yes.right - fieldRect.left + pad
  const yb = yes.bottom - fieldRect.top + pad

  return x < yr && x + box.width > yl && y < yb && y + box.height > yt
}

function dodge() {
  const fieldEl = field.value
  const btn = noBtn.value
  if (!fieldEl || !btn) return

  const fieldRect = fieldEl.getBoundingClientRect()
  const box = btn.getBoundingClientRect()

  const maxX = Math.max(0, fieldRect.width - box.width - 8)
  const maxY = Math.max(0, fieldRect.height - box.height - 8)

  let x = 4
  let y = 4
  for (let tries = 0; tries < 14; tries++) {
    x = 4 + Math.random() * maxX
    y = 4 + Math.random() * maxY
    if (!hitsYes(x, y, box, fieldRect)) break
  }

  dodges.value += 1
  noStyle.value = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: `rotate(${(Math.random() - 0.5) * 18}deg) scale(${Math.max(
      0.55,
      1 - dodges.value * 0.07,
    )})`,
  }
}
</script>

<style scoped>
.ask {
  z-index: 1;
}

.ask__head,
.ask__field {
  position: relative;
  z-index: 1;
}

.ask__taunt {
  margin: 12px 0 0;
  font-size: 0.76rem;
  font-style: italic;
  text-align: center;
  color: rgba(74, 43, 61, 0.6);
  animation: taunt-in 0.3s ease;
}

.ask__field {
  flex: 1;
  min-height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ask__row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ask__yes {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.12s ease;
}

.ask__yes:hover {
  box-shadow: 0 7px 0 var(--plum);
}

.ask__no {
  transition:
    left 0.18s cubic-bezier(0.4, 1.5, 0.6, 1),
    top 0.18s cubic-bezier(0.4, 1.5, 0.6, 1),
    transform 0.18s ease;
}

@keyframes taunt-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* The Yes button still grows; only the springy travel is toned down. */
@media (prefers-reduced-motion: reduce) {
  .ask__no,
  .ask__yes {
    transition-duration: 0.01s;
  }

  .ask__taunt {
    animation: none;
  }
}
</style>
