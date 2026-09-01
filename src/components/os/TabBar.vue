<template>
  <nav class="tabbar" aria-label="Love OS sections">
    <router-link
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="tabbar__tab"
      active-class="tabbar__tab--on"
    >
      <span class="tabbar__icon" aria-hidden="true">{{ tab.icon }}</span>
      <span class="tabbar__label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
// The four sections, in the order they are meant to be learned: what today
// looks like, how to add to it, what it has added up to, and who it is about.
const TABS = [
  { to: '/os/vitals', icon: '💗', label: 'VITALS' },
  { to: '/os/log', icon: '✍️', label: 'LOG' },
  { to: '/os/trends', icon: '📈', label: 'TRENDS' },
  { to: '/os/me', icon: '🧸', label: 'US' },
]
</script>

<style scoped>
.tabbar {
  flex: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 6px 6px 7px;
  border-top: 2px dashed rgba(74, 43, 61, 0.3);
  background: rgba(255, 194, 221, 0.42);
  /* Above the screen glass, or the scanlines sit on top of the controls. */
  position: relative;
  z-index: 6;
}

.tabbar__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 2px 4px;
  border: 2px solid transparent;
  border-radius: 10px;
  text-decoration: none;
  color: rgba(74, 43, 61, 0.6);
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    transform 0.12s ease;
}

.tabbar__tab:active {
  transform: translateY(2px);
}

.tabbar__tab:focus-visible {
  outline: 3px solid var(--mint);
  outline-offset: 2px;
}

.tabbar__tab--on {
  border-color: var(--plum);
  background: var(--cream);
  color: var(--plum);
  box-shadow: 0 3px 0 rgba(74, 43, 61, 0.25);
}

.tabbar__icon {
  font-size: 15px;
  line-height: 1;
  /* Grey the icon down until its tab is the one selected — an emoji cannot be
     recoloured, so desaturation is the only handle on it. */
  filter: grayscale(0.65);
}

.tabbar__tab--on .tabbar__icon {
  filter: none;
}

.tabbar__label {
  font-family: var(--font-hud);
  font-size: 6px;
  letter-spacing: 0.08em;
}

@media (prefers-reduced-motion: reduce) {
  .tabbar__tab {
    transition: none;
  }

  .tabbar__tab:active {
    transform: none;
  }
}
</style>
