import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// Usa service_role key per bypassare RLS sul bucket storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// ─── Deskew: trova l'angolo di inclinazione dai pixel non-bianchi ─────────────
// Usa i momenti centrali del bounding box per calcolare la rotazione necessaria
async function deskewBuffer(inputBuf) {
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  let minX = width, maxX = 0, minY = height, maxY = 0

  // Raccolta punti del bordo sinistro e destro per ogni riga
  const leftEdge  = new Array(height).fill(null)
  const rightEdge = new Array(height).fill(null)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const isContent = data[i + 3] > 30 &&
        !(data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245)
      if (isContent) {
        if (leftEdge[y]  === null) leftEdge[y]  = x
        rightEdge[y] = x
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // Calcola angolo di inclinazione con regressione lineare sul bordo sinistro
  const points = leftEdge
    .map((x, y) => x !== null ? { x, y } : null)
    .filter(Boolean)

  if (points.length < 20) return inputBuf  // non abbastanza dati

  const n  = points.length
  const sx = points.reduce((s, p) => s + p.x, 0)
  const sy = points.reduce((s, p) => s + p.y, 0)
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0)
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0)
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)

  // angolo in gradi (rispetto all'asse verticale)
  const angleDeg = Math.atan(slope) * (180 / Math.PI)

  // Correggi solo inclinazioni piccole (< 20°), altrimenti lascia stare
  if (Math.abs(angleDeg) < 0.5 || Math.abs(angleDeg) > 20) return inputBuf

  return sharp(inputBuf)
    .rotate(-angleDeg, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    imageBase64,
    mimeType   = 'image/jpeg',
    filename   = 'copertina.jpg',
    removeBg   = true,
  } = req.body

  // 1. Recupera la API key di Remove.bg dalle impostazioni
  let removeBgKey = null
  try {
    const { data } = await supabase
      .from('impostazioni')
      .select('api_key')
      .eq('servizio', 'removebg')
      .maybeSingle()
    removeBgKey = data?.api_key || null
  } catch (_) {}

  let workingBuffer = Buffer.from(imageBase64, 'base64')

  // 2. Auto-rotate da EXIF (fondamentale per foto da iPhone)
  try {
    workingBuffer = await sharp(workingBuffer).rotate().toBuffer()
  } catch (_) {}

  // 3. Remove.bg: sfondo bianco (solo se è una foto da camera e c'è la key)
  if (removeBgKey && removeBg) {
    try {
      const b64     = workingBuffer.toString('base64')
      const formData = new FormData()
      formData.append('image_file_b64', b64)
      formData.append('size',      'auto')
      formData.append('bg_color',  'ffffff')
      formData.append('format',    'jpg')

      const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method:  'POST',
        headers: { 'X-Api-Key': removeBgKey },
        body:    formData,
      })

      if (rbRes.ok) {
        const ab = await rbRes.arrayBuffer()
        workingBuffer = Buffer.from(ab)
      }
    } catch (e) {
      console.error('[remove-bg] Remove.bg error:', e.message)
    }
  }

  // 4. Deskew: correggi l'inclinazione della copertina
  if (removeBg) {
    try {
      workingBuffer = await deskewBuffer(workingBuffer)
    } catch (e) {
      console.error('[remove-bg] deskew error:', e.message)
    }
  }

  // 5. Trim bordi bianchi/trasparenti + conversione JPEG finale
  try {
    workingBuffer = await sharp(workingBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 20 })
      .jpeg({ quality: 88 })
      .toBuffer()
  } catch (e) {
    console.error('[remove-bg] trim error:', e.message)
    // Fallback: JPEG senza trim
    try {
      workingBuffer = await sharp(workingBuffer).jpeg({ quality: 88 }).toBuffer()
    } catch (_) {}
  }

  // 6. Upload su Supabase Storage bucket "copertine"
  try {
    const path = `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}.jpg`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('copertine')
      .upload(path, workingBuffer, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('copertine')
      .getPublicUrl(uploadData.path)

    return res.status(200).json({ url: publicUrl, processed: !!removeBgKey })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
