import { redirect } from 'next/navigation'

interface ShortUrlPageProps {
  params: Promise<{ serial: string }>
}

/**
 * Short URL redirect for QR codes
 * /v/{serial12} -> /th/verify?serial={serial12}
 *
 * This creates much shorter QR codes that are easier to scan
 * Example: https://domain.com/v/123456789012
 */
export default async function ShortUrlPage({ params }: ShortUrlPageProps) {
  const { serial } = await params

  // Validate serial format (12 digits)
  const isValidSerial = /^\d{12}$/.test(serial)

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
