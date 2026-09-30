# Excel Combiner — frontend

React (Vite) UI for Excel Combiner: upload Excel files that share the same sheets (Facebook, Instagram, LinkedIn, …) and download one file where each sheet holds the rows from all uploads. The combining happens in the backend (separate repo).

The UI always calls `/api/...` on its own address, so it needs no environment variables: in production nginx forwards `/api` to the backend, in development Vite does.

## Run locally

Start the backend first (`npm run dev` in the backend repo, port 3000), then:

```bash
npm install
npm run dev     # http://localhost:5173
```

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
