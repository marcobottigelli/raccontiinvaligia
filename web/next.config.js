/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'books.google.com',
      'covers.openlibrary.org',
      'placehold.co',
    ],
  },
}

module.exports = nextConfig
