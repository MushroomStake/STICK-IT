import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function AdminSidebar({ open = false, onClose }: Props) {
  const router = useRouter();
  const rawPath = (router.asPath || '').split('?')[0];
  const path = rawPath.replace(/\/$/, '') || '/';
  const isActive = (p: string) => (p.replace(/\/$/, '') || '/') === path;
  const SidebarInner = (
    <>
      <Link href="/" className="flex items-center gap-3 mb-6">
        <img src="/assets/StickIT.png" alt="Stick IT" className="w-10 h-10" />
        <span className="font-bold text-lg">Stick IT</span>
      </Link>

      <nav className="flex-1 space-y-1">
        <Link href="/admin" onClick={() => onClose?.()} className={`${isActive('/admin') ? 'block px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 font-medium' : 'block px-3 py-2 rounded-lg text-gray-700'}`}>Dashboard</Link>
        <Link href="/admin/qr-scan" onClick={() => onClose?.()} className={`${isActive('/admin/qr-scan') ? 'block px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 font-medium' : 'block px-3 py-2 rounded-lg text-gray-700'}`}>QR Scan</Link>
        <Link href="/admin/profile" onClick={() => onClose?.()} className={`block px-3 py-2 rounded-lg text-gray-700`}>Profile</Link>
      </nav>

      <div className="mt-6">
        <Link href="/admin/login" className="block px-3 py-2 text-red-600">Logout</Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile slide-in sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 p-6 transform translate-x-0 transition-transform z-50">
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-white lg:border-r lg:border-gray-100 lg:p-6 lg:flex lg:flex-col">
        {SidebarInner}
      </aside>
    </>
  );
}
