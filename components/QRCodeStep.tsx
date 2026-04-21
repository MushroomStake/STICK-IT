import React, { useEffect, useState } from 'react';

type Props = {
  value?: string | null;
  filename?: string;
  onSaved?: (saved: boolean) => void;
  highlight?: boolean;
};

export default function QRCodeStep({ value, filename = 'pickup-qr.png', onSaved, highlight = false }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const qrcode = await import('qrcode');
        const url: string = await qrcode.toDataURL(value, { margin: 2, width: 320 });
        if (mounted) setDataUrl(url);
      } catch (err) {
        // graceful fallback to external QR generator (avoids crash when `qrcode` isn't installed)
        console.warn('Failed to generate QR locally, falling back to remote generator', err);
        const fallback = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          String(value)
        )}&size=320x320&ecc=M`;
        if (mounted) setDataUrl(fallback);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [value]);

  useEffect(() => {
    onSaved?.(saved);
  }, [saved, onSaved]);

  function handleDownload() {
    if (!dataUrl) return;
    // If dataUrl is a data: URI we can download directly. Otherwise fetch the image and download blob.
    if (dataUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // remote URL fallback: fetch and download
    (async () => {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        // As a last resort, open the image in a new tab so user can save it manually
        window.open(dataUrl, '_blank', 'noopener');
      }
    })();
  }

  return (
    <div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-yellow-50 mb-6">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h8v8H3V3zM13 3h8v8h-8V3zM3 13h8v8H3v-8zM13 13h8v8h-8v-8z" fill="#FDE68A" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Your Pickup QR Code</h3>
          <p className="text-sm text-gray-500 mt-2">Present this at the counter to claim</p>

          <div className="mt-6">
            <div className="relative inline-block p-4 border border-dashed border-gray-200 rounded-lg bg-white">
              <div className="w-56 h-56 bg-white flex items-center justify-center">
                {dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dataUrl} alt="Pickup QR Code" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-gray-300">Generating QR…</div>
                )}
              </div>

              {/* decorative corner accents */}
              <span className="absolute -left-2 -top-2 w-4 h-4 border-t-2 border-l-2 border-yellow-300 rounded-sm" />
              <span className="absolute -right-2 -top-2 w-4 h-4 border-t-2 border-r-2 border-yellow-300 rounded-sm" />
              <span className="absolute -left-2 -bottom-2 w-4 h-4 border-b-2 border-l-2 border-yellow-300 rounded-sm" />
              <span className="absolute -right-2 -bottom-2 w-4 h-4 border-b-2 border-r-2 border-yellow-300 rounded-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-yellow-200 bg-white text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 11-2 0V5H5v10h4a1 1 0 110 2H4a1 1 0 01-1-1V3z" clipRule="evenodd" />
            <path d="M9 7a1 1 0 012 0v6a1 1 0 11-2 0V7z" />
          </svg>
          Download QR Image
        </button>
      </div>

      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-sm">
        <div className="font-semibold text-red-700 mb-1">ONE-TIME QR CODE</div>
        <div className="text-red-600">If you lose this screen or navigate away, <span className="underline font-semibold text-red-700">there is no way of retrieving this code again</span>. Download it to your gallery immediately.</div>
      </div>

      <div className="mb-28">
        <label className={`flex items-start gap-3 p-3 bg-white rounded-md border ${highlight ? 'ring-4 ring-yellow-300 animate-pulse border-yellow-300' : 'border-gray-100'}`}>
          <input
            type="checkbox"
            id="qr-saved-checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-1 h-4 w-4 rounded"
          />
          <div>
            <div className="text-sm font-semibold">I have saved the QR Code</div>
            <div className="text-xs text-gray-500 mt-1">I understand that this code will not be visible again after I proceed to the final thank you screen.</div>
          </div>
        </label>
      </div>
    </div>
  );
}
