import { useEffect, useRef, useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

// ─── Colonne preferite (sync con settings.js) ────────────────────────────────
const LS_KEY = 'libreria_cols_v1'

const OPTIONAL_COLS = [
  { key: 'anno',          label: 'Anno',             render: l => l.anno_pubblicazione || '—' },
  { key: 'casa_editrice', label: 'Casa editrice',    render: l => l.casa_editrice || '—' },
  { key: 'voto',          label: 'Voto',             render: l => l.voto ? '★'.repeat(l.voto) + '☆'.repeat(5 - l.voto) : '—' },
  { key: 'genere',        label: 'Genere',           render: l => l.genere?.join(', ') || '—' },
  { key: 'lingua',        label: 'Lingua',           render: l => l.lingua_originale?.toUpperCase() || '—' },
  { key: 'pagine',        label: 'Pagine',           render: l => l.pagine || '—' },
  { key: 'fonte',         label: 'Fonte',            render: l => l.data_source || '—', Component: ({ libro }) => <FonteBadge source={libro.data_source} /> },
  { key: 'isbn',          label: 'ISBN',             render: l => l.isbn, className: 'font-mono text-xs' },
]

function loadExtraCols() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

// ─── Barcode Scanner overlay ───────────────────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const videoRef    = useRef(null)
  const controlsRef = useRef(null)   // IScannerControls da @zxing/browser
  const doneRef     = useRef(false)  // evita chiamate multiple a onDetected
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!videoRef.current) return

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader   = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' }, audio: false },
          videoRef.current,
          (result, err) => {
            if (result && !doneRef.current) {
              doneRef.current = true
              onDetected(result.getText())
            }
          }
        )
        controlsRef.current = controls
      } catch (e) {
        setErr('Fotocamera non disponibile: ' + (e?.message ?? e))
      }
    }

    start()

    return () => {
      doneRef.current = true
      try { controlsRef.current?.stop() } catch (_) {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 bg-black/70">
        <p className="text-white text-sm font-medium">Inquadra il codice a barre del libro</p>
        <button onClick={onClose} className="text-white text-3xl leading-none hover:text-gray-300">×</button>
      </div>

      {/* video */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {/* mirino */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-72 h-28">
            {/* angoli del mirino */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-500 rounded-tl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-500 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-500 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-500 rounded-br" />
            {/* linea laser */}
            <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-brand-500/70" />
          </div>
        </div>
      </div>

      {err && (
        <div className="px-5 py-4 bg-red-900/80 text-red-200 text-sm text-center">{err}</div>
      )}

      <div className="px-5 py-4 bg-black/70 text-center">
        <p className="text-gray-400 text-xs">ISBN-13 / EAN-13</p>
      </div>
    </div>
  )
}

// ─── Star picker ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value ?? 0
  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          onMouseEnter={() => setHovered(n)}
          className="text-2xl leading-none transition-transform active:scale-90 select-none"
          aria-label={`${n} stelle`}
        >
          <span className={n <= display ? 'text-amber-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-xs text-gray-400 hover:text-gray-600 self-center"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Stato lettura badge ───────────────────────────────────────────────────────
function StatoBadge({ stato }) {
  const map = {
    letto:      'bg-green-100 text-green-700 border-green-200',
    in_lettura: 'bg-blue-100 text-blue-700 border-blue-200',
    da_leggere: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const label = {
    letto:      '✓ Letto',
    in_lettura: '📖 In lettura',
    da_leggere: '⏳ Da leggere',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[stato] || map.da_leggere}`}>
      {label[stato] || stato}
    </span>
  )
}

// ─── Data source badge ─────────────────────────────────────────────────────────
function FonteBadge({ source }) {
  const map = {
    api:     'bg-blue-100 text-blue-700',
    manual:  'bg-purple-100 text-purple-700',
    pending: 'bg-amber-100 text-amber-700',
  }
  const label = {
    api:     'API',
    manual:  'Manuale',
    pending: 'Mancante',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[source] || map.pending}`}>
      {label[source] || source}
    </span>
  )
}

// ─── Book detail sheet ────────────────────────────────────────────────────────
function BookDetailSheet({ libro, onClose }) {
  if (!libro) return null

  const statoLabel = { letto: '✓ Letto', in_lettura: '📖 In lettura', da_leggere: '⏳ Da leggere' }
  const statoColor = {
    letto:      'bg-green-100 text-green-700',
    in_lettura: 'bg-blue-100 text-blue-700',
    da_leggere: 'bg-gray-100 text-gray-600',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet: bottom on mobile, centered modal on desktop */}
      <div className="fixed z-50 inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl sm:max-w-lg w-full sm:w-full max-h-[92vh] overflow-y-auto shadow-2xl">

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Close button (desktop) */}
          <div className="hidden sm:flex justify-end p-4 pb-0">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5 pt-3 sm:pt-2">

            {/* Cover + titolo + autore */}
            <div className="flex gap-4 mb-5">
              <div className="flex-shrink-0">
                {libro.copertina ? (
                  <img
                    src={libro.copertina}
                    alt={libro.titolo}
                    className="w-20 h-28 sm:w-24 sm:h-36 object-cover rounded-lg border border-gray-200 shadow-sm"
                    onError={e => { e.target.src = 'https://placehold.co/80x112?text=?' }}
                  />
                ) : (
                  <div className="w-20 h-28 sm:w-24 sm:h-36 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-3xl">
                    📖
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 text-lg leading-tight mb-1">
                  {libro.titolo || <span className="text-gray-400 italic">Titolo mancante</span>}
                </h2>
                {libro.autore?.length > 0 && (
                  <p className="text-sm text-gray-600 mb-2">{libro.autore.join(', ')}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statoColor[libro.stato_lettura] || statoColor.da_leggere}`}>
                    {statoLabel[libro.stato_lettura] || libro.stato_lettura}
                  </span>
                  <div className="flex gap-0.5" title={libro.voto ? `${libro.voto} stelle` : 'Non valutato'}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={`text-lg leading-none ${libro.voto && n <= libro.voto ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Metadati */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-5 border-t border-gray-100 pt-4">
              {libro.casa_editrice && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Casa editrice</p>
                  <p className="text-gray-800 font-medium">{libro.casa_editrice}</p>
                </div>
              )}
              {libro.anno_pubblicazione && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Anno</p>
                  <p className="text-gray-800 font-medium">{libro.anno_pubblicazione}</p>
                </div>
              )}
              {libro.pagine && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Pagine</p>
                  <p className="text-gray-800 font-medium">{libro.pagine}</p>
                </div>
              )}
              {libro.lingua_originale && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Lingua orig.</p>
                  <p className="text-gray-800 font-medium">{libro.lingua_originale.toUpperCase()}</p>
                </div>
              )}
              {libro.genere?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Genere</p>
                  <p className="text-gray-800 font-medium">{libro.genere.join(', ')}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">ISBN</p>
                <p className="text-gray-500 font-mono text-xs">{libro.isbn}</p>
              </div>
            </div>

            {/* Descrizione */}
            {libro.descrizione && (
              <div className="mb-4 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descrizione</p>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-6">{libro.descrizione}</p>
              </div>
            )}

            {/* Note personali */}
            {libro.note_personali && (
              <div className="mb-4 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Note personali</p>
                <p className="text-sm text-gray-700 leading-relaxed">{libro.note_personali}</p>
              </div>
            )}

            {/* Azioni */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 pb-safe">
              <Link
                href={`/libro/${libro.id}`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Modifica
              </Link>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Cover picker sheet ────────────────────────────────────────────────────────
function CoverPickerSheet({ onFile, onUrl, onClose }) {
  const cameraRef   = useRef(null)
  const galleryRef  = useRef(null)
  const [urlMode, setUrlMode] = useState(false)
  const [urlVal,  setUrlVal]  = useState('')
  const waitingRef  = useRef(false)

  // iOS fix: when user returns from native camera/gallery without selecting,
  // onChange never fires. Close the sheet on next page visibility restore.
  function openPicker(ref) {
    waitingRef.current = true
    ref.current.click()
    const handleVisible = () => {
      if (waitingRef.current) {
        // Small delay to let onChange fire first if a file was selected
        setTimeout(() => { if (waitingRef.current) onClose() }, 400)
      }
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50"
         onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5"
           onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <p className="font-semibold text-gray-900">Cambia copertina</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {urlMode ? (
          <div className="space-y-3">
            <input
              type="url"
              autoFocus
              placeholder="https://..."
              value={urlVal}
              onChange={e => setUrlVal(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setUrlMode(false)}
                className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">
                Indietro
              </button>
              <button
                disabled={!urlVal.trim()}
                onClick={() => { onUrl(urlVal.trim()); onClose() }}
                className="flex-1 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40">
                Usa URL
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Fotocamera */}
            <button onClick={() => openPicker(cameraRef)}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-gray-600 font-medium">Fotocamera</span>
            </button>
            {/* Libreria */}
            <button onClick={() => openPicker(galleryRef)}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-600 font-medium">Libreria</span>
            </button>
            {/* URL */}
            <button onClick={() => setUrlMode(true)}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs text-gray-600 font-medium">URL</span>
            </button>
          </div>
        )}

        {/* Input nascosti */}
        <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
          className="hidden" onChange={e => { waitingRef.current = false; if (e.target.files[0]) onFile(e.target.files[0], true);  onClose() }} />
        <input ref={galleryRef} type="file" accept="image/*"
          className="hidden" onChange={e => { waitingRef.current = false; if (e.target.files[0]) onFile(e.target.files[0], false); onClose() }} />
      </div>
    </div>
  )
}

// ─── Modal aggiungi libro ──────────────────────────────────────────────────────
function AggiungiLibroModal({ isOpen, onClose, onSaved }) {
  const [isbn, setIsbn]           = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saveLoading, setSaveLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [found, setFound]         = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [coverUploading, setCoverUploading]   = useState(false)
  const [duplicate, setDuplicate] = useState(null)  // { id, titolo } se ISBN già presente
  // autocomplete casa editrice
  const [publishers, setPublishers]             = useState([])
  const [showPublishers, setShowPublishers]     = useState(false)
  const [form, setForm]           = useState({
    titolo: '', autore: '', casa_editrice: '', anno_pubblicazione: '',
    descrizione: '', copertina: '', genere: '', lingua_originale: '',
    pagine: '', stato_lettura: 'letto', note_personali: '', voto: null,
  })

  // Apri scanner automaticamente ogni volta che il modal viene aperto
  useEffect(() => {
    if (isOpen) setScanning(true)
  }, [isOpen])

  async function loadPublishers() {
    if (publishers.length > 0) return
    try {
      const res  = await fetch('/api/libri')
      const data = await res.json()
      const pubs = [...new Set((data || []).map(l => l.casa_editrice).filter(Boolean))].sort()
      setPublishers(pubs)
    } catch (_) {}
  }

  async function checkDuplicate(isbnCode) {
    const clean = isbnCode.trim().replace(/[-\s]/g, '')
    if (!clean) return false
    try {
      const res = await fetch(`/api/libri?isbn_exact=${encodeURIComponent(clean)}`)
      const data = await res.json()
      if (data?.id) { setDuplicate(data); return true }
    } catch (_) {}
    return false
  }

  function reset() {
    setIsbn(''); setFound(null); setError(null); setDuplicate(null); setScanning(false)
    setShowCoverPicker(false)
    setForm({ titolo: '', autore: '', casa_editrice: '', anno_pubblicazione: '',
      descrizione: '', copertina: '', genere: '', lingua_originale: '',
      pagine: '', stato_lettura: 'letto', note_personali: '', voto: null })
  }

  // Carica immagine (camera o galleria), rimuove bg se camera, poi aggiorna form
  async function handleImageFile(file, isCamera) {
    setCoverUploading(true); setError(null)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res  = await fetch('/api/remove-bg', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          imageBase64: base64,
          mimeType:    file.type,
          filename:    file.name,
          removeBg:    isCamera,  // rimuovi sfondo solo per foto scattate
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(f => ({ ...f, copertina: data.url }))
    } catch (e) {
      setError('Errore caricamento immagine: ' + e.message)
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleBarcodeDetected(code) {
    setScanning(false)
    setIsbn(code)
    setFound(null)
    setDuplicate(null)
    // Controlla se già in libreria
    const isDup = await checkDuplicate(code)
    if (isDup) return
    // Avvia lookup automaticamente dopo lo scan
    setLookupLoading(true); setError(null)
    try {
      const res = await fetch('/api/isbn-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: code.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setFound(data)
        setForm({
          titolo:             data.titolo || '',
          autore:             (data.autore || []).join(', '),
          casa_editrice:      data.casa_editrice || '',
          anno_pubblicazione: data.anno_pubblicazione || '',
          descrizione:        data.descrizione || '',
          copertina:          data.copertina || '',
          genere:             (data.genere || []).join(', '),
          lingua_originale:   data.lingua_originale || '',
          pagine:             data.pagine || '',
          stato_lettura:      'letto',
          note_personali:     '',
          voto:               null,
        })
      } else if (res.status === 404) {
        setFound({ source: 'not_found' })
      } else {
        setError(data.error || 'Errore nel lookup')
      }
    } catch (e) {
      setError('Errore di rete: ' + e.message)
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleLookup() {
    if (!isbn.trim()) return
    setLookupLoading(true); setError(null); setFound(null)
    try {
      const res = await fetch('/api/isbn-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: isbn.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setFound(data)
        setForm({
          titolo:             data.titolo || '',
          autore:             (data.autore || []).join(', '),
          casa_editrice:      data.casa_editrice || '',
          anno_pubblicazione: data.anno_pubblicazione || '',
          descrizione:        data.descrizione || '',
          copertina:          data.copertina || '',
          genere:             (data.genere || []).join(', '),
          lingua_originale:   data.lingua_originale || '',
          pagine:             data.pagine || '',
          stato_lettura:      'letto',
          note_personali:     '',
          voto:               null,
        })
      } else if (res.status === 404) {
        setFound({ source: 'not_found' })
        // Form vuota, dati manuali
      } else {
        setError(data.error || 'Errore nel lookup')
      }
    } catch (e) {
      setError('Errore di rete: ' + e.message)
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSave() {
    if (!isbn.trim()) return
    setSaveLoading(true); setError(null); setDuplicate(null)
    // Controlla duplicato prima di salvare
    const isDup = await checkDuplicate(isbn)
    if (isDup) { setSaveLoading(false); return }
    try {
      const payload = {
        isbn:               isbn.trim().replace(/[-\s]/g, ''),
        titolo:             form.titolo || null,
        autore:             form.autore ? form.autore.split(',').map(s => s.trim()).filter(Boolean) : [],
        casa_editrice:      form.casa_editrice || null,
        anno_pubblicazione: form.anno_pubblicazione ? parseInt(form.anno_pubblicazione) : null,
        descrizione:        form.descrizione || null,
        copertina:          form.copertina || null,
        genere:             form.genere ? form.genere.split(',').map(s => s.trim()).filter(Boolean) : [],
        lingua_originale:   form.lingua_originale || null,
        pagine:             form.pagine ? parseInt(form.pagine) : null,
        stato_lettura:      form.stato_lettura,
        note_personali:     form.note_personali || null,
        voto:               form.voto || null,
        data_source:        found && found.source !== 'not_found' ? 'api' : 'manual',
      }
      const res = await fetch('/api/libri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        reset()
        onClose()
      } else {
        setError(data.error || 'Errore nel salvataggio')
      }
    } catch (e) {
      setError('Errore di rete: ' + e.message)
    } finally {
      setSaveLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
    {scanning && (
      <BarcodeScanner
        onDetected={handleBarcodeDetected}
        onClose={() => setScanning(false)}
      />
    )}
    {showCoverPicker && (
      <CoverPickerSheet
        onFile={handleImageFile}
        onUrl={url => setForm(f => ({ ...f, copertina: url }))}
        onClose={() => setShowCoverPicker(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Aggiungi libro</h2>
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* ISBN input + lookup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ISBN / EAN</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="es. 9788804668237"
                value={isbn}
                onChange={e => { setIsbn(e.target.value); setFound(null) }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {/* pulsante fotocamera */}
              <button
                type="button"
                onClick={() => setScanning(true)}
                title="Scansiona codice a barre"
                className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-brand-500 hover:border-brand-300 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !isbn.trim()}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {lookupLoading ? '...' : 'Cerca'}
              </button>
            </div>
            {found && found.source === 'not_found' && (
              <p className="text-amber-600 text-xs mt-1">ISBN non trovato online — inserisci i dati manualmente.</p>
            )}
            {found && found.source && found.source !== 'not_found' && (
              <p className="text-green-600 text-xs mt-1">✓ Dati trovati via {found.source === 'google-books' ? 'Google Books' : 'Open Library'} — puoi modificarli prima di salvare.</p>
            )}
          </div>

          {(found !== null) && (
            <>
              {/* Copertina */}
              <div className="flex gap-4 items-center">
                {/* Preview */}
                <div className="w-20 h-28 flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  {coverUploading ? (
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  ) : form.copertina ? (
                    <img src={form.copertina} alt="Copertina"
                      className="w-full h-full object-cover"
                      onError={() => setForm(f => ({ ...f, copertina: '' }))} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                {/* Pulsante cambia */}
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  disabled={coverUploading}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {form.copertina ? 'Cambia copertina' : 'Aggiungi copertina'}
                </button>
              </div>

              {/* Titolo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
                <input type="text" value={form.titolo}
                  onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Autore */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Autore/i <span className="text-gray-400 font-normal">(separati da virgola)</span>
                </label>
                <input type="text" value={form.autore}
                  onChange={e => setForm(f => ({ ...f, autore: e.target.value }))}
                  placeholder="es. Umberto Eco, Elena Ferrante"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Casa editrice + Anno */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Casa editrice</label>
                  <input
                    type="text"
                    value={form.casa_editrice}
                    onChange={e => setForm(f => ({ ...f, casa_editrice: e.target.value }))}
                    onFocus={() => { loadPublishers(); setShowPublishers(true) }}
                    onBlur={() => setTimeout(() => setShowPublishers(false), 150)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {showPublishers && publishers.length > 0 && form.casa_editrice.length >= 2 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-44 overflow-y-auto">
                      {publishers
                        .filter(p => p.toLowerCase().includes(form.casa_editrice.toLowerCase()))
                        .map(p => (
                          <li key={p}>
                            <button
                              type="button"
                              onMouseDown={() => setForm(f => ({ ...f, casa_editrice: p }))}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-brand-50 hover:text-brand-700 transition-colors"
                            >
                              {p}
                            </button>
                          </li>
                        ))
                      }
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
                  <input type="number" value={form.anno_pubblicazione}
                    onChange={e => setForm(f => ({ ...f, anno_pubblicazione: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Genere + Lingua + Pagine */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genere/i</label>
                  <input type="text" value={form.genere}
                    onChange={e => setForm(f => ({ ...f, genere: e.target.value }))}
                    placeholder="es. Romanzo, Storico"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lingua orig.</label>
                  <input type="text" value={form.lingua_originale}
                    onChange={e => setForm(f => ({ ...f, lingua_originale: e.target.value }))}
                    placeholder="es. it, en"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pagine</label>
                  <input type="number" value={form.pagine}
                    onChange={e => setForm(f => ({ ...f, pagine: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Stato lettura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stato lettura</label>
                <div className="flex gap-2">
                  {[
                    { value: 'da_leggere', label: 'Da leggere' },
                    { value: 'in_lettura', label: 'In lettura' },
                    { value: 'letto',      label: 'Letto' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, stato_lettura: opt.value }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${form.stato_lettura === opt.value
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voto personale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voto personale</label>
                <StarPicker value={form.voto} onChange={v => setForm(f => ({ ...f, voto: v }))} />
              </div>

              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={form.descrizione}
                  onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Note personali */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note personali</label>
                <textarea value={form.note_personali}
                  onChange={e => setForm(f => ({ ...f, note_personali: e.target.value }))}
                  rows={2}
                  placeholder="Appunti, riflessioni, contesto..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </>
          )}

          {duplicate && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-3 items-start">
              <span className="text-xl flex-shrink-0">📚</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-800 text-sm">Libro già in libreria</p>
                <p className="text-amber-700 text-xs mt-0.5 truncate">
                  {duplicate.titolo || `ISBN ${duplicate.isbn}`}
                </p>
                <Link href={`/libro/${duplicate.id}`} className="text-xs text-brand-500 hover:underline font-medium mt-1 inline-block">
                  Apri la scheda →
                </Link>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={() => { reset(); onClose() }}
            className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Annulla
          </button>
          {found !== null && (
            <>
              <button onClick={() => { reset(); setScanning(true) }}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                + Nuovo
              </button>
              <button onClick={handleSave} disabled={saveLoading}
                className="px-6 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {saveLoading ? 'Salvataggio...' : 'Salva libro'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Filtri ─────────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',             label: 'Tutti' },
  { key: 'da_leggere',     label: 'Da leggere' },
  { key: 'in_lettura',     label: 'In lettura' },
  { key: 'letto',          label: 'Letti' },
  { key: 'dati_mancanti',  label: 'Dati mancanti' },
  { key: 'senza_copertina', label: 'Senza copertina' },
]

// ─── Pagina principale ────────────────────────────────────────────────────────
export default function Libri() {
  const router = useRouter()
  const [libri, setLibri]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(new Set())
  const [showModal, setShowModal]   = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)
  const [extraCols, setExtraCols]   = useState([])
  const [groupBy, setGroupBy]       = useState('none') // 'none' | 'casa_editrice'

  // Carica preferenze colonne da localStorage
  useEffect(() => { setExtraCols(loadExtraCols()) }, [])

  // Sync filtro da URL
  useEffect(() => {
    if (router.query.filter) setFilter(router.query.filter)
  }, [router.query.filter])

  // FAB dal bottom nav mobile: /libri?add=1 apre il modal
  useEffect(() => {
    if (router.query.add === '1') {
      setShowModal(true)
      router.replace('/libri', undefined, { shallow: true })
    }
  }, [router.query.add])

  const fetchLibri = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/libri?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLibri(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => { fetchLibri() }, [fetchLibri])

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === libri.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(libri.map(l => l.id)))
    }
  }

  async function bulkSegnaLetti() {
    const ids = [...selected]
    if (!ids.length) return
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id =>
        fetch('/api/libri', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, stato_lettura: 'letto' }),
        })
      ))
      setLibri(prev => prev.map(l => selected.has(l.id) ? { ...l, stato_lettura: 'letto' } : l))
      setSelected(new Set())
    } catch (e) {
      alert('Errore: ' + e.message)
    } finally {
      setBulkLoading(false)
    }
  }

  function handleSaved(newLibro) {
    setLibri(prev => [newLibro, ...prev])
  }

  // Raggruppamento
  const groups = groupBy === 'casa_editrice'
    ? Object.entries(
        libri.reduce((acc, l) => {
          const k = l.casa_editrice || '— Senza editore'
          if (!acc[k]) acc[k] = []
          acc[k].push(l)
          return acc
        }, {})
      ).sort(([a], [b]) => a.localeCompare(b, 'it'))
    : [['', libri]]

  // Colonne extra attive
  const activeCols = OPTIONAL_COLS.filter(c => extraCols.includes(c.key))
  const useScrollMobile = activeCols.length > 0

  return (
    <Layout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Libreria</h1>
          <p className="text-gray-500 mt-1">{libri.length} libri mostrati</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          + Aggiungi libro
        </button>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Cerca per ISBN, titolo o autore..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSelected(new Set()) }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${filter === f.key
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setGroupBy(g => g === 'casa_editrice' ? 'none' : 'casa_editrice')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1
                ${groupBy === 'casa_editrice'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Per editore
            </button>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selected.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-4 flex items-center gap-3 text-sm">
          <span className="text-brand-700 font-medium">{selected.size} selezionati</span>
          <button
            onClick={bulkSegnaLetti}
            disabled={bulkLoading}
            className="px-4 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            ✓ Segna come letti
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            ✕ Deseleziona
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {/* ── MOBILE: card list (default) o scroll table (extra cols) ─── */}
      <div className="sm:hidden bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <input type="checkbox" checked={selected.size === libri.length && libri.length > 0}
            onChange={toggleSelectAll} className="rounded flex-shrink-0" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{libri.length} libri</span>
          {useScrollMobile && (
            <span className="ml-auto text-xs text-amber-600 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              scroll
            </span>
          )}
        </div>

        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 animate-pulse">
              <div className="w-4 h-4 bg-gray-100 rounded flex-shrink-0" />
              <div className="w-10 h-14 bg-gray-100 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : libri.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-sm">Nessun libro trovato.</p>
          </div>
        ) : useScrollMobile ? (
          /* ── scroll table mobile (extra cols attive) ─────────── */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="p-2 w-8" />
                  <th className="p-2 w-12 text-xs font-medium text-gray-500">Cover</th>
                  <th className="p-2 text-xs font-medium text-gray-500">Titolo</th>
                  <th className="p-2 text-xs font-medium text-gray-500">Stato</th>
                  {activeCols.map(col => (
                    <th key={col.key} className="p-2 text-xs font-medium text-gray-500 whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.flatMap(([groupName, groupLibri]) => [
                  groupName && (
                    <tr key={`gh-${groupName}`} className="bg-indigo-50 border-y border-indigo-100">
                      <td colSpan={4 + activeCols.length} className="px-3 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">{groupName}</td>
                    </tr>
                  ),
                  ...groupLibri.map(libro => (
                    <tr key={libro.id} onClick={() => setSelectedBook(libro)}
                      className={`border-b border-gray-100 cursor-pointer active:bg-gray-50 ${selected.has(libro.id) ? 'bg-brand-50' : ''}`}>
                      <td className="p-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(libro.id)} onChange={() => toggleSelect(libro.id)} className="rounded" />
                      </td>
                      <td className="p-2">
                        {libro.copertina
                          ? <img src={libro.copertina} alt="" className="w-8 h-11 object-cover rounded border border-gray-200" onError={e => { e.target.src = 'https://placehold.co/32x44?text=?' }} />
                          : <div className="w-8 h-11 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-xs">📖</div>}
                      </td>
                      <td className="p-2 max-w-[120px]">
                        <p className="font-medium text-gray-900 text-xs truncate">{libro.titolo || '—'}</p>
                        <p className="text-gray-400 text-xs truncate">{libro.autore?.join(', ') || libro.isbn}</p>
                      </td>
                      <td className="p-2"><StatoBadge stato={libro.stato_lettura} /></td>
                      {activeCols.map(col => (
                        <td key={col.key} className={`p-2 text-xs text-gray-600 whitespace-nowrap ${col.className || ''}`}>
                          {col.Component ? <col.Component libro={libro} /> : col.render(libro)}
                        </td>
                      ))}
                    </tr>
                  ))
                ].filter(Boolean))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── card list mobile (nessuna extra col) ────────────── */
          groups.flatMap(([groupName, groupLibri]) => [
            groupName && (
              <div key={`gh-${groupName}`} className="px-4 py-2 bg-indigo-50 border-y border-indigo-100 text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                {groupName}
              </div>
            ),
            ...groupLibri.map(libro => (
              <div key={libro.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors ${selected.has(libro.id) ? 'bg-brand-50' : ''}`}>
                <input type="checkbox" checked={selected.has(libro.id)} onChange={() => toggleSelect(libro.id)}
                  className="rounded flex-shrink-0" onClick={e => e.stopPropagation()} />
                <button type="button" onClick={() => setSelectedBook(libro)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {libro.copertina
                    ? <img src={libro.copertina} alt={libro.titolo || libro.isbn} className="w-10 h-14 object-cover rounded border border-gray-200 flex-shrink-0" onError={e => { e.target.src = 'https://placehold.co/40x56?text=?' }} />
                    : <div className="w-10 h-14 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-base flex-shrink-0">📖</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate leading-snug">
                      {libro.titolo || <span className="text-gray-400 italic">Titolo mancante</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {libro.autore?.length > 0 ? libro.autore.join(', ') : libro.isbn}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StatoBadge stato={libro.stato_lettura} />
                      <span className="text-xs tracking-tight">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={n <= (libro.voto||0) ? 'text-amber-400' : 'text-gray-300'}>★</span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-300 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ))
          ].filter(Boolean))
        )}
      </div>

      {/* ── DESKTOP: table ─────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 w-10">
                <input type="checkbox" checked={selected.size === libri.length && libri.length > 0}
                  onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="p-3 text-left font-medium text-gray-600 w-16">Copertina</th>
              <th className="p-3 text-left font-medium text-gray-600">Titolo</th>
              <th className="p-3 text-left font-medium text-gray-600">Autore</th>
              <th className="p-3 text-left font-medium text-gray-600 w-16">Anno</th>
              <th className="p-3 text-left font-medium text-gray-600">Stato</th>
              <th className="p-3 text-left font-medium text-gray-600">Dati</th>
              {activeCols.map(col => (
                <th key={col.key} className="p-3 text-left font-medium text-gray-600 whitespace-nowrap">{col.label}</th>
              ))}
              <th className="p-3 text-left font-medium text-gray-600 w-20">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100 animate-pulse">
                  {[...Array(8 + activeCols.length)].map((_, j) => (
                    <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : libri.length === 0 ? (
              <tr>
                <td colSpan={8 + activeCols.length} className="p-12 text-center text-gray-400">
                  <p className="text-4xl mb-3">📚</p>
                  <p>Nessun libro trovato.</p>
                  {filter === 'all' && <p className="text-sm mt-2">Clicca <strong>"+ Aggiungi libro"</strong> per iniziare.</p>}
                </td>
              </tr>
            ) : (
              groups.flatMap(([groupName, groupLibri]) => [
                groupName && (
                  <tr key={`gh-${groupName}`} className="bg-indigo-50 border-y border-indigo-100">
                    <td colSpan={8 + activeCols.length} className="px-4 py-2 text-xs font-semibold text-indigo-700 uppercase tracking-wide">{groupName}</td>
                  </tr>
                ),
                ...groupLibri.map(libro => (
                  <tr key={libro.id} onClick={() => setSelectedBook(libro)}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${selected.has(libro.id) ? 'bg-brand-50' : ''}`}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(libro.id)} onChange={() => toggleSelect(libro.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      {libro.copertina
                        ? <img src={libro.copertina} alt={libro.titolo || libro.isbn} className="w-10 h-14 object-cover rounded border border-gray-200" onError={e => { e.target.src = 'https://placehold.co/40x56?text=?' }} />
                        : <div className="w-10 h-14 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-lg">📖</div>}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-800 max-w-xs truncate">
                        {libro.titolo || <span className="text-gray-300 italic">— titolo mancante</span>}
                      </div>
                      <div className="font-mono text-xs text-gray-400 mt-0.5">{libro.isbn}</div>
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">
                      {libro.autore?.length > 0 ? libro.autore.join(', ') : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-3 text-gray-500">{libro.anno_pubblicazione || '—'}</td>
                    <td className="p-3"><StatoBadge stato={libro.stato_lettura} /></td>
                    <td className="p-3"><FonteBadge source={libro.data_source} /></td>
                    {activeCols.map(col => (
                      <td key={col.key} className={`p-3 text-gray-600 ${col.className || ''}`}>
                        {col.Component ? <col.Component libro={libro} /> : col.render(libro)}
                      </td>
                    ))}
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Link href={`/libro/${libro.id}`}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                        Modifica
                      </Link>
                    </td>
                  </tr>
                ))
              ].filter(Boolean))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail sheet */}
      {selectedBook && (
        <BookDetailSheet libro={selectedBook} onClose={() => setSelectedBook(null)} />
      )}

      <AggiungiLibroModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />
    </Layout>
  )
}
