import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Shape, Group, Rect } from 'react-konva';

type ShapeType = 'circle' | 'square' | 'star' | 'hexagon' | 'triangle';

interface CustomSettings {
  shape?: ShapeType;
  borderColor?: string;
  strokeWidth?: number;
  padding?: number;
  cornerRadius?: number;
  imgScale?: number;
  imgX?: number;
  imgY?: number;
}

interface ImageCustomizerProps {
  initialImageUrl?: string | null;
  initialSettings?: CustomSettings | null;
  onSave?: (dataUrl: string, settings?: CustomSettings) => void;
  onClose?: () => void;
}

const MAX_STAGE = 400;
const MIN_STAGE = 200;

function drawStarPath(ctx: any, cx: number, cy: number, spikes: number, outer: number, inner: number) {
  let rot = -Math.PI / 2; // start top
  const step = Math.PI / spikes;
  ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < spikes; i++) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  }
}

function drawPolygonPath(ctx: any, cx: number, cy: number, sides: number, radius: number, rotation = -Math.PI/2) {
  const step = (Math.PI * 2) / sides;
  ctx.moveTo(cx + Math.cos(rotation) * radius, cy + Math.sin(rotation) * radius);
  for (let i = 1; i < sides; i++) {
    const ang = rotation + step * i;
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
  }
}

function drawRoundedRectPath(ctx: any, cx: number, cy: number, size: number, radius: number) {
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;
  const r = Math.min(radius, half);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// triangle uses the generic polygon path (3 sides)

export default function ImageCustomizer({ initialImageUrl, initialSettings = null, onSave, onClose }: ImageCustomizerProps) {
  const stageRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<number>(MAX_STAGE);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [localSrc, setLocalSrc] = useState<string | undefined>(initialImageUrl ?? undefined);
  const createdObjectUrlRef = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // If older saved settings used 'heart', treat them as 'triangle' now
  // accept legacy 'heart' value from persisted settings by checking raw value
  const legacyShape = (initialSettings as any)?.shape;
  const initialShape = (legacyShape === 'heart') ? 'triangle' : (initialSettings?.shape ?? 'circle');
  const [shape, setShape] = useState<ShapeType>(initialShape);
  const [borderColor, setBorderColor] = useState<string>(initialSettings?.borderColor ?? '#FFD600');
  const [strokeWidth, setStrokeWidth] = useState<number>(initialSettings?.strokeWidth ?? 8);
  const [padding, setPadding] = useState<number>(initialSettings?.padding ?? 0);
  const [cornerRadius, setCornerRadius] = useState<number>(initialSettings?.cornerRadius ?? 16);
  const [imgScale, setImgScale] = useState<number>(1);
  const [imgX, setImgX] = useState<number>(0);
  const [imgY, setImgY] = useState<number>(0);

  useEffect(() => {
    if (!localSrc) return;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = localSrc;
    img.onload = () => setImgEl(img);
    return () => {
      // don't revoke here - parent may still use preview
    };
  }, [localSrc]);

  // Make the stage responsive: pick a square size based on the container width
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function updateFromWindow() {
      const fallback = Math.min(MAX_STAGE, Math.max(MIN_STAGE, Math.floor(window.innerWidth - 48)));
      setStageSize(fallback);
    }

    const el = containerRef.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect.width);
          const size = Math.min(MAX_STAGE, Math.max(MIN_STAGE, w));
          setStageSize(size);
        }
      });
      ro.observe(el);
      // initial
      const rect = el.getBoundingClientRect();
      setStageSize(Math.min(MAX_STAGE, Math.max(MIN_STAGE, Math.floor(rect.width))));
      return () => ro.disconnect();
    }

    updateFromWindow();
    window.addEventListener('resize', updateFromWindow);
    return () => window.removeEventListener('resize', updateFromWindow);
  }, []);

  useEffect(() => {
    let mounted = true;
    // cleanup any previously created object URL
    if (createdObjectUrlRef.current) {
      try { URL.revokeObjectURL(createdObjectUrlRef.current); } catch (e) { /* ignore */ }
      createdObjectUrlRef.current = null;
    }

    if (!initialImageUrl) {
      if (mounted) setLocalSrc(undefined);
      return () => { mounted = false; };
    }

    // If the source is already a blob or data URL, just use it directly.
    if (initialImageUrl.startsWith('blob:') || initialImageUrl.startsWith('data:')) {
      if (mounted) setLocalSrc(initialImageUrl);
      return () => { mounted = false; };
    }

    // For http(s) URLs, try to fetch the image as a blob and create an object URL.
    // This avoids canvas tainting in many hosting setups by ensuring we draw
    // a same-origin blob URL into the canvas. If the fetch/CORS fails we
    // gracefully fall back to using the original remote URL (may taint canvas).
    (async () => {
      try {
        const res = await fetch(initialImageUrl, { mode: 'cors' });
        if (!res.ok) throw new Error('Failed to fetch image');
        const b = await res.blob();
        const obj = URL.createObjectURL(b);
        createdObjectUrlRef.current = obj;
        if (mounted) setLocalSrc(obj);
      } catch (e) {
        // fallback to remote URL — this may taint the canvas depending on CORS
        if (mounted) setLocalSrc(initialImageUrl);
      }
    })();

    return () => {
      mounted = false;
      if (createdObjectUrlRef.current) {
        try { URL.revokeObjectURL(createdObjectUrlRef.current); } catch (e) { /* ignore */ }
        createdObjectUrlRef.current = null;
      }
    };
  }, [initialImageUrl]);

  // Note: image source is provided by the parent (`initialImageUrl`).

  // image transform state: imgScale, imgX, imgY control how the image is drawn.
  // initialize when image or stage size changes
  useEffect(() => {
    if (!imgEl) return;
    const iw = imgEl.width;
    const ih = imgEl.height;
    const cover = Math.max(stageSize / iw, stageSize / ih);
    const minScale = cover; // ensure image covers the stage
    const maxScale = Math.max(cover, 1); // don't allow upscaling beyond native when possible
    const initialScale = minScale;
    const w = Math.round(iw * initialScale);
    const h = Math.round(ih * initialScale);
    const x = Math.round((stageSize - w) / 2);
    const y = Math.round((stageSize - h) / 2);
    // prefer any previously saved transform settings if provided
    let useScale = initialScale;
    let useX = x;
    let useY = y;
    if (initialSettings && typeof initialSettings.imgScale === 'number') {
      const s = Math.min(maxScale, Math.max(minScale, initialSettings.imgScale));
      useScale = s;
      const clamped = clampImagePosition(typeof initialSettings.imgX === 'number' ? initialSettings.imgX : x, typeof initialSettings.imgY === 'number' ? initialSettings.imgY : y, s);
      useX = clamped.x;
      useY = clamped.y;
    }
    setImgScale(useScale);
    setImgX(useX);
    setImgY(useY);
    // store min/max on the element so handlers can access (keeps simple)
    (imgEl as any).__minScale = minScale;
    (imgEl as any).__maxScale = maxScale;
  }, [imgEl, stageSize]);

  const clampImagePosition = (x: number, y: number, scale = imgScale) => {
    if (!imgEl) return { x, y };
    const iw = imgEl.width;
    const ih = imgEl.height;
    const w = iw * scale;
    const h = ih * scale;
    const pad = Math.round(strokeWidth / 2 + padding);
    const left = pad;
    const top = pad;
    const right = stageSize - pad;
    const bottom = stageSize - pad;
    const minX = Math.round(right - w);
    const maxX = Math.round(left);
    const minY = Math.round(bottom - h);
    const maxY = Math.round(top);
    let nx = x;
    let ny = y;
    if (minX > maxX) {
      // image too small to cover horizontally (shouldn't happen if minScale used) - center
      nx = Math.round((left + right - w) / 2);
    } else {
      nx = Math.min(maxX, Math.max(minX, nx));
    }
    if (minY > maxY) {
      ny = Math.round((top + bottom - h) / 2);
    } else {
      ny = Math.min(maxY, Math.max(minY, ny));
    }
    return { x: nx, y: ny };
  };

  // clip function used for group clipping; supports many shapes
  const clipFunc = (ctx: any) => {
    const pad = strokeWidth / 2 + padding;
    const cx = stageSize / 2;
    const cy = stageSize / 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(cx, cy, stageSize / 2 - pad, 0, Math.PI * 2);
    } else if (shape === 'square') {
      if (cornerRadius > 0) {
        drawRoundedRectPath(ctx, cx, cy, stageSize - pad * 2, cornerRadius);
      } else {
        ctx.rect(pad, pad, stageSize - pad * 2, stageSize - pad * 2);
      }
    } else if (shape === 'hexagon') {
      drawPolygonPath(ctx, cx, cy, 6, stageSize / 2 - pad);
    } else if (shape === 'triangle') {
      drawPolygonPath(ctx, cx, cy, 3, stageSize / 2 - pad);
    } else {
      // star
      drawStarPath(ctx, cx, cy, 5, stageSize / 2 - pad, (stageSize / 2 - pad) * 0.5);
    }
    ctx.closePath();
  };

  // sceneFunc for border shape
  const sceneFunc = (ctx: any, shapeObj: any) => {
    const pad = strokeWidth / 2 + padding;
    const cx = stageSize / 2;
    const cy = stageSize / 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(cx, cy, stageSize / 2 - pad, 0, Math.PI * 2);
    } else if (shape === 'square') {
      if (cornerRadius > 0) {
        drawRoundedRectPath(ctx, cx, cy, stageSize - pad * 2, cornerRadius);
      } else {
        ctx.rect(pad, pad, stageSize - pad * 2, stageSize - pad * 2);
      }
    } else if (shape === 'hexagon') {
      drawPolygonPath(ctx, cx, cy, 6, stageSize / 2 - pad);
    } else if (shape === 'triangle') {
      drawPolygonPath(ctx, cx, cy, 3, stageSize / 2 - pad);
    } else {
      drawStarPath(ctx, cx, cy, 5, stageSize / 2 - pad, (stageSize / 2 - pad) * 0.5);
    }
    ctx.closePath();
    // draw stroke (Konva's context provides fillStrokeShape)
    if (typeof (ctx as any).fillStrokeShape === 'function') {
      (ctx as any).fillStrokeShape(shapeObj);
    }
  };

  // image-based border generation removed — use the vector `Shape` for borders

  function handleSave() {
    setSaveError(null);
    if (!stageRef.current) return;
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
      const settings: CustomSettings = { shape, borderColor, strokeWidth, padding, cornerRadius, imgScale, imgX, imgY };
      onSave?.(dataUrl, settings);
    } catch (err: any) {
      console.error('Export failed', err);
      const msg = err && err.message ? err.message : 'Failed to export image. This can happen when the source image is hosted without CORS headers.';
      setSaveError(msg);
    }
  }

  return (
    <div className="w-full" ref={containerRef}>
      <div className="flex flex-col gap-4 mb-4 items-center">
        <div className="p-2 bg-white rounded-md shadow-sm">
          <Stage width={stageSize} height={stageSize} ref={stageRef}>
            <Layer>
              <Group clipFunc={(ctx: any) => { clipFunc(ctx); if (typeof ctx.clip === 'function') ctx.clip(); }}>
                {imgEl ? (
                  <KonvaImage
                    image={imgEl}
                    x={imgX}
                    y={imgY}
                    width={Math.round(imgEl.width * imgScale)}
                    height={Math.round(imgEl.height * imgScale)}
                    draggable
                    onDragMove={(e: any) => {
                      const nx = e.target.x();
                      const ny = e.target.y();
                      const clamped = clampImagePosition(nx, ny);
                      e.target.x(clamped.x);
                      e.target.y(clamped.y);
                      setImgX(clamped.x);
                      setImgY(clamped.y);
                    }}
                    onDragEnd={(e: any) => {
                      const nx = e.target.x();
                      const ny = e.target.y();
                      const clamped = clampImagePosition(nx, ny);
                      e.target.x(clamped.x);
                      e.target.y(clamped.y);
                      setImgX(clamped.x);
                      setImgY(clamped.y);
                    }}
                  />
                ) : (
                  <Rect x={0} y={0} width={stageSize} height={stageSize} fill="#f8fafc" stroke="#e5e7eb" dash={[6, 6]} />
                )}
              </Group>

              <Shape sceneFunc={(ctx: any, shapeObj: any) => sceneFunc(ctx, shapeObj)} stroke={borderColor} strokeWidth={strokeWidth} fillEnabled={false} />
            </Layer>
          </Stage>
        </div>

        <div className="w-full max-w-2xl">
          <div className="mb-3">
            <div className="text-sm font-medium mb-2">Shape</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {['circle','square','star','hexagon','triangle'].map((s) => (
                <button
                  key={s}
                  onClick={() => setShape(s as ShapeType)}
                  aria-label={`Select ${s} shape${shape === s ? ' (selected)' : ''}`}
                  className={`px-2 py-2 border rounded text-sm ${shape === s ? 'bg-yellow-100 border-yellow-300' : 'bg-white'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-sm font-medium">Border</div>
              <div className="flex items-center gap-2 mt-2">
                <input id="custom-border-color-picker" aria-label="Choose border color" type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
                <input id="custom-border-color-hex" aria-label="Border color hex" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
              </div>
              <div className="mt-2">
                <input id="custom-border-width" aria-label="Border width" type="range" min={0} max={64} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-gray-500 mt-1">{strokeWidth}px</div>
              </div>

              {shape === 'square' && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Corner radius</div>
                  <input aria-label="Corner radius" type="range" min={0} max={Math.floor(stageSize / 2)} value={cornerRadius} onChange={(e) => setCornerRadius(Number(e.target.value))} className="w-full" />
                  <div className="text-xs text-gray-500 mt-1">{cornerRadius}px</div>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium">Padding</div>
                <div className="mt-2">
                  <input aria-label="Padding" type="range" min={0} max={64} value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="w-full" />
                  <div className="text-xs text-gray-500 mt-1">{padding}px</div>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium">Zoom</div>
                  <ZoomControl imgEl={imgEl} imgScale={imgScale} setImgScale={setImgScale} imgX={imgX} imgY={imgY} setImgX={setImgX} setImgY={setImgY} stageSize={stageSize} strokeWidth={strokeWidth} padding={padding} />
                </div>
            </div>

            <div>
              <div className="text-sm font-medium">Preview</div>
              <div className="text-xs text-gray-500 mt-2">Live preview updates as you change controls.</div>
              <div className="text-xs text-gray-500 mt-2">Using vector border</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-yellow-400 rounded font-semibold w-full sm:w-auto">Save</button>
            <button onClick={() => onClose?.()} className="px-4 py-2 border rounded w-full sm:w-auto">Close</button>
          </div>
          {saveError && <div className="text-sm text-red-600 mt-2">{saveError}</div>}
        </div>
      </div>
    </div>
  );
}

// ZoomControl: small helper rendered inside the same file to avoid new imports.
function ZoomControl({ imgEl, imgScale, setImgScale, imgX, imgY, setImgX, setImgY, stageSize, strokeWidth, padding }: any) {
  if (!imgEl) return <div className="text-xs text-gray-500 mt-2">Upload an image to enable zoom</div>;
  const iw = imgEl.width;
  const ih = imgEl.height;
  const cover = Math.max(stageSize / iw, stageSize / ih);
  const minScale = cover;
  const maxScale = Math.max(cover, 1);

  const handleChange = (v: number) => {
    const prevScale = imgScale;
    const newScale = Math.min(maxScale, Math.max(minScale, v));
    // anchor zoom at stage center
    const cx = stageSize / 2;
    const cy = stageSize / 2;
    const ux = (cx - imgX) / prevScale; // image-space coordinate at stage center
    const uy = (cy - imgY) / prevScale;
    const nx = Math.round(cx - ux * newScale);
    const ny = Math.round(cy - uy * newScale);
    // clamp pos so image covers the inner rect
    const w = iw * newScale;
    const h = ih * newScale;
    const pad = Math.round(strokeWidth / 2 + padding);
    const left = pad;
    const top = pad;
    const right = stageSize - pad;
    const bottom = stageSize - pad;
    const minX = Math.round(right - w);
    const maxX = Math.round(left);
    const minY = Math.round(bottom - h);
    const maxY = Math.round(top);
    let cxpos = nx;
    let cypos = ny;
    if (minX > maxX) cxpos = Math.round((left + right - w) / 2);
    else cxpos = Math.min(maxX, Math.max(minX, cxpos));
    if (minY > maxY) cypos = Math.round((top + bottom - h) / 2);
    else cypos = Math.min(maxY, Math.max(minY, cypos));
    setImgScale(newScale);
    setImgX(cxpos);
    setImgY(cypos);
  };

  return (
    <div>
      <input
        aria-label="Zoom"
        type="range"
        min={minScale}
        max={maxScale}
        step={(maxScale - minScale) / 100 || 0.01}
        value={imgScale}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="text-xs text-gray-500 mt-1">{Math.round(imgScale * 100)}%</div>
    </div>
  );
}
