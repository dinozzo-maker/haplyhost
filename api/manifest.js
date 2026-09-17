// Manifest PWA costruito per la singola guida: se un ospite installa Villa
// Virginia, l'icona riapre Villa Virginia e non una home generica della piattaforma.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const slug = String(req.query.slug || '').trim().toLowerCase()
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    return res.status(400).json({ error: 'Guida non valida' })
  }

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json({
    name: 'Guida ospiti HaplyHost',
    short_name: 'HaplyHost',
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: 'standalone',
    background_color: '#edf1f5',
    theme_color: '#12a69b',
    icons: [{
      src: '/pwa-icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    }],
  })
}
