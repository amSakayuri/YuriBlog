import { Slot } from '@radix-ui/react-slot';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';
export function Button({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
}) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component className={twMerge(clsx('button', `button-${variant}`, className))} {...props} />
  );
}
