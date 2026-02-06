import { redirect } from 'next/navigation'
import { isValidSerialNumber } from '@/lib/serial-generator'

interface ShortUrlPageProps {
  params: Promise<{ serial: string }>
}

/**
 * Short URL redirect for QR codes
 * /v/{serial} -> /th/verify?serial={serial}
 *
 * This creates much shorter QR codes that are easier to scan
 * Example: https://domain.com/v/PCBBN01000000000001
 */
export default async function ShortUrlPage({ params }: ShortUrlPageProps) {
  const { serial } = await params

  // Validate serial format (19-char new format)
  const isValidSerial = isValidSerialNumber(serial)

  if (!isValidSerial) {
    // Redirect to home page if invalid serial
    redirect('/th')
  }

  // Redirect to verify page with serial parameter (default to Thai locale)
  redirect(`/th/verify?serial=${serial}`)
}

// Enable static generation for better performance
export const dynamic = 'force-static'
export const revalidate = false
