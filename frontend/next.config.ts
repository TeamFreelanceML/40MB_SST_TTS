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
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
    const TTS_URL = process.env.TTS_API_URL || "http://localhost:8001";

    return [
      {
        source: "/api/tts/:path*",
        destination: `${TTS_URL}/:path*`,
      },
      {
        source: "/audio/:path*",
        destination: `${TTS_URL}/audio/:path*`,
      },
      {
        source: "/api/evaluation/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },

  turbopack: {},
};

export default nextConfig;
