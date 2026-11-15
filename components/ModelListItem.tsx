import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { LoadedModel } from '../types';
import { CloseIcon } from './Icons';
import { NumericInput } from './NumericInput';

const ZERO_VEC = { x: 0, y: 0, z: 0 };
const ONE_VEC = { x: 1, y: 1, z: 1 };
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const ModelListItem: React.FC<{ model: LoadedModel }> = ({ model }) => {
  const isSelected = useStore((state) => state.selectedModelId === model.id);
  const pos = useStore((state) => state.modelPositions[model.id] ?? ZERO_VEC);
  const rot = useStore((state) => state.modelRotations[model.id] ?? ZERO_VEC);
  const scale = useStore((state) => state.modelScales[model.id] ?? ONE_VEC);
  const dim = useStore((state) => state.modelDimensions[model.id] ?? ZERO_VEC);
  const selectModel = useStore((state) => state.selectModel);
  const removeModel = useStore((state) => state.removeModel);
  const updateModelTransform = useStore((state) => state.updateModelTransform);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isSelected) {
      const frame = requestAnimationFrame(() => {
        setIsExpanded(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    setIsExpanded(false);
  }, [isSelected]);

  const updateTransform = (
    type: 'position' | 'rotation' | 'scale',
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    const finalValue = type === 'rotation' ? value * DEG2RAD : value;
    const current = type === 'position' ? pos : type === 'rotation' ? rot : scale;
    updateModelTransform(model.id, {
      [type]: { ...current, [axis]: finalValue },
    });
  };

  return (
    <div
      onClick={() => selectModel(model.id)}
      className={`
        flex flex-col rounded-lg border cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden
        ${
          isSelected
            ? 'bg-white/[0.08] border-white/25 shadow-lg'
            : 'bg-white/[0.03] border-white/10 hover:border-white/25'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 shrink-0">
        <div className="hover-pop-btn flex items-center gap-2.5 flex-1 min-w-0">
          <span className="hover-pop-soft-label flex items-center gap-2.5 min-w-0 origin-left">
            <span
              className="w-3 h-3 rounded-full shadow-sm shrink-0"
              style={{ backgroundColor: model.color }}
            />
            <span className={`text-sm truncate leading-none ${isSelected ? 'text-white font-medium' : 'text-white/90'}`}>
              {model.file.name}
            </span>
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeModel(model.id);
          }}
          className="hover-pop-btn w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/65 hover:text-red-400 shrink-0"
          aria-label={`Remove model ${model.file.name}`}
        >
          <span className="hover-pop-icon">
            <CloseIcon />
          </span>
        </button>
      </div>

      <div
        className={`
          grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden">
          <div
            className={`
              px-2 pb-3 pt-0 transition-opacity duration-500 delay-100
              ${isExpanded ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <div className="h-px bg-white/10 w-full mb-3" />
            <div className="space-y-3">
              {/* Position */}
              <div>
                <span className="text-[9px] text-white/65 uppercase mb-1 block">
                  Position (mm)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <NumericInput
                    id={`pos-x-${model.id}`}
                    label="X"
                    value={Math.round(pos.x * 100) / 100}
                    onChange={(v) => updateTransform('position', 'x', v)}
                  />
                  <NumericInput
                    id={`pos-y-${model.id}`}
                    label="Y"
                    value={Math.round(pos.y * 100) / 100}
                    onChange={(v) => updateTransform('position', 'y', v)}
                  />
                  <NumericInput
                    id={`pos-z-${model.id}`}
                    label="Z"
                    value={Math.round(pos.z * 100) / 100}
                    onChange={(v) => updateTransform('position', 'z', v)}
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <span className="text-[9px] text-white/65 uppercase mb-1 block">
                  Rotation (deg)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <NumericInput
                    id={`rot-x-${model.id}`}
                    label="X"
                    value={Math.round(rot.x * RAD2DEG)}
                    onChange={(v) => updateTransform('rotation', 'x', v)}
                  />
                  <NumericInput
                    id={`rot-y-${model.id}`}
                    label="Y"
                    value={Math.round(rot.y * RAD2DEG)}
                    onChange={(v) => updateTransform('rotation', 'y', v)}
                  />
                  <NumericInput
                    id={`rot-z-${model.id}`}
                    label="Z"
                    value={Math.round(rot.z * RAD2DEG)}
                    onChange={(v) => updateTransform('rotation', 'z', v)}
                  />
                </div>
              </div>

              {/* Dimension (mm) */}
              <div>
                <span className="text-[9px] text-white/65 uppercase mb-1 block">
                  Dimension (mm)
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <NumericInput
                    id={`dim-x-${model.id}`}
                    label="X"
                    step={1}
                    min={0.01}
                    value={Math.round(scale.x * dim.x * 100) / 100}
                    onChange={(v) => {
                      if (dim.x > 0) updateTransform('scale', 'x', v / dim.x);
                    }}
                  />
                  <NumericInput
                    id={`dim-y-${model.id}`}
                    label="Y"
                    step={1}
                    min={0.01}
                    value={Math.round(scale.y * dim.y * 100) / 100}
                    onChange={(v) => {
                      if (dim.y > 0) updateTransform('scale', 'y', v / dim.y);
                    }}
                  />
                  <NumericInput
                    id={`dim-z-${model.id}`}
                    label="Z"
                    step={1}
                    min={0.01}
                    value={Math.round(scale.z * dim.z * 100) / 100}
                    onChange={(v) => {
                      if (dim.z > 0) updateTransform('scale', 'z', v / dim.z);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
