<p align="center">
  <img src="static/img/banner.svg" alt="WireForge" width="100%">
</p>

# WireForge

**WireForge** is a self-hosted OPNsense WireGuard client manager and configuration generator.

It can generate WireGuard client configurations manually or manage WireGuard peers directly through the OPNsense API.

WireForge can generate:

- a WireGuard `.conf` client profile
- a QR code as a PNG image
- a ZIP archive containing `wg0.conf` and `wg0.png`
- a live configuration summary
- full-tunnel or split-tunnel detection

## Project links

GitHub repository:

https://github.com/Mauckisch/WireForge

Docker image:

```text
ghcr.io/mauckisch/wireforge
```

## Features

### Manual Generator

- Paste a WireGuard configuration into the browser
- Upload `.conf` or `.txt` files
- Validate required WireGuard sections and fields
- Preview important configuration values
- Generate a QR code
- Download the `.conf` file
- Download the QR code as PNG
- Download both files as a ZIP archive
- Full-tunnel or split-tunnel detection

### API Generator

When an OPNsense connection is configured, WireForge can:

- connect directly to the OPNsense WireGuard API
- discover configured WireGuard server instances
- list WireGuard clients / peers for the selected server
- display existing peer information
- request the next available client tunnel address from OPNsense
- create new WireGuard clients
- generate WireGuard client key pairs locally
- generate an optional preshared key
- generate `.conf`, QR and ZIP exports for newly created clients
- regenerate an existing client's WireGuard key pair and export a new configuration
- delete existing WireGuard clients

### OPNsense Settings

- Configure the OPNsense URL
- Configure an API key and API secret
- Enable or disable TLS certificate verification
- Test the OPNsense connection
- Persist the connection settings in the Docker data volume
- Encrypt stored API credentials automatically

The Manual Generator remains available even when no OPNsense connection is configured.

## Important limitation for existing clients

OPNsense stores the public key of a WireGuard client peer, but the client's private key is not available through the WireGuard configuration API.

Therefore, an existing client configuration cannot be reconstructed completely from OPNsense alone.

For an existing peer, **Regenerate & Export** creates a new WireGuard client key pair and replaces the existing public key in OPNsense.

> **Warning:** Regenerating a client immediately invalidates all previous WireGuard configurations for that peer. The newly generated configuration must be imported on the client.

WireForge requires explicit confirmation before regeneration.

Deleting a client also requires explicit confirmation and makes existing configurations for that peer unusable.

## OPNsense API requirements

### Dedicated API user

A dedicated OPNsense user is recommended for WireForge.

Generate an API key and API secret for that user.

The required OPNsense privilege is:

```text
VPN: WireGuard: Configuration
```

An unrestricted administrator account is not required and should not be used when a dedicated API user can be created.

### Network access

The Docker host/container must be able to reach the OPNsense WebGUI/API address.

For a standard HTTPS OPNsense WebGUI configuration:

```text
Protocol:     TCP
Destination: OPNsense WebGUI/API address
Port:        443
```

If the OPNsense WebGUI uses a custom HTTPS port, that port must be allowed instead.

If WireForge and OPNsense are located in different networks or VLANs, allow the WireForge host to access the OPNsense management/API address on the configured HTTPS port.

A restrictive firewall rule is recommended:

```text
Source:      WireForge host
Destination: OPNsense management/API address
Protocol:    TCP
Port:        443 or the configured WebGUI HTTPS port
```

Do not expose the OPNsense WebGUI/API to the public Internet solely for WireForge.

### TLS verification

TLS certificate verification can be enabled in the OPNsense Settings page.

Disabling certificate verification may be necessary when OPNsense uses a certificate that is not trusted by the container, but this reduces protection against man-in-the-middle attacks.

Use a trusted certificate and keep TLS verification enabled whenever possible.

## API credential security

Saved OPNsense API credentials are encrypted at rest.

WireForge automatically generates a random encryption key. The administrator does not need to create or remember an encryption password.

Persistent application data is stored under:

```text
/app/data
```

WireForge uses:

```text
/app/data/.master.key
/app/data/opnsense.json
```

The master key and configuration file are created with restrictive file permissions.

The API key and API secret stored in `opnsense.json` are encrypted. Saved API credentials are not returned to the browser.

If the application encryption key is lost, the encrypted credentials cannot be recovered. Configure new OPNsense API credentials instead.

The local encryption protects credentials at rest from simple configuration-file disclosure. It does **not** protect the credentials against an attacker with full root access to the Docker host, because such an attacker can access both the encrypted data and the local encryption key.

Removing the saved OPNsense configuration also removes the associated local master key.

## WireGuard key handling

New WireGuard client key pairs are generated by WireForge.

The private client key is required to build the new WireGuard client configuration and is returned to the browser as part of that generated configuration.

Generated private client keys are not intentionally persisted by WireForge.

Normal client-list API responses do not expose preshared keys. They indicate only whether a preshared key is available.

Sensitive API credentials and WireGuard key material are not intentionally written to application logs.

Generated WireGuard configurations and QR codes contain sensitive client credentials and must be protected accordingly.

## Tunnel address assignment

WireForge does not independently calculate the next WireGuard client address.

When creating a new client, it requests the next client address from OPNsense immediately before creating the peer.

This leaves address assignment under OPNsense control.

## Docker Compose installation

Create a project directory:

```bash
mkdir -p wireforge
cd wireforge
```

Create the file `docker-compose.yml`:

```yaml
services:
  generator:
    image: ghcr.io/mauckisch/wireforge:latest
    container_name: wireforge
    restart: unless-stopped
    init: true

    ports:
      - "8787:8787"

    volumes:
      - generator-data:/app/data

volumes:
  generator-data:
```

The persistent volume is required if OPNsense connection settings should survive container recreation.

Do not store OPNsense API credentials directly in `docker-compose.yml`, the Docker image or the Git repository.

Pull the Docker image:

```bash
docker compose pull
```

Start WireForge:

```bash
docker compose up -d
```

Open WireForge in a browser:

```text
http://SERVER-IP:8787
```

Replace `SERVER-IP` with the IP address or hostname of your Docker host.

## Direct Docker pull

The image can also be downloaded directly:

```bash
docker pull ghcr.io/mauckisch/wireforge:latest
```

Run it without Docker Compose and with persistent application data:

```bash
docker volume create wireforge-data

docker run -d \
  --name wireforge \
  --restart unless-stopped \
  --init \
  -p 8787:8787 \
  -v wireforge-data:/app/data \
  ghcr.io/mauckisch/wireforge:latest
```

## Update

Change into the directory containing `docker-compose.yml`:

```bash
cd wireforge
```

Pull the current image:

```bash
docker compose pull
```

Recreate the container with the new image:

```bash
docker compose up -d
```

The persistent `generator-data` volume is retained during a normal Docker Compose container recreation.

Optionally remove unused old images:

```bash
docker image prune
```

## Migration from the former project name

WireForge is the rebranded successor of **OPNsense WireGuard Config Generator**.

The GitHub repository is now:

```text
https://github.com/Mauckisch/WireForge
```

The Docker image is now:

```text
ghcr.io/mauckisch/wireforge
```

Existing installations that used the old image path must update the `image:` entry in `docker-compose.yml`.

Keep the existing persistent `/app/data` volume if you want to retain the saved encrypted OPNsense connection.

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
  "version": "4.1.0"
}
```

## Stop WireForge

```bash
docker compose down
```

The named Docker volume is not removed by this command.

Do not use `docker compose down -v` unless you intentionally want to remove the persistent OPNsense configuration and encryption key.

## Build locally

Clone the repository:

```bash
git clone https://github.com/Mauckisch/WireForge.git
cd WireForge
```

Build a local image:

```bash
docker build \
  -t wireforge:local \
  .
```

Run the locally built image:

```bash
docker volume create wireforge-local-data

docker run -d \
  --name wireforge-local \
  --restart unless-stopped \
  --init \
  -p 8787:8787 \
  -v wireforge-local-data:/app/data \
  wireforge:local
```

## Security recommendations

WireGuard client configurations contain private keys and must be treated as sensitive credentials.

Therefore:

- do not publish generated configurations
- do not commit client configurations to Git
- do not store generated QR codes publicly
- protect backups containing WireGuard profiles
- use a dedicated least-privilege OPNsense API user
- restrict OPNsense API network access to the WireForge host where possible
- use HTTPS for the OPNsense API
- keep TLS certificate verification enabled whenever possible
- protect the Docker host and persistent application volume
- remove or disable compromised peers in OPNsense
- expose the WireForge web interface only to trusted networks

WireForge does not intentionally persist submitted or generated WireGuard client configurations.

OPNsense connection settings are intentionally persisted when configured. API credentials within those settings are encrypted at rest.

## License

No license has currently been specified.
