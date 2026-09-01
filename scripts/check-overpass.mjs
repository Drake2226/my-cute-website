// ---------------------------------------------------------------------------
// Check every Overpass mirror before trusting it.
//
//   node scripts/check-overpass.mjs
//
// Run this before adding a server to OVERPASS_ENDPOINTS in src/lib/places.js,
// and any time the map starts finding nothing. It tests the two things that
// have actually gone wrong:
//
//   Reachability — does a browser get an answer at all? Some instances are
//   down, and some serve no CORS headers, which a page cannot use. Node does
//   not enforce CORS, so this drives a real browser to find out.
//
//   Coverage — does it hold the whole planet? overpass.osm.ch is the Swiss
//   chapter's instance and holds only Switzerland. It answered 200 in two
//   seconds with an empty result for everywhere else, beat the slower planet
//   servers, and had the map insisting a city of 250,000 had no cinemas. A
//   server that is down is obvious; one that confidently answers "nothing" is
//   not. So each candidate is asked for cafés in Manila *and* Zurich: a planet
//   instance finds plenty of both, a regional one finds only its own region.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

// Any page will do — it exists only to give the fetches a real browser origin.
const ORIGIN = 'https://www.openstreetmap.org/'

const CANDIDATES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  // Kept here as a standing reminder of what this script is for. Both are
  // expected to fail; neither belongs in the app.
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const SPOTS = [
  ['Manila', 14.5995, 120.9842],
  ['Zurich', 47.3769, 8.5417],
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await (await browser.newContext()).newPage()
await page.goto(ORIGIN)

console.log('server'.padEnd(30), 'Manila'.padEnd(9), 'Zurich'.padEnd(9), 'verdict')

for (const url of CANDIDATES) {
  const counts = []

  for (const [, lat, lng] of SPOTS) {
    const query = `[out:json][timeout:25];node["amenity"="cafe"](around:5000,${lat},${lng});out 50;`

    const found = await page.evaluate(
      async ([endpoint, body]) => {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(body)}`,
            signal: AbortSignal.timeout(30000),
          })
          if (!res.ok) return `HTTP${res.status}`
          return (await res.json()).elements?.length ?? 0
        } catch {
          return 'failed'
        }
      },
      [url, query],
    )

    counts.push(found)
    // These are shared servers being asked a favour. Do not rush them.
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  const [manila, zurich] = counts
  const bothNumbers = typeof manila === 'number' && typeof zurich === 'number'

  let verdict
  if (!bothNumbers) verdict = 'unusable — no answer'
  else if (manila > 0 && zurich > 0) verdict = 'PLANET — safe to add'
  else if (manila === 0 && zurich === 0) verdict = 'unusable — empty everywhere'
  else verdict = 'REGIONAL — do NOT add, it will answer "nothing" elsewhere'

  const host = url.replace('https://', '').split('/')[0]
  console.log(host.padEnd(30), String(manila).padEnd(9), String(zurich).padEnd(9), verdict)
}

await browser.close()
