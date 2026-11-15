import React from 'react';

interface LiquidContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const LiquidContainer: React.FC<LiquidContainerProps> = ({
  children,
  className = '',
}) => {
  const radiusClass = /\brounded-/.test(className) ? '' : 'rounded-2xl';
  return (
    <div
      className={`
        liquid-lens
        ${radiusClass}
        overflow-hidden
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  as?: React.ElementType;
}

export const LiquidButton: React.FC<LiquidButtonProps> = ({
  children,
  className = '',
  active = false,
  as: Component = 'button',
  ...props
}) => {
  const Tag = Component as React.ElementType;

  return (
    <Tag
      className={`
        hover-pop-btn
        px-4 py-2 rounded-xl text-sm font-medium
        flex items-center justify-center gap-2
        ${
          active
            ? 'bg-white text-black shadow-lg shadow-white/20'
            : 'bg-white/5 text-white/90 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
        }
        ${className}
      `}
      {...props}
    >
      <span className="hover-pop-label inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </Tag>
  );
};
