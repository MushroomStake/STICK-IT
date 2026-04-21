import { useState, useEffect, useRef } from 'react';
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
  // server-side / transient order errors are shown in a modal now
  const [showServerErrorModal, setShowServerErrorModal] = useState<boolean>(false);
  const [serverErrorMessage, setServerErrorMessage] = useState<string>('');
  const [highlightQrCheckbox, setHighlightQrCheckbox] = useState<boolean>(false);
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const [prevStep, setPrevStep] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const ANIM_MS = 320;
  const [showNoReservationModal, setShowNoReservationModal] = useState<boolean>(false);
  const [showReviewConfirm, setShowReviewConfirm] = useState<boolean>(false);

  const STORAGE_KEY = 'stickit_orderflow_state_v1';

  // Load persisted state on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed) {
        // Do not restore the final completed step (5). If a saved state
        // contains step 5, clear it so future flows start fresh.
        if (typeof parsed.step === 'number') {
          if (parsed.step === 5) {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
          } else {
            setStep(parsed.step);
          }
        }
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
      // If we've reached the final step, clear any persisted state and
      // avoid saving the completed state. This ensures returning users
      // start a fresh flow instead of being restored to step 5.
      if (step === 5) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        return;
      }
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

  // cleanup any pending animation timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

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

      // require reservation name before proceeding
      if (!reservationName || reservationName.trim().length < 2) {
        const msg = 'Please enter the reservation name (at least 2 characters).';
        setUploadErrors((prev) => {
          if (prev && prev.includes(msg)) return prev;
          return [...(prev || []), msg];
        });
        setShowNoReservationModal(true);
        return;
      }

      // show confirmation modal before moving to payment
      setShowReviewConfirm(true);
      return;
    }

    if (step < 5) {
      goToStep(step + 1);
    }
    else {
      // Finalize (placeholder)
      alert('Order completed (placeholder)');
    }
  }

  async function handlePurchase() {
    if (processingOrder) return;
    // Ensure user confirmed they've saved the QR code. If not, navigate/focus checkbox.
    if (!qrSaved) {
      try {
        const el = document.getElementById('qr-saved-checkbox');
        // visually highlight the checkbox and scroll to it
        setHighlightQrCheckbox(true);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            try { (el as HTMLElement).focus(); } catch (e) { /* ignore */ }
            // clear highlight after a short delay
            setTimeout(() => setHighlightQrCheckbox(false), 1600);
          }, 300);
        } else {
          // if element not found, remove highlight after timeout
          setTimeout(() => setHighlightQrCheckbox(false), 1600);
        }
      } catch (e) {
        // ignore
      }
      return;
    }
    const dealCount = getDealCount();
    if (totalQuantity() > dealCount) {
      // use the existing over-limit modal rather than an inline message
      setShowOverLimitModal(true);
      return;
    }
    if (!reservationName || reservationName.trim().length < 2) {
      // prompt the reservation modal instead of an inline error
      setShowNoReservationModal(true);
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
        setServerErrorMessage(json?.error || 'Failed to create order');
        setShowServerErrorModal(true);
        setProcessingOrder(false);
        return;
      }

      setOrderId(json.orderId ?? null);
      goToStep(5);
      // Clear in-memory order state so future flows start fresh.
      // Use a short timeout to allow the Thank You UI to render first.
      setTimeout(() => clearInMemoryState(), 120);
    } catch (err) {
      console.error(err);
      setServerErrorMessage('Failed to create order');
      setShowServerErrorModal(true);
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
    if (step > 1) {
      goToStep(step - 1);
    } else cancel();
  }

  function goToStep(target: number) {
    if (target === step) return;
    if (isAnimating) return; // avoid interrupting an in-progress animation

    const newDirection = target > step ? 'left' : 'right';
    setDirection(newDirection);

    // prepare for animation: capture previous step and lock container height
    const container = containerRef.current;
    if (container) {
      const h = container.getBoundingClientRect().height;
      container.style.height = `${h}px`;
    }

    setPrevStep(step);
    setIsAnimating(true);

    // switch to new step
    setStep(target);

    // clear any existing timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // after animation completes, cleanup
    timerRef.current = window.setTimeout(() => {
      setPrevStep(null);
      setIsAnimating(false);
      if (container) container.style.height = '';
      timerRef.current = null;
    }, ANIM_MS + 40);
  }

  function clearInMemoryState() {
    try {
      // revoke any blob object URLs to free memory
      uploadedFiles.forEach((f) => {
        if (f.previewUrl && typeof f.previewUrl === 'string' && f.previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(f.previewUrl); } catch (e) { /* ignore */ }
        }
      });
    } catch (e) {
      // ignore
    }

    setUploadedFiles([]);
    setReservationName('');
    setSelectedDeal('standard');
    setQrValue(null);
    setQrSaved(false);
    setOrderId(null);
    setUploadErrors([]);
    setHighlightQrCheckbox(false);
    setProcessingOrder(false);
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

  useEffect(() => {
    // clear any temporary highlight when the user actually checks the box
    if (qrSaved) setHighlightQrCheckbox(false);
  }, [qrSaved]);

  const confirmDeal = DEALS.find((d) => d.id === selectedDeal) ?? null;

  function renderStep(s: number | null) {
    if (s === 1) return (
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
    );

    if (s === 2) return (
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
        onChooseOtherDeal={() => goToStep(1)}
      />
    );

    if (s === 3) return (
      <FinalCheck
        deal={DEALS.find((d) => d.id === selectedDeal) ?? null}
        files={uploadedFiles}
        reservationName={reservationName}
        onReservationChange={setReservationName}
      />
    );

    if (s === 4) return (
      <QRCodeStep value={qrValue} onSaved={(v) => setQrSaved(v)} highlight={highlightQrCheckbox} />
    );

    if (s === 5) return (
      <ThankYouStep onBack={() => router.push('/user')} />
    );

    return null;
  }

  // Reusable modal wrapper with fade in/out animations on mount/unmount
  function Modal({ visible, onClose, children, dialogClass = 'relative z-10 w-full max-w-md sm:max-w-lg mx-4' }: { visible: boolean; onClose?: () => void; children: any; dialogClass?: string }) {
    const [rendered, setRendered] = useState<boolean>(visible);
    const [closing, setClosing] = useState<boolean>(false);

    useEffect(() => {
      if (visible) {
        setRendered(true);
        setClosing(false);
      } else if (rendered) {
        setClosing(true);
        const t = setTimeout(() => {
          setRendered(false);
          setClosing(false);
        }, 260);
        return () => clearTimeout(t);
      }
    }, [visible]);

    if (!rendered) return null;

    return (
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${closing ? 'modal-closing' : 'modal-opening'}`}>
        <div className="absolute inset-0 modal-overlay" aria-hidden="true" onClick={() => onClose?.()} />
        <div role="dialog" aria-modal="true" className={`${dialogClass} modal-dialog`}>
          {children}
        </div>
      </div>
    );
  }

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

      <Modal visible={showOverLimitModal} onClose={() => setShowOverLimitModal(false)}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-full">
              <h3 className="text-lg font-semibold text-yellow-800">Deal limit exceeded</h3>
              <p className="mt-3 text-sm text-yellow-700 mx-auto max-w-[40ch]">You currently have {totalQuantity()} stickers but the selected deal allows {getDealCount()}. Reduce quantities or choose a larger deal before purchasing.</p>
            </div>

            <div className="w-full flex justify-center mt-2">
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg px-4 sm:px-0">
                <button onClick={() => { setShowOverLimitModal(false); goToStep(2); }} className="w-full sm:w-auto px-4 py-2 rounded-md border bg-white">Adjust files</button>
                <button onClick={() => { setShowOverLimitModal(false); goToStep(1); }} className="w-full sm:w-auto px-4 py-2 rounded-md bg-yellow-400 font-semibold">Choose other deal</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal visible={showNoFilesModal} onClose={() => setShowNoFilesModal(false)}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-full">
              <h3 className="text-lg font-semibold text-yellow-800">No files uploaded</h3>
              <p className="mt-3 text-sm text-yellow-700 mx-auto max-w-[40ch]">You haven't uploaded any designs. Please upload at least one file to continue to the Review step.</p>
            </div>

            <div className="w-full flex justify-center mt-2">
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg px-4 sm:px-0">
                <button onClick={() => setShowNoFilesModal(false)} className="w-full sm:w-auto px-4 py-2 rounded-md border bg-white">Upload files</button>
                <button onClick={() => { setShowNoFilesModal(false); goToStep(1); }} className="w-full sm:w-auto px-4 py-2 rounded-md bg-yellow-400 font-semibold">Choose other deal</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal visible={showNoReservationModal} onClose={() => setShowNoReservationModal(false)}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-full">
              <h3 className="text-lg font-semibold text-yellow-800">Reservation name required</h3>
              <p className="mt-3 text-sm text-yellow-700 mx-auto max-w-[40ch]">Please provide a reservation name so we can hold your order. The name should be at least 2 characters.</p>
            </div>

            <div className="w-full flex justify-center mt-2">
              <div className="w-full max-w-lg px-4 sm:px-0">
                <button onClick={() => setShowNoReservationModal(false)} className="w-full px-4 py-2 rounded-md border bg-white">Enter name</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal visible={showReviewConfirm} onClose={() => setShowReviewConfirm(false)} dialogClass="relative z-10 w-full max-w-2xl mx-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-semibold">Confirm your order</h3>

            <div className="bg-[#FFF6E0] rounded-2xl p-4 sm:p-6 shadow-sm ring-1 ring-yellow-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 font-medium">Recommended Deal</div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-gray-900">{confirmDeal?.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{confirmDeal?.description}</div>
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
                      <div className="text-lg font-extrabold">₱{(confirmDeal?.price ?? 0).toFixed(2)}</div>
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
                  <div className="font-semibold mt-1 text-gray-900">{totalQuantity()} Items</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Sheets Required</div>
                  <div className="font-semibold mt-1 text-gray-900">{Math.max(1, Math.ceil(totalQuantity() / 10))} Full Sheets</div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-700">Reservation name: <span className="font-semibold">{reservationName}</span></div>

            <div className="mt-4 w-full">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={() => setShowReviewConfirm(false)} className="w-full sm:w-auto px-4 py-2 rounded-md border bg-white">Cancel</button>
                <button onClick={() => { 
                  // generate QR and proceed
                  const code = `STICKIT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
                  setQrValue(code);
                  setQrSaved(false);
                  setShowReviewConfirm(false);
                  goToStep(4);
                }} className="w-full sm:w-auto px-4 py-2 rounded-md bg-yellow-400 font-semibold">Confirm and proceed</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal visible={showServerErrorModal} onClose={() => setShowServerErrorModal(false)}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 text-center">
            <h3 className="text-lg font-semibold text-red-700">Error</h3>
            <p className="text-sm text-gray-700">{serverErrorMessage}</p>
            <div className="mt-4">
              <button onClick={() => setShowServerErrorModal(false)} className="px-4 py-2 rounded-md border bg-white">Close</button>
            </div>
          </div>
        </div>
      </Modal>

      <div ref={containerRef} className={`animated-area overflow-hidden relative ${isAnimating ? 'is-animating' : ''}`}>
        {prevStep !== null && (
          <div key={`prev-${prevStep}`} className={`animated-step ${isAnimating ? (direction === 'left' ? 'slide-out-left' : 'slide-out-right') : ''}`}>
            {renderStep(prevStep)}
          </div>
        )}

        <div key={`curr-${step}`} className={`animated-step ${isAnimating ? (direction === 'left' ? 'slide-in-right' : 'slide-in-left') : ''}`}>
          {renderStep(step)}
        </div>
      </div>

      {step !== 5 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:justify-end" style={{ zIndex: 60 }}>
        <div className="max-w-md w-full px-4">
          <div className="bg-white p-3 rounded-3xl shadow-lg flex gap-3 items-center">
            <button onClick={back} className="flex-1 bg-white border border-gray-200 rounded-full py-3 font-medium">Go Back</button>
            <div className="flex-1">
              <button
                onClick={step === 4 ? handlePurchase : next}
                disabled={processingOrder}
                className={`w-full rounded-full py-3 font-semibold bg-[#FFD600] text-black`}
              >
                {step === 4 ? (processingOrder ? 'Processing...' : 'PURCHASED') : 'Next →'}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
      <style jsx>{`
        .animated-area { overflow: hidden; position: relative; }
        .animated-step { position: relative; width: 100%; }
        .animated-area.is-animating .animated-step { position: absolute; top: 0; left: 0; width: 100%; }
        .slide-in-right { animation: slideInFromRight 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-in-left { animation: slideInFromLeft 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-out-left { animation: slideOutToLeft 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        .slide-out-right { animation: slideOutToRight 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideInFromRight {
          from { transform: translateX(30%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-30%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutToLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-30%); opacity: 0; }
        }
        @keyframes slideOutToRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(30%); opacity: 0; }
        }
        .modal-overlay { background: rgba(0,0,0,0); opacity: 0; transition: opacity 260ms ease; }
        .modal-dialog { transform-origin: center; opacity: 0; transform: translateY(8px) scale(0.98); transition: opacity 260ms ease, transform 260ms cubic-bezier(0.2,0.8,0.2,1); }
        .modal-opening .modal-overlay { opacity: 0.5; }
        .modal-opening .modal-dialog { transform: translateY(0) scale(1); opacity: 1; }
        .modal-closing .modal-overlay { opacity: 0; }
        .modal-closing .modal-dialog { transform: translateY(8px) scale(0.98); opacity: 0; }
      `}</style>
    </div>
  );
}
