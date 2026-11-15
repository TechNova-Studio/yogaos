/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@yogaos/ui', '@yogaos/contracts', '@yogaos/api-client'],
  reactStrictMode: true,
};

export default nextConfig;
