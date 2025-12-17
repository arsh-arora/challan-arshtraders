'use client'

import { usePathname } from 'next/navigation'
import NavBar from './NavBar'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = pathname !== '/login'

  return (
    <>
      {showNav && <NavBar />}
      <main className="min-h-screen bg-gray-50">
        {children}
      </main>
    </>
  )
}
