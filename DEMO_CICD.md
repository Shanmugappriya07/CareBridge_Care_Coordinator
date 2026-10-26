# CI/CD for CareBridge

Pipeline (GitHub Actions, `.github/workflows/ci-cd.yml`):
1. Install dependencies (`npm ci`)
2. Syntax check backend + HMS portal JS
3. Smoke test: start server, check `/api/health` and HMS `/login.html`
4. Build Docker image (`Dockerfile`)
5. Push to Docker Hub (main branch only, needs secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`)

Jenkins alternative: `Jenkinsfile` (Checkout -> Test -> Docker build -> push -> Ansible deploy via `ansible/deploy.yml`).

Setup: push repo to GitHub root (this folder = repo root), add the two secrets under
Settings -> Secrets and variables -> Actions. Every push to main triggers the pipeline.

Demo tip: keep the live demo on the locally tested setup; show the pipeline run (green checks / Docker Hub image) separately.
