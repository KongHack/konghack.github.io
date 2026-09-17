# KongHack.org site

The static front door for the [KongHack GitHub organization](https://github.com/KongHack). It is deliberately built with plain HTML, CSS, and JavaScript, with no application server or frontend framework.

## How it works

```text
KongHack GitHub organization
        ↓ GitHub API
scheduled GitHub Actions workflow
        ↓
data/projects.json
        ↓
static GitHub Pages site
```

The [Pages workflow](.github/workflows/pages.yml) runs after pushes to `master`, on manual dispatch, and every 12 hours. It runs `scripts/generate-project-data.mjs` with the workflow's read-only `GITHUB_TOKEN`, uploads the repository as a Pages artifact, and deploys it. Visitors only fetch the generated local JSON file; they never call the GitHub API.

The generator:

- discovers every public organization repository;
- automatically removes archived repositories and entries in `excludedRepositories`;
- fetches each repository's latest published, non-prerelease release;
- retains descriptions, languages, licenses, topics, homepages, and activity dates from GitHub;
- produces a cross-organization release feed; and
- assigns presentation details from `projects.json` where GitHub has no equivalent.

The generated `data/projects.json` file is committed so the site works immediately and can be previewed without an API call. Deployments regenerate it in the Pages artifact; scheduled runs do not create noisy commits.

## Categories and editorial configuration

GitHub topics are the preferred long-term category source:

| Category | Topic |
| --- | --- |
| Core | `konghack-core` |
| Application | `konghack-application` |
| Data | `konghack-data` |
| Infrastructure | `konghack-infrastructure` |

No KongHack repositories currently have topics, so `projects.json` supplies initial category fallbacks, featured status, display names, and ordering. A recognized category topic takes precedence over the configured fallback. This means maintainers can add topics repository by repository without coordinating a site change. New repositories appear automatically in **Other** until they receive a recognized topic or a fallback category.

Keep volatile information out of `projects.json`: descriptions, releases, archive state, dates, languages, licenses, and repository URLs all belong on GitHub.

## Local preview

Regenerate the data (requires Node.js 20 or newer):

```sh
node scripts/generate-project-data.mjs
```

Then serve the repository root with any static server, for example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Opening `index.html` directly is not supported because browsers generally block `fetch()` for local files.

## GitHub Pages setup

In the repository's **Settings → Pages → Build and deployment**, change the existing publishing source to **GitHub Actions**. The current public site is still the original branch-published “Hello World” page; no workflow, Jekyll theme, or `CNAME` was present in the repository. The empty `.nojekyll` file makes the new static-file behavior explicit.

## Event-driven release refreshes

KongHack release workflows call the reusable `KongHack/.github/.github/workflows/refresh-site.yml` workflow after their `release` job succeeds. The reusable workflow uses the organization secret `KONGHACK_PAGES_TOKEN` to dispatch this repository's `pages.yml` workflow, so a published release appears on the site without waiting for the next scheduled run.

The secret contains a fine-grained token restricted to this repository with **Actions: read and write** permission. It is explicitly passed to the reusable workflow rather than inheriting every available secret. The 12-hour schedule remains enabled as an eventual-consistency fallback.

## Possible follow-ups

- Add the category topics above to repositories, then trim the category fallbacks.
- Add validated Packagist package links by reading `composer.json` during generation.
- Add a custom domain and corresponding `CNAME` if one is chosen.
