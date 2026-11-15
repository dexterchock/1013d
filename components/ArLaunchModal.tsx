import React, { useEffect } from 'react';
import { useStore } from '../store';
import { LiquidContainer } from './LiquidContainer';
import { isIosThirdPartyBrowser } from '../utils/arSupport';

// 1x1 transparent PNG so WebKit treats <a rel="ar"><img /></a> as a valid AR Quick Look link.
const TRANSPARENT_AR_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface ArLaunchModalProps {
  onLaunchWebAr: () => void;
}

export const ArLaunchModal: React.FC<ArLaunchModalProps> = ({ onLaunchWebAr }) => {
  const arStatus = useStore((state) => state.arStatus);
  const arUsdzUrl = useStore((state) => state.arUsdzUrl);
  const arModelUrl = useStore((state) => state.arModelUrl);
  const arFileName = useStore((state) => state.arFileName);
  const arError = useStore((state) => state.arError);
  const closeArSession = useStore((state) => state.closeArSession);
  const triggerArGeneration = useStore((state) => state.triggerArGeneration);

  const isOpen = arStatus !== 'idle';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeArSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeArSession]);

  if (!isOpen) {
    return null;
  }

  const thirdPartyIos = isIosThirdPartyBrowser();
  const usdzDownloadName = `${arFileName || 'model'}.usdz`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeArSession();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Augmented Reality Launch"
    >
      <LiquidContainer className="w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/15">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 px-2 items-center rounded-md bg-blue-500/20 text-blue-300 text-[11px] font-bold tracking-wider">
              AR 1:1
            </span>
            <h2 className="text-sm font-semibold text-white">View in Your Space</h2>
          </div>
          <button
            type="button"
            onClick={closeArSession}
            className="hover-pop-btn p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Close AR launcher"
          >
            <span className="hover-pop-icon">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
          </button>
        </div>

        {arStatus === 'preparing' && (
          <div className="py-4 flex flex-col items-center text-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-white">Preparing 1:1 AR Model...</p>
              <p className="text-xs text-white/75 mt-1">
                Converting geometry to true physical scale.
              </p>
            </div>
          </div>
        )}

        {arStatus === 'ready' && arUsdzUrl && (
          <div className="space-y-3">
            <p className="text-xs text-white/80 leading-relaxed">
              Your model is ready in physical 1:1 scale. Tap below to launch Apple AR Quick Look.
            </p>

            {/* WebKit requires <a rel="ar"> to have a single <img> child activated by a direct user tap */}
            <div className="hover-pop-btn relative h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-[0_0_24px_rgba(37,99,235,0.4)] flex items-center justify-center overflow-hidden">
              <span className="hover-pop-label pointer-events-none select-none text-sm font-semibold text-white tracking-wide">
                Open in AR Quick Look
              </span>
              <a
                rel="ar"
                href={arUsdzUrl}
                download={usdzDownloadName}
                aria-label="Open in AR Quick Look"
                className="absolute inset-0 z-10 block"
              >
                <img
                  src={TRANSPARENT_AR_PIXEL}
                  alt="Open in AR Quick Look"
                  className="w-full h-full block"
                />
              </a>
            </div>

            {thirdPartyIos ? (
              <p className="text-[11px] text-amber-300/95 leading-relaxed">
                This iOS browser uses an embedded view where Apple Quick Look may download the{' '}
                <code className="text-white">.usdz</code> file instead of opening automatically.
                Open this page in Safari for instant inline AR.
              </p>
            ) : (
              <p className="text-[11px] text-white/70 text-center">
                Tap Done in the top corner of Quick Look when finished to return here.
              </p>
            )}
          </div>
        )}

        {arStatus === 'ready' && !arUsdzUrl && arModelUrl && (
          <div className="space-y-3">
            <p className="text-xs text-white/80 leading-relaxed">
              Your 1:1 model is ready for Augmented Reality placement.
            </p>
            <button
              type="button"
              onClick={onLaunchWebAr}
              className="hover-pop-btn h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm font-semibold text-white shadow-[0_0_24px_rgba(37,99,235,0.4)]"
            >
              <span className="hover-pop-label">Launch AR Viewer</span>
            </button>
          </div>
        )}

        {arStatus === 'error' && (
          <div className="space-y-3">
            <p className="text-xs text-red-300 leading-relaxed">
              {arError || 'Could not export this model for AR.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={triggerArGeneration}
                className="hover-pop-btn flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                <span className="hover-pop-label">Try Again</span>
              </button>
              <button
                type="button"
                onClick={closeArSession}
                className="hover-pop-btn flex-1 h-10 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/90"
              >
                <span className="hover-pop-label">Close</span>
              </button>
            </div>
          </div>
        )}
      </LiquidContainer>
    </div>
  );
};
