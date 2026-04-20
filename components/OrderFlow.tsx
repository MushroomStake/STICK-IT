import { useState } from 'react';
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
};

const DEALS: Deal[] = [
  {
    id: 'standard',
    tag: 'STANDARD',
    title: '10 Stickers',
    price: 15,
    description: 'Our most popular choice! High-quality weather resistant vinyl.',
    best: true,
  },
  {
    id: 'pack',
    tag: 'PACK',
    title: '20 Stickers',
    price: 25,
    description: 'Great for teams. Includes background removal service.',
  },
  {
    id: 'bulk',
    tag: 'BULK',
    title: '30 Stickers',
    price: 35,
    description: 'Maximum savings for large events or small businesses.',
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

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_FILES = 20;

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

    const slots = Math.max(0, MAX_FILES - uploadedFiles.length);
    if (valid.length > slots) {
      errors.push(`You can only upload ${slots} more file(s).`);
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
      setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false, uploadedUrl: publicUrl, error: undefined } : f)));

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
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleRemoveBackground(id: string) {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, removeBackground: !f.removeBackground } : f)));
  }

  function toggleBorder(id: string) {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, border: !f.border } : f)));
  }

  function updateQuantity(id: string, delta: number) {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, quantity: Math.max(1, f.quantity + delta) } : f)));
  }

  function handleCustomize(id: string) {
    // placeholder, can open modal or navigate to customization UI
    alert(`Customize ${id}`);
  }


  function next() {
    // generate QR value when advancing from review (step 3) to payment/qr (step 4)
    if (step === 3) {
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
    router.push('/user');
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
    else router.push('/user');
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
