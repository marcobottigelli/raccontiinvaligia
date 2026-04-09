import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import ChatWidget from './ChatWidget'

export default function Layout({ children }) {
  const router = useRouter()
  const path   = router.pathname

  const prevPath = useRef('/')
  useEffect(() => {
    if (path !== '/settings') prevPath.current = path
  }, [path])

  const isActive = (href) =>
    href === '/'
      ? path === '/'
      : path === href || path.startsWith(href)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">

            {/* Logo + nome */}
            <Link href="/" className="flex items-center flex-shrink-0">
              <div className="relative h-10 w-28 sm:h-11 sm:w-32">
                <Image
                  src="/logo.jpg"
                  alt="RaccontiInValigia"
                  fill
                  sizes="128px"
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden sm:flex items-center gap-1">
              {[
                { href: '/',      label: 'Dashboard' },
                { href: '/libri', label: 'Libreria'  },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive(href)
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Chat AI — sempre visibile */}
            <ChatWidget />

            {/* Gear / Close — sempre visibile */}
            <Link
              href={path === '/settings' ? prevPath.current : '/settings'}
              title={path === '/settings' ? 'Chiudi' : 'Impostazioni'}
              className={`ml-2 p-2 rounded-lg transition-colors flex-shrink-0
                ${path === '/settings'
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            >
              {path === '/settings' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </Link>

          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-8">
        {children}
      </main>

      {/* ── FOOTER desktop ─────────────────────────────────────── */}
      <footer className="hidden sm:block border-t border-gray-200 py-4 text-center text-xs text-gray-400 bg-white">
        RaccontiInValigia —{' '}
        <a href="https://raccontiinvaligia.it" target="_blank" rel="noreferrer" className="hover:text-brand-500">
          raccontiinvaligia.it
        </a>
      </footer>

      {/* ── BOTTOM NAV mobile ───────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-end justify-around h-16 px-8">

          {/* Dashboard */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 pb-1 transition-colors
              ${isActive('/') && path === '/' ? 'text-brand-500' : 'text-gray-400'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Dashboard</span>
          </Link>

          {/* FAB + Aggiungi libro */}
          <Link
            href="/libri?add=1"
            className="w-14 h-14 bg-brand-500 rounded-full flex items-center justify-center shadow-lg -mt-5 text-white hover:bg-brand-600 active:scale-95 transition-all"
            title="Aggiungi libro"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </Link>

          {/* Libreria */}
          <Link
            href="/libri"
            className={`flex flex-col items-center gap-0.5 pb-1 transition-colors
              ${isActive('/libri') ? 'text-brand-500' : 'text-gray-400'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-xs font-medium">Libreria</span>
          </Link>

        </div>
      </nav>

    </div>
  )
}
