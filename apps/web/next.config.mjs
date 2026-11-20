/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output folder. Normally ".next". Set NEXT_DIST_DIR to build somewhere else, for example to
  // check a production build without overwriting the files of a `npm run dev` that is already running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The payroll engine is plain TypeScript source inside the workspace.
  transpilePackages: ['@tristan/payroll-engine'],
  // react-pdf runs on the server only and is left out of the bundle.
  serverExternalPackages: ['@react-pdf/renderer'],
  // pdfkit (inside react-pdf) loads its built-in font files (Helvetica.cjs and friends) with a dynamic require, which
  // Next's file tracing cannot see. Without this, Vercel's PDF route fails with "Cannot find module .../Helvetica.cjs".
  outputFileTracingIncludes: {
    '/api/payslips/[lineId]/pdf': ['../../node_modules/pdfkit/js/**/*'],
  },
};
export default nextConfig;
