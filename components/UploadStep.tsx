import React, { useRef } from 'react';

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

interface UploadStepProps {
  files: UploadedFile[];
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onToggleRemoveBackground: (id: string) => void;
  onToggleBorder: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onCustomize: (id: string) => void;
  errors?: string[];
}

export default function UploadStep({ files, onAddFiles, onRemoveFile, onToggleRemoveBackground, onToggleBorder, onUpdateQuantity, onCustomize, errors }: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function triggerInput() {
    fileInputRef.current?.click();
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    onAddFiles(e.target.files);
    // reset so same file can be re-selected
    e.currentTarget.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onAddFiles(e.dataTransfer.files);
  }

  return (
    <div>
      {errors && errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
          <ul className="text-sm text-red-700 list-disc pl-5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      <div
        onClick={triggerInput}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-yellow-50 cursor-pointer"
      >
        <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/webp" multiple onChange={handleInput} className="hidden" />
        <div className="w-12 h-12 rounded-full bg-[#FFD600] flex items-center justify-center mb-3 shadow">
          <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
        </div>
        <div className="text-lg font-semibold">Tap to Upload Images</div>
        <div className="text-sm text-gray-500 mt-2">PNG, JPG or WebP (Max 15MB)</div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Uploaded Images</h3>
          <div className="bg-gray-800 text-white text-xs rounded-full px-3 py-1">{files.length} Files</div>
        </div>

        <div className="space-y-4">
          {files.map((file) => (
            <div key={file.id} className="bg-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start gap-4">
              <div className="relative w-full md:w-20 h-40 md:h-20 min-w-[5rem] min-h-[5rem] rounded-md bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
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
                    <button onClick={() => onRemoveFile(file.id)} className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span title={file.name} className="max-w-[14rem] block truncate">{file.name}</span>
                      {file.uploading && <span className="text-xs text-gray-500">Uploading…</span>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">&nbsp;</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Remove Background</div>
                    </div>
                    <div>
                      <button onClick={() => onToggleRemoveBackground(file.id)} aria-pressed={file.removeBackground} className="w-8 h-8 rounded-full flex items-center justify-center border">
                        {file.removeBackground ? (
                          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Border</div>
                    </div>
                    <div>
                      <button onClick={() => onToggleBorder(file.id)} aria-pressed={file.border} className="w-8 h-8 rounded-full flex items-center justify-center border">
                        {file.border ? (
                          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 uppercase">Quantity</div>
                    <div className="flex items-center border rounded-full">
                      <button onClick={() => onUpdateQuantity(file.id, -1)} className="px-3 py-1">−</button>
                      <div className="px-3 py-1 font-semibold">{file.quantity}</div>
                      <button onClick={() => onUpdateQuantity(file.id, 1)} className="px-3 py-1">+</button>
                    </div>
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
}
