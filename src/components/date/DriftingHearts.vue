<template>
  <div class="drift" aria-hidden="true">
    <span v-for="h in hearts" :key="h.id" class="drift__heart" :style="h.style">{{ h.glyph }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: { type: Number, default: 12 },
  glyphs: { type: Array, default: () => ['💗', '💖', '🩷', '✨', '🌸'] },
})

// Randomised once on mount so each screen has its own drift pattern.
const hearts = computed(() =>
  Array.from({ length: props.count }, (_, id) => {
    const duration = 9 + Math.random() * 9
    return {
      id,
      glyph: props.glyphs[Math.floor(Math.random() * props.glyphs.length)],
      style: {
        left: `${Math.random() * 92}%`,
        fontSize: `${11 + Math.random() * 15}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${-Math.random() * duration}s`,
      },
    }
  }),
)
</script>
