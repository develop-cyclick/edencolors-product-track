import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, Noto_Sans_Thai } from 'next/font/google'
import './globals.css'
import { ConfirmProvider } from '@/components/ui/confirm-modal'

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const notoSansThai = Noto_Sans_Thai({
  variable: '--font-noto-thai',
  subsets: ['thai'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Edencolors - QR Authenticity System',
  description: 'ระบบตรวจสอบความแท้ของสินค้าด้วย QR Code',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body className={`${playfair.variable} ${dmSans.variable} ${notoSansThai.variable} antialiased`}>
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </body>
    </html>
  )
}
