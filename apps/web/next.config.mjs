/** @type {import('next').NextConfig} */
const nextConfig = {
  // The payroll engine is plain TypeScript source inside the workspace.
  transpilePackages: ['@tristan/payroll-engine'],
};
export default nextConfig;
