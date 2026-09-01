<template>
  <router-view />

  <Transition name="splash-lift">
    <SplashScreen v-if="opening" />
  </Transition>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import SplashScreen from '@/components/os/SplashScreen.vue'
// Imported for its side effect: the module registers the `beforeinstallprompt`
// listener as it loads, and that event fires once, early, whether or not the
// page she happens to be on is listening. Anything later than app start misses
// it. See src/lib/install.js.
import '@/lib/install.js'

// Long enough that the splash is a moment rather than a flicker, and long
// enough for the fonts to arrive on a warm cache.
const AT_LEAST_MS = 900

// And a ceiling, because everything it waits for can fail. A splash that
// outstays this is worse than the fallback typeface it was hiding.
const AT_MOST_MS = 2600

const opening = ref(true)

const after = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

onMounted(async () => {
  // The fonts are the actual reason to wait: they are bundled, so they land
  // fast, but not before the first paint. `document.fonts` is missing on old
  // browsers, which simply means there is nothing to wait for.
  const ready = Promise.all([document.fonts?.ready ?? Promise.resolve(), after(AT_LEAST_MS)])

  await Promise.race([ready, after(AT_MOST_MS)])
  opening.value = false
})
</script>

<style>
/* Not scoped: the transition classes land on the splash component's own root. */
.splash-lift-leave-active {
  transition:
    opacity 0.45s ease,
    transform 0.45s ease;
}

.splash-lift-leave-to {
  opacity: 0;
  transform: scale(1.04);
}

@media (prefers-reduced-motion: reduce) {
  .splash-lift-leave-active {
    transition-duration: 0.15s;
  }

  .splash-lift-leave-to {
    transform: none;
  }
}
</style>
