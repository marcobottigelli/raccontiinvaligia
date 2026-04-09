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
