'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/i18n/get-dictionary'

interface ActivateFormProps {
  token?: string
  dict: Dictionary
  locale: string
}

// Thai provinces list
const THAI_PROVINCES = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
  'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
  'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
  'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
  'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
  'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
  'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง',
  'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
  'พะเยา', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
  'ยะลา', 'ยโสธร', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
  'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
  'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
  'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
  'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
  'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์',
  'อุบลราชธานี', 'อำนาจเจริญ'
]

interface ProductData {
  serialNumber: string
  productName: string
  sku: string
  modelSize?: string
  category: string
  expiryDate?: string
  status: string
}

interface ActivationResult {
  success: boolean
  message?: string
  error?: string
  code?: string
  data?: {
    serialNumber: string
    productName: string
    category: string
    activatedAt: string
  }
}

export default function ActivateForm({ token, dict, locale }: ActivateFormProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [canActivate, setCanActivate] = useState(false)
  const [result, setResult] = useState<ActivationResult | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    age: '',
    gender: '' as 'M' | 'F' | 'Other' | '',
    province: '',
    phone: '',
    consent: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/public/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (data.success && data.data) {
          setProductData(data.data)
          // Can activate if SHIPPED (genuine and not yet activated)
          const isShipped = data.result === 'GENUINE_SHIPPED'
          setCanActivate(isShipped)
          if (!isShipped) {
            if (data.result === 'ACTIVATED') {
              setVerifyError(dict.activate.alreadyActivated)
            } else if (data.result === 'GENUINE_IN_STOCK') {
              setVerifyError(locale === 'th'
                ? 'สินค้านี้ยังไม่ได้จัดส่ง ไม่สามารถเปิดใช้งานได้'
                : 'This product has not been shipped yet')
            } else {
              setVerifyError(data.message || 'Cannot activate this product')
            }
          }
        } else {
          setVerifyError(data.error || data.message || 'Invalid QR code')
        }
      } catch {
        setVerifyError(locale === 'th' ? 'เกิดข้อผิดพลาดในการเชื่อมต่อ' : 'Connection error')
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token, dict, locale])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      newErrors.customerName = locale === 'th' ? 'กรุณากรอกชื่อ' : 'Name is required'
    }

    const age = parseInt(formData.age)
    if (!formData.age || isNaN(age) || age < 1 || age > 150) {
      newErrors.age = locale === 'th' ? 'กรุณากรอกอายุที่ถูกต้อง' : 'Valid age is required'
    }

    if (!formData.gender) {
      newErrors.gender = locale === 'th' ? 'กรุณาเลือกเพศ' : 'Gender is required'
    }

    if (!formData.province) {
      newErrors.province = locale === 'th' ? 'กรุณาเลือกจังหวัด' : 'Province is required'
    }

    if (!formData.consent) {
      newErrors.consent = dict.activate.consentRequired
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !token) return

    setSubmitting(true)

    try {
      const res = await fetch('/api/public/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          customerName: formData.customerName.trim(),
          age: parseInt(formData.age),
          gender: formData.gender,
          province: formData.province,
          phone: formData.phone.trim() || undefined,
          consent: formData.consent,
        }),
      })

      const data = await res.json()
      setResult(data)
    } catch {
      setResult({
        success: false,
        error: locale === 'th' ? 'เกิดข้อผิดพลาดในการเชื่อมต่อ' : 'Connection error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // No token
  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-8 text-center animate-scaleIn">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
          <svg className="w-10 h-10 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <h2 className="text-display text-xl font-semibold text-[var(--color-charcoal)] mb-2">
          {locale === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}
        </h2>
        <p className="text-[var(--color-foreground-muted)]">
          {locale === 'th'
            ? 'สแกน QR Code บนสินค้าเพื่อลงทะเบียน'
            : 'Scan the QR code on the product to register'}
        </p>
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
        <p className="text-[var(--color-foreground-muted)]">{dict.common.loading}</p>
      </div>
    )
  }

  // Activation success
  if (result?.success) {
    return (
      <div className="space-y-4 animate-slideUp">
        {/* Success Card */}
        <div className="bg-[var(--color-mint)]/10 border-2 border-[var(--color-mint)] rounded-2xl p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-mint)] flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-display text-2xl font-bold text-[var(--color-mint-dark)] mb-2">
            {dict.activate.activationSuccess}
          </h2>
          <p className="text-[var(--color-foreground-muted)]">{result.message}</p>
        </div>

        {/* Product Info */}
        {result.data && (
          <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
            <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
              <h3 className="text-display font-semibold text-[var(--color-charcoal)]">
                {dict.verify.productInfo}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <InfoRow label={dict.verify.serialNumber} value={result.data.serialNumber} highlight />
              <InfoRow label={dict.verify.productName} value={result.data.productName} />
              <InfoRow label={locale === 'th' ? 'หมวดหมู่' : 'Category'} value={result.data.category} />
              <div className="pt-4 border-t border-[var(--color-beige)]">
                <InfoRow
                  label={locale === 'th' ? 'ลงทะเบียนเมื่อ' : 'Registered at'}
                  value={new Date(result.data.activatedAt).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US')}
                />
              </div>
            </div>
          </div>
        )}

        {/* View Product Link */}
        <div className="text-center">
          <Link
            href={`/${locale}/verify?token=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-2 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {locale === 'th' ? 'ดูข้อมูลสินค้า' : 'View Product Info'}
          </Link>
        </div>
      </div>
    )
  }

  // Activation error from API
  if (result && !result.success) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 text-center animate-scaleIn">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-display text-xl font-semibold text-red-700 mb-2">{dict.common.error}</h2>
        <p className="text-[var(--color-foreground-muted)] mb-6">{result.error}</p>
        <button
          onClick={() => setResult(null)}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-[var(--color-gold)] border border-[var(--color-gold)] rounded-lg hover:bg-[var(--color-gold)] hover:text-white transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {locale === 'th' ? 'ลองใหม่' : 'Try again'}
        </button>
      </div>
    )
  }

  // Cannot activate (already activated or wrong status)
  if (verifyError) {
    return (
      <div className="space-y-4 animate-slideUp">
        {/* Warning Card */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <h2 className="text-display text-xl font-semibold text-amber-700 mb-2">
            {locale === 'th' ? 'ไม่สามารถลงทะเบียนได้' : 'Cannot Register'}
          </h2>
          <p className="text-[var(--color-foreground-muted)]">{verifyError}</p>
        </div>

        {/* Product Info if available */}
        {productData && (
          <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
            <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
              <h3 className="text-display font-semibold text-[var(--color-charcoal)]">
                {dict.verify.productInfo}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <InfoRow label={dict.verify.serialNumber} value={productData.serialNumber} highlight />
              <InfoRow label={dict.verify.productName} value={productData.productName} />
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center">
          <Link
            href={`/${locale}/verify?token=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {dict.common.back}
          </Link>
        </div>
      </div>
    )
  }

  // Activation form
  return (
    <div className="space-y-4 animate-slideUp">
      {/* Product Info Card */}
      {productData && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-beige)]/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-charcoal)]">{productData.productName}</h3>
              <p className="text-sm text-[var(--color-foreground-muted)]">
                <span className="font-mono text-[var(--color-gold)]">{productData.serialNumber}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Activation Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {/* Form Header */}
        <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
          <h3 className="text-display font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'กรอกข้อมูลเพื่อลงทะเบียน' : 'Fill in to register'}
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
              {dict.activate.name} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className={`w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-white border rounded-lg transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] ${
                  errors.customerName ? 'border-red-500 focus:border-red-500' : 'border-[var(--color-beige)] focus:border-[var(--color-gold)]'
                }`}
                placeholder={locale === 'th' ? 'ชื่อ-นามสกุล' : 'Full name'}
              />
            </div>
            {errors.customerName && (
              <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.customerName}
              </p>
            )}
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Age */}
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {dict.activate.age} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="age"
                min="1"
                max="150"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className={`w-full px-4 py-3 text-[0.9375rem] bg-white border rounded-lg transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] ${
                  errors.age ? 'border-red-500 focus:border-red-500' : 'border-[var(--color-beige)] focus:border-[var(--color-gold)]'
                }`}
                placeholder={locale === 'th' ? 'อายุ' : 'Age'}
              />
              {errors.age && (
                <p className="mt-1.5 text-sm text-red-500">{errors.age}</p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {dict.activate.gender} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'M', label: locale === 'th' ? 'ชาย' : 'M' },
                  { value: 'F', label: locale === 'th' ? 'หญิง' : 'F' },
                  { value: 'Other', label: locale === 'th' ? 'อื่นๆ' : 'O' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: option.value as 'M' | 'F' | 'Other' })}
                    className={`flex-1 py-2.5 px-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                      formData.gender === option.value
                        ? 'bg-[var(--color-gold)] text-white border-[var(--color-gold)]'
                        : 'bg-white text-[var(--color-charcoal)] border-[var(--color-beige)] hover:border-[var(--color-gold)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.gender && (
                <p className="mt-1.5 text-sm text-red-500">{errors.gender}</p>
              )}
            </div>
          </div>

          {/* Province */}
          <div>
            <label htmlFor="province" className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
              {dict.activate.province} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="province"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                className={`w-full px-4 py-3 text-[0.9375rem] bg-white border rounded-lg transition-all duration-200 appearance-none focus:outline-none focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] ${
                  errors.province ? 'border-red-500 focus:border-red-500' : 'border-[var(--color-beige)] focus:border-[var(--color-gold)]'
                } ${!formData.province ? 'text-[var(--color-foreground-muted)]' : ''}`}
              >
                <option value="">{locale === 'th' ? '-- เลือกจังหวัด --' : '-- Select Province --'}</option>
                {THAI_PROVINCES.map((province) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {errors.province && (
              <p className="mt-1.5 text-sm text-red-500">{errors.province}</p>
            )}
          </div>

          {/* Phone (Optional) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
              {dict.activate.phone}
              <span className="text-[var(--color-foreground-muted)] text-xs ml-2">
                ({locale === 'th' ? 'ไม่บังคับ' : 'optional'})
              </span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-white border border-[var(--color-beige)] rounded-lg transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                placeholder="08X-XXX-XXXX"
              />
            </div>
          </div>

          {/* PDPA Consent */}
          <div className="pt-5 border-t border-[var(--color-beige)]">
            {/* Privacy Policy Box */}
            <div className="bg-[var(--color-off-white)] rounded-xl p-4 mb-4">
              <h4 className="font-medium text-[var(--color-charcoal)] mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {locale === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
              </h4>
              <div className="text-sm text-[var(--color-foreground-muted)] space-y-2 max-h-24 overflow-y-auto pr-2">
                {locale === 'th' ? (
                  <>
                    <p>ข้าพเจ้ายินยอมให้บริษัทเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า เพื่อวัตถุประสงค์ในการยืนยันความแท้ของสินค้า การรับประกัน และการติดต่อสื่อสาร</p>
                    <p className="text-xs">ข้อมูลที่จัดเก็บ: ชื่อ อายุ เพศ จังหวัด เบอร์โทรศัพท์ (ถ้ามี)</p>
                  </>
                ) : (
                  <>
                    <p>I consent to the company collecting, using, and disclosing my personal data for the purpose of product authentication, warranty, and communication.</p>
                    <p className="text-xs">Data collected: Name, Age, Gender, Province, Phone number (if provided)</p>
                  </>
                )}
              </div>
            </div>

            {/* Consent Checkbox */}
            <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
              formData.consent ? 'bg-[var(--color-mint)]/10 border-2 border-[var(--color-mint)]' : 'border-2 border-[var(--color-beige)] hover:border-[var(--color-gold)]'
            }`}>
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                className="w-5 h-5 mt-0.5 text-[var(--color-gold)] border-[var(--color-beige)] rounded focus:ring-[var(--color-gold)] focus:ring-offset-0"
              />
              <span className={`text-sm ${formData.consent ? 'text-[var(--color-mint-dark)] font-medium' : 'text-[var(--color-charcoal)]'}`}>
                {dict.activate.consent} <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.consent && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.consent}
              </p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-6 bg-[var(--color-off-white)] border-t border-[var(--color-beige)]">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full py-3.5 px-4 text-[0.9375rem] font-medium text-white bg-[var(--color-gold)] rounded-xl transition-all duration-200 hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {dict.common.loading}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {dict.activate.activateButton}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Back link */}
      <div className="text-center">
        <Link
          href={`/${locale}/verify?token=${encodeURIComponent(token)}`}
          className="inline-flex items-center gap-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {dict.common.back}
        </Link>
      </div>
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
