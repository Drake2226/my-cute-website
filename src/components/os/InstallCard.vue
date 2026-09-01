<template>
  <!-- Nothing at all once it is installed — heading included, which is why the
       section lives in here rather than in the page: a card telling her to
       install the app she is already inside is just clutter. -->
  <section v-if="!isInstalled" class="section">
    <h2 class="section__title">THE APP ITSELF</h2>

    <div class="card install">
      <p class="install__head">
        <span aria-hidden="true">📲</span>
        Put it on your home screen
      </p>

      <p class="install__note">
        It installs like any other app — its own icon, no address bar, and it opens without a
        connection. Everything it remembers stays on this phone.
      </p>

      <button v-if="installPrompt" type="button" class="minibtn minibtn--go" @click="install">
        Install the Love Machine
      </button>

      <!-- iOS has no install API — Safari only offers it through the share
         sheet — so there is a button to tap on Android and a sentence to
         follow on an iPhone. -->
      <p v-else-if="isIos" class="install__how">
        Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>.
      </p>

      <p v-else class="install__how">
        Open your browser's menu and choose <b>Install app</b> (or <b>Add to Home screen</b>).
      </p>
    </div>
  </section>
</template>

<script setup>
import { installPrompt, isInstalled, isIos, promptInstall } from '@/lib/install.js'

async function install() {
  await promptInstall()
}
</script>

<style scoped>
.install {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
}

.install__head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--plum);
}

.install__note {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.5;
  color: rgba(74, 43, 61, 0.65);
}

.install__how {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.5;
  color: var(--plum);
}
</style>
