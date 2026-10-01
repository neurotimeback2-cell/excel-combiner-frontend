# Excel Combiner — frontend

React (Vite) UI for Excel Combiner: upload Excel files that share the same sheets (Facebook, Instagram, LinkedIn, …) and download one file where each sheet holds the rows from all uploads. The combining happens in the backend (separate repo).

The UI calls `${VITE_API_URL}/combine`. It defaults to `/api/combine`, so in production nginx forwards it to the backend and Vite does the same during local development. To use an API on another host, copy `.env.example` to `.env` and set `VITE_API_URL` to that API's `/api` prefix, for example `https://api.example.com/api`. Rebuild the frontend after changing it.

## Run locally

Start the backend first (`npm run dev` in the backend repo, port 3000), then:

```bash
npm install
npm run dev     # http://localhost:5173
```

### API URL setting

```bash
cp .env.example .env
# Use /api for the included Vite/nginx proxy, or an external API URL:
VITE_API_URL=https://api.example.com/api
```

`VITE_API_URL` is embedded in the frontend build, so it is public and must not contain credentials or secrets. When it points to another origin, set that backend's `CORS_ORIGIN` to the frontend origin (for example, `https://app.example.com`) and make the API publicly reachable.

## Deploy on the VPS

Set up the backend first (see its README). Requires Node.js 22+ and nginx. The steps assume `/opt/excel-combiner/`; if you use another path, change `root` in `deploy/nginx.conf`.

```bash
cd /opt/excel-combiner
git clone <frontend-repo-url> frontend
cd frontend
npm ci
npm run build               # creates dist/, which nginx serves

sudo cp deploy/nginx.conf /etc/nginx/sites-available/excel-combiner
sudo ln -s /etc/nginx/sites-available/excel-combiner /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default     # only if nothing else uses nginx's default site
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://SERVER_IP/`.

If port 80 is already used by another site on this server, change `listen 80 default_server;` to e.g. `listen 8080;` and open `http://SERVER_IP:8080/` (make sure the firewall allows that port).

Update to a new version (no nginx reload needed):

```bash
cd /opt/excel-combiner/frontend && git pull && npm ci && npm run build
```

### What the nginx config does

- Serves `dist/` and forwards `/api/` to the backend on `127.0.0.1:3000`.
- Allows uploads up to 1 GB in total per request (`client_max_body_size`).
- Waits up to 10 minutes for large combines.
- Streams uploads and results straight to/from the backend, so nginx doesn't write the files to temp files on disk.
