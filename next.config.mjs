/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/cron/welcome-trials": ["./emails/**/*"],
      "/api/debug/preview-template": ["./emails/**/*"],
      "/api/lifecycle/installed": ["./emails/**/*"],
    },
  },
};

export default nextConfig;
