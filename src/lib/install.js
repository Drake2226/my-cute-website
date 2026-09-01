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

if (typeof window !== 'undefined') {
  const standalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // The iOS spelling, and the only way to tell there.
    window.navigator.standalone === true

  isInstalled.value = standalone()
  isIos.value = /iphone|ipad|ipod/i.test(window.navigator.userAgent)

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
