<template>
  <!-- Covers everything while the app finds its feet. Opening straight onto a
       half-drawn console in fallback fonts is what this is for: the CSS lands
       before the fonts do, so without it the first thing she sees is the right
       layout in the wrong typeface, snapping into place a beat later. -->
  <div class="splash" role="status" aria-label="Opening Meet Cute">
    <div class="splash__badge">
      <img :src="badge" alt="" width="104" height="104" />
    </div>

    <p class="splash__name">MEET CUTE</p>

    <div class="splash__bar" aria-hidden="true">
      <div class="splash__fill" />
    </div>

    <p class="splash__hint">warming up the love machine</p>
  </div>
</template>

<script setup>
// public/ is served under the app's own prefix — /my-cute-website/ on Pages,
// / in development — so the path has to be built from the base rather than
// written as an absolute one.
const badge = `${import.meta.env.BASE_URL}icons/icon-192x192.png`
</script>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  /* The same polka-dotted room the console stands in, so the splash lifting
     off does not look like a change of scene. */
  background-color: var(--blush);
  background-image:
    radial-gradient(circle, rgba(255, 194, 221, 0.9) 3px, transparent 3.5px),
    radial-gradient(circle, rgba(255, 217, 125, 0.55) 2px, transparent 2.5px);
  background-size:
    38px 38px,
    38px 38px;
  background-position:
    0 0,
    19px 19px;
}

.splash__badge {
  display: flex;
  padding: 6px;
  border: var(--ink);
  border-radius: 26px;
  background: var(--cotton);
  box-shadow: var(--drop);
  animation: splash-breathe 1.6s ease-in-out infinite;
}

.splash__badge img {
  display: block;
  border-radius: 20px;
}

.splash__name {
  margin: 0;
  font-family: var(--font-hud);
  font-size: 13px;
  letter-spacing: 0.18em;
  color: var(--plum);
  text-shadow: 2px 2px 0 var(--cotton);
}

.splash__bar {
  width: 168px;
  height: 14px;
  padding: 2px;
  border: 3px solid var(--plum);
  background: var(--cream);
}

.splash__fill {
  height: 100%;
  background: var(--bubblegum);
  /* Not a real measurement of anything — nothing here has a percentage to
     report. It is a "the machine is doing something" bar, so it fills once and
     waits, rather than looping and looking stuck. */
  animation: splash-fill 1.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.splash__hint {
  margin: 0;
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-style: italic;
  color: rgba(74, 43, 61, 0.6);
}

@keyframes splash-fill {
  from {
    width: 6%;
  }
  to {
    width: 100%;
  }
}

@keyframes splash-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-5px) scale(1.03);
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash__badge {
    animation: none;
  }

  .splash__fill {
    animation: none;
    width: 100%;
  }
}
</style>
