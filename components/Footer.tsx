//components/Footer.tsx

import React from 'react'
import Link from 'next/link'

const Footer = () => {
  return (
    <footer className="bg-blue-800 text-white py-8 mt-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-between">
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <h3 className="text-xl font-bold mb-2">Proxy Reseller Admin</h3>
            <p className="text-blue-200">Manage your proxy reselling business efficiently.</p>
          </div>
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <h4 className="text-lg font-semibold mb-2">Quick Links</h4>
            <ul>
              <li><Link href="/dashboard" className="text-blue-200 hover:text-white">Dashboard</Link></li>
              <li><Link href="/users" className="text-blue-200 hover:text-white">User Management</Link></li>
              <li><Link href="/proxies" className="text-blue-200 hover:text-white">Proxy Management</Link></li>
              <li><Link href="/billing" className="text-blue-200 hover:text-white">Billing</Link></li>
            </ul>
          </div>
          <div className="w-full md:w-1/3">
            <h4 className="text-lg font-semibold mb-2">Contact Us</h4>
            <p className="text-blue-200">Email: support@facelessproxy.com</p>
            <p className="text-blue-200">Phone: +1 (555) 123-4567</p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-blue-700 text-center">
          <p className="text-blue-200">&copy; 2024 Proxy Reseller Admin. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

