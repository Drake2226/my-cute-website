<template>
  <div class="cabinet">
    <div class="console">
      <span class="console__screw console__screw--tl" aria-hidden="true" />
      <span class="console__screw console__screw--tr" aria-hidden="true" />
      <span class="console__screw console__screw--bl" aria-hidden="true" />
      <span class="console__screw console__screw--br" aria-hidden="true" />

      <p class="console__plate">♡ LOVE-MACHINE 3000 ♡</p>

      <div ref="screenEl" class="screen" @scroll.capture="markScroll">
        <!-- The date flow gets the level counter; Love OS passes its own bar in
             through this slot. Both sit in the same place on the glass. -->
        <slot name="hud">
          <!-- The bar also appears for a level 0 screen that has somewhere to
               go back to — the setup screen is not numbered, but she still has
               to be able to leave it. -->
          <div v-if="level > 0 || canGoBack" class="hud">
            <button
              v-if="canGoBack"
              type="button"
              class="hud__back"
              aria-label="Back to the level before"
              title="Back"
              @click="$emit('back')"
            >
              ‹
            </button>
            <span class="hud__label">{{
              level > 0 ? `LVL ${level}/${total} · ${levelLabel}` : setupLabel
            }}</span>
            <span v-if="level > 0" class="hud__pips" aria-hidden="true">
              <i
                v-for="n in total"
                :key="n"
                class="hud__pip"
                :class="{ 'hud__pip--on': n <= level }"
              />
            </span>
          </div>
        </slot>

        <div class="stage">
          <slot />
        </div>

        <!-- Empty for the invite. Love OS puts its tab bar here, inside the
             screen, so the console reads as a device running an app. -->
        <slot name="dock" />

        <div class="screen__glass" aria-hidden="true" />
      </div>

      <div class="console__deck" aria-hidden="true">
        <span v-for="n in 9" :key="n" class="console__hole" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, onUpdated, useTemplateRef } from 'vue'

defineProps({
  level: { type: Number, default: 0 },
  levelLabel: { type: String, default: '' },
  total: { type: Number, default: 5 },
  // Whether this level has somewhere to go back to. The invite is a one-way
  // corridor otherwise: pick the wrong day and the only way out is to finish
  // the whole thing or reload the page.
  canGoBack: { type: Boolean, default: false },
  // What the bar says on an unnumbered screen that still has a back button.
  setupLabel: { type: String, default: 'SETUP' },
})

defineEmits(['back'])

// ---------------------------------------------------------------------------
// Telling her a screen scrolls
//
// Every level's root carries `.scene`, which scrolls. The console's frame cuts
// that off dead, so a screen taller than the glass looked finished when it was
// not — the vibe list hid two of its twelve tiles that way.
//
// The classes go on from here rather than from each of the eleven screens.
// `scroll` does not bubble, but it does capture, so one listener on the frame
// hears every scene inside it, whichever one is currently mounted.
// ---------------------------------------------------------------------------

const screen = useTemplateRef('screenEl')

const EDGE = 2

function mark(scene) {
  if (!scene) return
  const more = scene.scrollTop + scene.clientHeight < scene.scrollHeight - EDGE
  scene.classList.toggle('scene--more', more)
  scene.classList.toggle('scene--above', scene.scrollTop > EDGE)
}

function markScroll(event) {
  const scene = event.target
  if (scene instanceof HTMLElement && scene.classList.contains('scene')) mark(scene)
}

function markAll() {
  screen.value?.querySelectorAll('.scene').forEach(mark)
}

// A screen's height settles after it mounts — fonts land, a map sizes itself,
// a list finishes rendering — and each of those changes whether there is
// anything below the fold.
let watcher = null

onMounted(() => {
  markAll()
  if (typeof ResizeObserver === 'undefined' || !screen.value) return
  watcher = new ResizeObserver(markAll)
  watcher.observe(screen.value)
})

// Swapping levels replaces the scene entirely, and the new one starts unmarked.
onUpdated(markAll)

onBeforeUnmount(() => watcher?.disconnect())
</script>
