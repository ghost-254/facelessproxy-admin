'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  HardDrive,
  DollarSign,
  Settings,
  LogOut,
  ShoppingCart,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import styles from './sidebar.module.css'

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: Users, label: 'Sub-Users', href: '/sub-users' },
  { icon: HardDrive, label: 'Proxy Pools', href: '/proxy-pools' },
  { icon: DollarSign, label: 'Traffic', href: '/traffic' },
  { icon: ShoppingCart, label: 'Orders', href: '/admin/orders' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Sign out the user
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Error signing out:', error.message)
        return
      }

      // Clear session data and redirect to login
      router.push('/login')
    } catch (err) {
      console.error('Unexpected error during logout:', err)
    }
  }

  return (
    <div className="w-64 bg-gradient-to-b from-blue-600 to-blue-800 h-screen shadow-lg flex flex-col fixed left-0 top-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-center h-16 border-b border-blue-500">
        <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
      </div>

      {/* Navigation Menu */}
      <nav className={`flex-grow overflow-y-auto ${styles.customScrollbar}`}>
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-6 py-3 text-blue-100 hover:bg-blue-700 hover:text-white transition-colors duration-200 ${
              pathname === item.href ? 'bg-blue-700 text-white' : ''
            }`}
          >
            <item.icon className="h-5 w-5 mr-3" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center px-6 py-3 text-blue-100 hover:bg-blue-700 hover:text-white transition-colors duration-200 w-full rounded-md"
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  )
}
