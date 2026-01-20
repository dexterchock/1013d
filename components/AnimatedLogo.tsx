
import React, { useState, useEffect, useRef } from 'react';

// Exponential Ease Out: Creates a very fast start and a long, slow tail.
// This naturally handles the "see 91, 92... 100" requirement.
const easeOutExpo = (x: number): number => {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

export const AnimatedLogo: React.FC = () => {
  const [displayValue, setDisplayValue] = useState(0);
  const [showSuffix, setShowSuffix] = useState(false);
  
  // Refs for animation state
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const previousFloatRef = useRef<number>(0);
  const previousIntRef = useRef<number>(0);
  const time100StartRef = useRef<number>(0);
  const suffixTriggeredRef = useRef<boolean>(false);
  
  const numberSpanRef = useRef<HTMLSpanElement>(null);
  
  // Configuration
  const START_VAL = 0;
  // Target slightly above 101 to ensure clean crossover from 100->101
  const LOGICAL_END_VAL = 101.5; 
  const DISPLAY_CLAMP = 101;
  
  const DURATION = 3300; 

  useEffect(() => {
    const animate = (time: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }
      
      const timeElapsed = time - startTimeRef.current;
      const progress = Math.min(timeElapsed / DURATION, 1);
      
      // Calculate current float value based on easing
      const ease = easeOutExpo(progress);
      const currentFloat = START_VAL + (LOGICAL_END_VAL - START_VAL) * ease;
      
      // Determine integer to display
      let currentInt = Math.floor(currentFloat);
      if (currentInt > DISPLAY_CLAMP) currentInt = DISPLAY_CLAMP;
      
      // --- DYNAMIC TIMING LOGIC ---
      // We want the pause AFTER 101 (before 3D) to match the duration OF 100.
      if (currentInt !== previousIntRef.current) {
          // Record when 100 starts
          if (currentInt === 100) {
              time100StartRef.current = time;
          }
          // When we hit 101, calculate how long 100 was shown
          if (currentInt === 101 && !suffixTriggeredRef.current) {
              suffixTriggeredRef.current = true;
              
              // How long was 100 on screen?
              // Default to 500ms if 100 was skipped (unlikely)
              const durationOf100 = time100StartRef.current ? (time - time100StartRef.current) : 500;
              
              // Delay the "3D" reveal by exactly that duration
              setTimeout(() => {
                  setShowSuffix(true);
              }, durationOf100);
          }
      }
      previousIntRef.current = currentInt;

      // --- MOTION BLUR ---
      const velocity = currentFloat - previousFloatRef.current;
      previousFloatRef.current = currentFloat;
      
      if (numberSpanRef.current) {
        // Blur when moving fast (skipping numbers)
        if (velocity > 0.15) {
            const blurAmount = Math.min(velocity * 4, 3);
            numberSpanRef.current.style.filter = `blur(${blurAmount}px)`;
            numberSpanRef.current.style.opacity = `${1 - (blurAmount * 0.1)}`;
        } else {
            numberSpanRef.current.style.filter = 'none';
            numberSpanRef.current.style.opacity = '1';
        }
      }

      setDisplayValue(currentInt);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        // Animation Complete
        setDisplayValue(DISPLAY_CLAMP);
        if (numberSpanRef.current) {
            numberSpanRef.current.style.filter = 'none';
            numberSpanRef.current.style.opacity = '1';
        }
        
        // Fallback: if somehow logic didn't trigger (e.g. tab background throttling)
        if (!suffixTriggeredRef.current) {
             setShowSuffix(true);
        }
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="flex items-center select-none cursor-default group" aria-label="1013D">
      {/* The Counter */}
      <div className="relative overflow-visible">
         <span 
            ref={numberSpanRef}
            className="text-xl font-bold tracking-tight text-white tabular-nums leading-none font-mono block will-change-[filter,opacity,transform]"
         >
           {displayValue}
         </span>
      </div>

      {/* The Suffix "3D" */}
      <div 
        className={`
          grid transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
          ${showSuffix ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'}
        `}
      >
        <div className="overflow-hidden flex items-center">
            <span 
                className={`
                    text-xl font-bold tracking-tight text-blue-500 leading-none font-mono ml-0.5
                    transform transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
                    ${showSuffix ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
                `}
            >
                3D
            </span>
        </div>
      </div>
    </div>
  );
};
