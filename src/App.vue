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
import { warmLocation, warmMap } from '@/lib/warmup.js'

// Long enough that the splash is a moment rather than a flicker, and long
// enough for the fonts to arrive on a warm cache.
const AT_LEAST_MS = 900

// And a ceiling, because everything it waits for can fail. A splash that
// outstays this is worse than the fallback typeface it was hiding.
const AT_MOST_MS = 2600

const opening = ref(true)

const after = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

onMounted(async () => {
  // The splash is dead time she is already spending, so the map level does its
  // queueing here instead: Leaflet comes down now rather than when she taps a
  // date type, and if she has already granted location once, the fix is taken
  // now too. Neither is awaited — the splash lifts on its own schedule and
  // both of these carry on behind it.
  // Costs no bandwidth, so it goes first: a fix is only collected here if
  // permission was granted on an earlier visit.
  warmLocation()

  // The fonts are the actual reason to wait: they are bundled, so they land
  // fast, but not before the first paint. `document.fonts` is missing on old
  // browsers, which simply means there is nothing to wait for.
  const fonts = document.fonts?.ready ?? Promise.resolve()

  // Leaflet is 145 KB and the map is at least four taps away, so it must not
  // race the fonts this splash is waiting on — fetching it first would make the
  // splash last longer to save time she has not asked for yet. It still lands
  // long before she gets there.
  fonts.then(() => warmMap())

  const ready = Promise.all([fonts, after(AT_LEAST_MS)])

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
