import type { NextConfig } from 'next';
// Export tĩnh dùng Firebase Hosting/Vercel; root cố định tránh lấy lockfile ngoài workspace.
const config: NextConfig = {
  output: 'export', images: { unoptimized: true }, trailingSlash: true,
  turbopack: { root: process.cwd() },
};
export default config;