const state = { data: null, category: "all" };

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeDate(value) {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86400000);
  if (Math.abs(days) < 31) return relativeFormatter.format(days, "day");
  const months = Math.round(days / 30.44);
  if (Math.abs(months) < 12) return relativeFormatter.format(months, "month");
  return relativeFormatter.format(Math.round(days / 365.25), "year");
}

function projectCard(project) {
  const topics = project.topics
    .filter((topic) => !topic.startsWith("konghack-"))
    .slice(0, 4)
    .map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join("");
  const releaseLink = project.release
    ? `<a href="${escapeHtml(project.release.url)}">${escapeHtml(project.release.tag)} release ↗</a>` : "";
  const homepageLink = project.homepage
    ? `<a href="${escapeHtml(project.homepage)}">Documentation ↗</a>` : "";
  const license = project.license?.spdxId && project.license.spdxId !== "NOASSERTION"
    ? `<span>${escapeHtml(project.license.spdxId)}</span>` : "";

  return `<article class="project-card">
    <div class="card-top">
      <span class="category">${escapeHtml(project.categoryLabel)}</span>
      ${project.featured ? '<span class="featured" title="Featured project"></span>' : ""}
    </div>
    <h3><a href="${escapeHtml(project.repositoryUrl)}">${escapeHtml(project.displayName)}</a></h3>
    <p class="description">${escapeHtml(project.description || "Explore this project on GitHub.")}</p>
    <div class="project-meta">
      ${project.language ? `<span><i class="language-dot"></i>${escapeHtml(project.language)}</span>` : ""}
      ${license}
      <span title="Last code push: ${escapeHtml(dateFormatter.format(new Date(project.pushedAt)))}">Updated ${escapeHtml(relativeDate(project.pushedAt))}</span>
    </div>
    ${topics ? `<div class="topic-list">${topics}</div>` : ""}
    <div class="card-links">
      <a href="${escapeHtml(project.repositoryUrl)}">Repository ↗</a>
      ${releaseLink}${homepageLink}
    </div>
  </article>`;
}

function renderProjects() {
  const projects = state.category === "all"
    ? state.data.projects
    : state.data.projects.filter((project) => project.category === state.category);
  const grid = document.querySelector("#project-grid");
  grid.innerHTML = projects.map(projectCard).join("");
  grid.setAttribute("aria-busy", "false");
}

function renderFilters() {
  const categories = state.data.categories.filter((category) =>
    state.data.projects.some((project) => project.category === category.id));
  const filters = [{ id: "all", label: "All projects" }, ...categories];
  const container = document.querySelector("#category-filters");
  container.innerHTML = filters.map((category) =>
    `<button class="filter" type="button" data-category="${escapeHtml(category.id)}" aria-pressed="${category.id === "all"}">${escapeHtml(category.label)}</button>`
  ).join("");
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    container.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderProjects();
  });
}

function renderReleases() {
  const list = document.querySelector("#release-list");
  if (!state.data.recentReleases.length) {
    list.innerHTML = '<p class="description">No published releases yet.</p>';
    return;
  }
  list.innerHTML = state.data.recentReleases.slice(0, 8).map((release) => `<a class="release-row" href="${escapeHtml(release.url)}">
    <span class="release-project">${escapeHtml(release.project)}</span>
    <span class="release-version">${escapeHtml(release.tag)}</span>
    <time class="release-date" datetime="${escapeHtml(release.publishedAt)}">${escapeHtml(dateFormatter.format(new Date(release.publishedAt)))}</time>
    <span class="release-arrow" aria-hidden="true">↗</span>
  </a>`).join("");
}

async function init() {
  try {
    const response = await fetch("data/projects.json");
    if (!response.ok) throw new Error(`Project data request failed: ${response.status}`);
    state.data = await response.json();
    renderFilters();
    renderProjects();
    renderReleases();
    document.querySelector("#freshness").textContent = `Metadata refreshed ${dateFormatter.format(new Date(state.data.generatedAt))}.`;
  } catch (error) {
    console.error(error);
    document.querySelector("#project-grid").hidden = true;
    document.querySelector("#data-error").hidden = false;
    document.querySelector("#release-list").innerHTML = '<p class="description">Release data is temporarily unavailable.</p>';
  }
}

init();
