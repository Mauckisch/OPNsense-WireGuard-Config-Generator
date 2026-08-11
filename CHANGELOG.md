# Changelog

All notable changes to the OPNsense WireGuard Config Generator are documented in this file.

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
