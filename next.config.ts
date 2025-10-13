import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	experimental: {
		serverActions: {
			bodySizeLimit: '2mb',
		},
		optimizePackageImports: ['react-icons', 'framer-motion', 'luxon'],
	},
	swcMinify: true,
};

export default nextConfig;
