import React, { useRef, useState, useEffect } from 'react';
import { ViewerScene } from './components/ViewerScene';
import { Overlay } from './components/ControlPanel';
import { AuraEffect } from './components/AuraEffect';
import { CalibrationModal } from './components/CalibrationModal';
import { CameraControls } from '@react-three/drei';
import { useStore } from './store';
// Import model-viewer for the web component side-effects
import '@google/model-viewer';

// Declare intrinsic elements for TypeScript to recognize <model-viewer>
// Use module augmentation for 'react' to ensure it merges correctly with existing JSX types
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

function App() {
  const controlsRef = useRef<CameraControls>(null);
  const [isMounted, setIsMounted] = useState(false);
  const addModels = useStore((state) => state.addModels);
  const [isDragging, setIsDragging] = useState(false);
  
  // AR Refs and State
  const modelViewerRef = useRef<any>(null); // Type 'any' to access custom methods like activateAR
  const arModelUrl = useStore((state) => state.arModelUrl);
  const setArSupported = useStore((state) => state.setArSupported);

  useEffect(() => {
    // Slight delay ensures the browser has painted the initial frame of the UI 
    // behind the curtain before we lift it.
    const t = setTimeout(() => setIsMounted(true), 100);

    // Global Context Menu (Right Click) Restriction
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow right-click only on inputs and textareas for accessibility/usability
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      const isEditable = target.isContentEditable;

      if (!isInput && !isEditable) {
        e.preventDefault();
      }
    };

    // Global Key Listener for Deletion
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useStore.getState();
        if (state.selectedModelId) {
          state.removeModel(state.selectedModelId);
        }
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- AR Logic ---
  useEffect(() => {
    const mv = modelViewerRef.current;
    if (mv) {
        // Check AR availability on mount
        const checkAr = () => {
            // canActivateAR is a property on the element instance
            setArSupported(mv.canActivateAR);
        };
        
        // Wait a tick for the element to initialize or listen to event
        if (mv.canActivateAR !== undefined) {
            checkAr();
        } else {
            // Fallback: wait for load or error (some browsers might be slow to report capabilities)
            mv.addEventListener('load', checkAr);
        }
    }
  }, [setArSupported]);

  // Activate AR when a new URL is generated
  useEffect(() => {
      if (arModelUrl && modelViewerRef.current) {
          // Setting the src triggers a load. We wait for load to activate AR.
          const mv = modelViewerRef.current;
          
          const handleLoad = () => {
              if (mv.canActivateAR) {
                  mv.activateAR();
              }
              // Clean up listener to prevent double triggering
              mv.removeEventListener('load', handleLoad);
          };

          mv.addEventListener('load', handleLoad);
      }
  }, [arModelUrl]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Strictly handle preventDefault to allow drop, but avoid state updates here 
    // as this event fires continuously on every mouse movement.
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only cancel dragging if we actually leave the window (relatedTarget is null or out of scope)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addModels(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <main 
        className="w-screen h-[100dvh] relative bg-neutral-900 selection:bg-blue-500/30 font-sans overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      
      {/* Background Gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] to-[#000000] pointer-events-none" />
      
      {/* Drag Overlay Feedback */}
      <div 
        className={`
          absolute inset-4 z-[200] border-2 border-dashed border-blue-500/50 bg-black/60 backdrop-blur-sm rounded-2xl 
          flex items-center justify-center pointer-events-none transition-opacity duration-300 
          ${isDragging ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div className="text-blue-400 font-mono text-xl tracking-widest uppercase animate-pulse">
            Drop Files to Import
        </div>
      </div>

      {/* 3D Scene */}
      <ViewerScene controlsRef={controlsRef} />

      {/* UI Overlay */}
      <Overlay controlsRef={controlsRef} />
      
      {/* Full Screen Calibration Modal */}
      <CalibrationModal />

      {/* 1:1 Scale Aura Effect */}
      <AuraEffect />

      {/* 
        The "Curtain" - Prevents FOUC (Flash of Unstyled Content) 
        It covers the screen immediately with the background color, then fades out 
        once React has settled the layout.
      */}
      <div 
        className={`
            fixed inset-0 z-[9999] bg-[#050505] pointer-events-none 
            transition-opacity duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isMounted ? 'opacity-0' : 'opacity-100'}
        `}
      />

      {/* Hidden Model Viewer for AR capabilities */}
      {/* We apply style to hide it but keep it in DOM. 
          ar-modes="webxr scene-viewer quick-look" prefers WebXR > Android Scene Viewer > iOS Quick Look */}
      <model-viewer
        ref={modelViewerRef}
        src={arModelUrl || undefined}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        style={{ display: 'block', width: '0px', height: '0px', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', visibility: 'hidden' }}
      ></model-viewer>

    </main>
  );
}

export default App;