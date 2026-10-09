import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'next-env.d.ts', 'public/sw.js', 'public/pdf.worker-*.min.mjs'] },
];

export default config;
