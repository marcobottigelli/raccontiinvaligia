import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Layout({ children }) {
  const router = useRouter()

  const navItems = [
    { href: '/',       label: 'Dashboard' },
    { href: '/libri',  label: 'Libreria'  },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAV */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-brand-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                RaccontiInValigia
              </span>
              <span className="text-xs text-gray-400 mt-1">La libreria di Cristina</span>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label }) => {
                const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? 'bg-brand-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {label}
                  </Link>
                )
              })}

              <Link
                href="/settings"
                title="Impostazioni"
                className={`ml-2 p-2 rounded-lg transition-colors
                  ${router.pathname === '/settings'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </nav>

          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        RaccontiInValigia — <a href="https://raccontiinvaligia.it" target="_blank" rel="noreferrer" className="hover:text-brand-500">raccontiinvaligia.it</a>
      </footer>
    </div>
  )
}
