/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Pages that were removed. Old links and bookmarks land somewhere useful
  // instead of on a 404.
  async redirects() {
    return [
      { source: '/status',              destination: '/',          permanent: false },
      { source: '/ai-governance',       destination: '/dashboard', permanent: false },
      { source: '/admin/ai-governance', destination: '/dashboard', permanent: false },
    ]
  },

  // HTTP security headers applied to every response. The Content-Security-Policy
  // is NOT set here: src/middleware.ts owns it (it knows about Plaid and about
  // development), and a second policy here would be enforced alongside it.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key:   'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()',
          },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas   = false
      config.resolve.alias.encoding = false
    }
    return config
  },
}
