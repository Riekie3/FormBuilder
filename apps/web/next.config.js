/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@sfb/shared"],
  reactStrictMode: true,
  output: "standalone",
};

module.exports = nextConfig;
