#!/usr/bin/env bash
set -euo pipefail

APP_NAME="opnsense-wireguard-config-generator"
APP_DIR="${HOME}/.local/share/${APP_NAME}"
VENV_DIR="${APP_DIR}/venv"
BIN_FILE="${HOME}/.local/bin/${APP_NAME}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${APP_DIR}"
mkdir -p "${HOME}/.local/bin"

cp "${SCRIPT_DIR}/app.py" "${APP_DIR}/app.py"
cp "${SCRIPT_DIR}/VERSION" "${APP_DIR}/VERSION"
cp -r "${SCRIPT_DIR}/templates" "${APP_DIR}/templates"
cp -r "${SCRIPT_DIR}/static" "${APP_DIR}/static"

python3 -m venv "${VENV_DIR}"
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${SCRIPT_DIR}/requirements.txt"

cat > "${BIN_FILE}" <<INNER_EOF
#!/usr/bin/env bash
exec "${VENV_DIR}/bin/python" "${APP_DIR}/app.py"
INNER_EOF

chmod +x "${BIN_FILE}"

echo
echo "Installation completed."
echo
echo "Start the application with:"
echo "  ${BIN_FILE}"
echo
echo "Then open:"
echo "  http://127.0.0.1:8787"
