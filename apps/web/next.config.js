/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  // No .eslintrc configured — skip lint step so it doesn't fail the build
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    // pdfjs-dist v6 references 'canvas' and 'encoding' at build time;
    // alias them to false so webpack doesn't try to resolve them.
    if (!isServer) {
      config.resolve.alias.canvas   = false
      config.resolve.alias.encoding = false
    }
    return config
  },
}
