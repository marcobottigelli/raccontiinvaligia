/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zxing/browser', '@zxing/library'],
  images: {
    domains: [
      'books.google.com',
      'covers.openlibrary.org',
      'placehold.co',
    ],
  },
}

module.exports = nextConfig
