'use client'

import { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'gold' | 'mint' | 'beige' | 'error' | 'warning' | 'success'
  size?: 'sm' | 'md'
  children: ReactNode
}

function Badge({
  variant = 'beige',
  size = 'md',
  children,
  className = '',
  ...props
}: BadgeProps) {
  const variants = {
    gold: 'bg-[rgba(201,163,90,0.15)] text-[var(--color-gold-dark)]',
    mint: 'bg-[rgba(115,207,199,0.2)] text-[var(--color-mint-dark)]',
    beige: 'bg-[var(--color-beige)] text-[var(--color-charcoal)]',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-emerald-100 text-emerald-700',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
  }

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps }
