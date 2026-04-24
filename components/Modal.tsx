import React, { useEffect, useState } from 'react';

type Props = {
  visible: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  dialogClass?: string;
};

export default function Modal({ visible, onClose, children, dialogClass = 'relative z-10 w-full max-w-md sm:max-w-lg mx-4' }: Props) {
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

      <style jsx global>{`
        .modal-overlay {
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.6) 100%);
          backdrop-filter: blur(4px) saturate(80%);
          -webkit-backdrop-filter: blur(4px) saturate(80%);
          opacity: 0;
          transition: opacity 260ms ease;
        }
        .modal-dialog { transform-origin: center; opacity: 0; transform: translateY(8px) scale(0.98); transition: opacity 260ms ease, transform 260ms cubic-bezier(0.2,0.8,0.2,1); box-shadow: 0 24px 48px rgba(7,18,26,0.22); }
        .modal-opening .modal-overlay { opacity: 1; }
        .modal-opening .modal-dialog { transform: translateY(0) scale(1); opacity: 1; }
        .modal-closing .modal-overlay { opacity: 0; }
        .modal-closing .modal-dialog { transform: translateY(8px) scale(0.98); opacity: 0; }
      `}</style>
    </div>
  );
}
