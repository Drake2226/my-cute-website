<template>
  <router-view />
</template>

<script setup>
// Imported for its side effect: the module registers the `beforeinstallprompt`
// listener as it loads, and that event fires once, early, whether or not the
// page she happens to be on is listening. Anything later than app start misses
// it. See src/lib/install.js.
import '@/lib/install.js'
</script>
