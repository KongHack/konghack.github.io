#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(resolve(root, "projects.json"), "utf8"));
const output = resolve(root, process.argv[2] || "data/projects.json");
const apiBase = "https://api.github.com";
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "KongHack-Pages-data-generator",
  "X-GitHub-Api-Version": "2026-03-10"
};

if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function request(path, allowNotFound = false) {
  const response = await fetch(`${apiBase}${path}`, { headers });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await request(`/orgs/${config.organization}/repos?type=public&sort=updated&per_page=100&page=${page}`);
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

function categoryFor(repository, editorial) {
  const topicCategory = config.categories.find((category) => category.topic && repository.topics.includes(category.topic));
  return topicCategory?.id || editorial.category || "other";
}

const repositories = (await fetchRepositories()).filter((repository) =>
  !repository.archived && !config.excludedRepositories.includes(repository.name));

const releases = await Promise.all(repositories.map((repository) =>
  request(`/repos/${config.organization}/${repository.name}/releases/latest`, true)));

const categoryMap = new Map(config.categories.map((category) => [category.id, category]));
const projects = repositories.map((repository, index) => {
  const editorial = config.repositories[repository.name] || {};
  const category = categoryFor(repository, editorial);
  const categoryDefinition = categoryMap.get(category) || categoryMap.get("other");
  const release = releases[index];

  return {
    name: repository.name,
    displayName: editorial.displayName || repository.name,
    description: editorial.description || repository.description,
    category: categoryDefinition.id,
    categoryLabel: categoryDefinition.label,
    featured: Boolean(editorial.featured),
    order: Number.isFinite(editorial.order) ? editorial.order : 1000,
    repositoryUrl: repository.html_url,
    homepage: repository.homepage || null,
    language: repository.language,
    license: repository.license ? {
      name: repository.license.name,
      spdxId: repository.license.spdx_id
    } : null,
    topics: repository.topics,
    fork: repository.fork,
    stars: repository.stargazers_count,
    pushedAt: repository.pushed_at,
    updatedAt: repository.updated_at,
    release: release ? {
      tag: release.tag_name,
      name: release.name,
      url: release.html_url,
      publishedAt: release.published_at
    } : null
  };
}).sort((a, b) =>
  Number(b.featured) - Number(a.featured) ||
  config.categories.findIndex((category) => category.id === a.category) - config.categories.findIndex((category) => category.id === b.category) ||
  a.order - b.order || a.displayName.localeCompare(b.displayName));

const recentReleases = projects.filter((project) => project.release).map((project) => ({
  project: project.displayName,
  repository: project.name,
  ...project.release
})).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const data = {
  generatedAt: new Date().toISOString(),
  organization: {
    name: config.organization,
    url: `https://github.com/${config.organization}`
  },
  categories: config.categories,
  projects,
  recentReleases
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Generated ${projects.length} projects and ${recentReleases.length} releases in ${output}`);
