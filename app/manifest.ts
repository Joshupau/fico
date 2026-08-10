import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fico - Money Management Made Simple',
    short_name: 'Fico',
    description: 'Fico is a comprehensive financial management application that helps you track transactions, manage budgets, and take control of your finances.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F1F5F9',
    theme_color: '#0066CC',
    icons: [
      {
        src: '/FicoLogoTrans1.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
