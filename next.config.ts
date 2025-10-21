import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

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
	// Enable React strict mode for better performance warnings
	reactStrictMode: true,
	// Optimize production builds
	compress: true,
};

export default withPWA({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
})(nextConfig);
