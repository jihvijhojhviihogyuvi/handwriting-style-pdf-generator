/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hides the framework banner from responses (small, free hardening).
  poweredByHeader: false,
  reactStrictMode: true,
  // Allows the sandbox preview proxy (and local tunnelling services) to load dev
  // assets and the HMR socket when running `next dev` behind a different origin.
  allowedDevOrigins: ['*.e2b.app', '*.e2b.dev', '*.ngrok-free.app', '*.serveo.net'],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ]
  },
}

export default nextConfig
