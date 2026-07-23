# Relay Chat

A responsive realtime chat and calling application built with Next.js, TypeScript, Tailwind CSS, Express, Socket.IO, WebRTC, and Prisma.

## Features

- Registration/login API with bcrypt password hashing and JWT sessions
- Searchable user discovery and one-to-one conversations
- Optimistic realtime messages, typing, presence, read receipts, and room isolation
- Audio/video call UI and WebRTC signaling events
- Call history backed by Prisma
- Cursor-paginated message API and indexed database access
- Responsive desktop/mobile experience with accessible controls

## Run locally

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Open `http://localhost:3000/register` to create a real account, then create a second account in another browser/private window to test realtime messaging and WebRTC calls. The API runs on port 4000. Camera and microphone access requires localhost or HTTPS.

## Scaling notes

The API is stateless apart from Socket.IO connections. For multi-node production, use PostgreSQL instead of SQLite, a Redis Socket.IO adapter for cross-node fanout/presence, object storage for attachments, a TURN service (such as coturn) for reliable WebRTC connectivity, rate limiting, and a job queue for push notifications. Keep sticky sessions enabled or use connection-state recovery. Messages are cursor-paginated and indexed by conversation/time.

## Production deployment with Docker and Nginx

The production stack contains Next.js, the Express/Socket.IO API, Nginx, Certbot, persistent SQLite storage, and a self-hosted coturn server. It expects these DNS records to resolve directly to `172.252.13.8`:

```text
chat.nazmulhasan.dev       A  172.252.13.8
turn.chat.nazmulhasan.dev  A  172.252.13.8
```

On the VPS, copy or clone the repository and create the production environment file:

```bash
cp .env.production.example .env.production
openssl rand -hex 32
openssl rand -hex 32
```

Put a different generated value in each setting:

```env
JWT_SECRET=first_generated_value
TURN_SHARED_SECRET=second_generated_value
```

`JWT_SECRET` must be at least 32 characters. The API intentionally refuses to
start in production when it is missing or too short.

Open both the VPS firewall and any provider-level firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49160:49200/udp
sudo ufw enable
```

Before the first HTTPS deployment, start the application services and issue the initial Let's Encrypt certificate. Port 80 must be free:

```bash
docker compose --env-file .env.production up -d --build web api coturn
docker compose --env-file .env.production run --rm -p 80:80 --entrypoint certbot certbot \
  certonly --standalone --non-interactive --agree-tos \
  --email YOUR_EMAIL_ADDRESS --no-eff-email \
  -d chat.nazmulhasan.dev
```

Now start the complete stack. `--env-file` is required because Compose also injects the TURN shared secret into the coturn command:

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs -f
```

Open `https://chat.nazmulhasan.dev`. Certbot checks renewal every 12 hours, while Nginx reloads periodically to pick up renewed certificates. The database is stored in the `relay_data` Docker volume and survives container rebuilds.

Before exposing the service publicly, verify:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production ps
curl --fail https://chat.nazmulhasan.dev/health
```

Useful operations:

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production restart api
docker compose --env-file .env.production logs -f api coturn nginx certbot
docker compose --env-file .env.production down
```

Do not use `down -v` unless you intentionally want to delete the database and Let's Encrypt certificate volumes.

## GitHub Actions CI/CD

The workflow at `.github/workflows/deploy.yml` validates every pull request. A push to `main` runs the same checks, securely uploads a release archive over SSH, rebuilds the Docker stack on the VPS, and verifies the production health endpoint.

Complete the manual VPS bootstrap above once before enabling automatic deployment. Keep `.env.production` at `~/relay-chat/.env.production` on the VPS; the workflow never uploads or overwrites it.

Create an SSH deployment key on your own computer:

```bash
ssh-keygen -t ed25519 -f github-relay-deploy -C github-relay-deploy
```

Append `github-relay-deploy.pub` to the VPS user's `~/.ssh/authorized_keys`. Ensure that user can run Docker without `sudo`. Add these secrets to the GitHub repository's `production` environment:

```text
VPS_HOST         172.252.13.8
VPS_USER         your_vps_user
VPS_SSH_KEY      complete contents of github-relay-deploy
VPS_KNOWN_HOSTS  output of: ssh-keyscan -H 172.252.13.8
```

Never add the private deployment key or `.env.production` to the repository. The workflow uses only official GitHub checkout/setup actions and the runner's native SSH client.
