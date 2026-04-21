import React, { useState } from 'react';

type Deal = {
  id: string;
  tag: string;
  title: string;
  price: number;
  description: string;
  best?: boolean;
};

type FilePreview = {
  id: string;
  name?: string;
  previewUrl?: string;
  uploadedUrl?: string;
  uploading?: boolean;
  error?: string;
  quantity?: number;
};

interface FinalCheckProps {
  deal: Deal | null;
  files: FilePreview[];
  reservationName?: string;
  onReservationChange?: (v: string) => void;
}

export default function FinalCheck({ deal, files, reservationName, onReservationChange }: FinalCheckProps) {

  const totalStickers = files.reduce((s, f) => s + (f.quantity ?? 1), 0);
  const itemsPerSheet = 10;
  const sheetsRequired = Math.max(1, Math.ceil(totalStickers / itemsPerSheet));
  const pricePerSheet = deal?.price ?? 0;

  return (
    <section className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Review your order</h1>
        <p className="text-sm text-gray-600 mt-2">Review your order details and provide your name for the reservation.</p>

        <div className="mt-4">
          <label className="flex items-center justify-between mb-2">
            <span className="font-semibold">RESERVATION NAME</span>
            <span className="text-xs text-red-500">Required</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <input
              value={reservationName ?? ''}
              onChange={(e) => onReservationChange?.(e.target.value)}
              placeholder="Enter your full name"
              className="w-full pl-12 pr-4 py-3 border rounded-md outline-none focus:ring-2 focus:ring-yellow-200"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#FFF6E0] rounded-2xl p-6 shadow-sm mb-6 ring-1 ring-yellow-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-gray-600 font-medium">Recommended Deal</div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-gray-900">{deal?.title}</div>
              <div className="text-sm text-gray-600 mt-1">{deal?.description}</div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-white/80 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-yellow-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="18" height="6" rx="1"/></svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Price per sheet</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold">₱{pricePerSheet.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="pl-2 shrink-0">
            <span className="inline-block bg-yellow-200 text-yellow-800 text-sm px-3 py-1 rounded-full font-semibold">Selected</span>
          </div>
        </div>

        <div className="mt-6 border-t border-yellow-100 pt-4 grid grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <div className="text-xs text-gray-500">Stickers Uploaded</div>
            <div className="font-semibold mt-1 text-gray-900">{totalStickers} Items</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Sheets Required</div>
            <div className="font-semibold mt-1 text-gray-900">{sheetsRequired} Full Sheets</div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">PREVIEW ITEMS</h3>
          <div className="text-xs text-gray-400">Scroll to see all</div>
        </div>

        <div className="mt-3 overflow-x-auto flex items-center gap-3 py-3">
          {files.map((f) => {
            const src = f.uploadedUrl ?? f.previewUrl;
            return (
              <div key={f.id} className="relative w-16 h-16 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                {src ? (
                  <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url("${src}")` }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No preview</div>
                )}
                { (f.quantity ?? 1) > 1 && (
                  <div className="absolute top-0 right-0 bg-black/70 text-white text-xs rounded-full px-2 py-0.5">{f.quantity}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      

      <div className="mb-24">
        <h4 className="text-sm font-semibold mb-2">PICKUP INFORMATION</h4>
        <div className="border rounded-md p-3 bg-white">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v6"/><path d="M20 8a8 8 0 1 1-16 0"/></svg>
            </div>
            <div className="text-sm text-gray-600">By confirming, you agree to pickup your order. Orders not collected will be cancelled.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
