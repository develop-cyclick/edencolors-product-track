'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'

interface QRScannerProps {
  onScan: (result: string) => void
  locale: string
}

export default function QRScanner({ onScan, locale }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startScanner = async () => {
    if (!containerRef.current) return

    setError(null)
    setIsScanning(true)

    try {
      const html5QrCode = new Html5Qrcode('qr-reader')
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Successfully scanned
          stopScanner()

          // Extract token from URL if it's a full URL
          let token = decodedText
          try {
            const url = new URL(decodedText)
            const urlToken = url.searchParams.get('token')
            if (urlToken) {
              token = urlToken
            }
          } catch {
            // Not a URL, use as-is
          }

          onScan(token)
        },
        () => {
          // QR code not found in frame - ignore
        }
      )

      setHasPermission(true)
    } catch (err) {
      console.error('Scanner error:', err)
      setIsScanning(false)
      setHasPermission(false)

      if (err instanceof Error) {
        if (err.message.includes('Permission')) {
          setError(locale === 'th'
            ? 'ไม่ได้รับอนุญาตใช้กล้อง กรุณาอนุญาตการเข้าถึงกล้อง'
            : 'Camera permission denied. Please allow camera access.')
        } else if (err.message.includes('not supported') || err.message.includes('Camera streaming')) {
          // Check if accessing via non-HTTPS
          const isSecure = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
          setError(locale === 'th'
            ? `ไม่สามารถใช้กล้องได้${!isSecure ? ' (ต้องเข้าผ่าน HTTPS)' : ''} กรุณาใช้ปุ่ม "อัปโหลดรูป QR Code" ด้านล่างแทน`
            : `Camera not available${!isSecure ? ' (HTTPS required)' : ''}. Please use "Upload QR Code Image" button below.`)
        } else {
          setError(locale === 'th'
            ? 'ไม่สามารถเปิดกล้องได้ กรุณาใช้ปุ่ม "อัปโหลดรูป QR Code" แทน'
            : 'Cannot open camera. Please use "Upload QR Code Image" instead.')
        }
      }
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setIsProcessingFile(true)

    try {
      let result: string | null = null

      // Method 1: Use jsQR library (most reliable for images)
      try {
        const imageData = await getImageDataFromFile(file)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          result = code.data
        }
      } catch (e) {
        console.log('jsQR failed:', e)
      }

      // Method 2: Try native BarcodeDetector API
      if (!result && 'BarcodeDetector' in window) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const BarcodeDetector = (window as any).BarcodeDetector
          const detector = new BarcodeDetector({ formats: ['qr_code'] })
          const imageBitmap = await createImageBitmap(file)
          const barcodes = await detector.detect(imageBitmap)
          if (barcodes.length > 0) {
            result = barcodes[0].rawValue
          }
        } catch (e) {
          console.log('BarcodeDetector failed:', e)
        }
      }

      if (!result) {
        throw new Error('QR code not found')
      }

      // Extract token from URL if it's a full URL
      let token = result
      try {
        const url = new URL(result)
        const urlToken = url.searchParams.get('token')
        if (urlToken) {
          token = urlToken
        }
      } catch {
        // Not a URL, use as-is
      }

      onScan(token)
    } catch (err) {
      console.error('File scan error:', err)
      setError(locale === 'th'
        ? 'ไม่พบ QR Code ในรูปภาพ กรุณาถ่ายรูปใหม่ให้ชัดขึ้น หรือให้ QR Code อยู่ตรงกลางและใหญ่พอ'
        : 'No QR code found. Please take a clearer photo with the QR code centered and large enough.')
    } finally {
      setIsProcessingFile(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Helper function to get ImageData from file
  const getImageDataFromFile = (file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve(imageData)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Scanner Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-2xl overflow-hidden"
        style={{ minHeight: isScanning ? '300px' : 'auto' }}
      >
        <div id="qr-reader" className="w-full" />

        {!isScanning && (
          <div className="p-8 text-center bg-[var(--color-off-white)]">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h2 className="text-display text-xl font-semibold text-[var(--color-charcoal)] mb-2">
              {locale === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}
            </h2>
            <p className="text-[var(--color-foreground-muted)] mb-2">
              {locale === 'th'
                ? 'สแกน QR Code บนสินค้าเพื่อตรวจสอบความแท้'
                : 'Scan the QR code on the product to verify authenticity'}
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Camera Button */}
      <button
        onClick={isScanning ? stopScanner : startScanner}
        className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 text-[0.9375rem] font-medium rounded-xl transition-all duration-200 ${
          isScanning
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-gold-dark)] shadow-[0_4px_14px_rgba(201,163,90,0.25)]'
        }`}
      >
        {isScanning ? (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {locale === 'th' ? 'หยุดสแกน' : 'Stop Scanning'}
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {locale === 'th' ? 'เปิดกล้องสแกน' : 'Open Camera to Scan'}
          </>
        )}
      </button>

      {/* Instructions for camera */}
      {isScanning && (
        <p className="text-center text-sm text-[var(--color-foreground-muted)]">
          {locale === 'th'
            ? 'วาง QR Code ให้อยู่ในกรอบสี่เหลี่ยม'
            : 'Position the QR code within the frame'}
        </p>
      )}

      {/* Divider */}
      {!isScanning && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-beige)]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'หรือ' : 'or'}
              </span>
            </div>
          </div>

          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="qr-file-input"
          />
          <label
            htmlFor="qr-file-input"
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 text-[0.9375rem] font-medium rounded-xl transition-all duration-200 cursor-pointer border-2 border-[var(--color-beige)] text-[var(--color-charcoal)] hover:border-[var(--color-gold)] hover:bg-[var(--color-off-white)] ${
              isProcessingFile ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {isProcessingFile ? (
              <>
                <div className="w-5 h-5 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังประมวลผล...' : 'Processing...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {locale === 'th' ? 'อัปโหลดรูป QR Code' : 'Upload QR Code Image'}
              </>
            )}
          </label>

          <p className="text-center text-xs text-[var(--color-foreground-muted)]">
            {locale === 'th'
              ? 'ใช้รูปภาพ QR Code หากกล้องไม่สามารถใช้งานได้'
              : 'Use QR code image if camera is not available'}
          </p>
        </>
      )}
    </div>
  )
}
