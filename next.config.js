/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // התעלם משגיאות לינטינג בזמן בנייה
    ignoreDuringBuilds: true,
  },
  typescript: {
    // התעלם משגיאות טיפוסים בזמן בנייה
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;