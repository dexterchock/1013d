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
  const arStatus = useStore((state) => state.arStatus);
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
    <div className="absolute bottom-8 md:bottom-6 left-1/2 -translate-x-1/2 max-w-[calc(100vw-1rem)] pointer-events-auto">
      <LiquidContainer className="flex items-center gap-0 p-1 rounded-full overflow-hidden">
        {/* Axis Views Group */}
        <div className="flex items-center gap-0.5">
          {(['X', 'Y', 'Z'] as const).map((axis) => (
            <button
              key={axis}
              onClick={() => handleAxisClick(axis)}
              className="hover-pop-btn shrink-0 h-8 sm:h-9 w-8 sm:w-9 rounded-full flex items-center justify-center leading-none text-[13px] font-sans font-medium tracking-wide text-white/90 hover:text-white hover:bg-white/10"
              aria-label={`View ${axis} axis`}
            >
              <span className="hover-pop-label leading-none">{axis}</span>
            </button>
          ))}
        </div>

        <span className="h-4 w-px shrink-0 bg-white/15 mx-1.5 sm:mx-2" aria-hidden="true" />

        {/* View Mode + Wireframe Overlay Toggle */}
        <button
          onClick={toggleWireframe}
          className={`
            hover-pop-btn shrink-0 h-8 sm:h-9 w-8 sm:w-9 rounded-full flex items-center justify-center
            ${
              isWireframeVisible
                ? 'liquid-chip-active'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }
          `}
          title={isWireframeVisible ? 'Shaded View' : 'Shaded + Wireframe'}
          aria-label="Toggle Wireframe Overlay"
          aria-pressed={isWireframeVisible}
        >
          <span className="hover-pop-icon">
            <WireframeIcon />
          </span>
        </button>

        {/* Model Tools - Animated Wrapper */}
        <div
          className={`
            flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${showModelTools ? 'max-w-[13rem] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'}
          `}
        >
          <span className="h-4 w-px shrink-0 bg-white/15 mx-1.5 sm:mx-2" aria-hidden="true" />

          <div className="flex items-center">
            <button
              onClick={() => setGizmoMode('translate')}
              className={`
                hover-pop-btn shrink-0 h-8 sm:h-9 w-8 sm:w-9 rounded-full flex items-center justify-center
                ${
                  gizmoMode === 'translate'
                    ? 'liquid-chip-active'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }
              `}
              title="Move"
              aria-label="Move Tool"
            >
              <span className="hover-pop-icon">
                <MoveIcon />
              </span>
            </button>

            <button
              onClick={() => setGizmoMode('rotate')}
              className={`
                hover-pop-btn shrink-0 ml-1 h-8 sm:h-9 w-8 sm:w-9 rounded-full flex items-center justify-center
                ${
                  gizmoMode === 'rotate'
                    ? 'liquid-chip-active'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }
              `}
              title="Rotate"
              aria-label="Rotate Tool"
            >
              <span className="hover-pop-icon">
                <RotateIcon />
              </span>
            </button>

            {/* Snap Button - Slide Out */}
            <div
              className={`
                flex items-center overflow-hidden transition-all duration-300 ease-out
                ${showSnap ? 'w-8 sm:w-9 ml-1 opacity-100' : 'w-0 ml-0 opacity-0 pointer-events-none'}
              `}
            >
              <button
                onClick={() => setRotationSnap(rotationSnap ? null : 45)}
                className={`
                  hover-pop-btn shrink-0 h-8 sm:h-9 w-8 sm:w-9 rounded-full flex items-center justify-center
                  ${
                    rotationSnap !== null
                      ? 'liquid-chip-active'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }
                `}
                title="Snap"
                aria-label="Toggle Rotation Snap"
              >
                <span className="hover-pop-icon">
                  <MagnetIcon />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* AR Button */}
        <div
          className={`
            flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${showAR ? 'max-w-[5.5rem] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'}
          `}
        >
          <span className="h-4 w-px shrink-0 bg-white/15 mx-1.5 sm:mx-2" aria-hidden="true" />
          <button
            type="button"
            onClick={triggerArGeneration}
            disabled={arStatus === 'preparing'}
            className={`hover-pop-btn shrink-0 h-8 sm:h-9 w-9 sm:w-11 rounded-full flex items-center justify-center leading-none text-xs font-sans font-semibold tracking-wider ${
              arStatus !== 'idle'
                ? 'bg-blue-500/20 text-blue-300 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.4)]'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
            title="View in AR"
            aria-label="View Augmented Reality"
          >
            <span className="hover-pop-label leading-none">AR</span>
          </button>
        </div>

        <span className="h-4 w-px shrink-0 bg-white/15 mx-1.5 sm:mx-2" aria-hidden="true" />

        {/* 1:1 Button - End Cap */}
        <button
          onClick={handle1to1Click}
          className={`
            hover-pop-btn shrink-0 h-8 sm:h-9 w-10 sm:w-11 rounded-full flex items-center justify-center leading-none
            text-xs font-sans font-semibold tracking-wider
            ${
              is1to1Mode
                ? 'bg-blue-600 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]'
                : 'bg-transparent text-white/90 hover:bg-white/10 hover:text-white'
            }
          `}
          aria-label="1:1 real world scale"
        >
          <span className="hover-pop-label leading-none">1:1</span>
        </button>
      </LiquidContainer>
    </div>
  );
};
