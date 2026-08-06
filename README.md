# OPNsense WireGuard Config Generator

A small self-hosted web application that processes WireGuard client
configurations created with the OPNsense WireGuard Peer Generator.

It generates:

- a WireGuard `.conf` client profile
- a QR code as a PNG image
- a ZIP archive containing `wg0.conf` and `wg0.png`
- a live configuration summary
- full-tunnel or split-tunnel detection

## Project links

GitHub repository:

https://github.com/Mauckisch/OPNsense-WireGuard-Config-Generator

Docker image:

```text
ghcr.io/mauckisch/opnsense-wireguard-config-generator
```

## Features

- Paste a WireGuard configuration into the browser
- Upload `.conf` or `.txt` files
- Validate required WireGuard sections and fields
- Preview important configuration values
- Generate a QR code
- Download the `.conf` file
- Download the QR code as PNG
- Download both files as a ZIP archive
- No cookies
- No browser storage
- No Flask sessions
- No configuration persistence

Reloading the page clears all entered data and generated previews.

## Docker Compose installation

Create a project directory:

```bash
mkdir -p opnsense-wireguard-config-generator
cd opnsense-wireguard-config-generator
```

Create the file `docker-compose.yml`:

```yaml
services:
  generator:
    image: ghcr.io/mauckisch/opnsense-wireguard-config-generator:latest
    container_name: opnsense-wireguard-config-generator
    restart: unless-stopped
    init: true
    ports:
      - "8787:8787"
```

Pull the Docker image:

```bash
docker compose pull
```

Start the application:

```bash
docker compose up -d
```

Open the application in a browser:

```text
http://SERVER-IP:8787
```

Replace `SERVER-IP` with the IP address or hostname of your Docker host.

## Direct Docker pull

The image can also be downloaded directly:

```bash
docker pull ghcr.io/mauckisch/opnsense-wireguard-config-generator:latest
```

Run it without Docker Compose:

```bash
docker run -d \
  --name opnsense-wireguard-config-generator \
  --restart unless-stopped \
  --init \
  -p 8787:8787 \
  ghcr.io/mauckisch/opnsense-wireguard-config-generator:latest
```

## Update

Change into the directory containing `docker-compose.yml`:

```bash
cd opnsense-wireguard-config-generator
```

Pull the current image:

```bash
docker compose pull
```

Recreate the container with the new image:

```bash
docker compose up -d
```

Optionally remove unused old images:

```bash
docker image prune
```

## Container status

```bash
docker compose ps
```

## Logs

```bash
docker compose logs -f generator
```

## Health check

The Docker image includes an automatic container health check.

A manual test can be performed on the Docker host:

```bash
curl http://127.0.0.1:8787/health
```

Example response:

```json
{
  "status": "ok",
  "version": "2.2.0"
}
```

## Stop the application

```bash
docker compose down
```

## Build locally

Clone the repository:

```bash
git clone https://github.com/Mauckisch/OPNsense-WireGuard-Config-Generator.git
cd OPNsense-WireGuard-Config-Generator
```

Build a local image:

```bash
docker build \
  -t opnsense-wireguard-config-generator:local \
  .
```

Run the locally built image:

```bash
docker run -d \
  --name opnsense-wireguard-config-generator-local \
  --restart unless-stopped \
  --init \
  -p 8787:8787 \
  opnsense-wireguard-config-generator:local
```

## Security

WireGuard client configurations contain private keys.

Therefore:

- do not publish generated configurations
- do not commit client configurations to Git
- do not store generated QR codes publicly
- protect backups containing WireGuard profiles
- remove or disable compromised peers in OPNsense
- expose the application only to trusted networks

The application does not intentionally store submitted configurations.

## License

No license has currently been specified.
