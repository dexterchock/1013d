import React, { useState, useEffect, useRef } from 'react';
import type { CameraControls } from '@react-three/drei';
import { useStore } from '../store';
import { LiquidContainer, LiquidButton } from './LiquidContainer';
import { AnimatedLogo } from './AnimatedLogo';
import { ChevronDown, ChevronUp, CloseIcon, InfoIcon } from './Icons';
import { NumericInput } from './NumericInput';
import { ModelListItem } from './ModelListItem';
import { BottomPill } from './BottomPill';

interface OverlayProps {
  controlsRef: React.MutableRefObject<CameraControls | null>;
}

export const Overlay: React.FC<OverlayProps> = ({ controlsRef }) => {
  const models = useStore((state) => state.models);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const ppi = useStore((state) => state.ppi);
  const calibrationSettings = useStore((state) => state.calibrationSettings);
  const uploadError = useStore((state) => state.uploadError);

  const addModels = useStore((state) => state.addModels);
  const addExampleModel = useStore((state) => state.addExampleModel);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const setCalibrationSettings = useStore((state) => state.setCalibrationSettings);
  const setPPI = useStore((state) => state.setPPI);
  const setCalibrationModalOpen = useStore((state) => state.setCalibrationModalOpen);
  const clearUploadError = useStore((state) => state.clearUploadError);

  const [activeTab, setActiveTab] = useState<'models' | 'calibration'>('models');
  const [showAbout, setShowAbout] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Sync logical screen resolution on mount and resize
  useEffect(() => {
    const handleResize = () => {
      setCalibrationSettings({
        resolutionWidth: window.screen.width,
        resolutionHeight: window.screen.height,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCalibrationSettings]);

  // Auto-dismiss upload errors after 4s
  useEffect(() => {
    if (!uploadError) return;
    const timer = setTimeout(() => clearUploadError(), 4000);
    return () => clearTimeout(timer);
  }, [uploadError, clearUploadError]);

  // Keep sidebar height synced via ResizeObserver on unconstrained inner wrapper (zero forced reflows)
  useEffect(() => {
    const content = contentRef.current;
    const inner = innerRef.current;
    const container = containerRef.current;
    if (!content || !inner || !container) return;

    if (!sidebarOpen) {
      container.style.height = '56px';
      content.scrollTop = 0;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (!sidebarOpen) {
        container.style.height = '56px';
        return;
      }
      const height = Math.ceil(entry.contentRect.height) + 34;
      container.style.height = `${height}px`;
    });

    ro.observe(inner);
    return () => {
      ro.disconnect();
    };
  }, [sidebarOpen]);

  const { resolutionWidth, resolutionHeight, diagonalInches } = calibrationSettings;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addModels(Array.from(e.target.files));
      setActiveTab('models');
      e.target.value = '';
    }
  };

  const calculatePPI = () => {
    if (resolutionWidth > 0 && resolutionHeight > 0 && diagonalInches > 0) {
      const diagonalPixels = Math.sqrt(
        resolutionWidth * resolutionWidth + resolutionHeight * resolutionHeight
      );
      setPPI(diagonalPixels / diagonalInches);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between overflow-hidden">
      {/* LEFT SIDEBAR: Collapsible */}
      <div
        ref={containerRef}
        className={`
          absolute left-4 top-4
          transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto flex flex-col
          ${sidebarOpen ? 'w-80' : 'w-[8.5rem]'}
        `}
        style={{ maxHeight: '90vh' }}
      >
        <LiquidContainer
          className={`w-full h-full flex flex-col relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            sidebarOpen ? 'p-4 rounded-3xl' : 'p-[11px] rounded-[28px]'
          }`}
        >
          <div
            ref={contentRef}
            className={`flex flex-col max-h-full no-scrollbar ${
              sidebarOpen ? 'overflow-y-auto' : 'overflow-hidden'
            }`}
          >
            <div ref={innerRef} className="flex flex-col shrink-0">
              {/* Header */}
            <div
              className={`flex justify-between items-center shrink-0 h-8 mb-0 ${
                sidebarOpen ? 'px-0' : 'pl-1.5 pr-0'
              }`}
            >
              <h1 className="m-0 leading-none flex items-center">
                <button
                  type="button"
                  className="hover-pop-btn flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left"
                  onClick={toggleSidebar}
                  aria-label="1013D, toggle sidebar"
                >
                  <span className="sr-only">1013D</span>
                  <span className="hover-pop-label inline-flex items-center">
                    <AnimatedLogo />
                  </span>
                </button>
              </h1>

              <div className="flex items-center gap-1.5">
                {sidebarOpen && (
                  <button
                    onClick={() => setShowAbout((prev) => !prev)}
                    className={`hover-pop-btn w-8 h-8 flex items-center justify-center rounded-full ${
                      showAbout
                        ? 'liquid-chip-active'
                        : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/90 hover:text-white'
                    }`}
                    aria-label="About 1013D"
                  >
                    <span className="hover-pop-icon">
                      <InfoIcon />
                    </span>
                  </button>
                )}
                <button
                  onClick={toggleSidebar}
                  className="hover-pop-btn w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-white/90 hover:text-white"
                  aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  <span className="hover-pop-icon">
                    {sidebarOpen ? <ChevronUp /> : <ChevronDown />}
                  </span>
                </button>
              </div>
            </div>

              {/* Collapsible Content */}
              <div
                className={`
                  flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${
                    sidebarOpen
                      ? 'mt-4 opacity-100 translate-y-0 delay-100'
                      : 'mt-0 opacity-0 -translate-y-4 pointer-events-none'
                  }
                `}
              >
              {/* About Section */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  showAbout ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
                }`}
              >
                <div className="p-3 bg-white/[0.04] rounded-xl border border-white/10 text-xs leading-relaxed text-white/85">
                  <p className="mb-2">
                    A 3D viewer to inspect and scale models in true 1:1 dimensions using
                    display PPI or card calibration.
                  </p>
                  <div className="flex items-center gap-2 text-white/70 font-mono text-[10px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="leading-none">
                      Creator:{' '}
                      <a
                        href="https://www.instagram.com/dexterchock/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover-pop-btn inline-flex items-center hover:text-blue-400 cursor-pointer border-b border-transparent hover:border-blue-400/30"
                      >
                        <span className="hover-pop-label">Dexter Chock</span>
                      </a>
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center p-1 bg-white/[0.04] rounded-xl border border-white/10 mb-4 shrink-0">
                <button
                  onClick={() => setActiveTab('models')}
                  className={`hover-pop-btn flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center leading-none ${
                    activeTab === 'models'
                      ? 'liquid-chip-active'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <span className="hover-pop-label leading-none">Models</span>
                </button>
                <button
                  onClick={() => setActiveTab('calibration')}
                  className={`hover-pop-btn flex-1 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center leading-none ${
                    activeTab === 'calibration'
                      ? 'liquid-chip-active'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <span className="hover-pop-label leading-none">Calibration</span>
                </button>
              </div>

              {/* TAB CONTENT: MODELS */}
              {activeTab === 'models' && (
                <div className="flex flex-col transition-opacity duration-300">
                  <div className="mb-4 shrink-0">
                    <label className="hover-pop-btn flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl hover:bg-white/[0.06] hover:border-white/35 cursor-pointer group">
                      <span className="hover-pop-soft-label flex flex-col items-center">
                        <span className="text-sm text-white/90 group-hover:text-white">
                          Drag &amp; Drop or Click
                        </span>
                        <span className="text-xs text-white/65 mt-1">.obj, .stl, .3mf</span>
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".obj,.stl,.3mf,*/*"
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <div
                      role="alert"
                      className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-200 flex items-center justify-between gap-2"
                    >
                      <span>{uploadError}</span>
                      <button
                        type="button"
                        onClick={clearUploadError}
                        className="hover-pop-btn w-6 h-6 flex items-center justify-center rounded-full text-red-300/80 hover:text-red-100 hover:bg-red-500/20 shrink-0"
                        aria-label="Dismiss error"
                      >
                        <span className="hover-pop-icon">
                          <CloseIcon />
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto no-scrollbar mb-2 max-h-[50vh]">
                    <h2 className="text-xs font-mono uppercase text-white/75 mb-2">
                      Active Models
                    </h2>
                    <div className="space-y-2">
                      {models.length === 0 && (
                        <div className="flex flex-col items-center gap-2 p-2">
                          <div className="text-sm text-white/65 italic">No models loaded.</div>
                          <button
                            onClick={() => void addExampleModel()}
                            className="hover-pop-btn text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                          >
                            <span className="hover-pop-label">Try Example</span>
                          </button>
                        </div>
                      )}
                      {models.map((model) => (
                        <ModelListItem key={model.id} model={model} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: CALIBRATION */}
              {activeTab === 'calibration' && (
                <div className="flex flex-col transition-opacity duration-300 pb-1">
                  <p className="text-xs text-white/80 mb-4 leading-relaxed">
                    For true 1:1 scale, the app needs to know your specific pixel density
                    (PPI).
                  </p>

                  {/* Calculator Section */}
                  <div className="bg-white/[0.04] p-3 rounded-xl border border-white/10 mb-5 shrink-0">
                    <h2 className="text-xs font-bold text-white/90 mb-3 uppercase tracking-wider">
                      Auto Calculate
                    </h2>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] text-white/70 block mb-1">Width</label>
                        <div className="w-full h-7 flex items-center bg-white/[0.05] rounded px-2 text-xs text-white/85 font-mono border border-white/5">
                          {resolutionWidth} px
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/70 block mb-1">Height</label>
                        <div className="w-full h-7 flex items-center bg-white/[0.05] rounded px-2 text-xs text-white/85 font-mono border border-white/5">
                          {resolutionHeight} px
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/65 italic mb-2 leading-tight">
                      * Logical resolution detected (OS scaling applied).
                    </p>

                    <div className="mb-3">
                      <label
                        htmlFor="monitor-size"
                        className="text-[10px] text-white/70 block mb-1"
                      >
                        Diagonal Size (Inches)
                      </label>
                      <NumericInput
                        id="monitor-size"
                        variant="field"
                        min={1}
                        max={200}
                        step={0.1}
                        value={diagonalInches}
                        onChange={(val) => setCalibrationSettings({ diagonalInches: val })}
                        placeholder="e.g. 24, 27, 13.3"
                      />
                    </div>

                    <LiquidButton
                      onClick={calculatePPI}
                      className="w-full !py-1.5 !text-xs bg-white/10 hover:bg-white/20 border-white/15"
                    >
                      Calculate PPI
                    </LiquidButton>
                  </div>

                  {/* Manual Calibration Trigger */}
                  <div className="bg-white/[0.04] p-3 rounded-xl border border-white/10 shrink-0">
                    <h2 className="text-xs font-bold text-white/90 mb-3 uppercase tracking-wider">
                      Manual Adjustment
                    </h2>
                    <p className="text-[10px] text-white/70 mb-3">
                      Use a physical credit card to calibrate the scale precisely.
                    </p>

                    <div className="flex items-baseline justify-center gap-1.5 mb-4">
                      <span className="text-xl font-bold font-mono text-blue-400">
                        {ppi.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-white/75">PPI</span>
                    </div>

                    <LiquidButton
                      onClick={() => setCalibrationModalOpen(true)}
                      className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 border-blue-500/30"
                    >
                      Open Manual Calibration
                    </LiquidButton>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </LiquidContainer>
      </div>

      {/* BOTTOM CONTROL PILL */}
      <BottomPill controlsRef={controlsRef} />
    </div>
  );
};
