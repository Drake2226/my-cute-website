// ---------------------------------------------------------------------------
// Everything you need to fill in lives in this file.
//
// A website cannot send email by itself, so the letter goes out through EmailJS,
// which lets you paste your own HTML design. The design is in
// email/letter-template.html — copy it into your EmailJS template once.
//
// Full walkthrough: see "Set up the letter" in README.md
// ---------------------------------------------------------------------------

// ===========================================================================
// 1. YOUR EMAIL ADDRESS — the letter gets delivered here.
// ===========================================================================

export const RECIPIENT_EMAIL = 'zeddycarcellar@gmail.com'

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
// 4. FORMSPREE — optional fallback. Only used when EmailJS is not filled in.
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
function letterParams({ dateLabel, dateIso, dateType, dateIcon }) {
  return {
    to_email: RECIPIENT_EMAIL,
    subject: EMAIL_SUBJECT,
    date_label: dateLabel,
    date_iso: dateIso,
    date_type: dateType,
    date_icon: dateIcon,
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
        message: `She said yes! ${answer.dateType} on ${answer.dateLabel}.`,
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
