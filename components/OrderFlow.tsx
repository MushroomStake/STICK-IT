import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import UploadStep from './UploadStep';
import FinalCheck from './FinalCheck';
import QRCodeStep from './QRCodeStep';
import ThankYouStep from './ThankYouStep';

type Deal = {
  id: string;
  tag: string;
  title: string;
  price: number;
  description: string;
  best?: boolean;
  count: number;
};

const DEALS: Deal[] = [
  {
    id: 'standard',
    tag: 'STANDARD',
    title: '10 Stickers',
    price: 15,
    description: 'Our most popular choice! High-quality weather resistant vinyl.',
    best: true,
    count: 10,
  },
  {
    id: 'pack',
    tag: 'PACK',
    title: '20 Stickers',
    price: 25,
    description: 'Great for teams. Includes background removal service.',
    count: 20,
  },
  {
    id: 'bulk',
    tag: 'BULK',
    title: '30 Stickers',
    price: 35,
    description: 'Maximum savings for large events or small businesses.',
    count: 30,
  },
];

const stepLabels = [
  'Choose Deal',
  'Upload Designs',
  'Review',
  'Payment',
  'Complete',
];

export default function OrderFlow() {
  const [step, setStep] = useState<number>(1);
  const [selectedDeal, setSelectedDeal] = useState<string>('standard');
  const router = useRouter();
  type UploadedFile = {
    id: string;
    name: string;
    previewUrl?: string; // local object URL
    uploadedUrl?: string; // public URL from storage
    path?: string; // storage path (safeName) returned by upload API
    uploading?: boolean;
    error?: string;
    removeBackground: boolean;
    border: boolean;
    quantity: number;
  };

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrSaved, setQrSaved] = useState(false);
  const [reservationName, setReservationName] = useState<string>('');
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const STORAGE_KEY = 'stickit_orderflow_state_v1';

  // Load persisted state on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (typeof parsed.step === 'number') setStep(parsed.step);
        if (typeof parsed.selectedDeal === 'string') setSelectedDeal(parsed.selectedDeal);
        if (typeof parsed.reservationName === 'string') setReservationName(parsed.reservationName);
        if (parsed.qrValue) setQrValue(parsed.qrValue);
        if (typeof parsed.qrSaved === 'boolean') setQrSaved(parsed.qrSaved);
        if (parsed.orderId) setOrderId(parsed.orderId);
        if (Array.isArray(parsed.uploadedFiles)) {
          // sanitize uploaded files (don't restore blob: preview URLs and reset uploading)
          const files: UploadedFile[] = parsed.uploadedFiles.map((f: any) => ({
            id: f.id,
            name: f.name,
            previewUrl: f.previewUrl && typeof f.previewUrl === 'string' && !f.previewUrl.startsWith('blob:') ? f.previewUrl : undefined,
            uploadedUrl: f.uploadedUrl,
            path: f.path,
            uploading: false,
            error: f.error,
            removeBackground: !!f.removeBackground,
            border: !!f.border,
            quantity: typeof f.quantity === 'number' ? f.quantity : 1,
          }));
          setUploadedFiles(files);
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  // Refresh uploaded URLs for persisted files that include a storage path.
  // Refresh uploaded URLs for persisted files that include a storage path but only
  // when the file is missing an `uploadedUrl`. This avoids repeatedly refetching
  // URLs and prevents a loop where updating `uploadedFiles` triggers another fetch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    // only refresh files that have a storage path but no uploadedUrl
    const filesToRefresh = uploadedFiles.filter((f) => f.path && !f.uploadedUrl);
    if (filesToRefresh.length === 0) return;

    let mounted = true;
    (async () => {
      try {
        const paths = filesToRefresh.map((f) => f.path as string);
        const res = await fetch('/api/file-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        });
        if (!res.ok) return;
        const json = await res.json();
        const urls: Record<string, string | null> = json.urls || {};
        if (!mounted) return;
        setUploadedFiles((prev) => prev.map((f) => {
          if (!f.path) return f;
          if (!paths.includes(f.path)) return f;
          const fresh = urls[f.path];
          if (!fresh) return f;
          return { ...f, uploadedUrl: fresh };
        }));
      } catch (e) {
        // ignore
      }
    })();

    return () => { mounted = false; };
  }, [uploadedFiles]);

  // Persist state whenever relevant pieces change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const sanitized = uploadedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        // only persist previewUrl if it's not a blob URL
        previewUrl: f.previewUrl && !f.previewUrl.startsWith('blob:') ? f.previewUrl : undefined,
        uploadedUrl: f.uploadedUrl,
        path: f.path,
        // don't persist transient uploading state
        uploading: false,
        error: f.error,
        removeBackground: f.removeBackground,
        border: f.border,
        quantity: f.quantity,
      }));

      const toStore = {
        step,
        selectedDeal,
        reservationName,
        qrValue,
        qrSaved,
        orderId,
        uploadedFiles: sanitized,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      // ignore storage errors
    }
  }, [step, selectedDeal, reservationName, qrValue, qrSaved, orderId, uploadedFiles]);

  // Validate totals whenever deal or files change
  useEffect(() => {
    const dealCount = getDealCount();
    const total = totalQuantity();
    const exceedMsg = `Total stickers (${total}) exceed selected deal limit (${dealCount}). Reduce quantities or remove files.`;
    if (total > dealCount) {
      setUploadErrors((prev) => {
        // avoid duplicating the same exceed message
        if (prev && prev.some((p) => p === exceedMsg)) return prev;
        return [...(prev || []), exceedMsg];
      });
    } else {
      setUploadErrors((prev) => (prev || []).filter((p) => p !== exceedMsg));
    }
  }, [selectedDeal, uploadedFiles]);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_FILES = 100; // absolute cap to avoid extremely large uploads

  function getDealCount() {
    const deal = DEALS.find((d) => d.id === selectedDeal);
    return deal?.count ?? MAX_FILES;
  }

  function totalQuantity(files = uploadedFiles) {
    return files.reduce((s, f) => s + (f.quantity ?? 1), 0);
  }

  function handleAddFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const errors: string[] = [];
    const valid: File[] = [];

    incoming.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported file type`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: file too large (max 15MB)`);
        return;
      }
      valid.push(file);
    });

    // enforce deal-specific limits: total quantity of stickers across files must not exceed deal count
    const dealCount = getDealCount();
    const currentTotal = totalQuantity();
    const remaining = Math.max(0, dealCount - currentTotal);

    if (remaining <= 0) {
      errors.push(`You've reached the maximum number of stickers for this deal (${dealCount}).`);
      setUploadErrors(errors);
      return;
    }

    // each new file will default to quantity 1, so the maximum number of files we can add is `remaining`
    const slots = Math.max(0, Math.min(MAX_FILES, remaining));
    if (valid.length > slots) {
      errors.push(`You can only upload ${slots} more file(s) for this deal.`);
      valid.splice(slots);
    }

    setUploadErrors(errors);
    valid.forEach((f) => addFile(f));
  }

  function addFile(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);
    setUploadedFiles((prev) => [
      ...prev,
      { id, name: file.name, previewUrl, uploading: true, removeBackground: true, border: false, quantity: 1 },
    ]);
    void uploadToStorage(file, id, previewUrl);
  }

  async function uploadToStorage(file: File, id: string, previewUrl?: string) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('id', id);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) {
        setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false, error: json?.error || 'Upload failed' } : f)));
        setUploadErrors((errs) => [...errs, `${file.name}: upload failed`]);
        return;
      }

      const publicUrl = json.publicUrl as string | undefined;
      const path = json.path as string | undefined;
      setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false, uploadedUrl: publicUrl, path, error: undefined } : f)));

      // revoke object URL to free memory
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (e) {
          // ignore
        }
        setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, previewUrl: undefined } : f)));
      }
    } catch (err) {
      console.error(err);
      setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false, error: 'Upload failed' } : f)));
      setUploadErrors((errs) => [...errs, `${file.name}: upload failed`]);
    }
  }

  function removeFile(id: string) {
    const file = uploadedFiles.find((f) => f.id === id);
    if (!file) return;

    // If file was uploaded to storage, request server to delete it
    if (file.path) {
      (async () => {
        try {
          const res = await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: file.path }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            const err = json?.error || 'Failed to delete file from storage';
            setUploadErrors((prev) => [...prev, `${file.name}: ${err}`]);
            return;
          }
        } catch (e) {
          setUploadErrors((prev) => [...prev, `${file.name}: network error deleting file`]);
          return;
        }

        // remove from UI/state only after successful delete
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
      })();
    } else {
      // not uploaded yet, just remove locally
      setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    }
  }

  function toggleRemoveBackground(id: string) {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, removeBackground: !f.removeBackground } : f)));
  }

  function toggleBorder(id: string) {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, border: !f.border } : f)));
  }

  function updateQuantity(id: string, delta: number) {
    setUploadedFiles((prev) => {
      const file = prev.find((p) => p.id === id);
      if (!file) return prev;
      const dealCount = getDealCount();
      const sumWithout = prev.reduce((s, x) => (x.id === id ? s : s + (x.quantity ?? 1)), 0);
      const desired = Math.max(1, (file.quantity ?? 1) + delta);
      // clamp desired so total does not exceed dealCount
      const maxAllowedForThis = Math.max(1, dealCount - sumWithout);
      const finalQty = Math.min(desired, maxAllowedForThis);
      if (finalQty === file.quantity) return prev;
      return prev.map((f) => (f.id === id ? { ...f, quantity: finalQty } : f));
    });
  }

  function handleCustomize(id: string) {
    // placeholder, can open modal or navigate to customization UI
    alert(`Customize ${id}`);
  }


  function next() {
    // Prevent advancing from Upload (step 2) to Review (step 3) when there are no files
    // or when the totals exceed the selected deal.
    if (step === 2) {
      if (!uploadedFiles || uploadedFiles.length === 0) {
        const msg = `Please upload at least one design to continue.`;
        setShowNoFilesModal(true);
        setUploadErrors((prev) => {
          if (prev && prev.includes(msg)) return prev;
          return [...(prev || []), msg];
        });
        return;
      }

      const dealCount = getDealCount();
      if (totalQuantity() > dealCount) {
        // show modal and surface an inline error
        setShowOverLimitModal(true);
        const msg = `Total stickers (${totalQuantity()}) exceed selected deal limit (${dealCount}). Reduce quantities or pick a larger deal.`;
        setUploadErrors((prev) => {
          if (prev && prev.includes(msg)) return prev;
          return [...(prev || []), msg];
        });
        return;
      }
    }

    // Only validate totals when advancing from Review (step 3) to Payment (step 4).
    if (step === 3) {
      const dealCount = getDealCount();
      if (totalQuantity() > dealCount) {
        const msg = `Total stickers (${totalQuantity()}) exceed selected deal limit (${dealCount}). Reduce quantities or pick a larger deal.`;
        setUploadErrors((prev) => {
          if (prev && prev.includes(msg)) return prev;
          return [...(prev || []), msg];
        });
        return;
      }

      // generate QR value when advancing from review (step 3) to payment/qr (step 4)
      const code = `STICKIT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setQrValue(code);
      setQrSaved(false);
    }

    if (step < 5) setStep((s) => s + 1);
    else {
      // Finalize (placeholder)
      alert('Order completed (placeholder)');
    }
  }

  async function handlePurchase() {
    if (processingOrder) return;
    setOrderError(null);
    const dealCount = getDealCount();
    if (totalQuantity() > dealCount) {
      setOrderError(`Total stickers (${totalQuantity()}) exceed selected deal limit (${dealCount}). Reduce quantities or choose a larger deal.`);
      return;
    }
    if (!reservationName || reservationName.trim().length < 2) {
      setOrderError('Please enter the reservation name');
      return;
    }

    setProcessingOrder(true);
    try {
      const deal = DEALS.find((d) => d.id === selectedDeal);
      const payload = {
        reservationName: reservationName.trim(),
        dealId: selectedDeal,
        dealTitle: deal?.title ?? '',
        dealPrice: deal?.price ?? 0,
        files: uploadedFiles.map((f) => ({ uploadedUrl: f.uploadedUrl, name: f.name, quantity: f.quantity ?? 1, removeBackground: f.removeBackground, border: f.border })),
        qrValue,
      };

      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setOrderError(json?.error || 'Failed to create order');
        setProcessingOrder(false);
        return;
      }

      setOrderId(json.orderId ?? null);
      setStep(5);
    } catch (err) {
      console.error(err);
      setOrderError('Failed to create order');
    } finally {
      setProcessingOrder(false);
    }
  }

  function cancel() {
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    router.push('/user');
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
    else cancel();
  }

  const isOverLimit = totalQuantity() > getDealCount();
  const [showOverLimitModal, setShowOverLimitModal] = useState<boolean>(isOverLimit);
  const [showNoFilesModal, setShowNoFilesModal] = useState<boolean>(false);

  useEffect(() => {
    // Show the modal when over limit becomes true; hide when no longer over limit.
    // If the user manually closes the modal by clicking an action, it will stay
    // closed until `isOverLimit` changes (prevents immediate re-opening).
    setShowOverLimitModal(isOverLimit);
  }, [isOverLimit]);

  useEffect(() => {
    // If files were added, ensure the "no files" modal is hidden.
    if (uploadedFiles.length > 0 && showNoFilesModal) setShowNoFilesModal(false);
  }, [uploadedFiles.length, showNoFilesModal]);

  return (
    <div className="w-full pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center w-full">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step === i + 1 ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-600'}`}>
                    {i + 1}
                  </div>
                  {i < 4 && (
                    <div className={`h-0.5 flex-1 ${step > i + 1 ? 'bg-yellow-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Step {step}: {stepLabels[step - 1]}</div>
          </div>
          <div className="text-xs uppercase font-semibold">
            {step === 5 ? (
              <span className="text-yellow-600">COMPLETED</span>
            ) : (
              <span className="text-gray-400">IN PROGRESS</span>
            )}
          </div>
        </div>
      </div>

      {showOverLimitModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md sm:max-w-lg mx-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl p-6 sm:p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-yellow-800">Deal limit exceeded</h3>
                  <p className="mt-3 text-sm text-yellow-700 mx-auto max-w-[40ch]">You currently have {totalQuantity()} stickers but the selected deal allows {getDealCount()}. Reduce quantities or choose a larger deal before purchasing.</p>
                </div>

                <div className="w-full flex justify-center mt-2">
                  <div className="flex gap-3 w-full max-w-lg px-4 sm:px-0">
                    <button onClick={() => { setShowOverLimitModal(false); setStep(2); }} className="flex-1 px-4 py-2 rounded-md border bg-white">Adjust files</button>
                    <button onClick={() => { setShowOverLimitModal(false); setStep(1); }} className="flex-1 px-4 py-2 rounded-md bg-yellow-400 font-semibold">Choose other deal</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoFilesModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md sm:max-w-lg mx-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl p-6 sm:p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-yellow-800">No files uploaded</h3>
                  <p className="mt-3 text-sm text-yellow-700 mx-auto max-w-[40ch]">You haven't uploaded any designs. Please upload at least one file to continue to the Review step.</p>
                </div>

                <div className="w-full flex justify-center mt-2">
                  <div className="flex gap-3 w-full max-w-lg px-4 sm:px-0">
                    <button onClick={() => setShowNoFilesModal(false)} className="flex-1 px-4 py-2 rounded-md border bg-white">Upload files</button>
                    <button onClick={() => { setShowNoFilesModal(false); setStep(1); }} className="flex-1 px-4 py-2 rounded-md bg-yellow-400 font-semibold">Choose other deal</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xl font-semibold">Recommended Deals</h3>
              <p className="text-sm text-gray-500">Choose the package that fits your needs. You can upload custom designs in the next step.</p>
            </div>
          </div>

          <div className="space-y-4 mt-4">
            {DEALS.map((deal) => {
              const selected = selectedDeal === deal.id;
              return (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal.id)}
                  className={`w-full text-left p-4 rounded-2xl flex items-start gap-4 border ${selected ? 'border-yellow-400 bg-yellow-50 shadow-lg' : 'border-gray-200 bg-white'} `}
                  aria-pressed={selected}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-500">{deal.tag}</div>
                      <div className="text-sm font-bold">₱{deal.price} <span className="text-xs text-gray-400">total</span></div>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <div className="text-2xl font-bold">{deal.title}</div>
                        <div className="text-sm text-gray-500 mt-2">{deal.description}</div>
                      </div>
                      {deal.best && (
                        <div className="ml-4 text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">best value</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full border ${selected ? 'bg-yellow-400 border-yellow-400' : 'bg-white border-gray-300'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <UploadStep
          files={uploadedFiles}
          onAddFiles={handleAddFiles}
          onRemoveFile={removeFile}
          onToggleRemoveBackground={toggleRemoveBackground}
          onToggleBorder={toggleBorder}
          onUpdateQuantity={updateQuantity}
          onCustomize={handleCustomize}
            errors={uploadErrors}
            stickersRemaining={Math.max(0, getDealCount() - totalQuantity())}
            onChooseOtherDeal={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <FinalCheck
          deal={DEALS.find((d) => d.id === selectedDeal) ?? null}
          files={uploadedFiles}
          reservationName={reservationName}
          onReservationChange={setReservationName}
        />
      )}

      {step === 4 && (
        <QRCodeStep value={qrValue} onSaved={(v) => setQrSaved(v)} />
      )}

      {step === 5 && (
        <ThankYouStep onBack={() => router.push('/user')} />
      )}

      {step !== 5 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:justify-end" style={{ zIndex: 60 }}>
        <div className="max-w-md w-full px-4">
          <div className="bg-white p-3 rounded-3xl shadow-lg flex gap-3 items-center">
            <button onClick={back} className="flex-1 bg-white border border-gray-200 rounded-full py-3 font-medium">Go Back</button>
            <div className="flex-1">
              {orderError && <div className="text-sm text-red-600 mb-2 text-center">{orderError}</div>}
              <button
                onClick={step === 4 ? handlePurchase : next}
                disabled={step === 4 ? (!qrSaved || processingOrder) : false}
                className={`w-full rounded-full py-3 font-semibold ${step === 4 ? 'bg-[#FFD600] text-black' : 'bg-[#FFD600] text-black'}`}
              >
                {step === 4 ? (processingOrder ? 'Processing...' : 'PURCHASED') : 'Next →'}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
