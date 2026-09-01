<template>
  <ConsoleShell :level="level" :level-label="levelLabel">
    <Transition name="warp">
      <BootScreen v-if="step === 'boot'" :unlocked="vitals.unlocked" @start="onStart" />

      <MailScreen v-else-if="step === 'mail'" :suggested="suggestedEmail" @done="onSetEmail" />

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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ConsoleShell from '@/components/date/ConsoleShell.vue'
import BootScreen from '@/components/date/BootScreen.vue'
import MailScreen from '@/components/date/MailScreen.vue'
import AskScreen from '@/components/date/AskScreen.vue'
import DayScreen from '@/components/date/DayScreen.vue'
import VibeScreen from '@/components/date/VibeScreen.vue'
import PlaceScreen from '@/components/date/PlaceScreen.vue'
import WinScreen from '@/components/date/WinScreen.vue'
import { RECIPIENT_EMAIL, isEmailJsConfigured, isFormspreeConfigured } from '@/config.js'
import {
  forgetFlow,
  hasEmail,
  rememberDate,
  rememberFlow,
  resumableFlow,
  setEmail,
  vitals,
} from '@/lib/vitals.js'

const LEVELS = {
  boot: { n: 0, label: '' },
  // Level 0, like the boot screen. Numbering the setup screen would make the
  // counter read "1/6" on the visit that shows it and "1/5" on every visit
  // after, since it only appears until an address has been saved.
  mail: { n: 0, label: '' },
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

// What the setup screen offers before she types: whatever is already stored,
// falling back to the address in src/config.js so the usual answer is one tap.
const suggestedEmail = computed(() => vitals.email || RECIPIENT_EMAIL)

const level = computed(() => LEVELS[step.value].n)
const levelLabel = computed(() => LEVELS[step.value].label)

// The setup screen only stands between PRESS START and the question while
// there is no address to post the letter to. Once one is saved it never appears
// again — it is editable on the Us page from then on.
function onStart() {
  step.value = hasEmail.value ? 'ask' : 'mail'
}

function onSetEmail({ email }) {
  setEmail(email)
  step.value = 'ask'
}

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
  // Hand the finished answer to Love Vitals. This is also what unlocks the app:
  // the countdown on its summary page is the date she just picked, and the
  // console has nothing to count down to before this point.
  rememberDate({ ...answer, place })
  step.value = 'win'
}

// The last level runs itself out after half a minute and hands the console back
// to the boot screen, cleared of the previous answer.
function onRestart() {
  Object.assign(answer, { ...BLANK })
  step.value = 'boot'
}

// The levels worth coming back to. `boot` has nothing to resume, and `win` is
// over — the answer is already in her vitals and the letter is already sent, so
// reopening into a celebration with a countdown on it would be noise.
const RESUMABLE = new Set(['ask', 'day', 'vibe', 'place'])

onMounted(() => {
  document.title = 'Meet Cute 💕'

  // Installed apps get closed by being switched away from, not by being
  // finished. Picking the question back up where she left it is the difference
  // between an app and a page.
  const saved = resumableFlow()
  if (saved && RESUMABLE.has(saved.step)) {
    Object.assign(answer, { ...BLANK, ...saved.answer })
    step.value = saved.step
  }
})

watch(
  [step, answer],
  () => {
    if (RESUMABLE.has(step.value)) rememberFlow(step.value, answer)
    else forgetFlow()
  },
  { deep: true },
)
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
