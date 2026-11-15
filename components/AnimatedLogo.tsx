import React, { useState, useEffect, useRef } from 'react';

const easeOutExpo = (x: number): number => {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

export const AnimatedLogo: React.FC = () => {
  const [showSuffix, setShowSuffix] = useState(false);

  const requestRef = useRef<number>(0);
  const suffixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const previousIntRef = useRef<number>(0);
  const time100StartRef = useRef<number>(0);
  const suffixTriggeredRef = useRef<boolean>(false);

  const numberSpanRef = useRef<HTMLSpanElement>(null);

  const START_VAL = 0;
  const LOGICAL_END_VAL = 101.5;
  const DISPLAY_CLAMP = 101;
  const DURATION = 2200;

  useEffect(() => {
    const animate = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }

      const timeElapsed = time - startTimeRef.current;
      const progress = Math.min(timeElapsed / DURATION, 1);

      const ease = easeOutExpo(progress);
      const currentFloat = START_VAL + (LOGICAL_END_VAL - START_VAL) * ease;

      let currentInt = Math.floor(currentFloat);
      if (currentInt > DISPLAY_CLAMP) currentInt = DISPLAY_CLAMP;

      if (currentInt !== previousIntRef.current) {
        if (numberSpanRef.current) {
          numberSpanRef.current.textContent = String(currentInt);
        }

        if (currentInt === 100) {
          time100StartRef.current = time;
        }
        if (currentInt === 101 && !suffixTriggeredRef.current) {
          suffixTriggeredRef.current = true;
          const durationOf100 = time100StartRef.current
            ? time - time100StartRef.current
            : 350;

          suffixTimeoutRef.current = setTimeout(() => {
            setShowSuffix(true);
          }, durationOf100);
        }
        previousIntRef.current = currentInt;
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        if (numberSpanRef.current) {
          numberSpanRef.current.textContent = String(DISPLAY_CLAMP);
        }
        if (!suffixTriggeredRef.current) {
          suffixTriggeredRef.current = true;
          setShowSuffix(true);
        }
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (suffixTimeoutRef.current) clearTimeout(suffixTimeoutRef.current);
    };
  }, []);

  return (
    <span className="flex items-center select-none cursor-pointer group" aria-hidden="true">
      <span className="relative overflow-visible">
        <span
          ref={numberSpanRef}
          className="text-xl font-bold tracking-tight text-white tabular-nums leading-none font-mono block"
        >
          0
        </span>
      </span>

      <span
        className={`
          grid transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
          ${showSuffix ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'}
        `}
      >
        <span className="overflow-hidden flex items-center">
          <span
            className={`
              text-xl font-bold tracking-tight text-blue-500 leading-none font-mono ml-0.5
              transform transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
              ${showSuffix ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
            `}
          >
            3D
          </span>
        </span>
      </span>
    </span>
  );
};
