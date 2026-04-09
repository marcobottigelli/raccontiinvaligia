import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

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

// ─── Modal aggiungi libro ──────────────────────────────────────────────────────
function AggiungiLibroModal({ isOpen, onClose, onSaved }) {
  const [isbn, setIsbn]           = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saveLoading, setSaveLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [found, setFound]         = useState(null) // dati dal lookup
  const [form, setForm]           = useState({
    titolo: '', autore: '', casa_editrice: '', anno_pubblicazione: '',
    descrizione: '', copertina: '', genere: '', lingua_originale: '',
    pagine: '', stato_lettura: 'da_leggere', note_personali: '',
  })

  function reset() {
    setIsbn(''); setFound(null); setError(null)
    setForm({ titolo: '', autore: '', casa_editrice: '', anno_pubblicazione: '',
      descrizione: '', copertina: '', genere: '', lingua_originale: '',
      pagine: '', stato_lettura: 'da_leggere', note_personali: '' })
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
          stato_lettura:      'da_leggere',
          note_personali:     '',
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
    setSaveLoading(true); setError(null)
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
              {/* Copertina preview */}
              {form.copertina && (
                <div className="flex gap-4 items-start">
                  <img
                    src={form.copertina}
                    alt="Copertina"
                    className="w-20 h-28 object-cover rounded-lg border border-gray-200 shadow-sm"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL copertina</label>
                    <input
                      type="text"
                      value={form.copertina}
                      onChange={e => setForm(f => ({ ...f, copertina: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Casa editrice</label>
                  <input type="text" value={form.casa_editrice}
                    onChange={e => setForm(f => ({ ...f, casa_editrice: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
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
            <button onClick={handleSave} disabled={saveLoading}
              className="px-6 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saveLoading ? 'Salvataggio...' : 'Salva libro'}
            </button>
          )}
        </div>
      </div>
    </div>
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

  // Sync filtro da URL
  useEffect(() => {
    if (router.query.filter) setFilter(router.query.filter)
  }, [router.query.filter])

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

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === libri.length && libri.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left font-medium text-gray-600 w-16">Copertina</th>
                <th className="p-3 text-left font-medium text-gray-600">Titolo</th>
                <th className="p-3 text-left font-medium text-gray-600">Autore</th>
                <th className="p-3 text-left font-medium text-gray-600 w-16">Anno</th>
                <th className="p-3 text-left font-medium text-gray-600">Stato</th>
                <th className="p-3 text-left font-medium text-gray-600">Dati</th>
                <th className="p-3 text-left font-medium text-gray-600 w-20">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 animate-pulse">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : libri.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    <p className="text-4xl mb-3">📚</p>
                    <p>Nessun libro trovato.</p>
                    {filter === 'all' && (
                      <p className="text-sm mt-2">
                        Clicca <strong>"+ Aggiungi libro"</strong> per iniziare la tua libreria.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                libri.map(libro => (
                  <tr
                    key={libro.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors
                      ${selected.has(libro.id) ? 'bg-brand-50' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(libro.id)}
                        onChange={() => toggleSelect(libro.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3">
                      {libro.copertina ? (
                        <img
                          src={libro.copertina}
                          alt={libro.titolo || libro.isbn}
                          className="w-10 h-14 object-cover rounded border border-gray-200"
                          onError={e => { e.target.src = 'https://placehold.co/40x56?text=?' }}
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-lg">
                          📖
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-800 max-w-xs truncate">
                        {libro.titolo || <span className="text-gray-300 italic">— titolo mancante</span>}
                      </div>
                      <div className="font-mono text-xs text-gray-400 mt-0.5">{libro.isbn}</div>
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">
                      {libro.autore && libro.autore.length > 0
                        ? libro.autore.join(', ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-3 text-gray-500">{libro.anno_pubblicazione || '—'}</td>
                    <td className="p-3"><StatoBadge stato={libro.stato_lettura} /></td>
                    <td className="p-3"><FonteBadge source={libro.data_source} /></td>
                    <td className="p-3">
                      <Link
                        href={`/libro/${libro.id}`}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Modifica
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AggiungiLibroModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />
    </Layout>
  )
}
