<template>
  <div class="cabinet">
    <div class="console">
      <span class="console__screw console__screw--tl" aria-hidden="true" />
      <span class="console__screw console__screw--tr" aria-hidden="true" />
      <span class="console__screw console__screw--bl" aria-hidden="true" />
      <span class="console__screw console__screw--br" aria-hidden="true" />

      <p class="console__plate">♡ LOVE-MACHINE 3000 ♡</p>

      <div class="screen">
        <div v-if="level > 0" class="hud">
          <span>LVL {{ level }}/{{ total }} · {{ levelLabel }}</span>
          <span class="hud__pips" aria-hidden="true">
            <i
              v-for="n in total"
              :key="n"
              class="hud__pip"
              :class="{ 'hud__pip--on': n <= level }"
            />
          </span>
        </div>

        <div class="stage">
          <slot />
        </div>

        <div class="screen__glass" aria-hidden="true" />
      </div>

      <div class="console__deck" aria-hidden="true">
        <span v-for="n in 9" :key="n" class="console__hole" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  level: { type: Number, default: 0 },
  levelLabel: { type: String, default: '' },
  total: { type: Number, default: 4 },
})
</script>
