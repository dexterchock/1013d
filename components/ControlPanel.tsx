import React, { useState, useEffect, useRef } from 'react';
import type { CameraControls } from '@react-three/drei';
import { useStore } from '../store';
import { LiquidContainer, LiquidButton } from './LiquidContainer';
import { AnimatedLogo } from './AnimatedLogo';
import { ChevronDown, ChevronUp, InfoIcon } from './Icons';
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
  const [mounted, setMounted] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Keep sidebar height synced via ResizeObserver without 60fps interval polling
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    const updateHeight = () => {
      if (!sidebarOpen) {
        container.style.height = '56px';
        content.scrollTop = 0;
        return;
      }
      container.style.height = `${content.scrollHeight + 32}px`;
    };

    updateHeight();
    const rafId = requestAnimationFrame(updateHeight);

    const ro = new ResizeObserver(updateHeight);
    ro.observe(content);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [sidebarOpen, activeTab, models.length, showAbout, uploadError]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto flex flex-col overflow-hidden rounded-2xl
          ${sidebarOpen ? 'w-80' : 'w-[8.5rem]'}
          ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
        `}
        style={{ maxHeight: '90vh' }}
      >
        <LiquidContainer
          className={`h-full flex flex-col relative overflow-hidden transition-all duration-700 ${
            sidebarOpen ? 'p-4' : 'p-2'
          }`}
        >
          <div
            ref={contentRef}
            className={`flex flex-col max-h-full no-scrollbar ${
              sidebarOpen ? 'overflow-y-auto' : 'overflow-hidden'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center shrink-0 h-10 pl-2 pr-0.5 mb-0">
              <button
                type="button"
                className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                <AnimatedLogo />
              </button>

              <div className="flex items-center gap-1">
                {sidebarOpen && (
                  <button
                    onClick={() => setShowAbout((prev) => !prev)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                      showAbout
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                    }`}
                    aria-label="About 1013D"
                  >
                    <InfoIcon />
                  </button>
                )}
                <button
                  onClick={toggleSidebar}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  {sidebarOpen ? <ChevronUp /> : <ChevronDown />}
                </button>
              </div>
            </div>

            {/* Collapsible Content */}
            <div
              className={`
                flex flex-col flex-1 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
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
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs leading-relaxed text-white/70">
                  <p className="mb-2">
                    A 3D viewer to inspect and scale models in true 1:1 dimensions using
                    display PPI or card calibration.
                  </p>
                  <div className="flex items-center gap-2 text-white/40 font-mono text-[10px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>
                      Creator:{' '}
                      <a
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
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'models'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  Models
                </button>
                <button
                  onClick={() => setActiveTab('calibration')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'calibration'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  Calibration
                </button>
              </div>

              {/* TAB CONTENT: MODELS */}
              {activeTab === 'models' && (
                <div className="flex flex-col transition-opacity duration-300">
                  <div className="mb-4 shrink-0">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                      <span className="text-sm text-white/50 group-hover:text-white">
                        Drag &amp; Drop or Click
                      </span>
                      <span className="text-xs text-white/30 mt-1">.obj, .stl, .3mf</span>
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
                      className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-200 flex items-start justify-between gap-2"
                    >
                      <span>{uploadError}</span>
                      <button
                        type="button"
                        onClick={clearUploadError}
                        className="text-red-300/70 hover:text-red-100 leading-none"
                        aria-label="Dismiss error"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto no-scrollbar mb-2 max-h-[50vh]">
                    <h3 className="text-xs font-mono uppercase text-white/40 mb-2">
                      Active Models
                    </h3>
                    <div className="space-y-2">
                      {models.length === 0 && (
                        <div className="flex flex-col items-center gap-2 p-2">
                          <div className="text-sm text-white/20 italic">No models loaded.</div>
                          <button
                            onClick={() => void addExampleModel()}
                            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                          >
                            Try Example
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
                  <p className="text-xs text-white/60 mb-4 leading-relaxed">
                    For true 1:1 scale, the app needs to know your specific pixel density
                    (PPI).
                  </p>

                  {/* Calculator Section */}
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-6 shrink-0">
                    <h3 className="text-xs font-bold text-white/80 mb-3 uppercase tracking-wider">
                      Auto Calculate
                    </h3>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] text-white/40 block mb-1">Width</label>
                        <div className="w-full bg-white/5 rounded px-2 py-1 text-xs text-white/50 font-mono border border-transparent">
                          {resolutionWidth} px
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-1">Height</label>
                        <div className="w-full bg-white/5 rounded px-2 py-1 text-xs text-white/50 font-mono border border-transparent">
                          {resolutionHeight} px
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 italic mb-2 leading-tight">
                      * Logical resolution detected (OS scaling applied).
                    </p>

                    <div className="mb-3">
                      <label
                        htmlFor="monitor-size"
                        className="text-[10px] text-white/40 block mb-1"
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
                      className="w-full !py-1 !text-xs bg-white/10 hover:bg-white/20"
                    >
                      Calculate PPI
                    </LiquidButton>
                  </div>

                  {/* Manual Calibration Trigger */}
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5 shrink-0">
                    <h3 className="text-xs font-bold text-white/80 mb-3 uppercase tracking-wider">
                      Manual Adjustment
                    </h3>
                    <p className="text-[10px] text-white/40 mb-3">
                      Use a physical credit card to calibrate the scale precisely.
                    </p>

                    <div className="text-center mb-4">
                      <span className="text-xl font-bold font-mono text-blue-400">
                        {ppi.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-white/40 ml-1">PPI</span>
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
        </LiquidContainer>
      </div>

      {/* BOTTOM CONTROL PILL */}
      <BottomPill controlsRef={controlsRef} mounted={mounted} />
    </div>
  );
};
