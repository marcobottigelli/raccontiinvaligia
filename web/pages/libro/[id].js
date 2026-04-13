import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'

// ─── Cover picker sheet ───────────────────────────────────────────────────────
function CoverPickerSheet({ onFile, onUrl, onClose, isbn }) {
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)
  const [urlMode,    setUrlMode]    = useState(false)
  const [urlVal,     setUrlVal]     = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [searching,  setSearching]  = useState(false)
  const [foundCover, setFoundCover] = useState(null)
  const [searchErr,  setSearchErr]  = useState(false)
  const waitingRef = useRef(false)

  function openPicker(ref) {
    waitingRef.current = true
    ref.current.click()
    const handleVisible = () => {
      if (waitingRef.current) {
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
        ) : searchMode ? (
          <div className="space-y-3">
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-500 text-sm">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                Ricerca copertina...
              </div>
            )}
            {!searching && foundCover && (
              <div className="flex flex-col items-center gap-3">
                <img src={foundCover.url} alt="Copertina trovata"
                  className="h-40 object-contain rounded-lg border border-gray-200 shadow-sm"
                  onError={() => { setFoundCover(null); setSearchErr(true) }}
                />
                <p className="text-xs text-gray-400">via {foundCover.source === 'google-books' ? 'Google Books' : 'Open Library'}</p>
                <button onClick={() => { onUrl(foundCover.url); onClose() }}
                  className="w-full py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600">
                  Usa questa copertina
                </button>
              </div>
            )}
            {!searching && searchErr && (
              <p className="text-center text-sm text-amber-600 py-4">Nessuna copertina trovata online per questo ISBN.</p>
            )}
            <button onClick={() => { setSearchMode(false); setFoundCover(null); setSearchErr(false) }}
              className="w-full py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">
              Indietro
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
            {/* Cerca online */}
            {isbn && (
              <button onClick={async () => {
                setSearchMode(true); setSearching(true); setFoundCover(null); setSearchErr(false)
                try {
                  const r = await fetch('/api/isbn-lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isbn }),
                  })
                  if (r.ok) {
                    const d = await r.json()
                    if (d.copertina) setFoundCover({ url: d.copertina, source: d.source })
                    else setSearchErr(true)
                  } else setSearchErr(true)
                } catch (_) { setSearchErr(true) }
                finally { setSearching(false) }
              }}
                className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <span className="text-xs text-gray-600 font-medium">Cerca online</span>
              </button>
            )}
          </div>
        )}

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
          className="hidden" onChange={e => { waitingRef.current = false; if (e.target.files[0]) onFile(e.target.files[0], true);  onClose() }} />
        <input ref={galleryRef} type="file" accept="image/*"
          className="hidden" onChange={e => { waitingRef.current = false; if (e.target.files[0]) onFile(e.target.files[0], false); onClose() }} />
      </div>
    </div>
  )
}

// ─── Stato lettura toggle ─────────────────────────────────────────────────────
function StatoToggle({ value, onChange }) {
  const options = [
    { value: 'da_leggere', label: 'Da leggere', color: 'gray' },
    { value: 'in_lettura', label: '📖 In lettura', color: 'blue' },
    { value: 'letto',      label: '✓ Letto',      color: 'green' },
  ]
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
            ${value === opt.value
              ? opt.color === 'green' ? 'bg-green-600 text-white border-green-600'
              : opt.color === 'blue'  ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-gray-600 text-white border-gray-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Star picker ─────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value ?? 0
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          onMouseEnter={() => setHovered(n)}
          className="text-3xl leading-none transition-transform active:scale-90 select-none"
          aria-label={`${n} stelle`}
        >
          <span className={n <= display ? 'text-amber-400' : 'text-gray-200'}>★</span>
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-gray-400 hover:text-gray-600 self-center"
        >
          ✕ rimuovi
        </button>
      )}
    </div>
  )
}

// ─── Campo form ──────────────────────────────────────────────────────────────
function Campo({ label, children, note }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {note && <span className="text-gray-400 font-normal ml-1">{note}</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Pagina dettaglio libro ───────────────────────────────────────────────────
export default function DettaglioLibro() {
  const router = useRouter()
  const { id } = router.query

  const [libro, setLibro]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)
  const [form, setForm]             = useState(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [coverUploading, setCoverUploading]   = useState(false)

  useEffect(() => {
    if (!id) return
    async function fetch_() {
      try {
        const res = await fetch(`/api/libri?id=${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setLibro(data)
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
          stato_lettura:      data.stato_lettura || 'da_leggere',
          note_personali:     data.note_personali || '',
          voto:               data.voto || null,
          data_source:        data.data_source || 'pending',
        })
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [id])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    setSuccess(false)
  }

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
          removeBg:    isCamera,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setField('copertina', data.url)
    } catch (e) {
      setError('Errore caricamento immagine: ' + e.message)
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(false)
    try {
      const payload = {
        id,
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
        data_source:        form.data_source,
      }
      const res = await fetch('/api/libri', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLibro(data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminare "${libro?.titolo || libro?.isbn}"? L'operazione non è reversibile.`)) return
    try {
      const res = await fetch(`/api/libri?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/libri')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4 max-w-3xl">
          <div className="h-8 bg-gray-100 rounded w-64" />
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </Layout>
    )
  }

  if (error && !form) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">
          {error}
        </div>
        <Link href="/libri" className="text-brand-500 hover:underline text-sm">← Torna alla libreria</Link>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/libri" className="hover:text-brand-500 transition-colors">Libreria</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium truncate max-w-xs">
          {libro?.titolo || libro?.isbn}
        </span>
      </div>

      <form onSubmit={handleSave} className="max-w-3xl space-y-8">

        {/* COPERTINA + HEADER */}
        <div className="flex gap-6 items-start">
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <button type="button" onClick={() => setShowCoverPicker(true)}
              className="relative group focus:outline-none">
              {coverUploading ? (
                <div className="w-28 h-40 bg-gray-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Caricamento...</span>
                </div>
              ) : form?.copertina ? (
                <div className="relative">
                  <img
                    src={form.copertina}
                    alt={form.titolo}
                    className="w-28 h-40 object-cover rounded-xl border border-gray-200 shadow-sm group-hover:opacity-80 transition-opacity"
                    onError={e => { e.target.src = 'https://placehold.co/112x160?text=?' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/60 text-white text-xs rounded-lg px-2 py-1">Cambia</span>
                  </div>
                </div>
              ) : (
                <div className="w-28 h-40 bg-gray-100 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-center p-2 group-hover:bg-gray-50 transition-colors">
                  <span className="text-3xl mb-1">📖</span>
                  <span className="text-xs">Aggiungi copertina</span>
                </div>
              )}
            </button>
            <button type="button" onClick={() => setShowCoverPicker(true)}
              disabled={coverUploading}
              className="text-xs text-brand-500 hover:text-brand-600 disabled:opacity-40 transition-colors">
              Cambia copertina
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {libro?.titolo || <span className="text-gray-400 italic">Titolo mancante</span>}
                </h1>
                {libro?.autore && libro.autore.length > 0 && (
                  <p className="text-gray-600 mt-1">{libro.autore.join(', ')}</p>
                )}
                <p className="font-mono text-xs text-gray-400 mt-2">ISBN: {libro?.isbn}</p>
              </div>
            </div>

            {/* Stato lettura in evidenza */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Stato lettura</p>
              <StatoToggle
                value={form?.stato_lettura}
                onChange={v => setField('stato_lettura', v)}
              />
            </div>

            {/* Voto personale */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Voto personale</p>
              <StarPicker value={form?.voto} onChange={v => setField('voto', v)} />
            </div>
          </div>
        </div>

        {/* DATI BIBLIOGRAFICI */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Dati bibliografici</h2>

          <Campo label="Titolo">
            <input type="text" value={form?.titolo || ''} onChange={e => setField('titolo', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Campo>

          <Campo label="Autore/i" note="(separati da virgola)">
            <input type="text" value={form?.autore || ''} onChange={e => setField('autore', e.target.value)}
              placeholder="es. Umberto Eco, Elena Ferrante"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Casa editrice">
              <input type="text" value={form?.casa_editrice || ''} onChange={e => setField('casa_editrice', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Campo>
            <Campo label="Anno di pubblicazione">
              <input type="number" value={form?.anno_pubblicazione || ''} onChange={e => setField('anno_pubblicazione', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Campo>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Campo label="Genere/i" note="(separati da virgola)">
              <input type="text" value={form?.genere || ''} onChange={e => setField('genere', e.target.value)}
                placeholder="es. Romanzo, Storico"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Campo>
            <Campo label="Lingua originale">
              <input type="text" value={form?.lingua_originale || ''} onChange={e => setField('lingua_originale', e.target.value)}
                placeholder="es. it, en, fr"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Campo>
            <Campo label="Pagine">
              <input type="number" value={form?.pagine || ''} onChange={e => setField('pagine', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Campo>
          </div>

          <Campo label="Descrizione / Sinossi">
            <textarea value={form?.descrizione || ''} onChange={e => setField('descrizione', e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </Campo>

          <Campo label="Copertina">
            <div className="flex items-center gap-3">
              {form?.copertina && (
                <img src={form.copertina} alt="" className="w-10 h-14 object-cover rounded border border-gray-200 flex-shrink-0"
                  onError={e => { e.target.style.display = 'none' }} />
              )}
              <div className="flex-1 min-w-0">
                <input type="text" value={form?.copertina || ''} onChange={e => setField('copertina', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button type="button" onClick={() => setShowCoverPicker(true)}
                disabled={coverUploading}
                className="flex-shrink-0 px-3 py-2.5 text-sm text-brand-500 border border-brand-300 rounded-lg hover:bg-brand-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                {coverUploading ? '...' : 'Cambia'}
              </button>
            </div>
          </Campo>

          <Campo label="Fonte dati">
            <select value={form?.data_source || 'pending'} onChange={e => setField('data_source', e.target.value)}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="api">API (automatico)</option>
              <option value="manual">Manuale</option>
              <option value="pending">Mancante</option>
            </select>
          </Campo>
        </section>

        {/* NOTE PERSONALI */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Note personali</h2>
          <Campo label="Appunti, riflessioni, contesto">
            <textarea value={form?.note_personali || ''} onChange={e => setField('note_personali', e.target.value)}
              rows={4}
              placeholder="Pensieri sul libro, dove l'ho comprato, chi me lo ha consigliato..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </Campo>
        </section>

        {/* RECENSIONE — future-ready */}
        <section className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 space-y-4 opacity-70">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-600">Recensione WordPress</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Prossimamente
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Stato: <strong>{
              libro?.wordpress_status === 'pubblicata' ? '✓ Pubblicata'
              : libro?.wordpress_status === 'bozza' ? '📝 Bozza'
              : '— Non pubblicata'
            }</strong>
            {libro?.wordpress_post_id && (
              <span className="ml-3 text-xs text-gray-400">Post ID: {libro.wordpress_post_id}</span>
            )}
          </p>
          <textarea
            value={libro?.recensione_testo || ''}
            disabled
            rows={5}
            placeholder="La recensione (HTML) apparirà qui. Funzionalità in arrivo."
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white text-gray-400 resize-none cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="px-5 py-2.5 bg-gray-300 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
          >
            ↑ Pubblica su WordPress (prossimamente)
          </button>
        </section>

        {/* FEEDBACK + SALVA */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm font-medium">
            ✓ Modifiche salvate correttamente.
          </div>
        )}

        <div className="flex items-center justify-between pb-8">
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-500 hover:text-red-700 transition-colors px-3 py-2.5 -ml-3 rounded-lg hover:bg-red-50 min-h-[44px] flex items-center"
          >
            Elimina libro
          </button>
          <div className="flex gap-3">
            <Link href="/libri"
              className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Annulla
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      </form>

      {showCoverPicker && (
        <CoverPickerSheet
          onFile={handleImageFile}
          onUrl={url => setField('copertina', url)}
          onClose={() => setShowCoverPicker(false)}
          isbn={libro?.isbn}
        />
      )}
    </Layout>
  )
}
