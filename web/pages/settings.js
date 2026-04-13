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

// ─── Gestione editori ─────────────────────────────────────────────────────────
function GestisciEditori() {
  const [open, setOpen]           = useState(false)
  const [editori, setEditori]     = useState([])  // { nome, count }[]
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [editingNome, setEditingNome] = useState(null)  // nome in editing
  const [editVal, setEditVal]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState(new Set())  // nomi selezionati per merge
  const [mergeTarget, setMergeTarget] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/editori')
      if (res.ok) setEditori(await res.json())
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    if (!open) load()
    setOpen(o => !o)
    setSearch(''); setEditingNome(null); setSelected(new Set()); setMergeTarget('')
  }

  function startEdit(nome) {
    setEditingNome(nome)
    setEditVal(nome)
  }

  function cancelEdit() {
    setEditingNome(null)
    setEditVal('')
  }

  async function saveRename(vecchio, nuovo) {
    if (!nuovo.trim() || nuovo.trim() === vecchio) { cancelEdit(); return }
    setSaving(true)
    try {
      const res = await fetch('/api/editori', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vecchio_nome: vecchio, nuovo_nome: nuovo.trim() }),
      })
      if (res.ok) {
        setEditori(prev => {
          const existing = prev.find(e => e.nome === nuovo.trim())
          const old      = prev.find(e => e.nome === vecchio)
          if (existing) {
            // Fondi: aggiorna count del nome esistente, rimuovi il vecchio
            return prev
              .map(e => e.nome === nuovo.trim() ? { ...e, count: e.count + old.count } : e)
              .filter(e => e.nome !== vecchio)
              .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'it'))
          }
          return prev
            .map(e => e.nome === vecchio ? { ...e, nome: nuovo.trim() } : e)
            .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'it'))
        })
      }
    } finally {
      setSaving(false)
      cancelEdit()
    }
  }

  async function handleMerge() {
    const target = mergeTarget.trim()
    if (!target || selected.size < 2) return
    setSaving(true)
    try {
      const nomiDaUnire = [...selected].filter(n => n !== target)
      for (const vecchio of nomiDaUnire) {
        await fetch('/api/editori', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vecchio_nome: vecchio, nuovo_nome: target }),
        })
      }
      setEditori(prev => {
        let result = [...prev]
        const totalCount = [...selected].reduce((sum, n) => {
          const e = prev.find(x => x.nome === n)
          return sum + (e?.count || 0)
        }, 0)
        // Rimuovi tutti i selezionati, aggiungi/aggiorna il target
        result = result.filter(e => !selected.has(e.nome))
        const existing = result.find(e => e.nome === target)
        if (existing) {
          result = result.map(e => e.nome === target ? { ...e, count: e.count + totalCount } : e)
        } else {
          result.push({ nome: target, count: totalCount })
        }
        return result.sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'it'))
      })
      setSelected(new Set())
      setMergeTarget('')
    } finally {
      setSaving(false)
    }
  }

  function toggleSelect(nome) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  const filtered = editori.filter(e =>
    !search || e.nome.toLowerCase().includes(search.toLowerCase())
  )

  // Quando si selezionano 2+, prepopola il nome canonico con quello più frequente tra i selezionati
  const selectedList  = editori.filter(e => selected.has(e.nome))
  const mostFrequent  = selectedList.sort((a, b) => b.count - a.count)[0]?.nome || ''

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-8 overflow-hidden">
      {/* Header collassabile */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Gestisci editori</p>
          <p className="text-xs text-gray-400 mt-0.5">Normalizza e unifica i nomi degli editori a database</p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 pb-6 pt-4">
          {loading ? (
            <div className="text-sm text-gray-400 animate-pulse py-4 text-center">Caricamento editori…</div>
          ) : (
            <>
              {/* Ricerca */}
              <input
                type="text"
                placeholder="Cerca editore…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
              />

              {/* Barra merge */}
              {selected.size >= 2 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-indigo-700 flex-shrink-0">
                    {selected.size} selezionati → Unisci in:
                  </span>
                  <input
                    type="text"
                    value={mergeTarget || mostFrequent}
                    onChange={e => setMergeTarget(e.target.value)}
                    placeholder="Nome canonico…"
                    className="flex-1 min-w-[140px] border border-indigo-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                  <button
                    onClick={handleMerge}
                    disabled={saving || !(mergeTarget.trim() || mostFrequent)}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {saving ? '…' : 'Unisci'}
                  </button>
                  <button
                    onClick={() => { setSelected(new Set()); setMergeTarget('') }}
                    className="text-indigo-400 hover:text-indigo-600 text-xs flex-shrink-0"
                  >
                    ✕ Annulla
                  </button>
                </div>
              )}

              {/* Lista editori */}
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nessun editore trovato.</p>
                ) : filtered.map(({ nome, count }) => (
                  <div
                    key={nome}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors
                      ${selected.has(nome) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Checkbox selezione */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(nome)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                        ${selected.has(nome) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'}`}>
                        {selected.has(nome) && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </button>

                    {/* Nome — inline edit */}
                    {editingNome === nome ? (
                      <input
                        autoFocus
                        type="text"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRename(nome, editVal)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="flex-1 border border-brand-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(nome)}
                        className="flex-1 text-left text-sm text-gray-800 hover:text-brand-600 transition-colors truncate"
                        title="Clicca per rinominare"
                      >
                        {nome}
                      </button>
                    )}

                    {/* Count badge */}
                    <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                      {count}
                    </span>

                    {/* Azioni inline edit */}
                    {editingNome === nome ? (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => saveRename(nome, editVal)}
                          disabled={saving}
                          className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                        >
                          {saving ? '…' : '✓'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(nome)}
                        className="flex-shrink-0 p-1.5 text-gray-300 hover:text-brand-500 transition-colors"
                        title="Rinomina"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-3">
                {editori.length} editori unici · Clicca un nome per rinominarlo · Seleziona 2+ per unirli
              </p>
            </>
          )}
        </div>
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

      {/* GESTIONE EDITORI */}
      <GestisciEditori />

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

    </Layout>
  )
}
