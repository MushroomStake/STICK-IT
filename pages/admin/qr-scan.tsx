import React, { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import { useRouter } from 'next/router';

export default function AdminQRScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsqrRef = useRef<any>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    return () => {
      stopCamera();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureDecoder() {
    if (jsqrRef.current) return jsqrRef.current;
    try {
      const mod = await import('jsqr');
      jsqrRef.current = (mod && (mod.default ?? mod));
      return jsqrRef.current;
    } catch (e) {
      console.warn('Failed to load jsQR', e);
      throw e;
    }
  }

  async function startCamera() {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // autoplay/play
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (e: any) {
      console.error('camera start failed', e);
      setError('Cannot access camera — grant permission or try a different device.');
      setShowErrorModal(true);
      setCameraActive(false);
    }
  }

  function stopCamera() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.pause(); } catch (e) { /* ignore */ }
        try { (videoRef.current.srcObject as any) = null; } catch (e) { /* ignore */ }
      }
    } finally {
      setCameraActive(false);
      setScanning(false);
    }
  }

  async function handleScanStart() {
    setError(null);
    setResult(null);
    await startCamera();
    setScanning(true);
    try {
      await ensureDecoder();
      scanLoop();
    } catch (e) {
      setError('Failed to load QR decoder.');
      setShowErrorModal(true);
    }
  }

  function stopScanning() {
    setScanning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  async function scanLoop() {
    if (!videoRef.current || !canvasRef.current) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // choose a modest scan size to keep CPU reasonable
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const scanW = Math.min(640, vw);
    const scale = scanW / vw;
    const scanH = Math.floor(vh * scale);

    canvas.width = scanW;
    canvas.height = scanH;
    try {
      ctx.drawImage(video, 0, 0, scanW, scanH);
      const imageData = ctx.getImageData(0, 0, scanW, scanH);
      const decoder = await ensureDecoder();
      const code = decoder(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        setResult(code.data);
        stopScanning();
        stopCamera();
        handleFound(code.data);
        return;
      }
    } catch (e) {
      // continue scanning even if single frame fails
      // console.warn('scan frame error', e);
    }

    rafRef.current = requestAnimationFrame(scanLoop);
  }

  async function handleFound(qr: string) {
    try {
      const resp = await fetch(`/api/admin/lookup-qr?qr=${encodeURIComponent(qr)}`);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setError(j.error || 'Order not found for scanned QR');
        setShowErrorModal(true);
        return;
      }
      const json = await resp.json();
      const order = json.order;
      if (order && order.id) {
        // navigate to admin order page
        router.push(`/admin/order/${order.id}`);
      } else {
        setError('Order not found for scanned QR');
        setShowErrorModal(true);
      }
    } catch (e) {
      console.error('lookup failed', e);
      setError('Failed to lookup order for scanned QR');
      setShowErrorModal(true);
    }
  }

  function handleRetry() {
    setError(null);
    setResult(null);
    stopScanning();
    stopCamera();
    // start again
    setShowErrorModal(false);
    setTimeout(() => handleScanStart(), 250);
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-2">QR SCAN</h1>
        <div className="text-sm text-gray-600 mb-6">Scan the QR Code</div>

        <div className="bg-white rounded-2xl p-6 shadow mb-6">
          <div className="text-sm font-medium mb-4">Counter Scanner</div>

          <div className="w-full max-w-3xl mx-auto">
            <div className="relative border-2 border-dashed rounded-lg overflow-hidden h-64 sm:h-80 md:h-[480px]">
              {/* video positioned absolute over the container */}
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />

              {/* overlay frame in center */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 max-w-[520px] h-full border-4 border-yellow-400 rounded-md pointer-events-none flex items-center justify-center">
                <div className="w-28 h-28 border-4 border-yellow-400 rounded-lg flex items-center justify-center">
                  <svg className="w-10 h-10 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" /></svg>
                </div>
              </div>

              {/* small status badge */}
              <div className="absolute right-3 top-3 bg-white px-3 py-1 rounded-full text-xs font-medium border">{cameraActive ? 'Camera Active' : 'Camera Inactive'}</div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="w-56">
                <button onClick={() => { if (!scanning) handleScanStart(); }} disabled={scanning} className="w-full bg-yellow-400 text-black px-4 py-3 rounded-lg font-semibold">{scanning ? 'Scanning…' : 'Scan the QR Code'}</button>
              </div>

              <div className="w-56">
                <button onClick={handleRetry} className="w-full border px-4 py-2 rounded-lg">Retry</button>
              </div>

              {/* Scanned result intentionally hidden from UI */}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      </div>
        <Modal visible={showErrorModal} onClose={() => setShowErrorModal(false)}>
          <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
            <div className="flex flex-col gap-4 text-center">
              <h3 className="text-lg font-semibold text-red-700">QR Lookup Error</h3>
              <p className="text-sm text-gray-700">{error ?? 'Order not found for scanned QR'}</p>
              <div className="mt-4 flex gap-3 justify-center">
                <button onClick={() => handleRetry()} className="px-4 py-2 rounded-md bg-yellow-400 font-semibold">Retry</button>
                <button onClick={() => { setShowErrorModal(false); setError(null); }} className="px-4 py-2 rounded-md border bg-white">Close</button>
              </div>
            </div>
          </div>
        </Modal>
    </AdminLayout>
  );
}
