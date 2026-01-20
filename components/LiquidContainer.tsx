
import React from 'react';

interface LiquidContainerProps {
  children: React.ReactNode;
  className?: string;
}

// This component uses backdrop filters and high transparency to create the "Liquid Glass" look.
// It relies on the tailwind config and custom CSS in index.html.
export const LiquidContainer: React.FC<LiquidContainerProps> = ({ children, className = '' }) => {
  return (
    <div 
      className={`
        backdrop-blur-2xl 
        bg-white/5 
        border border-white/10 
        shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
        rounded-2xl
        overflow-hidden
        transition-all duration-300
        hover:bg-white/[0.07] hover:border-white/15 hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.02)]
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
  // We cast Component to 'any' to avoid TypeScript errors where it infers that
  // React.ElementType might be a void element (like 'input') which doesn't accept children.
  const Tag = Component as any;

  return (
    <Tag
      className={`
        px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
        flex items-center justify-center gap-2
        ${active 
          ? 'bg-white text-black shadow-lg shadow-white/20' 
          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'}
        ${className}
      `}
      {...props}
    >
      {children}
    </Tag>
  );
};
