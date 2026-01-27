'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Dictionary } from '@/i18n/get-dictionary'
import QRScanner from '@/components/qr-scanner'

interface VerifyResultProps {
  token?: string
  dict: Dictionary
  locale: string
}

interface VerifyResponse {
  success: boolean
  result?: string
  message?: string
  error?: string
  data?: {
    serialNumber: string
    productName: string
    sku: string
    modelSize?: string
    category: string
    expiryDate?: string
    status: string
    clinic?: {
      name: string
      province: string
      branch?: string
    }
    activatedAt?: string
    activatedBy?: string
  }
}

export default function VerifyResult({ token, dict, locale }: VerifyResultProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [response, setResponse] = useState<VerifyResponse | null>(null)

  const handleScan = (scannedToken: string) => {
    // Navigate to verify page with scanned token
    router.push(`/${locale}/verify?token=${encodeURIComponent(scannedToken)}`)
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/public/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        setResponse(data)
      } catch {
        setResponse({ success: false, error: 'Network error' })
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token])

  // No token provided - show QR scanner
  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 animate-scaleIn">
        <QRScanner onScan={handleScan} locale={locale} />
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
        <p className="text-[var(--color-foreground-muted)]">{dict.verify.scanning}</p>
      </div>
    )
  }

  // Error
  if (!response || response.error) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-8 text-center animate-scaleIn">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-display text-xl font-semibold text-[var(--color-charcoal)] mb-2">
          {dict.common.error}
        </h2>
        <p className="text-[var(--color-foreground-muted)]">{response?.error || 'Unknown error'}</p>
      </div>
    )
  }

  // Determine display based on result
  const result = response.result || ''
  const isGenuine = result.startsWith('GENUINE')
  const isActivated = result === 'ACTIVATED' || response.data?.status === 'ACTIVATED'
  const isReturned = result === 'RETURNED' || response.data?.status === 'RETURNED'
  const isReprinted = result === 'REPRINTED'
  const isInvalid = ['INVALID_TOKEN', 'NOT_FOUND', 'REVOKED'].includes(result)

  // Get status title and subtitle based on result
  const getStatusText = () => {
    if (isGenuine && !isActivated) {
      return {
        title: locale === 'th' ? 'ของแท้' : 'Genuine Product',
        subtitle: locale === 'th' ? 'สินค้านี้เป็นของแท้จากบริษัท' : 'This product is authentic',
      }
    }
    if (isActivated) {
      return {
        title: locale === 'th' ? 'สินค้าถูกลงทะเบียนแล้ว' : 'Already Registered',
        subtitle: locale === 'th' ? 'สินค้านี้ถูกลงทะเบียนใช้งานแล้ว' : 'This product has been registered by someone',
      }
    }
    if (isReturned) {
      return {
        title: locale === 'th' ? 'สินค้าถูกคืนแล้ว' : 'Product Returned',
        subtitle: locale === 'th' ? 'สินค้านี้ถูกส่งคืนกลับบริษัท' : 'This product has been returned',
      }
    }
    if (isReprinted) {
      return {
        title: locale === 'th' ? 'QR ถูกเปลี่ยนใหม่แล้ว' : 'QR Code Replaced',
        subtitle: locale === 'th' ? 'QR นี้ถูกยกเลิกและออกใหม่แล้ว กรุณาใช้ QR ใหม่' : 'This QR code has been replaced. Please use the new one',
      }
    }
    if (isInvalid) {
      return {
        title: locale === 'th' ? 'ของปลอม / QR ไม่ถูกต้อง' : 'Fake / Invalid QR',
        subtitle: locale === 'th' ? 'ไม่พบข้อมูลสินค้านี้ในระบบ อาจเป็นของปลอม' : 'Product not found in our system. May be counterfeit',
      }
    }
    return {
      title: locale === 'th' ? 'ไม่ทราบสถานะ' : 'Unknown Status',
      subtitle: response.message || '',
    }
  }

  const statusText = getStatusText()

  // Status config based on result type
  const getStatusConfig = () => {
    // Genuine (green)
    if (isGenuine && !isActivated && !isReturned) {
      return {
        bgColor: 'bg-[var(--color-mint)]/10',
        borderColor: 'border-[var(--color-mint)]',
        iconBg: 'bg-[var(--color-mint)]',
        textColor: 'text-[var(--color-mint-dark)]',
        icon: (
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ),
      }
    }
    // Invalid/Fake (red)
    if (isInvalid) {
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        iconBg: 'bg-red-500',
        textColor: 'text-red-700',
        icon: (
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      }
    }
    // Warning states: Activated, Returned, Reprinted (amber)
    return {
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-300',
      iconBg: 'bg-amber-500',
      textColor: 'text-amber-700',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className="space-y-4 animate-slideUp">
      {/* Status Card */}
      <div className={`rounded-2xl border-2 p-6 text-center ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
        {/* Icon */}
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${statusConfig.iconBg} flex items-center justify-center shadow-lg`}>
          {statusConfig.icon}
        </div>

        {/* Status Text */}
        <h2 className={`text-display text-2xl font-bold mb-2 ${statusConfig.textColor}`}>
          {statusText.title}
        </h2>
        <p className="text-[var(--color-foreground-muted)]">{statusText.subtitle}</p>

        {/* Activated Badge */}
        {isActivated && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[var(--color-beige)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
            <span className="text-sm font-medium text-[var(--color-charcoal)]">
              {locale === 'th' ? 'ลงทะเบียนแล้ว' : 'Already Registered'}
            </span>
          </div>
        )}
      </div>

      {/* Product Info Card */}
      {response.data && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
          <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
            <h3 className="text-display font-semibold text-[var(--color-charcoal)]">
              {dict.verify.productInfo}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <InfoRow
              label={dict.verify.serialNumber}
              value={response.data.serialNumber}
              highlight
            />
            <InfoRow
              label={dict.verify.productName}
              value={response.data.productName}
            />
            {response.data.modelSize && (
              <InfoRow
                label={locale === 'th' ? 'รุ่น/ขนาด' : 'Model/Size'}
                value={response.data.modelSize}
              />
            )}
            <InfoRow
              label={locale === 'th' ? 'หมวดหมู่' : 'Category'}
              value={response.data.category}
            />
            {response.data.expiryDate && (
              <InfoRow
                label={dict.verify.expiryDate}
                value={response.data.expiryDate}
              />
            )}

            {/* Clinic Info */}
            {response.data.clinic && (
              <div className="pt-4 mt-4 border-t border-[var(--color-beige)]">
                <InfoRow
                  label={dict.verify.clinic}
                  value={`${response.data.clinic.name}${
                    response.data.clinic.branch ? ` - ${response.data.clinic.branch}` : ''
                  }`}
                />
                <div className="mt-2">
                  <InfoRow
                    label={locale === 'th' ? 'จังหวัด' : 'Province'}
                    value={response.data.clinic.province}
                  />
                </div>
              </div>
            )}

            {/* Activation Info */}
            {isActivated && response.data.activatedAt && (
              <div className="pt-4 mt-4 border-t border-[var(--color-beige)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
                  <span className="text-sm font-medium text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ข้อมูลการลงทะเบียน' : 'Registration Info'}
                  </span>
                </div>
                {response.data.activatedBy && (
                  <InfoRow
                    label={locale === 'th' ? 'ลงทะเบียนโดย' : 'Registered by'}
                    value={response.data.activatedBy}
                  />
                )}
                <div className="mt-2">
                  <InfoRow
                    label={locale === 'th' ? 'วันที่ลงทะเบียน' : 'Registration date'}
                    value={new Date(response.data.activatedAt).toLocaleDateString(
                      locale === 'th' ? 'th-TH' : 'en-US',
                      { year: 'numeric', month: 'long', day: 'numeric' }
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Activate Button */}
          {isGenuine && !isActivated && (
            <div className="p-6 bg-[var(--color-off-white)] border-t border-[var(--color-beige)]">
              <Link
                href={`/${locale}/activate?token=${encodeURIComponent(token || '')}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 px-4 text-[0.9375rem] font-medium text-white bg-[var(--color-gold)] rounded-xl transition-all duration-200 hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {dict.activate.activateButton}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--color-foreground-muted)] text-sm">{label}</span>
      <span className={`font-medium ${highlight ? 'font-mono text-[var(--color-gold)]' : 'text-[var(--color-charcoal)]'}`}>
        {value}
      </span>
    </div>
  )
}
