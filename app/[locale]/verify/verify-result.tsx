'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Dictionary } from '@/i18n/get-dictionary'
import QRScanner from '@/components/qr-scanner'

interface VerifyResultProps {
  token?: string
  serial?: string
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
    imageUrl?: string
    expiryDate?: string
    status: string
    activationType?: 'SINGLE' | 'PACK'
    maxActivations?: number
    activationCount?: number
    canActivate?: boolean
    clinic?: {
      name: string
      province: string
      branch?: string
    }
    activatedAt?: string
    activatedBy?: string
  }
}

interface ActivationResponse {
  success: boolean
  message?: string
  error?: string
  data?: {
    serialNumber: string
    productName: string
    category: string
    activatedAt: string
    activationNumber: number
    maxActivations: number
    remainingActivations: number
  }
}

export default function VerifyResult({ token, serial, dict, locale }: VerifyResultProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [response, setResponse] = useState<VerifyResponse | null>(null)

  // Determine which identifier to use (prefer serial for new short URLs)
  const identifier = serial || token

  // Activation states
  const [consent, setConsent] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activationResult, setActivationResult] = useState<ActivationResponse | null>(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // Optional customer info
  const [customerName, setCustomerName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')

  const handleScan = (scannedToken: string) => {
    // Navigate to verify page with scanned token
    router.push(`/${locale}/verify?token=${encodeURIComponent(scannedToken)}`)
  }

  const handleActivate = async () => {
    if (!consent || !identifier) return

    setActivating(true)
    try {
      const res = await fetch('/api/public/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Support both token and serial
          ...(serial ? { serial } : { token }),
          consent: true,
          // Include customer info only if provided
          ...(customerName && { customerName }),
          ...(age && { age: parseInt(age) }),
          ...(gender && { gender }),
        }),
      })

      const data = await res.json()
      setActivationResult(data)

      if (data.success) {
        // Show optional form to add more customer info
        setShowCustomerForm(true)
        // Update the response to reflect activation
        if (response?.data) {
          setResponse({
            ...response,
            data: {
              ...response.data,
              status: 'ACTIVATED',
              activationCount: data.data?.activationNumber,
              canActivate: data.data?.remainingActivations > 0,
              activatedAt: data.data?.activatedAt,
            },
          })
        }
      }
    } catch {
      setActivationResult({ success: false, error: 'Network error' })
    } finally {
      setActivating(false)
    }
  }

  useEffect(() => {
    if (!identifier) {
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        // Support both token-based and serial-based verification
        const queryParam = serial
          ? `serial=${encodeURIComponent(serial)}`
          : `token=${encodeURIComponent(token!)}`
        const res = await fetch(`/api/public/verify?${queryParam}`)
        const data = await res.json()
        setResponse(data)
      } catch {
        setResponse({ success: false, error: 'Network error' })
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token, serial, identifier])

  // No identifier provided - show QR scanner
  if (!identifier) {
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
  const isPack = response.data?.activationType === 'PACK'
  const canActivate = response.data?.canActivate ?? false
  const isFullyActivated = result === 'ACTIVATED' || (response.data?.status === 'ACTIVATED' && !canActivate)
  const isActivated = response.data?.status === 'ACTIVATED'
  const isReturned = result === 'RETURNED' || response.data?.status === 'RETURNED'
  const isReprinted = result === 'REPRINTED'
  const isInvalid = ['INVALID_TOKEN', 'NOT_FOUND', 'REVOKED'].includes(result)

  // Get status title and subtitle based on result
  const getStatusText = () => {
    if (isGenuine && !isActivated) {
      return {
        title: locale === 'th' ? 'ของแท้' : 'Genuine Product',
        subtitle: locale === 'th' ? 'สินค้านี้เป็นของแท้จากบริษัทบริษัทอีเด็นคัลเลอร์(ประเทศไทย)' : 'This product is authentic from Eden Colors (Thailand)',
      }
    }
    // PACK product with activations remaining
    if (isPack && isActivated && canActivate) {
      const count = response.data?.activationCount || 0
      const max = response.data?.maxActivations || 1
      return {
        title: locale === 'th' ? 'ของแท้' : 'Genuine Product',
        subtitle: locale === 'th'
          ? `ถูกลงทะเบียนแล้ว ${count}/${max} ครั้ง - ยังสามารถลงทะเบียนได้อีก`
          : `Registered ${count}/${max} times - Can still be activated`,
      }
    }
    // Fully activated
    if (isFullyActivated) {
      const count = response.data?.activationCount || 0
      const max = response.data?.maxActivations || 1
      return {
        title: locale === 'th' ? 'สินค้าถูกลงทะเบียนแล้ว' : 'Already Registered',
        subtitle: isPack
          ? (locale === 'th'
              ? `สินค้านี้ถูกลงทะเบียนครบ ${max} ครั้งแล้ว`
              : `This product has been registered ${count}/${max} times`)
          : (locale === 'th'
              ? 'สินค้านี้ถูกลงทะเบียนใช้งานแล้ว'
              : 'This product has been registered'),
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
    // Genuine (green) - including PACK products with remaining activations
    if ((isGenuine && !isActivated && !isReturned) || (isPack && canActivate)) {
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
        {/* Product Image - Show for genuine products */}
        {(isGenuine || isFullyActivated || (isPack && canActivate)) && response.data?.imageUrl && (
          <div className="mb-4">
            <div className="relative w-fit mx-auto">
              <Image
                src={response.data.imageUrl}
                alt={response.data.productName}
                width={150}
                height={150}
                className="object-contain"
              />
              {/* Icon */}
              <div className={`w-10 h-10 rounded-full absolute -bottom-2 -right-2 ${statusConfig.iconBg} flex items-center justify-center shadow-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            {/* Product Name under image */}
            {/*<p className="mt-3 text-lg font-semibold text-[var(--color-charcoal)]">
              {response.data.productName}
            </p>*/}
          </div>
        )}

       

        {/* Status Text */}
        <h2 className={`text-display text-2xl font-bold mb-2 ${statusConfig.textColor}`}>
          {response.data.productName}
        </h2>
        <p className="text-[var(--color-foreground-muted)]">{statusText.subtitle}</p>

        {/* PACK Product - Activation Progress Visual */}
        {isPack && response.data?.maxActivations && response.data.maxActivations > 1 && (
          <div className="mt-5">
            {/* Activation Dots */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {Array.from({ length: response.data.maxActivations }).map((_, i) => {
                const isUsed = i < (response.data?.activationCount || 0)
                const isNext = i === (response.data?.activationCount || 0) && canActivate
                return (
                  <div
                    key={i}
                    className={`relative transition-all duration-300 ${
                      isUsed
                        ? 'w-8 h-8'
                        : isNext
                        ? 'w-8 h-8 animate-pulse'
                        : 'w-6 h-6'
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        isUsed
                          ? 'bg-[var(--color-gold)] border-[var(--color-gold)] shadow-[0_0_10px_rgba(201,163,90,0.4)]'
                          : isNext
                          ? 'border-[var(--color-gold)] border-dashed bg-[var(--color-gold)]/10'
                          : 'border-[var(--color-beige)] bg-white'
                      }`}
                    >
                      {isUsed && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isNext && (
                        <span className="text-[var(--color-gold)] text-xs font-bold">+</span>
                      )}
                    </div>
                    {/* Slot number */}
                    <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] ${
                      isUsed ? 'text-[var(--color-gold)] font-medium' : 'text-[var(--color-foreground-muted)]'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Progress Text */}
            <div className="mt-6 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-[var(--color-beige)] text-sm">
                <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="font-medium text-[var(--color-charcoal)]">
                  {response.data.activationCount || 0}
                </span>
                <span className="text-[var(--color-foreground-muted)]">/</span>
                <span className="text-[var(--color-foreground-muted)]">
                  {response.data.maxActivations}
                </span>
                <span className="text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? 'ครั้ง' : 'uses'}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Single Product - Activated Badge */}
        {!isPack && isActivated && (
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

          {/* Activate Section - Show for genuine not activated OR PACK products with remaining activations */}
          {((isGenuine && !isActivated) || (isPack && canActivate)) && !activationResult?.success && (
            <div className="p-6 bg-[var(--color-off-white)] border-t border-[var(--color-beige)]">
              {/* PACK Product - Highlight next activation */}
              {isPack && response.data?.maxActivations && response.data.maxActivations > 1 && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-[var(--color-gold)]/5 to-[var(--color-gold)]/10 border border-[var(--color-gold)]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                      <span className="text-[var(--color-gold)] font-bold text-lg">
                        {(response.data.activationCount || 0) + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-charcoal)]">
                        {locale === 'th'
                          ? `ลงทะเบียนครั้งที่ ${(response.data.activationCount || 0) + 1}`
                          : `Activation #${(response.data.activationCount || 0) + 1}`
                        }
                      </p>
                      <p className="text-xs text-[var(--color-foreground-muted)]">
                        {locale === 'th'
                          ? `เหลืออีก ${(response.data.maxActivations || 1) - (response.data.activationCount || 0)} ครั้ง`
                          : `${(response.data.maxActivations || 1) - (response.data.activationCount || 0)} activations remaining`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Consent Checkbox */}
              <label className="flex items-start gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[var(--color-gold)] focus:ring-[var(--color-gold)] focus:ring-offset-0"
                />
                <span className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th'
                    ? 'ข้าพเจ้ายินยอมให้บริษัทเก็บข้อมูลการลงทะเบียนตามนโยบายความเป็นส่วนตัว'
                    : 'I consent to the company collecting registration data according to the privacy policy'
                  }
                </span>
              </label>

              {/* Activation Error */}
              {activationResult?.error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {activationResult.error}
                </div>
              )}

              {/* Activate Button */}
              <button
                onClick={handleActivate}
                disabled={!consent || activating}
                className={`relative flex items-center justify-center gap-2 w-full py-3.5 px-4 text-[0.9375rem] font-medium text-white rounded-xl transition-all duration-200 shadow-[0_4px_14px_rgba(201,163,90,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden ${
                  consent && !activating
                    ? 'bg-[var(--color-gold)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)]'
                    : 'bg-[var(--color-gold)]/70'
                }`}
              >
                {activating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังลงทะเบียน...' : 'Registering...'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isPack
                      ? (locale === 'th' ? `ลงทะเบียนครั้งที่ ${(response.data?.activationCount || 0) + 1}` : `Register Use #${(response.data?.activationCount || 0) + 1}`)
                      : dict.activate.activateButton
                    }
                  </>
                )}
                {/* Shimmer effect when enabled */}
                {consent && !activating && (
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
              </button>
            </div>
          )}

          {/* Activation Success + Optional Customer Form */}
          {activationResult?.success && (
            <div className="p-6 bg-[var(--color-off-white)] border-t border-[var(--color-beige)]">
              {/* Success Message */}
              <div className="mb-4 p-4 rounded-xl bg-[var(--color-mint)]/10 border border-[var(--color-mint)] animate-scaleIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-mint)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-mint-dark)]">
                      {activationResult.message || (locale === 'th' ? 'ลงทะเบียนสำเร็จ!' : 'Registration successful!')}
                    </p>
                    {activationResult.data?.remainingActivations !== undefined && activationResult.data.remainingActivations > 0 && (
                      <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">
                        {locale === 'th'
                          ? `ยังใช้ได้อีก ${activationResult.data.remainingActivations} ครั้ง`
                          : `${activationResult.data.remainingActivations} uses remaining`
                        }
                      </p>
                    )}
                  </div>
                </div>

                {/* PACK - Show updated progress after activation */}
                {isPack && activationResult.data?.maxActivations && activationResult.data.maxActivations > 1 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-mint)]/20">
                    <div className="flex items-center justify-center gap-2">
                      {Array.from({ length: activationResult.data.maxActivations }).map((_, i) => {
                        const isUsed = i < (activationResult.data?.activationNumber || 0)
                        return (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                              isUsed
                                ? 'bg-[var(--color-mint)] border-[var(--color-mint)]'
                                : 'border-[var(--color-mint)]/30 bg-white'
                            } ${i === (activationResult.data?.activationNumber || 1) - 1 ? 'animate-bounce' : ''}`}
                          >
                            {isUsed && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Customer Info Form */}
              {showCustomerForm && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ข้อมูลเพิ่มเติม (ไม่บังคับ)' : 'Additional Info (Optional)'}
                    </h4>
                    <button
                      onClick={() => setShowCustomerForm(false)}
                      className="text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)]"
                    >
                      {locale === 'th' ? 'ข้าม' : 'Skip'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder={locale === 'th' ? 'ชื่อ-นามสกุล' : 'Full Name'}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-beige)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] outline-none text-sm"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder={locale === 'th' ? 'อายุ' : 'Age'}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-beige)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] outline-none text-sm"
                      />
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-beige)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] outline-none text-sm"
                      >
                        <option value="">{locale === 'th' ? 'เพศ' : 'Gender'}</option>
                        <option value="M">{locale === 'th' ? 'ชาย' : 'Male'}</option>
                        <option value="F">{locale === 'th' ? 'หญิง' : 'Female'}</option>
                        <option value="Other">{locale === 'th' ? 'อื่นๆ' : 'Other'}</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--color-foreground-muted)] text-center">
                    {locale === 'th'
                      ? 'ข้อมูลนี้จะถูกบันทึกเพื่อการรับประกันเท่านั้น'
                      : 'This information will only be used for warranty purposes'
                    }
                  </p>
                </div>
              )}
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
