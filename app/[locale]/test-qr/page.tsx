'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function TestQRPage() {
  const params = useParams()
  const locale = params.locale as string
  const [baseUrl, setBaseUrl] = useState('')
  const [products, setProducts] = useState<Array<{
    id: number
    serial12: string
    name: string
    status: string
    qrTokens?: Array<{ token: string }> | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current host
    setBaseUrl(window.location.origin)

    // Fetch products with QR tokens
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/warehouse/products?limit=20')
      const data = await res.json()
      if (data.success && data.data?.items) {
        setProducts(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateQRUrl = (token: string) => {
    return `${baseUrl}/${locale}/verify?token=${encodeURIComponent(token)}`
  }

  const generateQRImageUrl = (text: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }

  return (
    <div className="min-h-screen bg-[var(--color-off-white)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'ทดสอบ QR Code' : 'Test QR Code'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th'
              ? 'สแกน QR Code ด้วมือถือเพื่อทดสอบระบบตรวจสอบสินค้า'
              : 'Scan QR codes with your phone to test the verification system'}
          </p>
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              <strong>Base URL:</strong> {baseUrl || 'Loading...'}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {locale === 'th'
                ? '* มือถือต้องเชื่อมต่อ WiFi เดียวกันกับคอมพิวเตอร์'
                : '* Mobile must be on the same WiFi network as computer'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 mx-auto mb-3 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">Loading...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-md">
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่พบสินค้าในระบบ กรุณาสร้าง GRN ก่อน' : 'No products found. Please create a GRN first.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.filter(p => p.qrTokens?.[0]?.token).map((product) => {
              const verifyUrl = generateQRUrl(product.qrTokens![0].token)
              return (
                <div key={product.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
                  <div className="p-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <p className="font-mono text-sm text-[var(--color-gold)] font-medium">
                      {product.serial12}
                    </p>
                    <p className="text-[var(--color-charcoal)] font-medium truncate">
                      {product.name}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      product.status === 'IN_STOCK' ? 'bg-green-100 text-green-700' :
                      product.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                      product.status === 'ACTIVATED' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {product.status}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col items-center">
                    <img
                      src={generateQRImageUrl(verifyUrl)}
                      alt={`QR for ${product.serial12}`}
                      className="w-40 h-40 border border-[var(--color-beige)] rounded-lg"
                    />
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 text-xs text-[var(--color-gold)] hover:underline break-all text-center"
                    >
                      {locale === 'th' ? 'เปิดลิงก์' : 'Open link'}
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Manual Test */}
        <div className="mt-8 bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
            {locale === 'th' ? 'ทดสอบ Token แบบกำหนดเอง' : 'Test Custom Token'}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter token..."
              id="customToken"
              className="flex-1 px-4 py-2 border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)]"
            />
            <button
              onClick={() => {
                const token = (document.getElementById('customToken') as HTMLInputElement).value
                if (token) {
                  window.open(`/${locale}/verify?token=${encodeURIComponent(token)}`, '_blank')
                }
              }}
              className="px-4 py-2 bg-[var(--color-gold)] text-white rounded-xl font-medium hover:bg-[var(--color-gold-dark)]"
            >
              {locale === 'th' ? 'ทดสอบ' : 'Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
