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
  // Next.js emite una versión "standalone" que sólo incluye lo necesario
  // para correr `node server.js`. Coolify/Nixpacks lo aprovechan para
  // generar imágenes mucho más chicas.
  output: 'standalone',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
