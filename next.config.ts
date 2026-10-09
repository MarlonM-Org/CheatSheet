import type { NextConfig } from 'next';

// Statische App: kein Server, alles läuft im Browser und bleibt auf dem Gerät.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
