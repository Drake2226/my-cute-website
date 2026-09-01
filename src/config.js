// ---------------------------------------------------------------------------
// Everything you need to fill in lives in this file.
//
// A website cannot send email by itself, so the letter goes out through EmailJS,
// which lets you paste your own HTML design. The design is in
// email/letter-template.html — copy it into your EmailJS template once.
//
// Full walkthrough: see "Set up the letter" in README.md
// ---------------------------------------------------------------------------

import { formatDistance, mapLink } from '@/lib/places.js'
import { isEmailish, vitals } from '@/lib/vitals.js'

// ===========================================================================
// 1. YOUR EMAIL ADDRESS — the letter gets delivered here.
// ===========================================================================

// This is the fallback, not the last word: the setup screen after the boot
// sequence asks for an address and keeps it in the browser, and whatever it
// stored wins over this. Editing here still changes what that screen offers as
// its starting suggestion, and is what a browser with nothing stored uses.
export const RECIPIENT_EMAIL = 'zeddycarcellar@gmail.com'

/** The address the letter is actually posted to on this device. */
export function recipientEmail() {
  return isEmailish(vitals.email) ? vitals.email.trim() : RECIPIENT_EMAIL
}

// A copy of the very same letter, blind-copied to you. Leave it as an empty
// string to send only to her. This address never shows up in her email: it goes
// into the template's Bcc field, not the body, so she sees a letter addressed
// only to her. Needs one change in the EmailJS dashboard to work — see
// "Send yourself a copy" in README.md.
export const COPY_TO_EMAIL = 'zeddycarcellar@gmail.com'

// ===========================================================================
// 2. THE LETTER — edit these words freely, they are what she made you write.
// ===========================================================================

export const EMAIL_SUBJECT = 'She said yes 💕 — it is a date'

export const LOVE_NOTE =
  'She said yes. I am sitting here grinning like an idiot and I do not know how I got ' +
  'this lucky. She makes ordinary days feel like something worth remembering, and I ' +
  'would happily spend every single one of them with her.'

export const LOVE_NOTE_2 =
  'So this one is ours. I will be counting down to it. Thank you for being my favourite ' +
  'person, my safe place, and the best part of every day.'

export const CLOSING_LINE = 'I love you, my lovey dovey 💕'

// ===========================================================================
// 3. EMAILJS — three IDs from your emailjs.com dashboard.
//    Public keys are meant to be visible in browser code; lock the account to
//    your own domain under Account → Security so nobody else can use it.
// ===========================================================================

export const EMAILJS = {
  serviceId: 'service_8sd5nqg',
  templateId: 'template_8awm95e',
  publicKey: 'cAVvxyE7TX_tkUQvY',
}

// ===========================================================================
// 4. GEOAPIFY — optional, and the one thing that most improves the map level.
//
//    Without it the map asks the free, shared Overpass servers, which are the
//    same ones the whole internet uses: they answer 429 or 504 often enough
//    that the level regularly falls back to "tap the map yourself". Geoapify
//    serves the same OpenStreetMap data from paid-grade servers.
//
//    Getting a key: sign up at geoapify.com (email only, no card), make a
//    project, copy its API key here. The free tier is a few thousand requests
//    a day, which is far more than this will ever use. Lock the key to your
//    own domain in their dashboard — like the EmailJS key, it is visible in
//    browser code, and that restriction is what stops anyone else spending it.
//
//    Leaving it as-is is fine. The map falls back to Overpass and works
//    exactly as it does today.
// ===========================================================================

export const GEOAPIFY_KEY = 'YOUR_GEOAPIFY_KEY'

export function isGeoapifyConfigured() {
  return !GEOAPIFY_KEY.startsWith('YOUR_')
}

// ===========================================================================
// 5. FORMSPREE — optional fallback. Only used when EmailJS is not filled in.
//    Sends a plain notification with the date and the plan, no design.
// ===========================================================================

export const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'

// ---------------------------------------------------------------------------

export function isEmailJsConfigured() {
  return !Object.values(EMAILJS).some((value) => value.startsWith('YOUR_'))
}

export function isFormspreeConfigured() {
  return !FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID')
}

/**
 * The values the email template fills itself in with. Every {{placeholder}} in
 * email/letter-template.html has a matching key here.
 */
function letterParams({ dateLabel, dateIso, dateType, dateIcon, place }) {
  return {
    // Read at send time, not at import time, so an address changed on the Us
    // page an hour ago is the one this letter goes to.
    to_email: recipientEmail(),
    // Empty when you have not asked for a copy. EmailJS renders a blank Bcc as
    // no Bcc at all, so one template serves both cases.
    copy_email: COPY_TO_EMAIL,
    subject: EMAIL_SUBJECT,
    date_label: dateLabel,
    date_iso: dateIso,
    date_type: dateType,
    date_icon: dateIcon,
    // The spot she pinned on the map. EmailJS leaves a {{placeholder}} blank
    // when its value is an empty string, so every field is always present.
    place_name: place?.name ?? '',
    place_address: place?.address ?? '',
    place_distance: place && place.km !== null ? `${formatDistance(place.km)} from her` : '',
    place_coords: place ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : '',
    place_map_url: place ? mapLink(place) : '',
    love_note: LOVE_NOTE,
    love_note_2: LOVE_NOTE_2,
    closing: CLOSING_LINE,
  }
}

/**
 * Send the letter. Resolves once it is delivered and rejects when it is not, so
 * the screen can offer a retry instead of pretending it went through.
 */
export async function sendAnswer(answer) {
  const params = letterParams(answer)

  if (isEmailJsConfigured()) {
    // Loaded on demand so the SDK is not in the bundle she downloads up front.
    const { default: emailjs } = await import('@emailjs/browser')
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, params, {
      publicKey: EMAILJS.publicKey,
    })
    return { sent: true, via: 'emailjs' }
  }

  if (isFormspreeConfigured()) {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...params,
        _subject: EMAIL_SUBJECT,
        message: [
          `She said yes! ${answer.dateType} on ${answer.dateLabel}.`,
          params.place_name && `Where: ${params.place_name} (${params.place_map_url})`,
        ]
          .filter(Boolean)
          .join(' '),
      }),
    })

    if (!res.ok) {
      throw new Error(`Formspree responded with ${res.status}`)
    }

    return { sent: true, via: 'formspree' }
  }

  console.warn(
    '[love-machine] No email service configured in src/config.js — nothing was sent.',
    params,
  )
  return { sent: false, via: 'none' }
}
