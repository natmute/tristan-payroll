/** @type {import('next').NextConfig} */
const nextConfig = {
  // The payroll engine is plain TypeScript source inside the workspace.
  transpilePackages: ['@tristan/payroll-engine'],
  // react-pdf runs on the server only and is left out of the bundle.
  serverExternalPackages: ['@react-pdf/renderer'],
};
export default nextConfig;
