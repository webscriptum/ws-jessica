/**
 * Generates resources/icon.png (1024×1024) from the SVG design,
 * then builds resources/icon.ico (multi-size, PNG-compressed).
 *
 * On macOS CI, electron-builder converts icon.png → icon.icns automatically.
 * On Windows CI, icon.ico is committed directly.
 *
 * Usage: node scripts/make-icons.mjs
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCES = join(__dirname, '..', 'resources')
mkdirSync(RESOURCES, { recursive: true })

// ──────────────────────────────────────────────
// SVG ICON DESIGN
// ──────────────────────────────────────────────
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#1C3632"/>
      <stop offset="100%" stop-color="#081412"/>
    </radialGradient>
    <radialGradient id="core" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#A8F0EA"/>
      <stop offset="55%" stop-color="#44B8AD"/>
      <stop offset="100%" stop-color="#1A6060"/>
    </radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="12" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background rounded square -->
  <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>

  <!-- Subtle inner glow -->
  <ellipse cx="512" cy="440" rx="380" ry="340" fill="#1E3C38" opacity="0.55"/>

  <!-- ── TABLE ── -->
  <rect x="90" y="736" width="844" height="34" rx="10" fill="#AFAFAF"/>
  <rect x="185" y="736" width="649" height="34" rx="10" fill="#F2F2F2"/>

  <!-- ── CHAIR BACK (behind body) ── -->
  <ellipse cx="400" cy="665" rx="98" ry="112" fill="#D8D8D8" opacity="0.65"/>

  <!-- ── BODY / SHIRT ── -->
  <path d="M350,590 C350,548 430,530 512,530 C594,530 674,548 674,590 L674,748 L350,748 Z" fill="#F05364"/>
  <!-- breast shape -->
  <ellipse cx="658" cy="614" rx="42" ry="58" fill="#F05364"/>
  <!-- shoulder left (skin) -->
  <ellipse cx="334" cy="608" rx="32" ry="52" fill="#EF9067"/>
  <!-- collar skin fill -->
  <ellipse cx="512" cy="547" rx="60" ry="32" fill="#EF9067"/>

  <!-- ── NECK ── -->
  <rect x="473" y="493" width="78" height="90" rx="14" fill="#EF9067"/>

  <!-- ── HEAD / FACE ── -->
  <ellipse cx="512" cy="388" rx="125" ry="145" fill="#EF9067"/>
  <!-- face highlight -->
  <ellipse cx="548" cy="368" rx="72" ry="98" fill="#FC9F6F" opacity="0.42"/>
  <!-- chin shadow -->
  <ellipse cx="512" cy="510" rx="60" ry="14" fill="#DB7650" opacity="0.28"/>

  <!-- ── HAIR ── -->
  <!-- back left -->
  <ellipse cx="390" cy="295" rx="28" ry="195" fill="#603936"/>
  <!-- main dome -->
  <ellipse cx="512" cy="258" rx="148" ry="158" fill="#754743"/>
  <!-- crown -->
  <ellipse cx="512" cy="238" rx="132" ry="118" fill="#754743"/>
  <!-- fringe band -->
  <path d="M384,308 Q512,336 640,308 L640,348 Q512,374 384,348 Z" fill="#754743"/>
  <!-- right bob -->
  <rect x="630" y="295" width="24" height="172" rx="12" fill="#603936"/>
  <ellipse cx="642" cy="295" rx="24" ry="24" fill="#603936"/>
  <!-- left bob -->
  <rect x="370" y="295" width="24" height="172" rx="12" fill="#754743"/>
  <ellipse cx="382" cy="295" rx="24" ry="24" fill="#754743"/>

  <!-- ── GLASSES ── -->
  <!-- left frame -->
  <rect x="412" y="360" width="88" height="62" rx="10" fill="#F6CDF7" opacity="0.88"/>
  <rect x="412" y="360" width="88" height="62" rx="10" fill="none" stroke="#DD9883" stroke-width="5"/>
  <!-- right frame -->
  <rect x="524" y="360" width="88" height="62" rx="10" fill="#F6CDF7" opacity="0.88"/>
  <rect x="524" y="360" width="88" height="62" rx="10" fill="none" stroke="#DD9883" stroke-width="5"/>
  <!-- bridge -->
  <line x1="500" y1="391" x2="524" y2="391" stroke="#DD9883" stroke-width="5"/>
  <!-- nose pads -->
  <circle cx="502" cy="395" r="4" fill="#DD9883"/>
  <circle cx="522" cy="395" r="4" fill="#DD9883"/>

  <!-- ── EYES ── -->
  <ellipse cx="456" cy="391" rx="16" ry="11" fill="#161515"/>
  <ellipse cx="568" cy="391" rx="16" ry="11" fill="#161515"/>
  <!-- shine -->
  <circle cx="447" cy="384" r="6" fill="white" opacity="0.95"/>
  <circle cx="559" cy="384" r="6" fill="white" opacity="0.95"/>
  <circle cx="461" cy="395" r="3" fill="white" opacity="0.45"/>
  <circle cx="573" cy="395" r="3" fill="white" opacity="0.45"/>

  <!-- ── MOUTH ── -->
  <path d="M476,448 Q512,474 548,448" stroke="#FCFAFA" stroke-width="5.5" fill="none" stroke-linecap="round"/>

  <!-- ── KEYBOARD ── -->
  <rect x="248" y="720" width="404" height="20" rx="6" fill="#F7F7F7" opacity="0.95"/>
  <rect x="256" y="700" width="386" height="24" rx="5" fill="#F4EFF0" opacity="0.88"/>
  <!-- key row hints -->
  <rect x="264" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>
  <rect x="288" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>
  <rect x="312" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>
  <rect x="336" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>
  <rect x="360" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>
  <rect x="384" y="702" width="18" height="12" rx="3" fill="white" opacity="0.75"/>

  <!-- ── MOUSE ── -->
  <ellipse cx="740" cy="728" rx="30" ry="20" fill="#F7F7F7" opacity="0.92"/>
  <line x1="740" y1="708" x2="740" y2="748" stroke="#CECECE" stroke-width="2.5"/>

  <!-- ── POWER CORE (teal badge bottom-right) ── -->
  <circle cx="828" cy="828" r="96" fill="#44B8AD" filter="url(#glow)" opacity="0.9"/>
  <circle cx="828" cy="828" r="96" fill="#44B8AD"/>
  <circle cx="828" cy="828" r="62" fill="#0B1E1C"/>
  <polygon points="828,802 851,816 851,842 828,856 805,842 805,816" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
  <circle cx="828" cy="828" r="30" fill="url(#core)"/>

  <!-- ── OUTER TEAL BORDER ── -->
  <rect x="18" y="18" width="988" height="988" rx="214" fill="none" stroke="#44B8AD" stroke-width="12" opacity="0.30"/>
</svg>`

// ──────────────────────────────────────────────
// PNG GENERATION
// ──────────────────────────────────────────────
console.log('Rendering SVG → 1024×1024 PNG…')
const png1024 = await sharp(Buffer.from(SVG))
  .resize(1024, 1024)
  .png()
  .toBuffer()

writeFileSync(join(RESOURCES, 'icon.png'), png1024)
console.log('✓ resources/icon.png')

// ──────────────────────────────────────────────
// ICO GENERATION (PNG-compressed, multi-size)
// Each size is a standalone PNG buffer embedded in the ICO container.
// ──────────────────────────────────────────────
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

console.log(`Generating ICO sizes: ${ICO_SIZES.join(', ')}px…`)
const pngBuffers = await Promise.all(
  ICO_SIZES.map(s =>
    sharp(png1024).resize(s, s).png({ compressionLevel: 9 }).toBuffer()
  )
)

function buildIco(buffers, sizes) {
  const count = buffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = count * dirEntrySize
  const dataOffset = headerSize + dirSize

  // Compute data offsets
  const offsets = []
  let current = dataOffset
  for (const buf of buffers) {
    offsets.push(current)
    current += buf.length
  }

  const totalSize = current
  const out = Buffer.alloc(totalSize)

  // ICO header
  out.writeUInt16LE(0, 0)      // reserved
  out.writeUInt16LE(1, 2)      // type: 1 = ICO
  out.writeUInt16LE(count, 4)  // image count

  // Directory entries
  for (let i = 0; i < count; i++) {
    const base = headerSize + i * dirEntrySize
    const sz = sizes[i]
    out[base + 0] = sz >= 256 ? 0 : sz  // width (0 = 256)
    out[base + 1] = sz >= 256 ? 0 : sz  // height
    out[base + 2] = 0                    // palette count
    out[base + 3] = 0                    // reserved
    out.writeUInt16LE(1, base + 4)       // color planes
    out.writeUInt16LE(32, base + 6)      // bits per pixel
    out.writeUInt32LE(buffers[i].length, base + 8)   // data size
    out.writeUInt32LE(offsets[i], base + 12)          // data offset
  }

  // Image data
  for (let i = 0; i < count; i++) {
    buffers[i].copy(out, offsets[i])
  }

  return out
}

const icoBuffer = buildIco(pngBuffers, ICO_SIZES)
writeFileSync(join(RESOURCES, 'icon.ico'), icoBuffer)
console.log('✓ resources/icon.ico')
console.log('\nDone. Commit resources/icon.png and resources/icon.ico.')
