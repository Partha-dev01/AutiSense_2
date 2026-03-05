import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  // Redirects for removed pages
  async redirects() {
    return [
      { source: "/kid-dashboard/doctor-connect", destination: "/kid-dashboard/nearby-help", permanent: true },
      { source: "/kid-dashboard/map", destination: "/kid-dashboard/nearby-help", permanent: true },
      { source: "/kid-dashboard/talking", destination: "/kid-dashboard/chat", permanent: true },
    ];
  },

  // Inline server-side env vars at build time.
  // Amplify SSR (WEB_COMPUTE) injects env vars into the build container
  // but NOT into the Lambda runtime. This ensures they're baked into the
  // server bundle. AWS_* vars are excluded — Lambda provides those via IAM role.
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
    BEDROCK_REGION: process.env.BEDROCK_REGION ?? "",
    POLLY_REGION: process.env.POLLY_REGION ?? "",
    S3_MODELS_BUCKET: process.env.S3_MODELS_BUCKET ?? "",
    DYNAMODB_SESSIONS_TABLE: process.env.DYNAMODB_SESSIONS_TABLE ?? "",
    DYNAMODB_BIOMARKERS_TABLE: process.env.DYNAMODB_BIOMARKERS_TABLE ?? "",
    DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE ?? "",
    DYNAMODB_AUTH_SESSIONS_TABLE: process.env.DYNAMODB_AUTH_SESSIONS_TABLE ?? "",
    DYNAMODB_CHILD_PROFILES_TABLE: process.env.DYNAMODB_CHILD_PROFILES_TABLE ?? "",
    DYNAMODB_SESSION_SUMMARIES_TABLE: process.env.DYNAMODB_SESSION_SUMMARIES_TABLE ?? "",
    DYNAMODB_FEED_POSTS_TABLE: process.env.DYNAMODB_FEED_POSTS_TABLE ?? "",
    // Amplify blocks AWS_* prefix — use custom names for SDK credentials
    APP_ACCESS_KEY_ID: process.env.APP_ACCESS_KEY_ID ?? "",
    APP_SECRET_ACCESS_KEY: process.env.APP_SECRET_ACCESS_KEY ?? "",
    APP_REGION: process.env.APP_REGION ?? "",
  },

  // Required for SharedArrayBuffer (ONNX WASM multi-threading)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
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
