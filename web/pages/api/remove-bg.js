import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, mimeType = 'image/jpeg', filename = 'copertina.jpg', removeBg = true } = req.body

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

  let finalBase64  = imageBase64
  let finalMime    = mimeType

  // 2. Se c'è la chiave E removeBg=true, chiama Remove.bg con sfondo bianco
  if (removeBgKey && removeBg) {
    try {
      const formData = new FormData()
      formData.append('image_file_b64', imageBase64)
      formData.append('size',           'auto')
      formData.append('bg_color',       'ffffff')   // sfondo bianco
      formData.append('format',         'jpg')

      const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method:  'POST',
        headers: { 'X-Api-Key': removeBgKey },
        body:    formData,
      })

      if (rbRes.ok) {
        const buffer   = await rbRes.arrayBuffer()
        finalBase64    = Buffer.from(buffer).toString('base64')
        finalMime      = 'image/jpeg'
      }
    } catch (e) {
      console.error('[remove-bg] errore Remove.bg:', e.message)
      // Continua con l'immagine originale
    }
  }

  // 3. Carica su Supabase Storage bucket "copertine"
  try {
    const ext        = finalMime === 'image/png' ? 'png' : 'jpg'
    const path       = `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}.${ext}`
    const buffer     = Buffer.from(finalBase64, 'base64')

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('copertine')
      .upload(path, buffer, {
        contentType: finalMime,
        upsert:      false,
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('copertine')
      .getPublicUrl(uploadData.path)

    return res.status(200).json({ url: publicUrl, processed: !!removeBgKey })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
