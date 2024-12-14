import './globals.css'
import { Inter } from 'next/font/google'
import { Sidebar } from '@/components/sidebar'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Proxy Reseller Admin Dashboard',
  description: 'Manage your proxy reselling business',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-gray-100">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pl-64">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

