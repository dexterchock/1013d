
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
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
const MoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3M2 12h20M12 2v20" />
  </svg>
);
const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 5.5A10 10 0 1 1 11.26 2.05" />
  </svg>
);
const MagnetIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
      <path d="M6 10v4a6 6 0 1 0 12 0v-4" />
      <path d="M6 6h12" />
    </svg>
);

const NumberInput: React.FC<{ 
    label: string; 
    value: number; 
    onChange: (val: number) => void;
    step?: number;
    id?: string;
}> = ({ label, value, onChange, step = 1, id }) => {
    const [localVal, setLocalVal] = useState(value.toString());

    useEffect(() => {
        setLocalVal(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        setLocalVal(valStr);
        const num = parseFloat(valStr);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    return (
        <label className="flex items-center gap-2 bg-black/20 rounded px-2 py-1 border border-white/5 focus-within:border-white/20 transition-colors duration-200 cursor-text">
            <span className="text-[10px] font-mono text-white/40 w-2">{label}</span>
            <input 
                id={id}
                name={id}
                type="number"
                step={step}
                className="w-full bg-transparent text-xs text-white outline-none text-right font-mono"
                value={localVal}
                onChange={handleChange}
            />
        </label>
    );
};

// Robust input for calibration fields that handles focus/sync correctly to allow deletion
const CalibrationInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    id: string;
    placeholder?: string;
}> = ({ value, onChange, id, placeholder }) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // If element is focused, do not overwrite user input with store value
        // This prevents the field from snapping back while typing or clearing
        if (document.activeElement === inputRef.current) return;
        setLocalValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        const num = parseFloat(val);
        // We only update the store if it's a valid number. 
        // If empty (NaN), store keeps old value, but local state shows empty to user.
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = () => {
        // On blur, if invalid (empty), revert to last known good store value
        const num = parseFloat(localValue);
        if (isNaN(num)) {
             setLocalValue(value.toString());
        } else {
             // Optional: Format cleanly on blur
             setLocalValue(num.toString());
        }
    };

    return (
        <input 
            ref={inputRef}
            id={id}
            name={id}
            type="number" 
            value={localValue} 
            onChange={handleChange} 
            onBlur={handleBlur}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/20"
            placeholder={placeholder}
        />
    );
};

const ModelListItem: React.FC<{ model: LoadedModel }> = ({ model }) => {
    const store = useStore();
    const isSelected = store.selectedModelId === model.id;
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync expansion with selection state, allowing for mount animation
    useEffect(() => {
        if (isSelected) {
            const frame = requestAnimationFrame(() => {
                setIsExpanded(true);
            });
            return () => cancelAnimationFrame(frame);
        } else {
            setIsExpanded(false);
        }
    }, [isSelected]);

    const updateTransform = (type: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z', value: number) => {
        let finalValue = value;
        if (type === 'rotation') {
            finalValue = THREE.MathUtils.degToRad(value);
        }
        
        const currentPos = store.modelPositions[model.id] || {x:0, y:0, z:0};
        const currentRot = store.modelRotations[model.id] || {x:0, y:0, z:0};
        const currentScale = store.modelScales[model.id] || {x:1, y:1, z:1};

        const current = type === 'position' ? currentPos : (type === 'rotation' ? currentRot : currentScale);
        const newObj = { ...current, [axis]: finalValue };

        store.updateModelTransform(model.id, { [type]: newObj });
    };

    const pos = store.modelPositions[model.id] || {x:0, y:0, z:0};
    const rot = store.modelRotations[model.id] || {x:0, y:0, z:0};
    const scale = store.modelScales[model.id] || {x:1, y:1, z:1};
    
    // Hardcoded bezier for Tailwind to ensure it works
    const easingClass = "ease-[cubic-bezier(0.32,0.72,0,1)]";

    return (
        <div 
            onClick={() => store.selectModel(model.id)}
            className={`
                flex flex-col rounded-lg border cursor-pointer transition-all duration-500 ${easingClass} overflow-hidden
                ${isSelected 
                    ? 'bg-black/40 border-white/10 shadow-lg' 
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                }
            `}
        >
            <div className="flex items-center gap-3 p-2 shrink-0">
                <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: model.color }} />
                <span className={`text-sm truncate flex-1 ${isSelected ? 'text-white' : 'text-white/80'}`}>{model.file.name}</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        store.removeModel(model.id);
                    }}
                    className="text-white/20 hover:text-red-400 px-2 transition-colors"
                >
                    ×
                </button>
            </div>

            <div 
                className={`
                    grid transition-[grid-template-rows] duration-500 ${easingClass}
                    ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="overflow-hidden">
                    <div className={`
                        px-2 pb-3 pt-0 transition-opacity duration-500 delay-100
                        ${isExpanded ? 'opacity-100' : 'opacity-0'}
                    `}>
                        <div className="h-px bg-white/10 w-full mb-3"></div>
                        <div className="space-y-3">
                            {/* Position */}
                            <div>
                                <span className="text-[9px] text-white/30 uppercase mb-1 block">Position (mm)</span>
                                <div className="grid grid-cols-3 gap-1">
                                    <NumberInput id={`pos-x-${model.id}`} label="X" value={Math.round(pos.x * 100) / 100} onChange={(v) => updateTransform('position', 'x', v)} />
                                    <NumberInput id={`pos-y-${model.id}`} label="Y" value={Math.round(pos.y * 100) / 100} onChange={(v) => updateTransform('position', 'y', v)} />
                                    <NumberInput id={`pos-z-${model.id}`} label="Z" value={Math.round(pos.z * 100) / 100} onChange={(v) => updateTransform('position', 'z', v)} />
                                </div>
                            </div>

                            {/* Rotation */}
                            <div>
                                <span className="text-[9px] text-white/30 uppercase mb-1 block">Rotation (deg)</span>
                                <div className="grid grid-cols-3 gap-1">
                                    <NumberInput id={`rot-x-${model.id}`} label="X" value={Math.round(THREE.MathUtils.radToDeg(rot.x))} onChange={(v) => updateTransform('rotation', 'x', v)} />
                                    <NumberInput id={`rot-y-${model.id}`} label="Y" value={Math.round(THREE.MathUtils.radToDeg(rot.y))} onChange={(v) => updateTransform('rotation', 'y', v)} />
                                    <NumberInput id={`rot-z-${model.id}`} label="Z" value={Math.round(THREE.MathUtils.radToDeg(rot.z))} onChange={(v) => updateTransform('rotation', 'z', v)} />
                                </div>
                            </div>

                            {/* Scale */}
                            <div>
                                <span className="text-[9px] text-white/30 uppercase mb-1 block">Scale</span>
                                <div className="grid grid-cols-3 gap-1">
                                    <NumberInput id={`scale-x-${model.id}`} label="X" step={0.1} value={Math.round(scale.x * 100) / 100} onChange={(v) => updateTransform('scale', 'x', v)} />
                                    <NumberInput id={`scale-y-${model.id}`} label="Y" step={0.1} value={Math.round(scale.y * 100) / 100} onChange={(v) => updateTransform('scale', 'y', v)} />
                                    <NumberInput id={`scale-z-${model.id}`} label="Z" step={0.1} value={Math.round(scale.z * 100) / 100} onChange={(v) => updateTransform('scale', 'z', v)} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Overlay: React.FC<OverlayProps> = ({ controlsRef }) => {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'models' | 'calibration'>('models');
  const [mounted, setMounted] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  // Height Animation Logic using direct DOM manipulation for performance
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    // 1. Define the update function
    const updateHeight = () => {
         if (!store.sidebarOpen) {
             container.style.height = '56px'; // Collapsed height (h-14)
             // Force scroll to top when collapsed to ensure header is always visible
             content.scrollTop = 0; 
             return;
         }
         
         // Measure content height (scroll height to account for overflow) and add padding (p-4 = 32px)
         const contentHeight = content.scrollHeight; 
         const totalHeight = contentHeight + 32;
         
         container.style.height = `${totalHeight}px`;
    };

    // 2. Initial sync
    updateHeight();

    // 3. Set up ResizeObserver
    const ro = new ResizeObserver(() => {
        updateHeight();
    });
    ro.observe(content);

    // 4. FIX: Polling Interval for CSS Transitions
    // Since ResizeObserver often fails to fire when a parent container restricts
    // the height during an animation, we force updates every 16ms (60fps) 
    // for the duration of the transition (approx 600ms).
    const animationDuration = 600; 
    const startTime = Date.now();
    
    const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        updateHeight();
        
        if (elapsed > animationDuration) {
            clearInterval(intervalId);
        }
    }, 16);

    return () => {
        ro.disconnect();
        clearInterval(intervalId);
    };
  }, [store.sidebarOpen, store.selectedModelId, activeTab, store.models.length, showAbout]); 

  // Trigger entry animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calibration State (Synced with Store)
  const { resolutionWidth, resolutionHeight, diagonalInches } = store.calibrationSettings;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      store.addModels(Array.from(e.target.files));
      setActiveTab('models');
      e.target.value = '';
    }
  };

  const handle1to1 = () => {
    apply1to1Scale(controlsRef.current, store.ppi);
  };

  const calculatePPI = () => {
    if (resolutionWidth && resolutionHeight && diagonalInches) {
      const diagonalPixels = Math.sqrt(resolutionWidth * resolutionWidth + resolutionHeight * resolutionHeight);
      const calculatedPPI = diagonalPixels / diagonalInches;
      store.setPPI(calculatedPPI);
    }
  };

  // Visual state
  const showModelTools = !!store.selectedModelId;
  const showSnap = showModelTools && store.gizmoMode === 'rotate';
  const easingClass = "ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between overflow-hidden">
        
        {/* LEFT SIDEBAR: Collapsible */}
        <div 
          ref={containerRef}
          className={`
            absolute left-4 top-4 
            transition-all duration-500 ${easingClass} pointer-events-auto flex flex-col overflow-hidden
            ${store.sidebarOpen ? 'w-80' : 'w-[8.5rem]'}
            ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
          `}
          style={{ 
             maxHeight: '90vh' // Cap the height to viewport
          }}
        >
          <LiquidContainer className={`h-full flex flex-col relative overflow-hidden transition-all duration-700 ${store.sidebarOpen ? 'p-4' : 'p-2'}`}>
            <div 
                ref={contentRef} 
                // Toggle overflow based on sidebar state to prevent scrolling when collapsed
                className={`flex flex-col max-h-full no-scrollbar ${store.sidebarOpen ? 'overflow-y-auto' : 'overflow-hidden'}`}
            >
                {/* Header (Always Visible) */}
                <div className="flex justify-between items-center shrink-0 h-10 pl-2 pr-0.5 mb-0">
                    <div 
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={store.toggleSidebar}
                        role="button"
                        aria-label="Toggle sidebar"
                    >
                         <AnimatedLogo />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {store.sidebarOpen && (
                            <button 
                                onClick={() => setShowAbout(!showAbout)}
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showAbout ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'}`}
                            >
                                <InfoIcon />
                            </button>
                        )}
                        <button 
                            onClick={store.toggleSidebar}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            {store.sidebarOpen ? <ChevronUp/> : <ChevronDown/>}
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                <div 
                className={`
                    flex flex-col flex-1 transition-all duration-500 ${easingClass}
                    ${store.sidebarOpen ? 'mt-4 opacity-100 translate-y-0 delay-100' : 'mt-0 opacity-0 -translate-y-4 pointer-events-none'}
                `}
                >
                
                {/* About Section */}
                <div className={`overflow-hidden transition-all duration-500 ${easingClass} ${showAbout ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs leading-relaxed text-white/70">
                        <p className="mb-2">A 3D viewer to inspect and scale models in true 1:1 dimensions using display resolution or card calibration.</p>
                        <div className="flex items-center gap-2 text-white/40 font-mono text-[10px] uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span>
                                Creator: <a 
                                    href="https://www.instagram.com/dexterchock/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="hover:text-blue-400 transition-colors cursor-pointer border-b border-transparent hover:border-blue-400/30"
                                >
                                    Dexter Chock
                                </a>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-white/5 rounded-lg mb-4 shrink-0">
                    <button 
                    onClick={() => setActiveTab('models')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'models' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                    Models
                    </button>
                    <button 
                    onClick={() => setActiveTab('calibration')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'calibration' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                    Calibration
                    </button>
                </div>

                {/* TAB CONTENT: MODELS */}
                {activeTab === 'models' && (
                    <div className="flex flex-col animate-in fade-in duration-300">
                    {/* Upload Area */}
                    <div className="mb-4 shrink-0">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                        <span className="text-sm text-white/50 group-hover:text-white">Drag & Drop or Click</span>
                        <span className="text-xs text-white/30 mt-1">.obj, .stl, .3mf</span>
                        <input id="file-upload" name="file-upload" type="file" multiple onChange={handleFileUpload} className="hidden" accept=".obj,.stl,.3mf,*/*" />
                        </label>
                    </div>

                    {/* Model List */}
                    <div className="flex-1 overflow-y-auto no-scrollbar mb-2 max-h-[50vh]">
                        <h3 className="text-xs font-mono uppercase text-white/40 mb-2">Active Models</h3>
                        <div className="space-y-2">
                        {store.models.length === 0 && (
                            <div className="flex flex-col items-center gap-2 p-2">
                                <div className="text-sm text-white/20 italic">No models loaded.</div>
                                <button 
                                    onClick={() => store.addExampleModel()}
                                    className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                                >
                                    Try Example
                                </button>
                            </div>
                        )}
                        {store.models.map((model) => (
                            <ModelListItem key={model.id} model={model} />
                        ))}
                        </div>
                    </div>
                    </div>
                )}

                {/* TAB CONTENT: CALIBRATION */}
                {activeTab === 'calibration' && (
                    <div className="flex flex-col animate-in fade-in duration-300 pb-1">
                        <p className="text-xs text-white/60 mb-4 leading-relaxed">
                        For true 1:1 scale, the app needs to know your specific pixel density (PPI).
                        </p>

                        {/* Calculator Section */}
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-6 shrink-0">
                        <h3 className="text-xs font-bold text-white/80 mb-3 uppercase tracking-wider">Auto Calculate</h3>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                            <label htmlFor="res-width" className="text-[10px] text-white/40 block mb-1">Width (px)</label>
                            <CalibrationInput 
                                id="res-width" 
                                value={resolutionWidth} 
                                onChange={(val) => store.setCalibrationSettings({ resolutionWidth: val })}
                            />
                            </div>
                            <div>
                            <label htmlFor="res-height" className="text-[10px] text-white/40 block mb-1">Height (px)</label>
                            <CalibrationInput 
                                id="res-height" 
                                value={resolutionHeight} 
                                onChange={(val) => store.setCalibrationSettings({ resolutionHeight: val })}
                            />
                            </div>
                        </div>
                        
                        <div className="mb-3">
                            <label htmlFor="monitor-size" className="text-[10px] text-white/40 block mb-1">Diagonal Size (Inches)</label>
                            <CalibrationInput 
                                id="monitor-size" 
                                value={diagonalInches} 
                                onChange={(val) => store.setCalibrationSettings({ diagonalInches: val })}
                                placeholder="e.g. 24, 27, 13.3"
                            />
                        </div>

                        <LiquidButton onClick={calculatePPI} className="w-full !py-1 !text-xs bg-white/10 hover:bg-white/20">
                            Calculate PPI
                        </LiquidButton>
                        </div>

                        {/* Manual Controls - Replaced with Modal Trigger */}
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 shrink-0">
                        <h3 className="text-xs font-bold text-white/80 mb-3 uppercase tracking-wider">Manual Adjustment</h3>
                        <p className="text-[10px] text-white/40 mb-3">
                            Use a physical credit card to calibrate the scale precisely.
                        </p>
                        
                        <div className="text-center mb-4">
                            <span className="text-xl font-bold font-mono text-blue-400">{store.ppi.toFixed(1)}</span>
                            <span className="text-[10px] text-white/40 ml-1">PPI</span>
                        </div>

                        <LiquidButton 
                            onClick={() => store.setCalibrationModalOpen(true)}
                            className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 border-blue-500/30"
                        >
                            Open Manual Calibration
                        </LiquidButton>
                        </div>
                    </div>
                )}
                </div>
            </div>
          </LiquidContainer>
        </div>

        {/* BOTTOM CONTROL PILL */}
        <div 
          className={`
             absolute bottom-10 md:bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto
             transition-all duration-700 ${easingClass} delay-100
             ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          {/* Main Pill Container - P-0 allows full-bleed buttons */}
          <LiquidContainer className="flex items-center gap-0 p-0 rounded-full overflow-hidden">
            
            {/* Axis Views Group */}
            {(['X', 'Y', 'Z'] as const).map((axis) => (
               <button
                  key={axis}
                  onClick={() => transitionToAxis(controlsRef.current, axis)}
                  className="h-10 w-10 flex items-center justify-center text-xs font-mono font-bold text-white/40 hover:text-white hover:bg-white/5 border-r border-white/10 transition-colors"
               >
                 {axis}
               </button>
            ))}

            {/* Model Tools - Animated Wrapper */}
            <div 
                className={`
                    flex overflow-hidden transition-all duration-500 ${easingClass}
                    ${showModelTools ? 'max-w-[12rem] opacity-100' : 'max-w-0 opacity-0'}
                `}
            >
                <button
                    onClick={() => store.setGizmoMode('translate')}
                    className={`
                        h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
                        ${store.gizmoMode === 'translate' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
                    `}
                    title="Move"
                >
                    <MoveIcon />
                </button>

                <button
                    onClick={() => store.setGizmoMode('rotate')}
                    className={`
                        h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
                        ${store.gizmoMode === 'rotate' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
                    `}
                    title="Rotate"
                >
                    <RotateIcon />
                </button>

                {/* Snap Button - Slide Out */}
                <div className={`
                    overflow-hidden transition-all duration-300 ease-out
                    ${showSnap ? 'w-10 opacity-100' : 'w-0 opacity-0'}
                `}>
                     <button
                        onClick={() => store.setRotationSnap(store.rotationSnap ? null : 45)}
                        className={`
                            h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
                            ${store.rotationSnap !== null ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
                        `}
                        title="Snap"
                     >
                        <MagnetIcon />
                     </button>
                </div>
            </div>

            {/* 1:1 Button - End Cap */}
            <button 
                onClick={handle1to1}
                className={`
                    h-10 px-5 flex items-center justify-center 
                    text-xs font-bold tracking-wider transition-all duration-300
                    ${store.is1to1Mode 
                        ? 'bg-blue-600 text-white shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]' 
                        : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white'}
                `}
            >
                1:1
            </button>

          </LiquidContainer>
        </div>

      </div>
    </>
  );
}
