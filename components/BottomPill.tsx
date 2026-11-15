import React from 'react';
import type { CameraControls } from '@react-three/drei';
import { useStore } from '../store';
import { LiquidContainer } from './LiquidContainer';
import { MagnetIcon, MoveIcon, RotateIcon, WireframeIcon } from './Icons';

interface BottomPillProps {
  controlsRef: React.MutableRefObject<CameraControls | null>;
}

export const BottomPill: React.FC<BottomPillProps> = ({ controlsRef }) => {
  const selectedModelId = useStore((state) => state.selectedModelId);
  const gizmoMode = useStore((state) => state.gizmoMode);
  const rotationSnap = useStore((state) => state.rotationSnap);
  const isArSupported = useStore((state) => state.isArSupported);
  const is1to1Mode = useStore((state) => state.is1to1Mode);
  const isWireframeVisible = useStore((state) => state.isWireframeVisible);
  const ppi = useStore((state) => state.ppi);

  const setGizmoMode = useStore((state) => state.setGizmoMode);
  const setRotationSnap = useStore((state) => state.setRotationSnap);
  const triggerArGeneration = useStore((state) => state.triggerArGeneration);
  const toggleWireframe = useStore((state) => state.toggleWireframe);

  const showModelTools = !!selectedModelId;
  const showSnap = showModelTools && gizmoMode === 'rotate';
  const showAR = showModelTools && isArSupported;

  const handleAxisClick = (axis: 'X' | 'Y' | 'Z') => {
    void import('../utils/viewUtils').then(({ transitionToAxis }) => {
      transitionToAxis(controlsRef.current, axis);
    });
  };

  const handle1to1Click = () => {
    void import('../utils/viewUtils').then(({ apply1to1Scale }) => {
      apply1to1Scale(controlsRef.current, ppi);
    });
  };

  return (
    <div className="absolute bottom-10 md:bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
      <LiquidContainer className="flex items-center gap-0 p-0 rounded-full overflow-hidden">
        {/* Axis Views Group */}
        {(['X', 'Y', 'Z'] as const).map((axis) => (
          <button
            key={axis}
            onClick={() => handleAxisClick(axis)}
            className="h-10 w-10 flex items-center justify-center text-xs font-mono font-bold text-white/40 hover:text-white hover:bg-white/5 border-r border-white/10 transition-colors"
            aria-label={`View ${axis} axis`}
          >
            {axis}
          </button>
        ))}

        {/* View Mode + Wireframe Overlay Toggle */}
        <button
          onClick={toggleWireframe}
          className={`
            h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
            ${
              isWireframeVisible
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }
          `}
          title={isWireframeVisible ? 'Shaded View' : 'Shaded + Wireframe'}
          aria-label="Toggle Wireframe Overlay"
          aria-pressed={isWireframeVisible}
        >
          <WireframeIcon />
        </button>

        {/* Model Tools - Animated Wrapper */}
        <div
          className={`
            flex overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${showModelTools ? 'max-w-[12rem] opacity-100' : 'max-w-0 opacity-0'}
          `}
        >
          <button
            onClick={() => setGizmoMode('translate')}
            className={`
              h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
              ${
                gizmoMode === 'translate'
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }
            `}
            title="Move"
            aria-label="Move Tool"
          >
            <MoveIcon />
          </button>

          <button
            onClick={() => setGizmoMode('rotate')}
            className={`
              h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
              ${
                gizmoMode === 'rotate'
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }
            `}
            title="Rotate"
            aria-label="Rotate Tool"
          >
            <RotateIcon />
          </button>

          {/* Snap Button - Slide Out */}
          <div
            className={`
              overflow-hidden transition-all duration-300 ease-out
              ${showSnap ? 'w-10 opacity-100' : 'w-0 opacity-0'}
            `}
          >
            <button
              onClick={() => setRotationSnap(rotationSnap ? null : 45)}
              className={`
                h-10 w-10 flex items-center justify-center border-r border-white/10 transition-colors
                ${
                  rotationSnap !== null
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }
              `}
              title="Snap"
              aria-label="Toggle Rotation Snap"
            >
              <MagnetIcon />
            </button>
          </div>
        </div>

        {/* AR Button */}
        <div
          className={`
            overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${showAR ? 'max-w-[3rem] opacity-100 border-r border-white/10' : 'max-w-0 opacity-0 border-r-0'}
          `}
        >
          <button
            onClick={triggerArGeneration}
            className="h-10 w-12 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title="View in AR"
            aria-label="View Augmented Reality"
          >
            <span className="text-xs font-bold tracking-wider">AR</span>
          </button>
        </div>

        {/* 1:1 Button - End Cap */}
        <button
          onClick={handle1to1Click}
          className={`
            h-10 px-5 flex items-center justify-center
            text-xs font-bold tracking-wider transition-all duration-300
            ${
              is1to1Mode
                ? 'bg-blue-600 text-white shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]'
                : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white'
            }
          `}
          aria-label="1:1 real world scale"
        >
          1:1
        </button>
      </LiquidContainer>
    </div>
  );
};
