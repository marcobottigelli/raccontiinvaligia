import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

// ─── Flood-fill background removal (gratuito, nessuna API key) ────────────────
// Campiona i colori del bordo, fa BFS da tutti i pixel di bordo,
// sostituisce il background con bianco.
async function floodFillRemoveBg(inputBuf) {
  // Ridimensiona per elaborazione veloce (max 900px lato lungo)
  const workBuf = await sharp(inputBuf)
    .rotate()
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = workBuf
  const { width, height } = info
  const channels = info.channels  // 3 (RGB)
  const total = width * height

  // Campiona i colori sui 4 bordi ogni ~15px
  const seeds = []
  const step = 15
  for (let x = 0; x < width; x += step) {
    const push = (xx, yy) => {
      const i = (yy * width + xx) * channels
      seeds.push([data[i], data[i + 1], data[i + 2]])
    }
    push(x, 0); push(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
    const push = (xx, yy) => {
      const i = (yy * width + xx) * channels
      seeds.push([data[i], data[i + 1], data[i + 2]])
    }
    push(0, y); push(width - 1, y)
  }

  // Threshold: distanza max colore → sfondo
  const THRESHOLD = 70

  const visited = new Uint8Array(total)
  const queue   = new Int32Array(total)
  let   head    = 0, tail = 0

  function isBackground(px) {
    const i = px * channels
    for (const [r, g, b] of seeds) {
      const dr = data[i] - r, dg = data[i + 1] - g, db = data[i + 2] - b
      if (Math.sqrt(dr * dr + dg * dg + db * db) < THRESHOLD) return true
    }
    return false
  }

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const idx = y * width + x
    if (visited[idx]) return
    visited[idx] = 1
    if (isBackground(idx)) queue[tail++] = idx
  }

  // Semina dai 4 bordi
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1) }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y) }

  const output = Buffer.from(data)

  while (head < tail) {
    const idx = queue[head++]
    const i   = idx * channels
    output[i] = 255; output[i + 1] = 255; output[i + 2] = 255  // → bianco

    const x = idx % width, y = Math.floor(idx / width)
    enqueue(x + 1, y); enqueue(x - 1, y)
    enqueue(x, y + 1); enqueue(x, y - 1)
  }

  return sharp(output, { raw: { width, height, channels } })
    .jpeg({ quality: 90 })
    .toBuffer()
}

// ─── Deskew: corregge l'inclinazione analizzando il bordo sinistro ────────────
async function deskew(inputBuf) {
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const leftEdge = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const isContent = data[i + 3] > 30 &&
        !(data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245)
      if (isContent) { leftEdge.push({ x, y }); break }
    }
  }

  if (leftEdge.length < 20) return inputBuf

  const n = leftEdge.length
  const sx = leftEdge.reduce((s, p) => s + p.x, 0)
  const sy = leftEdge.reduce((s, p) => s + p.y, 0)
  const sxy = leftEdge.reduce((s, p) => s + p.x * p.y, 0)
  const sxx = leftEdge.reduce((s, p) => s + p.x * p.x, 0)
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const angleDeg = Math.atan(slope) * (180 / Math.PI)

  if (Math.abs(angleDeg) < 0.5 || Math.abs(angleDeg) > 20) return inputBuf

  return sharp(inputBuf)
    .rotate(-angleDeg, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer()
}

// ─── Handler principale ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    imageBase64,
    mimeType  = 'image/jpeg',
    filename  = 'copertina.jpg',
    removeBg  = true,   // true solo per foto da camera
  } = req.body

  let workingBuffer = Buffer.from(imageBase64, 'base64')

  // 1. Auto-rotate da EXIF
  try {
    workingBuffer = await sharp(workingBuffer).rotate().toBuffer()
  } catch (_) {}

  if (removeBg) {
    // 2a. Prova Remove.bg se c'è la API key (qualità migliore)
    let removeBgKey = null
    try {
      const { data } = await supabase
        .from('impostazioni')
        .select('api_key')
        .eq('servizio', 'removebg')
        .maybeSingle()
      removeBgKey = data?.api_key || null
    } catch (_) {}

    if (removeBgKey) {
      try {
        const b64 = workingBuffer.toString('base64')
        const fd  = new FormData()
        fd.append('image_file_b64', b64)
        fd.append('size',     'auto')
        fd.append('bg_color', 'ffffff')
        fd.append('format',   'jpg')

        const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST', headers: { 'X-Api-Key': removeBgKey }, body: fd,
        })
        if (rbRes.ok) {
          workingBuffer = Buffer.from(await rbRes.arrayBuffer())
          // 3. Deskew solo quando il bg è stato rimosso (sfondo bianco garantito)
          try { workingBuffer = await deskew(workingBuffer) } catch (_) {}
        } else {
          const errText = await rbRes.text().catch(() => '')
          console.error('[remove-bg] Remove.bg non-OK:', rbRes.status, errText)
          // Senza bg removal funzionante, carica la foto così com'è
        }
      } catch (e) {
        console.error('[remove-bg] Remove.bg errore:', e.message)
      }
    }
    // Senza chiave Remove.bg: nessuna rimozione sfondo.
    // Il flood-fill da bordi è troppo aggressivo sulle copertine (distrugge
    // elementi che toccano i bordi o hanno colori simili allo sfondo).
    // L'auto-rotate EXIF già corregge l'orientamento — la foto viene caricata as-is.
  }

  // 4. Trim bordi bianchi + JPEG finale
  try {
    workingBuffer = await sharp(workingBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 20 })
      .jpeg({ quality: 88 })
      .toBuffer()
  } catch (_) {
    try {
      workingBuffer = await sharp(workingBuffer)
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 88 })
        .toBuffer()
    } catch (_) {}
  }

  // 5. Upload su Supabase Storage
  try {
    const path = `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}.jpg`

    const { data: uploadData, error } = await supabase.storage
      .from('copertine')
      .upload(path, workingBuffer, { contentType: 'image/jpeg', upsert: false })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('copertine')
      .getPublicUrl(uploadData.path)

    return res.status(200).json({ url: publicUrl })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
