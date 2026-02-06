'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Button } from './button'

// ============ Types ============
interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  icon?: 'delete' | 'warning' | 'question' | 'success'
}

interface AlertOptions {
  title?: string
  message: string
  buttonText?: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  icon?: 'delete' | 'warning' | 'question' | 'success' | 'error' | 'info'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

// ============ Context ============
const ConfirmContext = createContext<ConfirmContextType | null>(null)

// ============ Hooks ============
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

export function useAlert() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useAlert must be used within a ConfirmProvider')
  }
  return context.alert
}

// ============ Icons ============
const Icons = {
  delete: (
    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  warning: (
    <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  question: (
    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

// ============ Modal Component ============
interface ModalProps {
  isOpen: boolean
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}

function Modal({ isOpen, options, onConfirm, onCancel }: ModalProps) {
  if (!isOpen) return null

  const {
    title,
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    variant = 'warning',
    icon = 'question',
  } = options

  const variantStyles = {
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary'

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon Header */}
          <div className={`flex justify-center pt-8 pb-4 ${variantStyles[variant]} border-b`}>
            <div className="rounded-full bg-white p-3 shadow-lg">
              {Icons[icon]}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 text-center">
            {title && (
              <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                {title}
              </h3>
            )}
            <p className="text-[var(--color-charcoal-light)] leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-6">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              variant={confirmButtonVariant}
              className="flex-1"
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Alert Modal Component ============
interface AlertModalProps {
  isOpen: boolean
  options: AlertOptions
  onClose: () => void
}

function AlertModal({ isOpen, options, onClose }: AlertModalProps) {
  if (!isOpen) return null

  const {
    title,
    message,
    buttonText = 'ตกลง',
    variant = 'info',
    icon = 'info',
  } = options

  const variantStyles = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }

  const buttonVariant = variant === 'error' ? 'danger' : variant === 'success' ? 'primary' : 'primary'

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon Header */}
          <div className={`flex justify-center pt-8 pb-4 ${variantStyles[variant]} border-b`}>
            <div className="rounded-full bg-white p-3 shadow-lg">
              {Icons[icon]}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 text-center">
            {title && (
              <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                {title}
              </h3>
            )}
            <p className="text-[var(--color-charcoal-light)] leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Action */}
          <div className="px-6 pb-6">
            <Button
              variant={buttonVariant}
              className="w-full"
              onClick={onClose}
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Provider ============
interface ConfirmProviderProps {
  children: ReactNode
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  // Confirm state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions>({ message: '' })
  const [confirmResolveRef, setConfirmResolveRef] = useState<((value: boolean) => void) | null>(null)

  // Alert state
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({ message: '' })
  const [alertResolveRef, setAlertResolveRef] = useState<(() => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setConfirmOptions(opts)
    setIsConfirmOpen(true)

    return new Promise<boolean>((resolve) => {
      setConfirmResolveRef(() => resolve)
    })
  }, [])

  const alert = useCallback((opts: AlertOptions): Promise<void> => {
    setAlertOptions(opts)
    setIsAlertOpen(true)

    return new Promise<void>((resolve) => {
      setAlertResolveRef(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsConfirmOpen(false)
    confirmResolveRef?.(true)
  }, [confirmResolveRef])

  const handleCancel = useCallback(() => {
    setIsConfirmOpen(false)
    confirmResolveRef?.(false)
  }, [confirmResolveRef])

  const handleAlertClose = useCallback(() => {
    setIsAlertOpen(false)
    alertResolveRef?.()
  }, [alertResolveRef])

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <Modal
        isOpen={isConfirmOpen}
        options={confirmOptions}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <AlertModal
        isOpen={isAlertOpen}
        options={alertOptions}
        onClose={handleAlertClose}
      />
    </ConfirmContext.Provider>
  )
}
