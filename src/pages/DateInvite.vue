<template>
  <ConsoleShell :level="level" :level-label="levelLabel">
    <Transition name="warp">
      <BootScreen v-if="step === 'boot'" @start="step = 'ask'" />

      <AskScreen v-else-if="step === 'ask'" @yes="step = 'day'" />

      <DayScreen v-else-if="step === 'day'" @pick="onPickDay" />

      <VibeScreen
        v-else-if="step === 'vibe'"
        :date-label="answer.dateLabel"
        :date-iso="answer.dateIso"
        @done="onPickVibe"
      />

      <WinScreen
        v-else
        :date-label="answer.dateLabel"
        :date-type="answer.dateType"
        :icon="answer.icon"
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
import WinScreen from '@/components/date/WinScreen.vue'
import { isEmailJsConfigured, isFormspreeConfigured } from '@/config.js'

const LEVELS = {
  boot: { n: 0, label: '' },
  ask: { n: 1, label: 'THE ASK' },
  day: { n: 2, label: 'PICK THE DAY' },
  vibe: { n: 3, label: 'PICK THE VIBE' },
  win: { n: 4, label: 'YOU WIN' },
}

// An unconfigured send is silent on purpose so she never sees an error. That
// silence is confusing while testing, so say it out loud during development.
const showSetupWarning = import.meta.env.DEV && !isEmailJsConfigured() && !isFormspreeConfigured()

const step = ref('boot')
const answer = reactive({ dateIso: '', dateLabel: '', dateType: '', icon: '💗' })

const level = computed(() => LEVELS[step.value].n)
const levelLabel = computed(() => LEVELS[step.value].label)

function onPickDay({ dateIso, dateLabel }) {
  answer.dateIso = dateIso
  answer.dateLabel = dateLabel
  step.value = 'vibe'
}

function onPickVibe({ dateType, icon }) {
  answer.dateType = dateType
  answer.icon = icon
  step.value = 'win'
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
