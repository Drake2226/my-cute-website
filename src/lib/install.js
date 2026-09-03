// ---------------------------------------------------------------------------
// "Add it to your home screen" — the install prompt, held for later.
//
// Chrome fires `beforeinstallprompt` once, early, and unprompted: if nothing
// calls preventDefault() the browser shows its own bar over the console art,
// and if nothing keeps the event the chance to prompt is gone for that visit.
// So the listener is registered at import time — App.vue imports this module
// for exactly that reason — and the event is parked in a ref until she taps a
// button that is actually part of the app.
// ---------------------------------------------------------------------------

import { ref } from 'vue'

// The parked event. Null means "no prompt available", which is the normal state
// on iOS, in an already-installed window, and in a browser that has decided the
// site does not qualify yet.
export const installPrompt = ref(null)

export const isInstalled = ref(false)

// Safari has no install API at all: on iOS the only route is Share → Add to
// Home Screen, so those pages get instructions instead of a button.
export const isIos = ref(false)

// The three display modes that mean "this app has a window of its own". Chrome
// and Android report the one the manifest asked for, so `minimal-ui` and
// `fullscreen` have to be here beside `standalone` — the manifest lists
// minimal-ui as a fallback, and a launcher is free to hand back either.
const OWN_WINDOW =
  '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)'

// The class the stylesheet hangs the frameless layout off. It is set from here
// rather than written as a media query in the CSS because iOS reports this
// through `navigator.standalone` rather than through `display-mode`, and one
// class means the rules are written once instead of twice.
const APP_WINDOW_CLASS = 'app-window'

if (typeof window !== 'undefined') {
  const query = window.matchMedia?.(OWN_WINDOW)

  const standalone = () =>
    query?.matches === true ||
    // The iOS spelling, and the only way to tell there.
    window.navigator.standalone === true

  // Applied at import time, not on mount: App.vue imports this module before it
  // renders, so the cabinet is never painted on and then taken away again.
  const apply = () => {
    isInstalled.value = standalone()
    document.documentElement.classList.toggle(APP_WINDOW_CLASS, isInstalled.value)
  }

  apply()
  isIos.value = /iphone|ipad|ipod/i.test(window.navigator.userAgent)

  // A window can change its mind — a desktop app window can be pushed into
  // fullscreen, and Chrome moves an installed tab back and forth.
  query?.addEventListener?.('change', apply)

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt.value = event
  })

  window.addEventListener('appinstalled', () => {
    installPrompt.value = null
    isInstalled.value = true
  })
}

// Resolves true if she accepted. The event is single-use — a second prompt()
// on the same one throws — so it is dropped before being shown, and a decline
// simply means the button is gone until the browser offers another.
export async function promptInstall() {
  const event = installPrompt.value
  if (!event) return false
  installPrompt.value = null
  event.prompt()
  const choice = await event.userChoice
  return choice?.outcome === 'accepted'
}
