import React, { useState, useEffect, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useStore } from '../store';
import { LiquidContainer, LiquidButton } from './LiquidContainer';
import { transitionToAxis, apply1to1Scale } from '../utils/viewUtils';
import * as THREE from 'three';
import { LoadedModel } from '../types';
import { AnimatedLogo } from './AnimatedLogo';

interface OverlayProps {
  controlsRef: React.MutableRefObject<CameraControls | null>;
}

// Icons
const ChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const MagnetIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.65 6.35a7.5 7.5 0 1 1-11.3 0" />
      <path d="M15 19a3 3 0 0 1-6 0" />
      <path d="M12 2v8" />
    </svg>
);

const ModelListItem: React.FC<{ model: LoadedModel }> = ({ model }) => {
  const store = useStore();
  const isSelected = store.selectedModelId === model.id;
  
  return (
    <div 
      className={`
        mb-2 rounded-xl transition-all duration-300 border
        ${isSelected ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10'}
      `}
    >
      <button 
        onClick={() => store.setSelectedModel(isSelected ? null : model.id)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white truncate max-w-[180px]">
            {model.name}
          </span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {(model.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
        <div className={`transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`}>
          <ChevronDown />
        </div>
      </button>

      <div className={`
        grid transition-[grid-template-rows] duration-300 ease-out
        ${isSelected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
      `}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
            <div className="flex justify-between items-center">
               <span className="text-[11px] text-white/40 uppercase font-bold">Properties</span>
               <button 
                onClick={(e) => {
                    e.stopPropagation();
                    store.removeModel(model.id);
                }}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
               >
                 <TrashIcon />
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 p-2 rounded-lg">
                    <div className="text-[9px] text-white/30 uppercase mb-1">Scale</div>
                    <div className="text-xs text-white font-mono">1.000</div>
                </div>
                <div className="bg-black/20 p-2 rounded-lg">
                    <div className="text-[9px] text-white/30 uppercase mb-1">Rotation</div>
                    <div className="text-xs text-white font-mono">0.0°</div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function Overlay({ controlsRef }: OverlayProps) {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'models' | 'calibration'>('models');
  const [showAbout, setShowAbout] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // PRODUCTION FIX: Reliable height observer
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    const updateHeight = () => {
      if (!store.sidebarOpen) {
        container.style.height = '56px'; // Header height
        return;
      }

      // We use scrollHeight to measure the "intended" size of expanded children
      // even if they are currently being clipped by the parent.
      const targetHeight = content.scrollHeight + 32; // +32 for p-4 padding
      
      requestAnimationFrame(() => {
        container.style.height = `${targetHeight}px`;
      });
    };

    const ro = new ResizeObserver(updateHeight);
    ro.observe(content);
    
    // Initial sync
    updateHeight();

    return () => ro.disconnect();
    // Re-run whenever internal state that changes height is triggered
  }, [store.sidebarOpen, activeTab, store.models.length, store.selectedModelId, showAbout]);

  const handle1to1 = () => {
    if (controlsRef.current) {
      apply1to1Scale(controlsRef.current, store);
    }
  };

  const easingClass = "cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50 p-4 font-sans text-white select-none">
        
        {/* TOP LEFT WINDOW: Main Controls */}
        <div 
          ref={containerRef}
          className={`
            absolute left-4 top-4 w-80 
            transition-all duration-500 pointer-events-auto
            ${store.sidebarOpen ? 'opacity-100' : 'w-14'}
          `}
          style={{ transitionTimingFunction: easingClass, overflow: 'hidden' }}
        >
          <LiquidContainer className="h-full flex flex-col p-4">
            {/* Header */}
            <div className="flex items-center justify-between h-6 mb-0">
               <button 
                onClick={() => store.setSidebarOpen(!store.sidebarOpen)}
                className="flex items-center gap-3 group"
               >
                 <div className="w-6 h-6 flex items-center justify-center">
                    <AnimatedLogo active={store.sidebarOpen} />
                 </div>
                 <span className={`font-black text-lg tracking-tighter transition-all duration-500 ${store.sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                   1013<span className="text-blue-500">D</span>
                 </span>
               </button>

               {store.sidebarOpen && (
                 <button 
                    onClick={() => setShowAbout(!showAbout)}
                    className={`p-1.5 rounded-full transition-colors ${showAbout ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                 >
                    <InfoIcon />
                 </button>
               )}
            </div>

            {/* Content Area */}
            <div 
               ref={contentRef}
               className={`
                 transition-all duration-500
                 ${store.sidebarOpen ? 'opacity-100 mt-6' : 'opacity-0 mt-0 pointer-events-none'}
               `}
               style={{ transitionTimingFunction: easingClass }}
            >
              {showAbout ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                   <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs leading-relaxed text-blue-100/80">
                        1013D is a spatial precision tool for verifying 3D assets in 1:1 real-world scale.
                      </p>
                   </div>
                   <button onClick={() => setShowAbout(false)} className="text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white transition-colors">
                     Back to Tools
                   </button>
                </div>
              ) : (
                <>
                  {/* Tab Switcher */}
                  <div className="flex p-1 bg-black/20 rounded-xl mb-6">
                    <button 
                      onClick={() => setActiveTab('models')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'models' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Models
                    </button>
                    <button 
                      onClick={() => setActiveTab('calibration')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'calibration' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Calibration
                    </button>
                  </div>

                  {activeTab === 'models' ? (
                    <div className="space-y-1">
                      {store.models.length === 0 ? (
                        <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                          <p className="text-xs text-white/20 font-medium">No models loaded</p>
                        </div>
                      ) : (
                        <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                           {store.models.map(m => <ModelListItem key={m.id} model={m} />)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-300">
                       <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <h4 className="text-[10px] font-bold uppercase text-white/40 mb-3">Display Density</h4>
                          <div className="space-y-4">
                             <div>
                                <div className="flex justify-between text-[10px] mb-2 font-mono">
                                   <span className="text-white/40">PPI / DPI</span>
                                   <span className="text-blue-400">{store.ppi}</span>
                                </div>
                                <input 
                                  type="range" min="50" max="300" step="1"
                                  value={store.ppi}
                                  onChange={(e) => store.setPpi(Number(e.target.value))}
                                  className="w-full accent-blue-500"
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </LiquidContainer>
        </div>

        {/* BOTTOM CENTER: Action Bar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto">
          <LiquidContainer className="flex items-center p-1 gap-1">
            <div className="flex bg-black/20 rounded-xl overflow-hidden">
                <button 
                    onClick={() => transitionToAxis(controlsRef.current, 'x')}
                    className="h-10 px-4 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >X</button>
                <button 
                    onClick={() => transitionToAxis(controlsRef.current, 'y')}
                    className="h-10 px-4 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >Y</button>
                <button 
                    onClick={() => transitionToAxis(controlsRef.current, 'z')}
                    className="h-10 px-4 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >Z</button>
                
                {/* Snap Button - Slide Out */}
                <div className={`
                    overflow-hidden transition-all duration-300 ease-out
                    ${store.models.length > 0 ? 'w-10 opacity-100' : 'w-0 opacity-0'}
                `}>
                     <button
                        onClick={() => store.setRotationSnap(store.rotationSnap ? null : 45)}
                        className={`
                            h-10 w-10 flex items-center justify-center border-l border-white/10 transition-colors
                            ${store.rotationSnap !== null ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
                        `}
                        title="Snap Rotation"
                     >
                        <MagnetIcon />
                     </button>
                </div>
            </div>

            {/* 1:1 Button */}
            <button 
                onClick={handle1to1}
                className={`
                    h-10 px-6 flex items-center justify-center 
                    text-xs font-black tracking-widest transition-all duration-300 rounded-xl
                    ${store.is1to1Mode 
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}
                `}
            >
                AUTO 1:1
            </button>
          </LiquidContainer>
        </div>

      </div>
    </>
  );
}
