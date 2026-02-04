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
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const isRunningRef = useRef(false)
  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).substr(2, 9)}`)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)

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
      videoTrackRef.current = null
      setHasFlash(false)
      setFlashOn(false)
    }
  }, [])

  // Toggle flash/torch
  const toggleFlash = useCallback(async () => {
    if (!videoTrackRef.current) return

    try {
      const capabilities = videoTrackRef.current.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
      if (capabilities.torch) {
        const newFlashState = !flashOn
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newFlashState } as MediaTrackConstraintSet]
        })
        setFlashOn(newFlashState)
      }
    } catch (err) {
      console.log('Flash toggle error:', err)
    }
  }, [flashOn])

  // Apply autofocus constraints to video track
  const applyFocusConstraints = useCallback(async (track: MediaStreamTrack) => {
    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[]
        torch?: boolean
      }

      console.log('Camera capabilities:', capabilities)

      // Check if camera supports continuous autofocus
      const constraints: MediaTrackConstraintSet & { focusMode?: string } = {}

      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        constraints.focusMode = 'continuous'
        console.log('Applying continuous autofocus')
      } else if (capabilities.focusMode && capabilities.focusMode.includes('auto')) {
        constraints.focusMode = 'auto'
        console.log('Applying auto focus')
      }

      // Check for torch/flash capability
      if (capabilities.torch) {
        setHasFlash(true)
        console.log('Flash/torch available')
      }

      if (Object.keys(constraints).length > 0) {
        await track.applyConstraints({
          advanced: [constraints as MediaTrackConstraintSet]
        })
        console.log('Focus constraints applied successfully')
      }
    } catch (err) {
      console.log('Could not apply focus constraints:', err)
      // Continue anyway - autofocus might still work
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

        // Start with optimized config for easier scanning
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15, // Higher FPS for faster detection
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              // Use 80% of the smaller dimension for larger scan area
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
              const qrboxSize = Math.floor(minEdge * 0.8)
              return { width: qrboxSize, height: qrboxSize }
            },
            aspectRatio: 1,
            disableFlip: false,
          } as any,
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

          // Get the video track and apply focus constraints
          // html5-qrcode exposes the video element, we need to get the stream from it
          const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream
            const videoTrack = stream.getVideoTracks()[0]
            if (videoTrack) {
              videoTrackRef.current = videoTrack
              await applyFocusConstraints(videoTrack)
            }
          }
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
  }, [isActive, stopScanner, applyFocusConstraints])

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

      {/* Flash toggle button */}
      {hasFlash && !isStarting && (
        <button
          type="button"
          onClick={toggleFlash}
          className={`absolute top-3 right-3 z-20 p-2.5 rounded-full transition-all ${
            flashOn
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={flashOn ? 'ปิดแฟลช' : 'เปิดแฟลช'}
        >
          {flashOn ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </button>
      )}

      <div
        id={containerIdRef.current}
        className="qr-scanner-container w-full overflow-hidden rounded-lg bg-black"
      />

      {/* Scan tips - compact on mobile */}
      {!isStarting && (
        <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-[10px] sm:text-xs text-blue-700 font-medium">
            💡 ถือ QR ให้เต็มกรอบ • หลีกเลี่ยงแสงสะท้อน • เลื่อนไกล-ใกล้ถ้าโฟกัสช้า
          </p>
        </div>
      )}
    </div>
  )
}
