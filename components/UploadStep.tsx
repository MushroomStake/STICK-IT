import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

type UploadedFile = {
  id: string;
  name: string;
  previewUrl?: string;
  uploadedUrl?: string;
  uploading?: boolean;
  error?: string;
  removeBackground: boolean;
  border: boolean;
  quantity: number;
};

export interface UploadStepProps {
  files: UploadedFile[];
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onToggleRemoveBackground: (id: string) => void;
  onToggleBorder: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onCustomize: (id: string) => void;
  errors?: string[];
  stickersRemaining?: number;
  onChooseOtherDeal?: () => void;
}
export type UploadStepHandle = { open: () => void };

const UploadStep = forwardRef<UploadStepHandle, UploadStepProps>(function UploadStep({ files, onAddFiles, onRemoveFile, onToggleRemoveBackground, onToggleBorder, onUpdateQuantity, onCustomize, errors, stickersRemaining = 0, onChooseOtherDeal }: UploadStepProps, ref) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  function triggerInput() {
    if (stickersRemaining <= 0) {
      setToastMessage('You have reached the maximum stickers allowed for this deal.');
      return;
    }
    fileInputRef.current?.click();
  }

  // expose `open` method to parent via ref
  useImperativeHandle(ref, () => ({ open: triggerInput }), [triggerInput]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (stickersRemaining <= 0) {
      setToastMessage('You have reached the maximum stickers allowed for this deal.');
      e.currentTarget.value = '';
      return;
    }

    const selected = e.target.files;
    if (selected && selected.length > stickersRemaining) {
      setToastMessage(`You can only upload ${stickersRemaining} more file(s) for this deal.`);
    }

    onAddFiles(e.target.files);
    // reset so same file can be re-selected
    e.currentTarget.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (stickersRemaining <= 0) {
      // disable drop entirely when no slots remain
      setToastMessage('No stickers remaining for this deal.');
      return;
    }

    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > stickersRemaining) {
      setToastMessage(`You can only upload ${stickersRemaining} more file(s) for this deal.`);
    }

    onAddFiles(e.dataTransfer.files);
  }

  return (
    <div>
      {/* Inline error banner removed in favor of modal/toast UX */}
      <div
        onClick={triggerInput}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-yellow-50 cursor-pointer"
      >
        <input aria-label="Upload images" ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/webp" multiple onChange={handleInput} className="hidden" />
        <div className="w-12 h-12 rounded-full bg-[#FFD600] flex items-center justify-center mb-3 shadow">
          <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
        </div>
        <div className="text-lg font-semibold">Tap to Upload Images</div>
        <div className="text-sm text-gray-500 mt-2">PNG, JPG or WebP (Max 15MB)</div>
      </div>

      {/* Stickers remaining badge */}
      <div className="mt-3 flex justify-end">
        <div className={`text-sm px-3 py-1 rounded-full ${stickersRemaining > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          Stickers remaining: {stickersRemaining}
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-black text-white px-4 py-2 rounded-md shadow">{toastMessage}</div>
        </div>
      )}

      {/* UploadStep no longer shows its own modal — parent `OrderFlow` provides the animated modal UX. */}

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Uploaded Images</h3>
            <div className="text-sm text-gray-500">Stickers remaining: {stickersRemaining}</div>
          </div>
          <div className="bg-gray-800 text-white text-xs rounded-full px-3 py-1">{files.length} Files</div>
        </div>

        <div className="space-y-4">
          {files.map((file) => (
            <div key={file.id} className="bg-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start gap-4">
              <div className="relative w-full md:w-20 aspect-square min-w-[5rem] rounded-md bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                {/** image preview: use <img> for more reliable rendering on mobile */}
                {(() => {
                  const imageSrc = file.uploadedUrl ?? file.previewUrl;
                  if (!imageSrc) return null;
                  return (
                    <img
                      src={imageSrc}
                      alt={file.name}
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                  );
                })()}
                <div className="absolute top-1 right-1 z-10">
                  {file.uploading ? (
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-600">…</div>
                  ) : file.error ? (
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm text-red-500">!</div>
                  ) : file.uploadedUrl ? (
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm text-green-600">✓</div>
                  ) : null}
                </div>
              </div>

                <div className="flex-1 w-full">
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-3">
                    {file.uploading && <div className="text-xs text-gray-500">Uploading…</div>}
                  </div>
                  <div className="text-sm text-gray-500">&nbsp;</div>
                </div>

                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 uppercase">Quantity</div>
                    <div className="flex items-center border rounded-full">
                      <button onClick={() => onUpdateQuantity(file.id, -1)} className="px-3 py-1">−</button>
                      <div className="px-3 py-1 font-semibold">{file.quantity}</div>
                      <button onClick={() => onUpdateQuantity(file.id, 1)} className="px-3 py-1">+</button>
                    </div>

                    <button onClick={() => onRemoveFile(file.id)} className="ml-2 w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center" aria-label={`Remove ${file.name}`}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>

                  <div>
                    <button onClick={() => onCustomize(file.id)} className="bg-[#FFD600] text-black px-4 py-2 rounded-md font-semibold w-full md:w-auto">CUSTOMIZE</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default UploadStep;
