# Changelog

All notable changes to the OPNsense WireGuard Config Generator are documented in this file.

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
