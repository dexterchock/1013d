
import React from 'react';
import { useStore } from '../store';

export const AuraEffect: React.FC = () => {
  const { is1to1Mode, isCalibrationModalOpen } = useStore();

  // Hide effect if calibration modal is open to prevent visual interference
  const isVisible = is1to1Mode && !isCalibrationModalOpen;

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-[100] transition-opacity duration-1000 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* 
         High-Precision Fiber-Optic Edge Glow
         Blend mode 'screen' ensures the light illuminates edges without obscuring content.
      */}
      <div className="absolute inset-0 overflow-hidden mix-blend-screen">
        
        {/* Persistent Fiber-Optic Border */}
        <div 
            className={`
                absolute inset-0 
                transition-all duration-[1.5s] ease-out
                ${isVisible ? 'opacity-100' : 'opacity-0'}
            `}
        >
             {/* 
                The Glow Container:
                - Inset shadow with 0 spread.
                - Increased blur to 20px to give it more body without losing the "edge" origin.
                - Blue color (rgba(59,130,246,1)).
                - animate-fiber-breath handles the opacity pulse (now 0.5 <-> 0.8).
             */}
            <div className="absolute inset-0 shadow-[inset_0_0_20px_0px_rgba(59,130,246,1)] animate-fiber-breath" />
            
            {/* 
                Crisp Line:
                A 1px sharp boundary at the very edge to reinforce the "fiber-optic" concept.
            */}
            <div className="absolute inset-0 border border-blue-500/80 animate-fiber-breath" />
        </div>
      </div>
    </div>
  );
};
