import React from 'react';
import { useRouter } from 'next/router';

type Props = {
  onBack?: () => void;
  branchName?: string;
  directionsUrl?: string;
};

export default function ThankYouStep({ onBack, branchName = 'Civic Center, Olongapo City', directionsUrl = 'https://maps.app.goo.gl/QToM1WmioBzZ3Fs97' }: Props) {
  const router = useRouter();
  const goHome = () => {
    if (onBack) return onBack();
    router.push('/user');
  };

  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-full bg-yellow-100 flex items-center justify-center shadow-md mb-4 pulse-outer">
            <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center pulse-inner">
              <svg className="pulse-check" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17l-5-5" stroke="#07121A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold">Thank you for your purchase!</h2>
          <p className="text-sm text-gray-500 mt-3">Your sticker reservation is confirmed. We've notified the stall to start preparing your prints.</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 11l7-7 7 7" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="font-semibold">Need help finding the stall?</div>
            <div className="text-sm text-gray-600 mt-1">Open the stall location in Google Maps to get directions to {branchName}.</div>
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm font-semibold text-yellow-600">Get Directions</a>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button onClick={goHome} className="w-full bg-white border border-gray-200 rounded-full py-3 font-medium">Back to Home</button>
      </div>
      <style jsx>{`
        .pulse-outer { position: relative; }
        .pulse-outer::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          box-shadow: 0 0 0 0 rgba(245,158,11,0.45);
          animation: pulse-ring 1600ms cubic-bezier(.33,.66,.66,1) infinite;
        }
        .pulse-inner { animation: pulse-scale 800ms ease-in-out infinite; transform-origin: center; }
        .pulse-check { animation: check-bounce 800ms ease-in-out infinite; transform-origin: center; }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.45); opacity: 1; transform: scale(1); }
          70% { box-shadow: 0 0 0 18px rgba(245,158,11,0); opacity: 0; transform: scale(1.06); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); opacity: 0; transform: scale(1.06); }
        }
        @keyframes pulse-scale {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes check-bounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
