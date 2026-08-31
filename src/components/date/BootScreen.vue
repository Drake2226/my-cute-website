<template>
  <div class="scene boot">
    <div class="boot__center">
      <!-- A pixel heart that fills from the tip up while the machine boots. -->
      <div class="pixelheart" :aria-label="ready ? 'Ready' : 'Loading'" role="img">
        <span
          v-for="cell in cells"
          :key="cell.id"
          class="pixelheart__px"
          :class="{
            'pixelheart__px--off': !cell.solid,
            'pixelheart__px--lit': cell.solid && cell.row >= rows - filled,
          }"
        />
      </div>

      <div class="boot__bar">
        <div class="boot__fill" :style="{ width: `${(filled / rows) * 100}%` }" />
      </div>

      <p class="boot__status">
        {{ ready ? 'READY' : status }}<span v-if="!ready" class="blink">_</span>
      </p>
    </div>

    <div class="boot__foot">
      <button v-if="ready" class="btn btn--yes boot__start" @click="$emit('start')">
        PRESS START
      </button>
      <p v-else class="boot__hint">powering up the love machine</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineEmits(['start'])

// 11 x 10 pixel heart. 1 = plastic, 0 = empty.
const BITMAP = [
  '01100000110',
  '11110001111',
  '11111011111',
  '11111111111',
  '11111111111',
  '01111111110',
  '00111111100',
  '00011111000',
  '00001110000',
  '00000100000',
]

const rows = BITMAP.length
const filled = ref(0)
const ready = ref(false)

const MESSAGES = [
  'LOADING SOMETHING SPECIAL',
  'GATHERING BUTTERFLIES',
  'POLISHING THE PIXELS',
  'CHECKING IF SHE IS CUTE',
]
const status = ref(MESSAGES[0])

const cells = computed(() =>
  BITMAP.flatMap((line, row) =>
    line.split('').map((bit, col) => ({
      id: `${row}-${col}`,
      row,
      solid: bit === '1',
    })),
  ),
)

let fillTimer
let msgTimer

onMounted(() => {
  let msgIndex = 0

  fillTimer = setInterval(() => {
    filled.value += 1
    if (filled.value >= rows) {
      clearInterval(fillTimer)
      clearInterval(msgTimer)
      ready.value = true
    }
  }, 230)

  msgTimer = setInterval(() => {
    msgIndex = (msgIndex + 1) % MESSAGES.length
    status.value = MESSAGES[msgIndex]
  }, 780)
})

onBeforeUnmount(() => {
  clearInterval(fillTimer)
  clearInterval(msgTimer)
})
</script>

<style scoped>
.boot {
  justify-content: center;
  align-items: center;
  gap: 26px;
  text-align: center;
}

.boot__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.pixelheart {
  display: grid;
  grid-template-columns: repeat(11, 12px);
  gap: 2px;
}

.pixelheart__px {
  width: 12px;
  height: 12px;
  background: rgba(255, 194, 221, 0.35);
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.pixelheart__px--off {
  background: transparent;
}

.pixelheart__px--lit {
  background: var(--bubblegum);
  box-shadow: 0 0 8px rgba(255, 95, 162, 0.5);
}

.boot__bar {
  width: 176px;
  height: 14px;
  border: 3px solid var(--plum);
  background: var(--cream);
  padding: 2px;
}

.boot__fill {
  height: 100%;
  background: var(--mint);
  transition: width 0.23s linear;
}

.boot__status {
  margin: 0;
  font-family: var(--font-hud);
  font-size: 7.5px;
  letter-spacing: 0.14em;
  color: rgba(74, 43, 61, 0.8);
}

.boot__foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 26px;
  display: flex;
  justify-content: center;
}

.boot__start {
  font-family: var(--font-hud);
  font-size: 11px;
  padding: 15px 22px;
  animation: start-throb 1.4s ease-in-out infinite;
}

.boot__hint {
  margin: 0;
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(74, 43, 61, 0.5);
}

@keyframes start-throb {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot__start {
    animation: none;
  }
}
</style>
