// ---------------------------------------------------------------------------
// Build every icon the app ships from one master artwork.
//
//   node scripts/make-icons.mjs [path-to-master.png]
//
// The master is the Meet Dawn badge (square, transparent around it). Chrome
// does the resampling, because it is already here to drive the app and the
// alternative is a native image dependency for five downscales.
//
// Three kinds come out, and the difference between them matters:
//
//   plain      transparent margins kept. Browser tabs and the manifest's "any"
//              icons, where the page behind them shows through.
//   maskable   badge shrunk into the middle 66% of a solid pink square.
//              Android clips an adaptive icon to its own shape, so anything
//              relying on transparent corners loses its edges; a full-bleed
//              background with the artwork inside the safe zone is the only
//              thing that survives every device's mask.
//   apple      badge at 92% of a solid pink square, no transparency at all.
//              iOS composites a transparent touch icon onto black, which puts
//              black corners around a pink badge.
// ---------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/icons')

const MASTER = resolve(process.argv[2] || join(OUT, 'icon-512x512.png'))

// The badge's own body pink, sampled from the artwork rather than guessed, so
// the mask background does not read as a ring of a slightly different pink
// around the badge. It is deliberately not the app's --bubblegum: the console
// palette and the badge artwork are two different pinks, and the one that has
// to match here is the one the badge is actually painted in.
const PINK = '#c62b64'

const JOBS = [
  // [file, size, kind]
  ['icon-128x128.png', 128, 'plain'],
  ['icon-192x192.png', 192, 'plain'],
  ['icon-256x256.png', 256, 'plain'],
  ['icon-384x384.png', 384, 'plain'],
  ['icon-maskable-192x192.png', 192, 'maskable'],
  ['icon-maskable-512x512.png', 512, 'maskable'],
  ['apple-icon-120x120.png', 120, 'apple'],
  ['apple-icon-152x152.png', 152, 'apple'],
  ['apple-icon-167x167.png', 167, 'apple'],
  ['apple-icon-180x180.png', 180, 'apple'],
  ['ms-icon-144x144.png', 144, 'apple'],
  ['favicon-96x96.png', 96, 'plain'],
  ['favicon-128x128.png', 128, 'plain'],
  // index.html asks for these two by name, so they are built here rather than
  // left over from whatever tool made the first set.
  ['favicon-32x32.png', 32, 'plain'],
  ['favicon-16x16.png', 16, 'plain'],
]

const master = (await readFile(MASTER)).toString('base64')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

function html(size, kind) {
  const inset = kind === 'maskable' ? 0.66 : kind === 'apple' ? 0.92 : 1
  const art = Math.round(size * inset)
  const pad = Math.round((size - art) / 2)
  const bg = kind === 'plain' ? 'transparent' : PINK

  return `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:${bg};position:relative">
      <img
        src="data:image/png;base64,${master}"
        width="${art}" height="${art}"
        style="position:absolute;left:${pad}px;top:${pad}px;display:block" />
    </div>
  </body></html>`
}

for (const [name, size, kind] of JOBS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(html(size, kind))
  await page.screenshot({ path: join(OUT, name), omitBackground: kind === 'plain' })
  await page.close()
  console.log(`${name.padEnd(28)} ${String(size).padStart(3)}px  ${kind}`)
}

// public/favicon.ico, which index.html still points at and which old browsers
// reach for before they read the PNG links. An .ico is only a container: three
// plain renders and a sixteen-byte directory entry each. They keep transparent
// corners for the same reason the tab icons do — a favicon is drawn straight
// onto the browser's own chrome.
const ICO_SIZES = [16, 32, 48]
const icoParts = []

for (const size of ICO_SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(html(size, 'plain'))
  icoParts.push(await page.screenshot({ omitBackground: true }))
  await page.close()
}

const dir = Buffer.alloc(6 + 16 * ICO_SIZES.length)
dir.writeUInt16LE(1, 2) // 1 = icon, as opposed to a cursor
dir.writeUInt16LE(ICO_SIZES.length, 4)

let at = dir.length
ICO_SIZES.forEach((size, i) => {
  const entry = 6 + 16 * i
  dir.writeUInt8(size, entry) // a 256px entry would be written as 0; none here is
  dir.writeUInt8(size, entry + 1)
  dir.writeUInt16LE(1, entry + 4) // colour planes
  dir.writeUInt16LE(32, entry + 6) // bits per pixel
  dir.writeUInt32LE(icoParts[i].length, entry + 8)
  dir.writeUInt32LE(at, entry + 12)
  at += icoParts[i].length
})

await writeFile(join(ROOT, 'public/favicon.ico'), Buffer.concat([dir, ...icoParts]))
console.log(`favicon.ico                    ${ICO_SIZES.join('/')}px  plain`)

await browser.close()

// A one-colour heart for Safari's pinned tabs, which take a mask rather than a
// picture — the badge cannot survive being reduced to a single colour.
await writeFile(
  join(OUT, 'safari-pinned-tab.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 29" fill="#000">
  <path d="M16 29C7 22 0 16 0 9.5 0 4.8 3.8 1 8.5 1 11.6 1 14.4 2.6 16 5c1.6-2.4 4.4-4 7.5-4C28.2 1 32 4.8 32 9.5 32 16 25 22 16 29z"/>
</svg>
`,
)
console.log('safari-pinned-tab.svg          mask')
