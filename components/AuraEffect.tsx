import React from 'react';
import { useStore } from '../store';

export const AuraEffect: React.FC = () => {
  const is1to1Mode = useStore((state) => state.is1to1Mode);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);
  const isRulerVisible = useStore((state) => state.isRulerVisible);

  const isVisible = is1to1Mode && !isCalibrationModalOpen;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-1000 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      <div
        className={`absolute top-0 bottom-0 left-0 overflow-hidden mix-blend-screen transition-[right] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isRulerVisible ? 'right-12' : 'right-0'
        }`}
      >
        <div
          className={`
            absolute inset-0 transition-all duration-[1.5s] ease-out
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <div
            className={`absolute inset-0 shadow-[inset_0_0_20px_0px_rgba(59,130,246,1)] ${
              isVisible ? 'animate-fiber-breath' : ''
            }`}
          />
          <div
            className={`absolute inset-0 border border-blue-500/80 ${
              isVisible ? 'animate-fiber-breath' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
};
