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
	// Configure server components external packages
	serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
	// Webpack configuration to exclude problematic files
	webpack: (config, { isServer }) => {
		// Add rule to handle .md files as raw strings instead of trying to parse them
		config.module.rules.push({
			test: /\.md$/,
			type: 'asset/resource',
			generator: {
				emit: false,
			},
		});

		return config;
	},
};

export default withPWA({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
})(nextConfig);
