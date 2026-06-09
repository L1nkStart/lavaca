/** @type {import('next').NextConfig} */
const nextConfig = {
  // Saltarse TS y ESLint en build. La verificación se hace en CI / IDE,
  // pero no queremos que un warning bloquee deploy.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Nota: NO usamos `output: 'standalone'` porque Coolify/Nixpacks invocan
  // `next start` por defecto, que no es compatible con standalone.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
