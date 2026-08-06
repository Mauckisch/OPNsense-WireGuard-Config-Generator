# OPNsense WireGuard Exporter v2

A small, local web application that converts an OPNsense WireGuard Peer Generator configuration into:

- a WireGuard `.conf` file
- a QR code PNG
- a ZIP archive containing `wg0.conf` and `wg0.png`

## Deploy

```bash
cd /home/dennigma/wireguard-exporter
docker compose up -d --build
```

Open:

```text
http://192.168.123.7:8787
```

## Update

Replace the project files, then run:

```bash
docker compose up -d --build
```

## Notes

The application does not use cookies, browser storage, or Flask sessions. Reloading the page clears all fields.
