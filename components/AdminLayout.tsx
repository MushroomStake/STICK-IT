import React, { PropsWithChildren, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';

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

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 p-8 lg:ml-64">
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
