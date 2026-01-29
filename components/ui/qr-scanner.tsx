'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  isActive: boolean
}

export function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const isRunningRef = useRef(false)
  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).substr(2, 9)}`)

  // Use refs to store callbacks to avoid stale closures
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onScanRef.current = onScan
    onErrorRef.current = onError
  }, [onScan, onError])

  // Safe stop function
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop()
        }
      } catch (err) {
        console.log('Scanner stop warning:', err)
      }
      try {
        scannerRef.current.clear()
      } catch {
        // Ignore clear errors
      }
      isRunningRef.current = false
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isActive) {
      stopScanner()
      return
    }

    const containerId = containerIdRef.current
    let mounted = true

    const startScanner = async () => {
      // First stop any existing scanner
      await stopScanner()

      if (!mounted) return

      setIsStarting(true)
      setCameraError(null)

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))

      if (!mounted) return

      try {
        const html5QrCode = new Html5Qrcode(containerId)
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            console.log('QR Scanned:', decodedText)
            if (mounted && onScanRef.current) {
              onScanRef.current(decodedText)
            }
          },
          () => {
            // QR not found in frame - ignore
          }
        )

        if (mounted) {
          isRunningRef.current = true
        }
      } catch (err) {
        console.error('Camera error:', err)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Cannot access camera'
          setCameraError(errorMessage)
          onErrorRef.current?.(errorMessage)
          isRunningRef.current = false
        }
      } finally {
        if (mounted) {
          setIsStarting(false)
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      stopScanner()
    }
  }, [isActive, stopScanner])

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-red-500 mb-2">ไม่สามารถเข้าถึงกล้องได้</p>
        <p className="text-xs text-[var(--color-foreground-muted)]">{cameraError}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {isStarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white">กำลังเปิดกล้อง...</span>
          </div>
        </div>
      )}
      <div
        id={containerIdRef.current}
        className="qr-scanner-container w-full overflow-hidden rounded-lg bg-black"
        style={{ minHeight: '280px', maxHeight: '300px' }}
      />
    </div>
  )
}
