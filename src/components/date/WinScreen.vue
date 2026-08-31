<template>
  <div class="scene win">
    <div class="confetti" aria-hidden="true">
      <span v-for="bit in confetti" :key="bit.id" class="confetti__bit" :style="bit.style">
        {{ bit.glyph }}
      </span>
    </div>

    <div class="win__body">
      <p class="eyebrow win__eyebrow">★ YOU WIN ★</p>

      <div class="win__heart pulse" aria-hidden="true">💖</div>

      <h1 class="headline win__headline">I love you,<br />my lovey dovey 💕</h1>

      <div class="win__ticket">
        <p class="win__ticket-row">{{ dateLabel }}</p>
        <p class="win__ticket-row win__ticket-row--big">{{ icon }} {{ dateType }}</p>
        <p v-if="place" class="win__ticket-row win__ticket-place">
          📍 {{ place.name
          }}<span v-if="place.km !== null"> · {{ formatDistance(place.km) }} away</span>
        </p>
        <p class="win__ticket-note">it's a date</p>
      </div>

      <p class="win__sign">See you soon 🥰</p>

      <p class="win__timer" role="status">BACK TO START IN {{ secondsLeft }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDistance } from '@/lib/places.js'

defineProps({
  dateLabel: { type: String, required: true },
  dateType: { type: String, required: true },
  icon: { type: String, default: '💗' },
  place: { type: Object, default: null },
})

const emit = defineEmits(['restart'])

// The console resets itself so the next person to pick it up starts at the boot
// screen instead of somebody else's answer.
const RESTART_SECONDS = 30
const secondsLeft = ref(RESTART_SECONDS)
let ticker = null

onMounted(() => {
  ticker = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) {
      clearInterval(ticker)
      ticker = null
      emit('restart')
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (ticker !== null) clearInterval(ticker)
})

const GLYPHS = ['💗', '💖', '✨', '🌸', '💕', '⭐']

const confetti = computed(() =>
  Array.from({ length: 26 }, (_, id) => {
    const duration = 3.4 + Math.random() * 3.4
    return {
      id,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      style: {
        left: `${Math.random() * 96}%`,
        fontSize: `${11 + Math.random() * 13}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${-Math.random() * duration}s`,
      },
    }
  }),
)
</script>

<style scoped>
.win {
  justify-content: center;
  overflow: hidden;
}

.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.confetti__bit {
  position: absolute;
  top: -30px;
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(660px) rotate(300deg);
    opacity: 0.9;
  }
}

.win__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

/* Gold on cream is too faint on its own, so the banner gets a plum outline. */
.win__eyebrow {
  color: var(--butter);
  font-size: 9px;
  text-shadow:
    1px 1px 0 var(--plum),
    -1px 1px 0 var(--plum),
    1px -1px 0 var(--plum),
    -1px -1px 0 var(--plum);
}

.win__heart {
  font-size: 3.6rem;
  line-height: 1;
  filter: drop-shadow(0 5px 0 rgba(74, 43, 61, 0.2));
}

.pulse {
  animation: pulse 1.25s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.16);
  }
}

.win__headline {
  margin: 0;
  font-size: clamp(1.5rem, 6.8vw, 2rem);
}

.win__ticket {
  width: 100%;
  max-width: 260px;
  padding: 12px 14px;
  border: var(--ink);
  border-radius: 12px;
  background: var(--cream);
  box-shadow: 5px 5px 0 rgba(74, 43, 61, 0.22);
}

.win__ticket-row {
  margin: 0;
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: rgba(74, 43, 61, 0.75);
}

.win__ticket-row--big {
  margin-top: 4px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--plum);
}

.win__ticket-place {
  margin-top: 6px;
  font-size: 0.72rem;
  line-height: 1.35;
}

.win__ticket-note {
  margin: 8px 0 0;
  padding-top: 7px;
  border-top: 2px dashed rgba(74, 43, 61, 0.3);
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.16em;
  color: var(--bubblegum);
}

.win__sign {
  margin: 2px 0 0;
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(74, 43, 61, 0.7);
}

.win__timer {
  margin: 6px 0 0;
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.16em;
  color: rgba(74, 43, 61, 0.55);
}
</style>
