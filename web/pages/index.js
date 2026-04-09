import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'brand' }) {
  const colors = {
    brand:  'bg-brand-50  border-brand-200  text-brand-700',
    green:  'bg-green-50  border-green-200  text-green-700',
    amber:  'bg-amber-50  border-amber-200  text-amber-700',
    red:    'bg-red-50    border-red-200    text-red-700',
    gray:   'bg-gray-50   border-gray-200   text-gray-600',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-4xl font-bold mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-2 opacity-60">{sub}</p>}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, total, color = '#a90707' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Usa la view libreria_stats
        const { data, error } = await supabase.from('libreria_stats').select('*').single()
        if (error) throw error
        setStats(data)
      } catch (err) {
        // Fallback: calcola manualmente se la view non esiste ancora
        try {
          const { data: libri } = await supabase
            .from('libri')
            .select('stato_lettura,data_source,copertina,wordpress_status')
          if (libri) {
            const s = {
              totale:                libri.length,
              letti:                 libri.filter(l => l.stato_lettura === 'letto').length,
              in_lettura:            libri.filter(l => l.stato_lettura === 'in_lettura').length,
              da_leggere:            libri.filter(l => l.stato_lettura === 'da_leggere').length,
              con_dati_api:          libri.filter(l => l.data_source === 'api').length,
              dati_mancanti:         libri.filter(l => l.data_source === 'pending').length,
              con_copertina:         libri.filter(l => l.copertina).length,
              senza_copertina:       libri.filter(l => !l.copertina).length,
              recensioni_pubblicate: libri.filter(l => l.wordpress_status === 'pubblicata').length,
              recensioni_bozza:      libri.filter(l => l.wordpress_status === 'bozza').length,
              letti_senza_recensione: libri.filter(l =>
                l.stato_lettura === 'letto' && l.wordpress_status === 'non_pubblicata'
              ).length,
            }
            setStats(s)
          }
        } catch (e2) {
          setError('Impossibile caricare i dati. Controlla le credenziali Supabase in web/.env.local')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <Layout>
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          La libreria di Cristina —{' '}
          <a href="https://raccontiinvaligia.it" target="_blank" rel="noreferrer"
             className="text-brand-500 hover:underline">
            raccontiinvaligia.it
          </a>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* LETTURE */}
          <section className="mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Totale libri"  value={stats.totale}      color="gray" />
              <StatCard label="Letti"         value={stats.letti}       color="green"
                sub={`${stats.totale ? Math.round(stats.letti / stats.totale * 100) : 0}% del catalogo`} />
              <StatCard label="In lettura"    value={stats.in_lettura}  color="blue" />
              <StatCard label="Da leggere"    value={stats.da_leggere}  color="amber" />
            </div>
          </section>

          {/* COPERTINE */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Copertine</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard label="Con copertina"    value={stats.con_copertina}   color="brand" />
                <StatCard label="Senza copertina"  value={stats.senza_copertina} color="gray"
                  sub="Fotografa e usa remove_bg.py" />
              </div>
              <ProgressBar value={stats.con_copertina} total={stats.totale} />
            </div>
          </section>

          {/* DATI */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Completezza dati</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard label="Dati via API"      value={stats.con_dati_api}   color="brand" />
                <StatCard label="Dati mancanti"     value={stats.dati_mancanti}  color="amber"
                  sub="Nessun risultato trovato online" />
              </div>
              <ProgressBar value={stats.con_dati_api} total={stats.totale} />
            </div>
          </section>

          {/* RECENSIONI */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Recensioni — WordPress
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <StatCard label="Pubblicate"         value={stats.recensioni_pubblicate} color="green" />
                <StatCard label="Bozza"              value={stats.recensioni_bozza}      color="blue" />
                <StatCard label="Letti, da recensire" value={stats.letti_senza_recensione} color="amber"
                  sub="Libri letti senza recensione" />
              </div>
              <ProgressBar
                value={stats.recensioni_pubblicate}
                total={stats.letti}
                color="#22c55e"
              />
            </div>
          </section>

          {/* AZIONI RAPIDE */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Azioni rapide</h2>
            <div className="flex flex-wrap gap-3">
              {stats.in_lettura > 0 && (
                <Link href="/libri?filter=in_lettura"
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  📖 In lettura ({stats.in_lettura})
                </Link>
              )}
              {stats.letti_senza_recensione > 0 && (
                <Link href="/libri?filter=letto"
                  className="px-5 py-3 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                  ✍️ Letti da recensire ({stats.letti_senza_recensione})
                </Link>
              )}
              {stats.dati_mancanti > 0 && (
                <Link href="/libri?filter=dati_mancanti"
                  className="px-5 py-3 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                  ⚠️ Dati mancanti ({stats.dati_mancanti})
                </Link>
              )}
              {stats.senza_copertina > 0 && (
                <Link href="/libri?filter=senza_copertina"
                  className="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
                  🖼️ Senza copertina ({stats.senza_copertina})
                </Link>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📚</p>
          <p className="text-lg font-bold">Nessun libro nel database.</p>
          <p className="text-sm mt-2">
            Vai in <Link href="/libri" className="text-brand-500 hover:underline">Libreria</Link> e aggiungi il tuo primo libro.
          </p>
        </div>
      )}
    </Layout>
  )
}
