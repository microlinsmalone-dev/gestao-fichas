import type { NextConfig } from 'next';

// Detecta automaticamente o nome do repositório no GitHub Actions para o GitHub Pages
const isGithubActions = Boolean(process.env.GITHUB_ACTIONS);
const rawRepo = process.env.GITHUB_REPOSITORY;
const repoName = rawRepo ? (rawRepo.includes('/') ? rawRepo.split('/')[1] : rawRepo) : '';
const repo = isGithubActions && repoName ? `/${repoName}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: repo || undefined,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
