import React from 'react';
import { useStore } from '../store';

export const AuraEffect: React.FC = () => {
  const is1to1Mode = useStore((state) => state.is1to1Mode);
  const isCalibrationModalOpen = useStore((state) => state.isCalibrationModalOpen);

  const isVisible = is1to1Mode && !isCalibrationModalOpen;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[100] transition-opacity duration-1000 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      <div className="absolute inset-0 overflow-hidden mix-blend-screen">
        <div
          className={`
            absolute inset-0 transition-all duration-[1.5s] ease-out
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <div className="absolute inset-0 shadow-[inset_0_0_20px_0px_rgba(59,130,246,1)] animate-fiber-breath" />
          <div className="absolute inset-0 border border-blue-500/80 animate-fiber-breath" />
        </div>
      </div>
    </div>
  );
};
