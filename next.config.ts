import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },

  // Redirects for removed pages
  async redirects() {
    return [
      { source: "/kid-dashboard/doctor-connect", destination: "/kid-dashboard/nearby-help", permanent: true },
      { source: "/kid-dashboard/map", destination: "/kid-dashboard/nearby-help", permanent: true },
      { source: "/kid-dashboard/talking", destination: "/kid-dashboard/chat", permanent: true },
      { source: "/games/social-stories", destination: "/kid-dashboard/games/social-stories-v2", permanent: false },
    ];
  },

  // Inline NON-SECRET server-side env vars at build time.
  // Amplify WEB_COMPUTE injects env vars into the build container AND
  // provides them at Lambda runtime. Secrets (OAuth, AWS keys) are read
  // at runtime via process.env — never baked into the bundle.
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
    BEDROCK_REGION: process.env.BEDROCK_REGION ?? "",
    POLLY_REGION: process.env.POLLY_REGION ?? "",
    // S3_MODELS_BUCKET removed — models served from public/ via CDN, not S3 at runtime
    DYNAMODB_SESSIONS_TABLE: process.env.DYNAMODB_SESSIONS_TABLE ?? "",
    DYNAMODB_BIOMARKERS_TABLE: process.env.DYNAMODB_BIOMARKERS_TABLE ?? "",
    DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE ?? "",
    DYNAMODB_AUTH_SESSIONS_TABLE: process.env.DYNAMODB_AUTH_SESSIONS_TABLE ?? "",
    DYNAMODB_CHILD_PROFILES_TABLE: process.env.DYNAMODB_CHILD_PROFILES_TABLE ?? "",
    DYNAMODB_SESSION_SUMMARIES_TABLE: process.env.DYNAMODB_SESSION_SUMMARIES_TABLE ?? "",
    DYNAMODB_FEED_POSTS_TABLE: process.env.DYNAMODB_FEED_POSTS_TABLE ?? "",
    APP_REGION: process.env.APP_REGION ?? "",
    // SECURITY: APP_ACCESS_KEY_ID, APP_SECRET_ACCESS_KEY are NOT baked here —
    // read at runtime via process.env (Lambda IAM role or APP_* env vars).
    // GOOGLE_CLIENT_SECRET is baked because Amplify WEB_COMPUTE does not
    // reliably inject branch-level env vars into the Lambda runtime.
  },

  // Security + COOP/COEP headers (SharedArrayBuffer for ONNX WASM)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.tile.openstreetmap.org https://unpkg.com https://img.youtube.com; connect-src 'self' https://overpass-api.de https://accounts.google.com https://oauth2.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; media-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'" },
        ],
      },
    ];
  },

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle .wasm files — prevent Next.js from breaking ONNX Runtime's
      // internal WASM file loading by treating them as static assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
        generator: {
          filename: "static/wasm/[name][ext]",
        },
      });
    }
    return config;
  },
};

export default nextConfig;
