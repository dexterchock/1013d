import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';

export const ScreenRuler: React.FC = () => {
  const isRulerVisible = useStore((state) => state.isRulerVisible);
  const ppi = useStore((state) => state.ppi);

  const tickAreaRef = useRef<HTMLDivElement>(null);
  const [tickAreaHeight, setTickAreaHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  useEffect(() => {
    const el = tickAreaRef.current;
    if (!el) return;

    const syncHeight = () => {
      const nextHeight = Math.ceil(el.getBoundingClientRect().height || el.clientHeight);
      if (nextHeight > 0) {
        setTickAreaHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
      }
    };

    syncHeight();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextHeight = Math.ceil(entry.contentRect.height);
      if (nextHeight > 0) {
        setTickAreaHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
      }
    });

    ro.observe(el);
    window.addEventListener('resize', syncHeight);
    document.addEventListener('fullscreenchange', syncHeight);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHeight);
      document.removeEventListener('fullscreenchange', syncHeight);
    };
  }, []);

  const tickElements = useMemo(() => {
    const originY = 8;
    const pxPerMm = ppi / 25.4;
    if (!(pxPerMm > 0) || tickAreaHeight <= 0) return null;

    const maxMm = Math.ceil(Math.max(0, tickAreaHeight - originY) / pxPerMm);
    const showMinorTicks = pxPerMm >= 1.5;
    const elements: React.ReactNode[] = [];

    for (let mm = 0; mm <= maxMm; mm++) {
      const y = originY + mm * pxPerMm;

      if (mm % 10 === 0) {
        elements.push(
          <g key={mm}>
            <line
              x1={0}
              y1={y}
              x2={16}
              y2={y}
              stroke="#ffffff"
              strokeWidth={1.25}
            />
            <text
              x={20}
              y={y}
              dominantBaseline="central"
              fill="#ffffff"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {mm / 10}
            </text>
          </g>
        );
      } else if (mm % 5 === 0) {
        elements.push(
          <line
            key={mm}
            x1={0}
            y1={y}
            x2={11}
            y2={y}
            stroke="rgba(255,255,255,0.72)"
            strokeWidth={1}
          />
        );
      } else if (showMinorTicks) {
        elements.push(
          <line
            key={mm}
            x1={0}
            y1={y}
            x2={6}
            y2={y}
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={0.75}
          />
        );
      }
    }

    return elements;
  }, [tickAreaHeight, ppi]);

  return (
    <div
      role="region"
      aria-label="1:1 Physical Centimeter Ruler"
      aria-hidden={!isRulerVisible}
      style={{
        touchAction: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      className={`absolute inset-y-0 right-0 z-20 w-12 bg-black border-l border-white/15 flex flex-col select-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        isRulerVisible
          ? 'translate-x-0 pointer-events-auto'
          : 'translate-x-full pointer-events-none'
      }`}
    >
      <div className="shrink-0 h-12 px-0.5 flex flex-col items-center justify-center border-b border-white/15 font-mono leading-tight text-center">
        <span className="text-[9px] font-bold text-white">1:1 cm</span>
        <span className="text-[8px] text-blue-400 tabular-nums">
          {Math.round(ppi)} PPI
        </span>
      </div>

      <div ref={tickAreaRef} className="flex-1 min-h-0 relative overflow-hidden">
        <svg className="w-full h-full block" aria-hidden="true">
          {tickElements}
        </svg>
      </div>
    </div>
  );
};
