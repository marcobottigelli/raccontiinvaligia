import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const EMPTY_FORM = { servizio: '', api_key: '', note: '' }

// ─── Colonne libreria ─────────────────────────────────────────────────────────
const LS_KEY = 'libreria_cols_v1'

export const DEFAULT_COLS = ['copertina', 'titolo', 'autore', 'stato_lettura']

export const OPTIONAL_COLS = [
  { key: 'anno',          label: 'Anno pubblicazione' },
  { key: 'casa_editrice', label: 'Casa editrice'      },
  { key: 'voto',          label: 'Voto stelline'      },
  { key: 'genere',        label: 'Genere'             },
  { key: 'lingua',        label: 'Lingua originale'   },
  { key: 'pagine',        label: 'Pagine'             },
  { key: 'fonte',         label: 'Fonte dati'         },
  { key: 'isbn',          label: 'ISBN'               },
]

export function loadExtraCols() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function saveExtraCols(cols) {
  localStorage.setItem(LS_KEY, JSON.stringify(cols))
}

function ColonneLibreria() {
  const [extras, setExtras] = useState([])

  useEffect(() => { setExtras(loadExtraCols()) }, [])

  function toggle(key) {
    const next = extras.includes(key) ? extras.filter(k => k !== key) : [...extras, key]
    setExtras(next)
    saveExtraCols(next)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
        Colonne libreria
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        I campi in grigio sono sempre visibili. Aggiungerne altri attiva lo scroll orizzontale su mobile.
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Default — grayed, non cliccabili */}
        {DEFAULT_COLS.map(key => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-default select-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {OPTIONAL_COLS.find(c => c.key === key)?.label ?? key.replace('_', ' ')}
          </span>
        ))}

        {/* Opzionali — togglabili */}
        {OPTIONAL_COLS.map(col => {
          const active = extras.includes(col.key)
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggle(col.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${active
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {active && (
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {col.label}
            </button>
          )
        })}
      </div>

      {extras.length > 0 && (
        <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {extras.length} campo{extras.length > 1 ? 'i extra attivi' : ' extra attivo'} — visualizzazione a tabella su mobile.
        </p>
      )}
    </div>
  )
}

export default function Settings() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [revealed, setRevealed] = useState({})   // id → true per mostrare la chiave in chiaro

  async function load() {
    setLoading(true)
    const res = await fetch('/api/impostazioni')
    if (!res.ok) { setError('Errore nel caricamento'); setLoading(false); return }
    setRows(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(row) {
    setEditingId(row.id)
    setForm({ servizio: row.servizio, api_key: row.api_key ?? '', note: row.note ?? '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function save() {
    if (!form.servizio.trim()) return
    setSaving(true)
    const method = editingId ? 'PUT' : 'POST'
    const body   = editingId ? { id: editingId, ...form } : form
    const res    = await fetch('/api/impostazioni', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { setError('Errore nel salvataggio'); return }
    setEditingId(null)
    setForm(EMPTY_FORM)
    load()
  }

  async function remove(id) {
    if (!confirm('Eliminare questa voce?')) return
    await fetch(`/api/impostazioni?id=${id}`, { method: 'DELETE' })
    load()
  }

  function toggleReveal(id) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function maskKey(key) {
    if (!key) return '—'
    if (key.length <= 8) return '•'.repeat(key.length)
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4)
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-500 mt-1">Chiavi API e configurazioni per servizi esterni</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* COLONNE LIBRERIA */}
      <ColonneLibreria />

      {/* FORM aggiunta / modifica */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
          {editingId ? 'Modifica voce' : 'Aggiungi servizio'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Servizio *</label>
            <input
              type="text"
              placeholder="es. openai, wordpress"
              value={form.servizio}
              onChange={e => setForm(f => ({ ...f, servizio: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">API Key</label>
            <input
              type="text"
              placeholder="sk-..."
              value={form.api_key}
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input
              type="text"
              placeholder="Descrizione opzionale"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={save}
            disabled={saving || !form.servizio.trim()}
            className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvataggio…' : editingId ? 'Aggiorna' : 'Aggiungi'}
          </button>
          {editingId && (
            <button
              onClick={cancelEdit}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Annulla
            </button>
          )}
        </div>
      </div>

      {/* TABELLA */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Caricamento…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nessun servizio configurato. Aggiungi la prima voce sopra.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Servizio</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">API Key</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Aggiornato</th>
                <th className="px-5 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.servizio}</td>
                  <td className="px-5 py-3 font-mono text-gray-600">
                    <div className="flex items-center gap-2">
                      <span>{revealed[row.id] ? (row.api_key || '—') : maskKey(row.api_key)}</span>
                      {row.api_key && (
                        <button
                          onClick={() => toggleReveal(row.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title={revealed[row.id] ? 'Nascondi' : 'Mostra'}
                        >
                          {revealed[row.id] ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{row.note || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {row.aggiornato_il ? new Date(row.aggiornato_il).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => startEdit(row)}
                        className="text-xs px-3 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => remove(row.id)}
                        className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SQL hint */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Setup DB (solo prima volta)</p>
        <pre className="text-xs text-gray-600 overflow-x-auto">{`CREATE TABLE impostazioni (
  id            SERIAL PRIMARY KEY,
  servizio      TEXT NOT NULL,
  api_key       TEXT,
  note          TEXT,
  aggiornato_il TIMESTAMPTZ DEFAULT now()
);`}</pre>
      </div>
    </Layout>
  )
}
