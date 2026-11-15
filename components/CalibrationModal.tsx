import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { LiquidButton, LiquidContainer } from './LiquidContainer';
import { MIN_PPI, MAX_PPI } from '../types';

export const CalibrationModal: React.FC = () => {
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  const setCalibrationModalOpen = useStore((state) => state.setCalibrationModalOpen);
  const ppi = useStore((state) => state.ppi);
  const setPPI = useStore((state) => state.setPPI);

  const [inputValue, setInputValue] = useState(ppi.toFixed(1));
  const [hasMounted, setHasMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setInputValue(ppi.toFixed(1));
  }, [ppi]);

  const isOpen = isCalibrationModalOpen && hasMounted;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCalibrationModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setCalibrationModalOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val) && val >= MIN_PPI) {
      setPPI(val);
    }
  };

  const handleBlur = () => {
    setInputValue(ppi.toFixed(1));
  };

  // ISO/IEC 7810 ID-1 credit card dimensions in mm
  const CARD_WIDTH_MM = 85.6;
  const CARD_HEIGHT_MM = 53.98;
  const CARD_RADIUS_MM = 3.18;

  const cardWidthPx = (CARD_WIDTH_MM / 25.4) * ppi;
  const cardHeightPx = (CARD_HEIGHT_MM / 25.4) * ppi;
  const cardRadiusPx = (CARD_RADIUS_MM / 25.4) * ppi;
  const cardFontSizePx = cardWidthPx * 0.045;

  const sliderValue = Math.min(400, Math.max(50, ppi));

  return (
    <div
      className={`
        fixed inset-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${
          isOpen
            ? 'opacity-100 visible pointer-events-auto backdrop-blur-md'
            : 'opacity-0 invisible pointer-events-none backdrop-blur-none delay-0'
        }
      `}
      {...(!isOpen ? { inert: '' as unknown as boolean } : {})}
    >
      {/* Background Backdrop */}
      <div
        className={`
          absolute inset-0 bg-black/80 transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Scrollable Overlay Container */}
      <div
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) setCalibrationModalOpen(false);
        }}
      >
        <div
          className={`
            min-h-full w-full flex flex-col items-center justify-center py-12
            transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${
              isOpen
                ? 'scale-100 opacity-100 translate-y-0 blur-0'
                : 'scale-95 opacity-0 translate-y-4 blur-sm'
            }
          `}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCalibrationModalOpen(false);
          }}
        >
          {/* Top Content (Header + Card) */}
          <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4 mb-16">
            <div className="flex flex-col items-center gap-2 mb-8 text-center">
              <span className="text-blue-400 font-mono text-xs uppercase tracking-[0.15em] font-bold">
                Manual Calibration
              </span>
              <h2 className="text-white text-xl font-medium">Standard Credit Card</h2>
              <p className="text-white/80 text-sm max-w-sm mx-auto leading-relaxed">
                Place your physical card against the screen. <br />
                <span className="text-blue-300 block mt-2 font-medium">
                  Mobile users: Match the{' '}
                  <span className="underline decoration-blue-300/50 underline-offset-4">
                    height
                  </span>{' '}
                  (top &amp; bottom edges).
                </span>
              </p>
            </div>

            {/* Card Container */}
            <div className="relative flex items-center justify-center">
              {/* Height Dimensions Lines */}
              <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-center items-center h-full opacity-50 md:opacity-80">
                <div className="w-[1px] bg-white/30 absolute top-0 bottom-0 left-1/2 -translate-x-1/2" />
                <div className="w-2 h-[1px] bg-white/30 absolute top-0 left-1/2 -translate-x-1/2" />
                <div className="w-2 h-[1px] bg-white/30 absolute bottom-0 left-1/2 -translate-x-1/2" />
                <span className="bg-black text-white/85 px-1 py-0.5 text-[9px] font-mono -rotate-90 whitespace-nowrap z-10 rounded border border-white/15">
                  53.98 mm
                </span>
              </div>

              {/* Credit Card Shape */}
              <div
                className="bg-gradient-to-br from-blue-500 to-blue-600 relative shadow-[0_0_50px_rgba(59,130,246,0.3)] transition-all duration-75 flex items-center justify-center border-t border-white/20 shrink-0 mx-auto"
                style={{
                  width: `${cardWidthPx}px`,
                  height: `${cardHeightPx}px`,
                  borderRadius: `${cardRadiusPx}px`,
                }}
              >
                <div className="absolute left-[10%] top-[30%] w-[15%] h-[20%] bg-yellow-200/20 rounded-sm border border-yellow-200/40" />

                <div
                  className="absolute left-0 right-0 top-[60%] text-center text-blue-950/40 font-bold tracking-wider pointer-events-none select-none uppercase whitespace-nowrap font-mono"
                  style={{
                    fontSize: `${cardFontSizePx}px`,
                    textShadow: '0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  Dexter Chock&apos;s Credit Card
                </div>

                {/* Mobile Height Guides */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white/80 md:hidden" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-white/80 md:hidden" />

                <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/50 animate-pulse" />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/50 animate-pulse" />

                {/* Width Dimensions Lines */}
                <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center opacity-30 md:opacity-70 transition-opacity">
                  <div className="h-[1px] bg-white/30 absolute left-0 right-0 top-1/2" />
                  <div className="h-[5px] bg-white/30 absolute left-0 top-0 bottom-0" />
                  <div className="h-[5px] bg-white/30 absolute right-0 top-0 bottom-0" />
                  <span className="bg-black text-white/85 px-2 text-[10px] font-mono relative z-10">
                    85.60 mm
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="w-full max-w-2xl px-6">
            <LiquidContainer className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-white/70">50</span>
                <input
                  id="ppi-slider"
                  name="ppi-slider"
                  aria-label="PPI Adjustment Slider"
                  type="range"
                  min="50"
                  max="400"
                  step="0.5"
                  value={sliderValue}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setPPI(next);
                    setInputValue(next.toFixed(1));
                  }}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs font-mono text-white/70">400</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <label
                    htmlFor="ppi-value-input"
                    className="text-xs text-white/70 uppercase tracking-widest mb-1"
                  >
                    Current Density
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      id="ppi-value-input"
                      name="ppi-value-input"
                      type="number"
                      inputMode="decimal"
                      min={MIN_PPI}
                      max={MAX_PPI}
                      value={inputValue}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      step="0.1"
                      className="bg-transparent text-2xl font-bold font-mono text-blue-400 outline-none w-32 border-b border-white/10 focus:border-blue-400 transition-colors py-0 leading-none"
                    />
                    <span className="text-xs text-white/70">PPI</span>
                  </div>
                </div>

                <LiquidButton
                  onClick={() => setCalibrationModalOpen(false)}
                  className="!bg-white !text-black hover:!bg-gray-200 !px-8 !py-3 !font-bold"
                >
                  Done
                </LiquidButton>
              </div>
            </LiquidContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
