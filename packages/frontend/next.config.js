/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  swcMinify: false,
  experimental: {
    turbo: {
      resolveAlias: {
        '@/*': './*'
      }
    }
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*'
      }
    ]
  }
}

module.exports = nextConfig
