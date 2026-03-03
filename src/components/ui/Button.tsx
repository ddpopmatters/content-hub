import { cx } from '../../lib/utils';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'destructive'
  | 'success';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Additional CSS classes */
  className?: string;
  /** Button content */
  children?: ReactNode;
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-ocean-600 text-white hover:bg-ocean-700 shadow-sm',
  secondary: 'bg-graystone-100 text-graystone-900 hover:bg-graystone-200',
  ghost: 'text-graystone-700 hover:bg-graystone-100',
  outline: 'border border-graystone-300 text-graystone-700 hover:bg-graystone-100',
  destructive: 'bg-rose-500 text-white hover:bg-rose-600',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600',
};

const sizes: Record<ButtonSize, string> = {
  default: 'px-5 py-2.5 text-sm',
  sm: 'px-3 py-1.5 text-xs',
  lg: 'px-6 py-3 text-base',
  icon: 'h-9 w-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'default', size = 'default', className = '', type = 'button', children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
