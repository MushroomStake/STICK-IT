import React, { PropsWithChildren, useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: PropsWithChildren) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return;
  }, [sidebarOpen]);

  const SidebarInner = (
    <>
      <Link href="/" className="flex items-center gap-3 mb-6">
        <img src="/assets/StickIT.png" alt="Stick IT" className="w-10 h-10" />
        <span className="font-bold text-lg">Stick IT</span>
      </Link>

      <nav className="flex-1 space-y-1">
        <Link href="/admin" className="block px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 font-medium">Dashboard</Link>
        <Link href="#" className="block px-3 py-2 rounded-lg text-gray-700">QR Scan</Link>
        <Link href="#" className="block px-3 py-2 rounded-lg text-gray-700">Activity Log</Link>
        <Link href="#" className="block px-3 py-2 rounded-lg text-gray-700">Profile</Link>
      </nav>

      <div className="mt-6">
        <Link href="#" className="block px-3 py-2 rounded-lg text-gray-700">Settings</Link>
        <Link href="/admin/login" className="block px-3 py-2 text-red-600 mt-2">Logout</Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile slide-in sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 p-6 transform translate-x-0 transition-transform z-50">
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 p-6 flex flex-col">
        {SidebarInner}
      </aside>

      <div className="flex-1 p-8">
        {/* Mobile header: burger + branding */}
        <div className="flex items-center gap-3 mb-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded border" aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-3">
            <img src="/assets/StickIT.png" alt="Stick IT" className="w-8 h-8" />
            <span className="font-bold">Stick IT</span>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
