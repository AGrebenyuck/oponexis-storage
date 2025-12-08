// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		// важно: именно для server / app routes
		serverExternalPackages: ['@napi-rs/canvas'],
	},
}

export default nextConfig
