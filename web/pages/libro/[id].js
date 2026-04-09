import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'

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

  const [libro, setLibro]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(false)
  const [form, setForm]         = useState(null)

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
          <div className="flex-shrink-0">
            {form?.copertina ? (
              <img
                src={form.copertina}
                alt={form.titolo}
                className="w-28 h-40 object-cover rounded-xl border border-gray-200 shadow-sm"
                onError={e => { e.target.src = 'https://placehold.co/112x160?text=?' }}
              />
            ) : (
              <div className="w-28 h-40 bg-gray-100 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-center p-2">
                <span className="text-3xl mb-1">📖</span>
                <span className="text-xs">Copertina mancante</span>
              </div>
            )}
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

          <Campo label="URL copertina">
            <input type="text" value={form?.copertina || ''} onChange={e => setField('copertina', e.target.value)}
              placeholder="https://... oppure path Supabase Storage"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {!form?.copertina && (
              <p className="text-xs text-gray-400 mt-1">
                Nessuna copertina. Fotografa il libro e usa{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">python scripts/remove_bg.py --update-db</code>{' '}
                per aggiungerla.
              </p>
            )}
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
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
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
    </Layout>
  )
}
