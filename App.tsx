
import React, { useRef, useState, useEffect } from 'react';
import { ViewerScene } from './components/ViewerScene';
import { Overlay } from './components/ControlPanel';
import { AuraEffect } from './components/AuraEffect';
import { CalibrationModal } from './components/CalibrationModal';
import { CameraControls } from '@react-three/drei';

function App() {
  const controlsRef = useRef<CameraControls>(null);
  const [isMounted, setIsMounted] = useState(false);

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

    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      clearTimeout(t);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <div className="w-screen h-screen relative bg-neutral-900 selection:bg-blue-500/30 font-sans overflow-hidden">
      
      {/* Background Gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] to-[#000000] pointer-events-none" />
      
      {/* 3D Scene */}
      <ViewerScene controlsRef={controlsRef} />

      {/* UI Overlay */}
      <Overlay controlsRef={controlsRef} />
      
      {/* Full Screen Calibration Modal */}
      <CalibrationModal />

      {/* 1:1 Scale Aura Effect */}
      <AuraEffect />
      
      {/* Aesthetic Noise Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

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
    </div>
  );
}

export default App;
