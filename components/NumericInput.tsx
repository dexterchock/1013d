import React, { useEffect, useRef, useState } from 'react';

interface NumericInputProps {
  id: string;
  value: number;
  onChange?: (val: number) => void;
  label?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  readOnly?: boolean;
  variant?: 'compact' | 'field';
}

export const NumericInput: React.FC<NumericInputProps> = ({
  id,
  value,
  onChange,
  label,
  step = 1,
  min,
  max,
  placeholder,
  readOnly = false,
  variant = 'compact',
}) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !onChange) return;
    const raw = e.target.value;
    setLocalValue(raw);

    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      if (min !== undefined && parsed < min) return;
      if (max !== undefined && parsed > max) return;
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (readOnly) return;
    const parsed = parseFloat(localValue);
    const outOfRange =
      Number.isNaN(parsed) ||
      !Number.isFinite(parsed) ||
      (min !== undefined && parsed < min) ||
      (max !== undefined && parsed > max);

    if (outOfRange) {
      setLocalValue(value.toString());
    } else {
      setLocalValue(parsed.toString());
    }
  };

  if (variant === 'field') {
    return (
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`
          w-full border rounded px-2 py-1 text-xs
          ${
            readOnly
              ? 'bg-white/5 border-transparent text-white/75 cursor-not-allowed select-none'
              : 'bg-white/5 border-white/15 text-white placeholder-white/50 focus:border-white/40 outline-none'
          }
        `}
      />
    );
  }

  return (
    <label className="flex items-center gap-2 bg-white/[0.04] rounded px-2 py-1 border border-white/10 focus-within:border-white/30 transition-colors duration-200 cursor-text">
      {label && (
        <span className="text-[10px] font-mono text-white/75 w-2.5 leading-none flex items-center">
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        className="w-full bg-transparent text-xs text-white outline-none text-right font-mono leading-none"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={readOnly}
      />
    </label>
  );
};
