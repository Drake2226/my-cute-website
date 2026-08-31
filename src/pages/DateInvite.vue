<template>
  <ConsoleShell :level="level" :level-label="levelLabel">
    <Transition name="warp">
      <BootScreen v-if="step === 'boot'" @start="step = 'ask'" />

      <AskScreen v-else-if="step === 'ask'" @yes="step = 'day'" />

      <DayScreen v-else-if="step === 'day'" @pick="onPickDay" />

      <VibeScreen v-else-if="step === 'vibe'" :date-label="answer.dateLabel" @done="onPickVibe" />

      <PlaceScreen
        v-else-if="step === 'place'"
        :date-label="answer.dateLabel"
        :date-iso="answer.dateIso"
        :date-type="answer.dateType"
        :icon="answer.icon"
        :category="answer.category"
        @done="onPickPlace"
      />

      <WinScreen
        v-else
        :date-label="answer.dateLabel"
        :date-type="answer.dateType"
        :icon="answer.icon"
        :place="answer.place"
        @restart="onRestart"
      />
    </Transition>
  </ConsoleShell>

  <!-- Visible only while you develop, never in the built site she opens. -->
  <p v-if="showSetupWarning" class="setup-warning">
    Dev only — no email service is set up in <code>src/config.js</code>, so nothing is being sent.
    Fill in the <code>EMAILJS</code> service ID, template ID and public key.
  </p>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ConsoleShell from '@/components/date/ConsoleShell.vue'
import BootScreen from '@/components/date/BootScreen.vue'
import AskScreen from '@/components/date/AskScreen.vue'
import DayScreen from '@/components/date/DayScreen.vue'
import VibeScreen from '@/components/date/VibeScreen.vue'
import PlaceScreen from '@/components/date/PlaceScreen.vue'
import WinScreen from '@/components/date/WinScreen.vue'
import { isEmailJsConfigured, isFormspreeConfigured } from '@/config.js'

const LEVELS = {
  boot: { n: 0, label: '' },
  ask: { n: 1, label: 'THE ASK' },
  day: { n: 2, label: 'PICK THE DAY' },
  vibe: { n: 3, label: 'PICK THE VIBE' },
  place: { n: 4, label: 'PICK THE SPOT' },
  win: { n: 5, label: 'YOU WIN' },
}

const BLANK = { dateIso: '', dateLabel: '', dateType: '', icon: '💗', category: '', place: null }

// An unconfigured send is silent on purpose so she never sees an error. That
// silence is confusing while testing, so say it out loud during development.
const showSetupWarning = import.meta.env.DEV && !isEmailJsConfigured() && !isFormspreeConfigured()

const step = ref('boot')
const answer = reactive({ ...BLANK })

const level = computed(() => LEVELS[step.value].n)
const levelLabel = computed(() => LEVELS[step.value].label)

function onPickDay({ dateIso, dateLabel }) {
  answer.dateIso = dateIso
  answer.dateLabel = dateLabel
  step.value = 'vibe'
}

function onPickVibe({ dateType, icon, category }) {
  answer.dateType = dateType
  answer.icon = icon
  answer.category = category
  step.value = 'place'
}

// The map level sends the letter — it is the last thing she picks — so by the
// time this runs the email is already on its way.
function onPickPlace({ place }) {
  answer.place = place
  step.value = 'win'
}

// The last level runs itself out after half a minute and hands the console back
// to the boot screen, cleared of the previous answer.
function onRestart() {
  Object.assign(answer, { ...BLANK })
  step.value = 'boot'
}

onMounted(() => {
  document.title = 'A date with you 💕'
})
</script>

<style scoped>
.setup-warning {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  margin: 0;
  padding: 10px 14px;
  border: 2px solid #4a2b3d;
  border-radius: 10px;
  background: #ffd97d;
  font-family: 'Courier Prime', 'Courier New', monospace;
  font-size: 0.74rem;
  line-height: 1.5;
  text-align: center;
  color: #4a2b3d;
  z-index: 100;
}

.setup-warning code {
  font-weight: 700;
}
</style>
