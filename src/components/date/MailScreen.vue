<template>
  <div class="scene mail">
    <DriftingHearts :count="7" :glyphs="['💌', '✨']" />

    <div class="mail__head">
      <p class="eyebrow">SETUP · POSTAL SLOT</p>
      <h1 class="headline mail__headline">Where should the letter land?</h1>
      <p class="subline">
        When she picks the spot, this machine posts a letter with her answer in it. Tell it which
        inbox to drop that letter into.
      </p>
    </div>

    <form class="mail__card" @submit.prevent="confirm">
      <label class="mail__label" for="letter-to">LETTER GOES TO</label>
      <input
        id="letter-to"
        v-model="draft"
        class="field mail__input"
        type="email"
        inputmode="email"
        autocomplete="email"
        spellcheck="false"
        enterkeyhint="go"
        placeholder="you@example.com"
        :aria-invalid="showProblem"
        :aria-describedby="showProblem ? 'letter-to-problem' : undefined"
        @blur="touched = true"
      />

      <p v-if="showProblem" id="letter-to-problem" class="mail__problem" role="alert">
        That does not look like an address yet.
      </p>
      <p v-else class="mail__reassure">
        Kept on this device only, and changeable later on the <b>Us</b> tab.
      </p>
    </form>

    <div class="mail__foot">
      <button class="btn btn--yes" :disabled="!valid" @click="confirm">Save it →</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import DriftingHearts from './DriftingHearts.vue'
import { isEmailish } from '@/lib/vitals.js'

const props = defineProps({
  // Whatever the machine already knows: the stored address if there is one, and
  // otherwise the fallback from src/config.js, so the common case is reading a
  // suggestion and tapping once.
  suggested: { type: String, default: '' },
})

const emit = defineEmits(['done'])

// Not autofocused on purpose: on a phone that throws the keyboard up over the
// console the moment the screen arrives, hiding the very thing being explained.
// The field is one tap away and the screen reads better sitting still.
const draft = ref(props.suggested)

// An address is only "wrong" once she has typed at it and moved on. Complaining
// at an empty box she has not reached yet is nagging, not helping.
const touched = ref(false)

const valid = computed(() => isEmailish(draft.value))
const showProblem = computed(() => touched.value && draft.value.trim() !== '' && !valid.value)

function confirm() {
  if (!valid.value) {
    touched.value = true
    return
  }
  emit('done', { email: draft.value.trim() })
}
</script>

<style scoped>
.mail {
  z-index: 1;
  justify-content: center;
  gap: 16px;
}

.mail__head,
.mail__card,
.mail__foot {
  position: relative;
  z-index: 1;
}

.mail__headline {
  font-size: clamp(1.4rem, 6.2vw, 1.8rem);
}

.mail__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: var(--ink);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 4px 4px 0 rgba(74, 43, 61, 0.2);
}

.mail__label {
  font-family: var(--font-hud);
  font-size: 6.5px;
  letter-spacing: 0.12em;
  color: rgba(74, 43, 61, 0.65);
}

.mail__input {
  /* 16px or larger, or iOS zooms the whole console in on focus and she has to
     pinch her way back out. */
  font-size: 1rem;
}

.mail__problem {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.4;
  color: var(--bubblegum);
}

.mail__reassure {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.4;
  color: rgba(74, 43, 61, 0.6);
}

.mail__foot {
  display: flex;
  justify-content: center;
}
</style>
