import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * COOP/COEP headers required for SharedArrayBuffer support.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
      {
        source: "/sherpa-onnx/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  /**
   * Production Proxy:
   * Redirects /api/ and /audio/ requests to the internal Docker services.
   * Fallback to localhost if running outside Docker.
   */
  async rewrites() {
    return [
      {
        source: '/api/evaluation/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:8000'}/:path*`,
      },
      {
        source: '/api/tts/:path*',
        destination: `${process.env.TTS_API_URL || 'http://tts-api:8001'}/:path*`,
      },
      {
        source: '/audio/:path*',
        destination: `${process.env.TTS_API_URL || 'http://tts-api:8001'}/audio/:path*`,
      },
    ];
  },

  turbopack: {},
};

export default nextConfig;
