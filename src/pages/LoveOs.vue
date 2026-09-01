<template>
  <ConsoleShell>
    <template #hud>
      <div class="hud oshud">
        <span class="oshud__title">♡ LOVE VITALS</span>
        <span class="oshud__day">{{ today }}</span>
        <!-- The only way back to the invite. It lives up here rather than in
             the tab bar so the four tabs stay the four sections of the app. -->
        <router-link to="/" class="oshud__back" title="Back to the invite">💌</router-link>
      </div>
    </template>

    <router-view v-slot="{ Component }">
      <Transition name="warp">
        <component :is="Component" />
      </Transition>
    </router-view>

    <template #dock>
      <TabBar />
    </template>
  </ConsoleShell>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ConsoleShell from '@/components/date/ConsoleShell.vue'
import TabBar from '@/components/os/TabBar.vue'
import { rememberTab, vitals } from '@/lib/vitals.js'

const route = useRoute()

// `/os` redirects to whichever tab this last saw, so reopening the installed
// app returns her to the page she was on rather than always to the summary.
watch(
  () => route.path,
  (path) => rememberTab(path),
  { immediate: true },
)

const today = new Date()
  .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  .toUpperCase()

onMounted(() => {
  document.title = 'Meet Cute · Vitals 💗'
  // Reaching the app at all counts as unlocking it: she may have opened the
  // link straight to /#/os on a second visit, and sending her back to the boot
  // screen to earn the tab bar again would be a puzzle, not a feature.
  vitals.unlocked = true
})
</script>

<style scoped>
.oshud {
  gap: 8px;
}

.oshud__title {
  color: var(--bubblegum);
}

.oshud__day {
  flex: 1;
  text-align: right;
  color: rgba(74, 43, 61, 0.65);
}

.oshud__back {
  flex: none;
  font-size: 12px;
  line-height: 1;
  text-decoration: none;
  transition: transform 0.12s ease;
}

.oshud__back:hover {
  transform: scale(1.15);
}

.oshud__back:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .oshud__back {
    transition: none;
  }
}
</style>
