/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output folder. Normally ".next". Set NEXT_DIST_DIR to build somewhere else, for example to
  // check a production build without overwriting the files of a `npm run dev` that is already running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The payroll engine is plain TypeScript source inside the workspace.
  transpilePackages: ['@tristan/payroll-engine'],
  // react-pdf runs on the server only and is left out of the bundle.
  serverExternalPackages: ['@react-pdf/renderer'],
};
export default nextConfig;
