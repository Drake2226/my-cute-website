<template>
  <ConsoleShell :level="level" :level-label="levelLabel" :can-go-back="canGoBack" @back="onBack">
    <Transition :name="transition">
      <BootScreen v-if="step === 'boot'" :unlocked="vitals.unlocked" @start="onStart" />

      <MailScreen v-else-if="step === 'mail'" :suggested="suggestedEmail" @done="onSetEmail" />

      <AskScreen v-else-if="step === 'ask'" @yes="goTo('day')" />

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
import { warmSearch } from '@/lib/warmup.js'

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

// Where she has been, most recent last. A stack rather than a fixed map of
// "previous level", because the setup screen only appears on the visit that
// asks for an address — with a map, backing out of the question would either
// land on a screen she never saw or refuse to go anywhere at all.
const trail = ref([])

// Every level can be reviewed and answered again, except the last one: the
// letter is sent by the time the win screen appears, and a way back to the map
// would be a way to send a second one.
const canGoBack = computed(() => trail.value.length > 0 && step.value !== 'win')

// Screens slide in from the right going forward and from the left coming back,
// so the direction of travel is never in doubt.
const transition = ref('warp')

function goTo(next) {
  trail.value.push(step.value)
  transition.value = 'warp'
  step.value = next
}

function onBack() {
  const previous = trail.value.pop()
  if (!previous) return
  transition.value = 'warp-back'
  step.value = previous
}

// Any move that is not the back button is a move forward.
watch(step, () => {
  if (transition.value === 'warp-back') {
    // Let the leaving screen finish before the direction flips back, or a
    // forward tap during the animation would reverse it mid-slide.
    setTimeout(() => {
      transition.value = 'warp'
    }, 360)
  }
})

// The setup screen only stands between PRESS START and the question while
// there is no address to post the letter to. Once one is saved it never appears
// again — it is editable on the Us page from then on.
function onStart() {
  goTo(hasEmail.value ? 'ask' : 'mail')
}

function onSetEmail({ email }) {
  setEmail(email)
  goTo('ask')
}

function onPickDay({ dateIso, dateLabel }) {
  answer.dateIso = dateIso
  answer.dateLabel = dateLabel
  goTo('vibe')
}

function onPickVibe({ dateType, icon, category }) {
  answer.dateType = dateType
  answer.icon = icon
  answer.category = category
  // The one search she is going to need, started as she picks it rather than
  // when the map appears. The map level asks for the same thing a moment later
  // and joins this request instead of making a second one.
  warmSearch(category)
  goTo('place')
}

// The map level sends the letter — it is the last thing she picks — so by the
// time this runs the email is already on its way.
function onPickPlace({ place }) {
  answer.place = place
  // Hand the finished answer to Love Vitals. This is also what unlocks the app:
  // the countdown on its summary page is the date she just picked, and the
  // console has nothing to count down to before this point.
  rememberDate({ ...answer, place })
  goTo('win')
}

// The last level runs itself out after half a minute and hands the console back
// to the boot screen, cleared of the previous answer.
function onRestart() {
  Object.assign(answer, { ...BLANK })
  trail.value = []
  transition.value = 'warp'
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
    // Rebuild the trail from the order of the levels, or resuming would arrive
    // on level four with no way back — she did walk those screens, just in a
    // session that has since been closed. The setup screen is only in the trail
    // if it would have been shown.
    const ORDER = ['boot', 'mail', 'ask', 'day', 'vibe', 'place']
    trail.value = ORDER.slice(0, ORDER.indexOf(saved.step)).filter(
      (level) => level !== 'mail' || !hasEmail.value,
    )
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
