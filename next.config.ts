import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
				pathname: '/**',
			},
		],
	},
	experimental: {
		serverActions: {
			bodySizeLimit: '2mb',
		},
		optimizePackageImports: ['react-icons', 'framer-motion', 'luxon', '@mui/material', '@mui/icons-material'],
	},
	// Enable SWC minification for faster builds
	swcMinify: true,
	// Enable React strict mode for better performance warnings
	reactStrictMode: true,
	// Optimize production builds
	compress: true,
};

export default nextConfig;
