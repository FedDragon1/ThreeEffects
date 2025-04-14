import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'picsum.photos',
            },
        ],
    },
    webpack: (config, context) => {
        config.module.rules.push({
            test: /\.glsl/,
            use: [
                context.defaultLoaders.babel,
                {
                    loader: "raw-loader"
                }
            ]
        })
        return config;
    },
    turbopack: {
        rules: {
            "*.glsl": {
                loaders: ['raw-loader'],
                as: "*.js"
            }
        }
    }
};

export default nextConfig;
