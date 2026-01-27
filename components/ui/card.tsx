'use client'

import { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
  hover?: boolean
  children: ReactNode
}

function Card({
  variant = 'default',
  hover = false,
  children,
  className = '',
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-white shadow-[var(--shadow-md)]',
    bordered: 'bg-white border border-[var(--color-beige)]',
    elevated: 'bg-white shadow-[var(--shadow-lg)]',
  }

  return (
    <div
      className={`
        rounded-xl overflow-hidden
        ${variants[variant]}
        ${hover ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
  return (
    <div
      className={`px-6 py-4 border-b border-[var(--color-beige)] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

function CardBody({ children, className = '', ...props }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={`px-6 py-4 bg-[var(--color-off-white)] border-t border-[var(--color-beige)] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card, CardHeader, CardBody, CardFooter }
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps }
