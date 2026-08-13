# Changelog

All notable changes to WireForge are documented in this file.

## [4.2.0]

### Added

- Added QR code import to the Manual Generator.
- Added a dedicated second drag-and-drop area for WireGuard QR code images.
- Added support for PNG, JPG, JPEG and WebP QR code uploads.
- Added server-side QR decoding using OpenCV.
- Imported QR codes are converted back into the complete WireGuard client configuration.
- QR-imported configurations are passed through the existing WireGuard validation, summary, preview and export workflow.
- Added an 8 MB upload limit for QR code images.
- QR images are processed in memory and are not intentionally persisted by WireForge.

### Changed

- Manual Generator now provides separate upload areas for configuration files and QR code images.
- Existing `.conf` and `.txt` upload behavior remains unchanged.
- Added `opencv-python-headless` and NumPy runtime dependencies for QR decoding.

## [4.1.2]

### Fixed

- Fixed OPNsense Settings connection-state handling for saved configurations.
- Saved OPNsense connections are now checked automatically when the page loads.
- Connection status now reports the actual state as `Connected`, `Unavailable`, or `Checking` instead of using `Saved` as a connection state.
- WireGuard API availability is now checked automatically for saved configurations.
- Fixed misleading `Not checked` WireGuard API status after loading an already configured OPNsense connection.
- Fixed connection testing with previously saved encrypted API credentials.
- WireGuard API and OPNsense connection states now use consistent success and error styling.
- Updated the sidebar footer so the WireForge version is displayed on the same line as the product name.

## [4.1.1]

### Fixed

- Fixed persistent storage for saved OPNsense connection settings
- Added a fixed Docker volume name `wireforge-data`
- OPNsense API credentials and the local encryption key now survive container recreation and rebuilds
- Development and production Compose configurations now mount `/app/data` persistently
- Prevented loss of `opnsense.json` and `.master.key` during `docker compose down` followed by rebuild/start

## [4.1.0]

### Rebranding

- Project renamed from **OPNsense WireGuard Config Generator** to **WireForge**
- New WireForge product name and identity
- Updated application branding throughout the web interface
- Updated WireForge logo, favicon and README banner
- GitHub repository moved to `Mauckisch/WireForge`
- Docker image moved to `ghcr.io/mauckisch/wireforge`
- GitHub release titles updated to use the WireForge name
- Application and Docker container naming updated for WireForge
- Documentation updated for the new project and image names

### Changed

- Product description updated to:
  `OPNsense WireGuard Client Manager & Config Generator`
- README installation, update and local-build examples updated for WireForge
- Docker Compose production container renamed to `wireforge`
- Development container renamed to `wireforge-dev`
- Application API User-Agent updated for WireForge
- GitHub links in the web interface now point to the WireForge repository

### Compatibility

- Core WireGuard parsing, QR generation and export behavior remains unchanged
- OPNsense API functionality remains unchanged
- Existing `/app/data` contents remain compatible
- Existing installations should retain their persistent data volume when changing to the WireForge image

## [4.0.0]

### Added

- Direct OPNsense WireGuard API integration
- Dedicated API Generator
- Dedicated OPNsense Settings page
- Persistent OPNsense connection configuration
- Automatic encrypted storage of OPNsense API credentials
- Automatically generated local application encryption key
- OPNsense connection testing
- Optional TLS certificate verification
- Automatic discovery of configured WireGuard server instances
- Server-specific WireGuard client / peer discovery
- Existing peer detail view
- Automatic retrieval of the next available client tunnel address from OPNsense
- Creation of new WireGuard clients
- Local generation of WireGuard client key pairs
- Optional preshared-key generation
- Regenerate & Export workflow for existing peers
- Explicit confirmation dialog before regenerating an existing peer
- Delete client functionality
- Explicit confirmation dialog before deleting a peer
- Reuse of `.conf`, QR code and ZIP export functionality for API-generated configurations
- Persistent Docker data volume for saved OPNsense connection settings

### Changed

- Application navigation now separates the Manual Generator, API Generator and OPNsense Settings
- Existing WireGuard peers are filtered by the selected server instance
- Existing peers clearly indicate that their original client private key is unavailable
- Regeneration replaces the existing peer public key and clearly warns that previous client configurations become invalid
- Client creation obtains the next tunnel address from OPNsense instead of calculating it locally
- Default Allowed IPs for newly generated full-tunnel configurations include IPv4 and IPv6:
  `0.0.0.0/0,::/0`
- About dialog updated for the API integration and security architecture
- Docker Compose deployment now uses persistent `/app/data` storage
- Application version updated to 4.0.0

### Security

- OPNsense API key and API secret are encrypted at rest
- A random encryption key is generated automatically by the application
- Saved API credentials are not returned to the browser
- Stored credential files use restrictive file permissions
- Normal client-list API responses do not expose preshared keys
- Generated client private keys are not intentionally persisted
- Sensitive credential values and WireGuard key material are not intentionally written to application logs
- Regenerate operations require explicit confirmation
- Delete operations require explicit confirmation
- Removing the saved OPNsense configuration also removes the associated local encryption key

### OPNsense Requirements

- Dedicated API user recommended
- Required privilege: `VPN: WireGuard: Configuration`
- HTTPS access from the generator to the OPNsense WebGUI/API is required
- Standard WebGUI/API port: TCP 443
- Custom OPNsense WebGUI HTTPS ports can be used
- Firewall access should be restricted to the generator host whenever possible

### Validated

- OPNsense API connection
- Encrypted credential persistence
- WireGuard server discovery
- WireGuard client discovery
- Server-specific peer filtering
- Existing peer detail retrieval
- Next-client-address retrieval from OPNsense
- New client creation
- Regenerate & Export
- Client deletion
- `.conf` export
- QR code generation
- ZIP export
- Removal of preshared keys from normal client-list API responses
- Application logs checked for unintended sensitive credential output

## [3.0.0]

### Added

- New corporate design for the complete web interface
- New red project branding inspired by OPNsense and WireGuard
- New project logo
- New SVG favicon
- New GitHub/README banner
- New persistent application sidebar
- New application top bar
- New About dialog with:
  - project logo
  - application version
  - frontend information
  - backend information
  - runtime information
  - project information
  - copyright information
  - GitHub repository link
- Version information accessible from the sidebar
- Responsive layout for smaller displays

### Changed

- Complete redesign of the previous single-page layout
- Reworked application structure into a dedicated application shell
- Reworked colors from the previous blue/turquoise theme to the new red corporate design
- Reworked cards, borders, inputs, buttons, upload area and status elements
- Reworked header and navigation structure
- GitHub link moved into the About dialog
- README updated with the new project banner
- Application version updated to 3.0.0

### Technical

- Existing WireGuard configuration parsing and download functionality retained
- Existing API endpoints retained
- Existing QR code generation retained
- Existing `.conf`, PNG and ZIP downloads retained
- Project assets stored as SVG files under `static/img/`
