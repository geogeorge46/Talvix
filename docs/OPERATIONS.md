# Talvix Operations

## CI/CD

GitHub Actions runs backend lint/tests/audit, frontend format/typecheck/lint/tests/build/audit, and Playwright browser smoke tests. The browser job starts MongoDB, the Express API, and the built Vite preview, then verifies health, auth routes, and fail-closed routing.

The deployment workflow publishes backend and frontend images to GitHub Container Registry. If `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_SSH_KEY` are configured, it also runs a Compose deployment on the target host from `/opt/talvix`.

Required repository secrets for deployment depend on the host, but production must supply the backend environment keys from `deploy/.env.example` and the frontend build-time `VITE_API_BASE_URL`.

## Deployment

Build local production images:

```sh
docker compose -f docker-compose.prod.yml build
```

Run with an external MongoDB such as Atlas:

```sh
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml up -d backend frontend
```

Run with the bundled local MongoDB profile for staging only:

```sh
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml --profile local-mongo up -d
```

Production requirements:

- Use HTTPS at the edge and set `CLIENT_URL` and `APP_FRONTEND_URL` to the exact public frontend origin.
- Keep refresh cookies HttpOnly and secure in production.
- Store secrets in the deployment platform, not in Git.
- Run one scheduled outbox worker or admin-triggered outbox processor until a dedicated worker exists.

## Monitoring

Use `ops/monitoring/prometheus.yml`, `ops/monitoring/blackbox.yml`, and `ops/monitoring/alerts.yml` with Prometheus plus blackbox-exporter for uptime alerts. For simple uptime checks:

```sh
TALVIX_HEALTH_URLS=https://api.example.com/api/v1/health,https://app.example.com/healthz node ops/scripts/health-check.mjs
```

Alert on API/frontend health failure, elevated 5xx rates at the edge, MongoDB connection failures, outbox backlog growth, backup failure, and storage-provider errors.

## Backups

MongoDB backups require MongoDB Database Tools on the runner or maintenance host.

Create a backup:

```sh
MONGODB_URI=mongodb://... BACKUP_DIR=backups/mongodb node ops/scripts/mongodb-backup.mjs
```

Restore into a controlled environment:

```sh
MONGODB_URI=mongodb://... RESTORE_DIR=backups/mongodb/2026-07-30T00-00-00-000Z RESTORE_DROP=true node ops/scripts/mongodb-restore.mjs
```

Keep encrypted daily backups with tested restore drills. Never restore production data into a developer machine unless the data has been approved and protected under the project data-handling policy.
