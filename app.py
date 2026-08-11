#!/usr/bin/env python3
from __future__ import annotations

import io
import json
import os
import re
import ssl
import urllib.error
import urllib.request
import zipfile
from base64 import b64encode
from pathlib import Path

import qrcode
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)

VERSION_FILE = Path(__file__).with_name("VERSION")

DATA_DIR = Path(
    os.environ.get("APP_DATA_DIR", "/app/data")
)

OPNSENSE_CONFIG_FILE = DATA_DIR / "opnsense.json"
MASTER_KEY_FILE = DATA_DIR / ".master.key"


def get_version() -> str:
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip() or "4.0.0"
    except OSError:
        return "4.0.0"


def generate_wireguard_keypair() -> tuple[str, str]:
    private_key = X25519PrivateKey.generate()

    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )

    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )

    private_key_b64 = b64encode(private_bytes).decode("ascii")
    public_key_b64 = b64encode(public_bytes).decode("ascii")

    return private_key_b64, public_key_b64


def normalize_config(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    return f"{value}\n" if value else ""


def safe_filename(value: str) -> str:
    value = value.strip()
    value = re.sub(r"\.conf$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value)
    value = value.strip(".-_")
    return value or "wireguard-client"


def section_values(config: str, section_name: str) -> dict[str, str]:
    current = None
    result: dict[str, str] = {}

    for raw_line in config.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(("#", ";")):
            continue

        section = re.fullmatch(r"\[([^\]]+)\]", line)
        if section:
            current = section.group(1).strip().lower()
            continue

        if current != section_name.lower() or "=" not in line:
            continue

        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()

    return result


def validate_config(config: str) -> list[str]:
    errors: list[str] = []

    if not config:
        return ["No configuration has been provided."]

    if "[Interface]" not in config:
        errors.append("The [Interface] section is missing.")
    if "[Peer]" not in config:
        errors.append("The [Peer] section is missing.")

    required_fields = ("PrivateKey", "Address", "PublicKey", "AllowedIPs", "Endpoint")
    for field in required_fields:
        if not re.search(rf"(?mi)^\s*{re.escape(field)}\s*=", config):
            errors.append(f"The field {field} is missing.")

    return errors


def tunnel_type(allowed_ips: str) -> str:
    values = {entry.strip() for entry in allowed_ips.split(",") if entry.strip()}
    if "0.0.0.0/0" in values or "::/0" in values:
        return "Full tunnel"
    return "Split tunnel" if values else "Unknown"


def config_summary(config: str, device: str) -> dict[str, str]:
    interface = section_values(config, "Interface")
    peer = section_values(config, "Peer")
    allowed_ips = peer.get("AllowedIPs", "")

    return {
        "device": safe_filename(device) if device.strip() else "—",
        "endpoint": peer.get("Endpoint", "—"),
        "address": interface.get("Address", "—"),
        "dns": interface.get("DNS", "—"),
        "allowed_ips": allowed_ips or "—",
        "tunnel": tunnel_type(allowed_ips),
    }


def make_qr_png(config: str) -> io.BytesIO:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(config)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")

    data = io.BytesIO()
    image.save(data, format="PNG")
    data.seek(0)
    return data


def request_payload() -> tuple[str, str]:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        return normalize_config(str(payload.get("config", ""))), str(payload.get("device", ""))

    return normalize_config(request.form.get("config", "")), request.form.get("device", "")


@app.get("/")
def index():
    return render_template("index.html", version=get_version())


@app.get("/health")
def health():
    return jsonify({"status": "ok", "version": get_version()})




def get_master_key() -> bytes:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        key = MASTER_KEY_FILE.read_bytes().strip()
        Fernet(key)
        return key

    except FileNotFoundError:
        key = Fernet.generate_key()

        temporary_file = MASTER_KEY_FILE.with_suffix(".tmp")
        temporary_file.write_bytes(key + b"\n")
        temporary_file.chmod(0o600)
        temporary_file.replace(MASTER_KEY_FILE)
        MASTER_KEY_FILE.chmod(0o600)

        return key

    except (OSError, ValueError):
        raise RuntimeError(
            "The application encryption key could not be loaded."
        )


def encrypt_secret(value: str) -> str:
    if not value:
        return ""

    return Fernet(
        get_master_key()
    ).encrypt(
        value.encode("utf-8")
    ).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""

    try:
        return Fernet(
            get_master_key()
        ).decrypt(
            value.encode("ascii")
        ).decode("utf-8")

    except (InvalidToken, ValueError, UnicodeError):
        raise RuntimeError(
            "Stored OPNsense credentials could not be decrypted."
        )


def load_opnsense_config() -> dict:
    try:
        data = json.loads(
            OPNSENSE_CONFIG_FILE.read_text(encoding="utf-8")
        )

    except FileNotFoundError:
        return {}

    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(data, dict):
        return {}

    try:
        return {
            "url": str(data.get("url", "")),
            "api_key": decrypt_secret(
                str(data.get("api_key", ""))
            ),
            "api_secret": decrypt_secret(
                str(data.get("api_secret", ""))
            ),
            "verify_tls": bool(
                data.get("verify_tls", True)
            ),
        }

    except RuntimeError:
        return {}


def save_opnsense_config(config: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    encrypted_config = {
        "url": str(config.get("url", "")),
        "api_key": encrypt_secret(
            str(config.get("api_key", ""))
        ),
        "api_secret": encrypt_secret(
            str(config.get("api_secret", ""))
        ),
        "verify_tls": bool(
            config.get("verify_tls", True)
        ),
    }

    temporary_file = OPNSENSE_CONFIG_FILE.with_suffix(".tmp")

    temporary_file.write_text(
        json.dumps(
            encrypted_config,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    temporary_file.chmod(0o600)
    temporary_file.replace(OPNSENSE_CONFIG_FILE)
    OPNSENSE_CONFIG_FILE.chmod(0o600)


def delete_opnsense_config() -> None:
    for file_path in (
        OPNSENSE_CONFIG_FILE,
        MASTER_KEY_FILE,
    ):
        try:
            file_path.unlink()
        except FileNotFoundError:
            pass


def normalize_opnsense_url(value: str) -> str:
    value = value.strip().rstrip("/")

    if not value:
        return ""

    if not re.match(r"^https?://", value, flags=re.IGNORECASE):
        value = f"https://{value}"

    return value


def opnsense_api_request(
    base_url: str,
    api_key: str,
    api_secret: str,
    path: str,
    verify_tls: bool = True,
    method: str = "GET",
    payload: dict | None = None,
) -> tuple[int, bytes]:
    url = f"{base_url}{path}"

    credentials = b64encode(
        f"{api_key}:{api_secret}".encode("utf-8")
    ).decode("ascii")

    headers = {
        "Authorization": f"Basic {credentials}",
        "Accept": "application/json",
        "User-Agent": "OPNsense-WireGuard-Config-Generator",
    }

    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request_object = urllib.request.Request(
        url,
        headers=headers,
        data=data,
        method=method.upper(),
    )

    context = ssl.create_default_context()

    if not verify_tls:
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    with urllib.request.urlopen(
        request_object,
        timeout=8,
        context=context,
    ) as response:
        return response.status, response.read()



@app.get("/api/opnsense/config")
def get_opnsense_config():
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "configured": False,
        })

    return jsonify({
        "configured": True,
        "url": config.get("url", ""),
        "verify_tls": bool(config.get("verify_tls", True)),
        "api_key_configured": bool(config.get("api_key")),
        "api_secret_configured": bool(config.get("api_secret")),
    })


@app.post("/api/opnsense/config")
def store_opnsense_config():
    payload = request.get_json(silent=True) or {}

    base_url = normalize_opnsense_url(
        str(payload.get("url", ""))
    )
    api_key = str(payload.get("api_key", "")).strip()
    api_secret = str(payload.get("api_secret", "")).strip()
    verify_tls = bool(payload.get("verify_tls", True))

    if not base_url:
        return jsonify({
            "saved": False,
            "error": "No OPNsense URL has been configured.",
        }), 400

    if not api_key or not api_secret:
        return jsonify({
            "saved": False,
            "error": "API key and API secret are required.",
        }), 400

    try:
        status, _ = opnsense_api_request(
            base_url,
            api_key,
            api_secret,
            "/api/wireguard/client/list_servers",
            verify_tls=verify_tls,
        )

        if status != 200:
            return jsonify({
                "saved": False,
                "error": f"OPNsense returned HTTP {status}.",
            }), 502

    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            message = (
                "Authentication failed or the API user does not have "
                "permission to access the WireGuard API."
            )
        elif error.code == 404:
            message = (
                "The OPNsense WireGuard API endpoint was not found."
            )
        else:
            message = f"OPNsense returned HTTP {error.code}."

        return jsonify({
            "saved": False,
            "error": message,
        }), 502

    except urllib.error.URLError as error:
        reason = str(error.reason)

        if "CERTIFICATE_VERIFY_FAILED" in reason:
            message = (
                "TLS certificate validation failed."
            )
        elif "timed out" in reason.lower():
            message = "The connection to OPNsense timed out."
        else:
            message = f"Could not connect to OPNsense: {reason}"

        return jsonify({
            "saved": False,
            "error": message,
        }), 502

    except TimeoutError:
        return jsonify({
            "saved": False,
            "error": "The connection to OPNsense timed out.",
        }), 502

    except Exception:
        return jsonify({
            "saved": False,
            "error": "The OPNsense configuration could not be saved.",
        }), 500

    save_opnsense_config({
        "url": base_url,
        "api_key": api_key,
        "api_secret": api_secret,
        "verify_tls": verify_tls,
    })

    return jsonify({
        "saved": True,
        "configured": True,
        "url": base_url,
        "verify_tls": verify_tls,
    })


@app.delete("/api/opnsense/config")
def remove_opnsense_config():
    delete_opnsense_config()

    return jsonify({
        "removed": True,
        "configured": False,
    })





def selected_model_values(value) -> list[str]:
    if isinstance(value, dict):
        return [
            str(key)
            for key, item in value.items()
            if isinstance(item, dict)
            and item.get("selected")
        ]

    if isinstance(value, list):
        return [str(item) for item in value]

    if isinstance(value, str):
        return [
            item.strip()
            for item in value.split(",")
            if item.strip()
        ]

    return []





@app.post("/api/opnsense/client/create")
def create_opnsense_client():
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "created": False,
            "error": "No saved OPNsense connection.",
        }), 400

    payload = request.get_json(silent=True) or {}

    server_uuid = str(
        payload.get("server", "")
    ).strip()

    name = str(
        payload.get("name", "")
    ).strip()

    allowed_ips = str(
        payload.get("allowed_ips", "0.0.0.0/0,::/0")
    ).strip()

    keepalive = str(
        payload.get("keepalive", "25")
    ).strip()

    use_psk = bool(
        payload.get("use_psk", True)
    )

    if not server_uuid:
        return jsonify({
            "created": False,
            "error": "No WireGuard server has been selected.",
        }), 400

    if not name:
        return jsonify({
            "created": False,
            "error": "A client name is required.",
        }), 400

    if not allowed_ips:
        return jsonify({
            "created": False,
            "error": "Allowed IPs must not be empty.",
        }), 400

    try:
        # Query OPNsense immediately before creation so the proposed
        # tunnel address is as current as possible.
        _, server_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/get_server_info/{server_uuid}",
            verify_tls=config.get("verify_tls", True),
        )

        server_info = json.loads(
            server_body.decode("utf-8")
        )

        tunnel_address = str(
            server_info.get("address", "")
        ).strip()

        server_public_key = str(
            server_info.get("pubkey", "")
        ).strip()

        endpoint = str(
            server_info.get("endpoint", "")
        ).strip()

        dns = str(
            server_info.get("peer_dns", "")
        ).strip()

        mtu = str(
            server_info.get("mtu", "")
        ).strip()

        if not tunnel_address:
            return jsonify({
                "created": False,
                "error": "OPNsense did not provide a tunnel address for the new client.",
            }), 400

        if not server_public_key:
            return jsonify({
                "created": False,
                "error": "The WireGuard server public key is unavailable.",
            }), 400

        if not endpoint:
            return jsonify({
                "created": False,
                "error": "The WireGuard server endpoint is unavailable.",
            }), 400

        private_key, public_key = generate_wireguard_keypair()

        preshared_key = ""

        if use_psk:
            # WireGuard PSKs are 32 random bytes, represented as base64.
            preshared_key = b64encode(
                os.urandom(32)
            ).decode("ascii")

        create_payload = {
            "client": {
                "enabled": "1",
                "name": name,
                "pubkey": public_key,
                "psk": preshared_key,
                "tunneladdress": tunnel_address,
                "serveraddress": "",
                "serverport": "",
                "endpoint": "",
                "keepalive": keepalive,
                "servers": server_uuid,
            }
        }

        status, create_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            "/api/wireguard/client/add_client",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload=create_payload,
        )

        create_result = json.loads(
            create_body.decode("utf-8")
        )

        if status != 200:
            return jsonify({
                "created": False,
                "error": f"OPNsense returned HTTP {status}.",
            }), 502

        result_value = str(
            create_result.get("result", "")
        ).lower()

        if result_value not in ("saved", "created"):
            return jsonify({
                "created": False,
                "error": "OPNsense did not create the WireGuard client.",
                "opnsense_result": create_result.get(
                    "result",
                    "unknown",
                ),
            }), 502

        reconfigure_status, _ = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            "/api/wireguard/service/reconfigure",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload={},
        )

        lines = [
            "[Interface]",
            f"PrivateKey = {private_key}",
            f"Address = {tunnel_address}",
        ]

        if dns:
            lines.append(
                f"DNS = {dns}"
            )

        if mtu:
            lines.append(
                f"MTU = {mtu}"
            )

        lines.extend([
            "",
            "[Peer]",
            f"PublicKey = {server_public_key}",
        ])

        if preshared_key:
            lines.append(
                f"PresharedKey = {preshared_key}"
            )

        lines.extend([
            f"AllowedIPs = {allowed_ips}",
            f"Endpoint = {endpoint}",
        ])

        if keepalive:
            lines.append(
                f"PersistentKeepalive = {keepalive}"
            )

        generated_config = "\n".join(lines) + "\n"

        return jsonify({
            "created": True,
            "reconfigured": reconfigure_status == 200,
            "client": {
                "name": name,
                "tunnel_address": tunnel_address,
            },
            "config": generated_config,
        })

    except urllib.error.HTTPError as error:
        return jsonify({
            "created": False,
            "error": f"OPNsense returned HTTP {error.code}.",
        }), 502

    except Exception:
        return jsonify({
            "created": False,
            "error": "The WireGuard client could not be created.",
        }), 500


@app.post("/api/opnsense/client/<uuid>/delete")
def delete_opnsense_client(uuid: str):
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "deleted": False,
            "error": "No saved OPNsense connection.",
        }), 400

    try:
        status, body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/del_client/{uuid}",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload={},
        )

        result = json.loads(
            body.decode("utf-8")
        )

        if (
            status != 200
            or result.get("result") != "deleted"
        ):
            return jsonify({
                "deleted": False,
                "error": "OPNsense did not delete the selected WireGuard client.",
                "opnsense_result": result.get(
                    "result",
                    "unknown",
                ),
            }), 502

        reconfigure_status, _ = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            "/api/wireguard/service/reconfigure",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload={},
        )

        return jsonify({
            "deleted": True,
            "reconfigured": reconfigure_status == 200,
        })

    except urllib.error.HTTPError as error:
        return jsonify({
            "deleted": False,
            "error": f"OPNsense returned HTTP {error.code}.",
        }), 502

    except Exception:
        return jsonify({
            "deleted": False,
            "error": "The WireGuard client could not be deleted.",
        }), 500


@app.post("/api/opnsense/client/<uuid>/regenerate")
def regenerate_opnsense_client(uuid: str):
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "generated": False,
            "error": "No saved OPNsense connection.",
        }), 400

    payload = request.get_json(silent=True) or {}

    server_uuid = str(
        payload.get("server", "")
    ).strip()

    allowed_ips = str(
        payload.get("allowed_ips", "0.0.0.0/0,::/0")
    ).strip()

    if not server_uuid:
        return jsonify({
            "generated": False,
            "error": "No WireGuard server has been selected.",
        }), 400

    if not allowed_ips:
        return jsonify({
            "generated": False,
            "error": "Allowed IPs must not be empty.",
        }), 400

    try:
        _, client_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/get_client/{uuid}",
            verify_tls=config.get("verify_tls", True),
        )

        _, server_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/get_server_info/{server_uuid}",
            verify_tls=config.get("verify_tls", True),
        )

        client_payload = json.loads(
            client_body.decode("utf-8")
        )

        server_info = json.loads(
            server_body.decode("utf-8")
        )

        client = client_payload.get("client", {})

        if not client:
            return jsonify({
                "generated": False,
                "error": "The selected WireGuard client was not found.",
            }), 404

        tunnel_addresses = selected_model_values(
            client.get("tunneladdress", {})
        )

        server_ids = selected_model_values(
            client.get("servers", {})
        )

        if not tunnel_addresses:
            return jsonify({
                "generated": False,
                "error": "The selected client has no tunnel address.",
            }), 400

        if not server_info.get("pubkey"):
            return jsonify({
                "generated": False,
                "error": "The WireGuard server public key is unavailable.",
            }), 400

        if not server_info.get("endpoint"):
            return jsonify({
                "generated": False,
                "error": "The WireGuard server endpoint is unavailable.",
            }), 400

        private_key, public_key = generate_wireguard_keypair()

        update_payload = {
            "client": {
                "enabled": str(client.get("enabled", "1")),
                "name": str(client.get("name", "")),
                "pubkey": public_key,
                "psk": str(client.get("psk", "")),
                "tunneladdress": ",".join(tunnel_addresses),
                "serveraddress": str(
                    client.get("serveraddress", "")
                ),
                "serverport": str(
                    client.get("serverport", "")
                ),
                "endpoint": str(
                    client.get("endpoint", "")
                ),
                "keepalive": str(
                    client.get("keepalive", "")
                ),
                "servers": ",".join(server_ids),
            }
        }

        status, update_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/set_client/{uuid}",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload=update_payload,
        )

        update_result = json.loads(
            update_body.decode("utf-8")
        )

        if (
            status != 200
            or update_result.get("result") != "saved"
        ):
            return jsonify({
                "generated": False,
                "error": "OPNsense did not save the regenerated client key.",
                "opnsense_result": update_result.get(
                    "result",
                    "unknown",
                ),
            }), 502

        reconfigure_status, _ = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            "/api/wireguard/service/reconfigure",
            verify_tls=config.get("verify_tls", True),
            method="POST",
            payload={},
        )

        lines = [
            "[Interface]",
            f"PrivateKey = {private_key}",
            f"Address = {','.join(tunnel_addresses)}",
        ]

        if server_info.get("peer_dns"):
            lines.append(
                f"DNS = {server_info['peer_dns']}"
            )

        if server_info.get("mtu"):
            lines.append(
                f"MTU = {server_info['mtu']}"
            )

        lines.extend([
            "",
            "[Peer]",
            f"PublicKey = {server_info['pubkey']}",
        ])

        if client.get("psk"):
            lines.append(
                f"PresharedKey = {client['psk']}"
            )

        lines.extend([
            f"AllowedIPs = {allowed_ips}",
            f"Endpoint = {server_info['endpoint']}",
        ])

        if client.get("keepalive"):
            lines.append(
                f"PersistentKeepalive = {client['keepalive']}"
            )

        generated_config = "\n".join(lines) + "\n"

        return jsonify({
            "generated": True,
            "reconfigured": reconfigure_status == 200,
            "client": {
                "uuid": uuid,
                "name": client.get("name", ""),
            },
            "config": generated_config,
            "warning": (
                "The previous configuration for this client is now invalid."
            ),
        })

    except urllib.error.HTTPError as error:
        return jsonify({
            "generated": False,
            "error": f"OPNsense returned HTTP {error.code}.",
        }), 502

    except Exception:
        return jsonify({
            "generated": False,
            "error": "The client could not be regenerated.",
        }), 500


@app.get("/api/opnsense/client/<uuid>/details")
def opnsense_client_details(uuid: str):
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "available": False,
            "error": "No saved OPNsense connection.",
        }), 400

    server_uuid = str(
        request.args.get("server", "")
    ).strip()

    if not server_uuid:
        return jsonify({
            "available": False,
            "error": "No WireGuard server has been selected.",
        }), 400

    try:
        _, client_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/get_client/{uuid}",
            verify_tls=config.get("verify_tls", True),
        )

        _, server_body = opnsense_api_request(
            config["url"],
            config["api_key"],
            config["api_secret"],
            f"/api/wireguard/client/get_server_info/{server_uuid}",
            verify_tls=config.get("verify_tls", True),
        )

        client_payload = json.loads(
            client_body.decode("utf-8")
        )
        server_payload = json.loads(
            server_body.decode("utf-8")
        )

        client = client_payload.get("client", {})

        tunnel_addresses = selected_model_values(
            client.get("tunneladdress", {})
        )

        return jsonify({
            "available": True,
            "client": {
                "uuid": uuid,
                "name": client.get("name", ""),
                "enabled": client.get("enabled", "0") == "1",
                "tunnel_address": ", ".join(tunnel_addresses),
                "public_key_available": bool(client.get("pubkey")),
                "psk_available": bool(client.get("psk")),
                "keepalive": client.get("keepalive", ""),
            },
            "server": {
                "uuid": server_uuid,
                "endpoint": server_payload.get("endpoint", ""),
                "dns": server_payload.get("peer_dns", ""),
                "mtu": server_payload.get("mtu", ""),
                "public_key_available": bool(server_payload.get("pubkey")),
            },
            "private_key_available": False,
            "exportable": False,
        })

    except Exception:
        return jsonify({
            "available": False,
            "error": "The WireGuard peer details could not be loaded.",
        }), 500



def sanitize_opnsense_client_search(
    payload: object,
    server_uuid: str,
) -> dict:
    if not isinstance(payload, dict):
        return {
            "current": 1,
            "rowCount": 0,
            "rows": [],
            "total": 0,
        }

    rows = payload.get("rows", [])

    if not isinstance(rows, list):
        rows = []

    sanitized_rows = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        row_server_uuid = str(
            row.get("servers", "")
        ).strip()

        # Only return peers belonging to the selected server.
        if row_server_uuid != server_uuid:
            continue

        sanitized_rows.append({
            "uuid": str(row.get("uuid", "")),
            "name": str(row.get("name", "")),
            "enabled": str(row.get("enabled", "0")),
            "tunneladdress": str(
                row.get("tunneladdress", "")
            ),
            "servers": row_server_uuid,
            "server_name": str(
                row.get("%servers", "")
            ),
            "keepalive": str(
                row.get("keepalive", "")
            ),
            "pubkey": str(
                row.get("pubkey", "")
            ),
            "psk_available": bool(
                row.get("psk")
            ),
        })

    return {
        "current": 1,
        "rowCount": len(sanitized_rows),
        "rows": sanitized_rows,
        "total": len(sanitized_rows),
    }


@app.get("/api/opnsense/clients")
def opnsense_wireguard_clients():
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "configured": False,
            "connected": False,
            "clients": [],
            "error": "No saved OPNsense connection.",
        }), 400

    server_uuid = str(
        request.args.get("server", "")
    ).strip()

    if not server_uuid:
        return jsonify({
            "configured": True,
            "connected": True,
            "clients": [],
            "error": "No WireGuard server has been selected.",
        }), 400

    try:
        status, body = opnsense_api_request(
            config.get("url", ""),
            config.get("api_key", ""),
            config.get("api_secret", ""),
            "/api/wireguard/client/search_client",
            verify_tls=bool(config.get("verify_tls", True)),
        )

        if status != 200:
            return jsonify({
                "configured": True,
                "connected": False,
                "clients": [],
                "error": f"OPNsense returned HTTP {status}.",
            }), 502

        try:
            payload = json.loads(
                body.decode("utf-8")
            )
        except (UnicodeDecodeError, json.JSONDecodeError):
            return jsonify({
                "configured": True,
                "connected": True,
                "clients": [],
                "error": "OPNsense returned an invalid JSON response.",
            }), 502

        sanitized_clients = sanitize_opnsense_client_search(
            payload,
            server_uuid,
        )

        return jsonify({
            "configured": True,
            "connected": True,
            "server": server_uuid,
            "clients": sanitized_clients,
        })

    except urllib.error.HTTPError as error:
        return jsonify({
            "configured": True,
            "connected": False,
            "clients": [],
            "error": f"OPNsense returned HTTP {error.code}.",
        }), 502

    except urllib.error.URLError as error:
        return jsonify({
            "configured": True,
            "connected": False,
            "clients": [],
            "error": f"Could not connect to OPNsense: {error.reason}",
        }), 502

    except TimeoutError:
        return jsonify({
            "configured": True,
            "connected": False,
            "clients": [],
            "error": "The connection to OPNsense timed out.",
        }), 502

    except Exception:
        return jsonify({
            "configured": True,
            "connected": False,
            "clients": [],
            "error": "The WireGuard client list could not be loaded.",
        }), 500


@app.get("/api/opnsense/servers")
def opnsense_wireguard_servers():
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "configured": False,
            "connected": False,
            "servers": [],
            "error": "No saved OPNsense connection.",
        }), 400

    try:
        status, body = opnsense_api_request(
            config.get("url", ""),
            config.get("api_key", ""),
            config.get("api_secret", ""),
            "/api/wireguard/client/list_servers",
            verify_tls=bool(config.get("verify_tls", True)),
        )

        if status != 200:
            return jsonify({
                "configured": True,
                "connected": False,
                "servers": [],
                "error": f"OPNsense returned HTTP {status}.",
            }), 502

        try:
            payload = json.loads(
                body.decode("utf-8")
            )
        except (UnicodeDecodeError, json.JSONDecodeError):
            return jsonify({
                "configured": True,
                "connected": True,
                "servers": [],
                "error": "OPNsense returned an invalid JSON response.",
            }), 502

        return jsonify({
            "configured": True,
            "connected": True,
            "servers": payload,
        })

    except urllib.error.HTTPError as error:
        return jsonify({
            "configured": True,
            "connected": False,
            "servers": [],
            "error": f"OPNsense returned HTTP {error.code}.",
        }), 502

    except urllib.error.URLError as error:
        return jsonify({
            "configured": True,
            "connected": False,
            "servers": [],
            "error": f"Could not connect to OPNsense: {error.reason}",
        }), 502

    except TimeoutError:
        return jsonify({
            "configured": True,
            "connected": False,
            "servers": [],
            "error": "The connection to OPNsense timed out.",
        }), 502

    except Exception:
        return jsonify({
            "configured": True,
            "connected": False,
            "servers": [],
            "error": "The WireGuard server list could not be loaded.",
        }), 500


@app.get("/api/opnsense/status")
def saved_opnsense_status():
    config = load_opnsense_config()

    if not config:
        return jsonify({
            "configured": False,
            "connected": False,
            "error": "No saved OPNsense connection.",
        })

    try:
        status, _ = opnsense_api_request(
            config.get("url", ""),
            config.get("api_key", ""),
            config.get("api_secret", ""),
            "/api/wireguard/client/list_servers",
            verify_tls=bool(config.get("verify_tls", True)),
        )

        return jsonify({
            "configured": True,
            "connected": status == 200,
            "url": config.get("url", ""),
            "status": status,
        })

    except Exception:
        return jsonify({
            "configured": True,
            "connected": False,
            "url": config.get("url", ""),
            "error": "The saved OPNsense connection is currently unavailable.",
        })


@app.post("/api/opnsense/test")
def test_opnsense_connection():
    payload = request.get_json(silent=True) or {}

    base_url = normalize_opnsense_url(
        str(payload.get("url", ""))
    )
    api_key = str(payload.get("api_key", "")).strip()
    api_secret = str(payload.get("api_secret", "")).strip()
    verify_tls = bool(payload.get("verify_tls", True))

    if not base_url:
        return jsonify({
            "connected": False,
            "error": "No OPNsense URL has been configured.",
        }), 400

    if not api_key or not api_secret:
        return jsonify({
            "connected": False,
            "error": "API key and API secret are required.",
        }), 400

    try:
        status, _ = opnsense_api_request(
            base_url,
            api_key,
            api_secret,
            "/api/wireguard/client/list_servers",
            verify_tls=verify_tls,
        )

        return jsonify({
            "connected": status == 200,
            "status": status,
            "url": base_url,
        })

    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            message = (
                "Authentication failed or the API user does not have "
                "permission to access the WireGuard API."
            )
        elif error.code == 404:
            message = (
                "The OPNsense WireGuard API endpoint was not found. "
                "WireGuard may not be available on this firewall."
            )
        else:
            message = f"OPNsense returned HTTP {error.code}."

        return jsonify({
            "connected": False,
            "status": error.code,
            "error": message,
        }), 502

    except urllib.error.URLError as error:
        reason = str(error.reason)

        if "CERTIFICATE_VERIFY_FAILED" in reason:
            message = (
                "TLS certificate validation failed. Verify the certificate "
                "or disable TLS verification for this connection."
            )
        elif "timed out" in reason.lower():
            message = "The connection to OPNsense timed out."
        else:
            message = f"Could not connect to OPNsense: {reason}"

        return jsonify({
            "connected": False,
            "error": message,
        }), 502

    except TimeoutError:
        return jsonify({
            "connected": False,
            "error": "The connection to OPNsense timed out.",
        }), 502

    except Exception:
        return jsonify({
            "connected": False,
            "error": "An unexpected error occurred while connecting to OPNsense.",
        }), 500


@app.post("/api/parse")
def parse_config():
    config, device = request_payload()
    errors = validate_config(config)

    if errors:
        return jsonify({
            "valid": False,
            "errors": errors,
            "summary": config_summary(config, device),
        }), 400

    return jsonify({
        "valid": True,
        "errors": [],
        "summary": config_summary(config, device),
    })


@app.post("/api/qr")
def qr_preview():
    config, _ = request_payload()
    errors = validate_config(config)
    if errors:
        return jsonify({"valid": False, "errors": errors}), 400

    return send_file(make_qr_png(config), mimetype="image/png", max_age=0)


@app.post("/download/conf")
def download_conf():
    config, device = request_payload()
    errors = validate_config(config)
    if errors:
        return jsonify({"valid": False, "errors": errors}), 400

    filename = safe_filename(device)
    data = io.BytesIO(config.encode("utf-8"))
    return send_file(
        data,
        mimetype="text/plain; charset=utf-8",
        as_attachment=True,
        download_name=f"{filename}.conf",
    )


@app.post("/download/png")
def download_png():
    config, device = request_payload()
    errors = validate_config(config)
    if errors:
        return jsonify({"valid": False, "errors": errors}), 400

    filename = safe_filename(device)
    return send_file(
        make_qr_png(config),
        mimetype="image/png",
        as_attachment=True,
        download_name=f"{filename}-qr.png",
    )


@app.post("/download/zip")
def download_zip():
    config, device = request_payload()
    errors = validate_config(config)
    if errors:
        return jsonify({"valid": False, "errors": errors}), 400

    filename = safe_filename(device)
    qr_data = make_qr_png(config).getvalue()

    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("wg0.conf", config)
        archive.writestr("wg0.png", qr_data)

    bundle.seek(0)
    return send_file(
        bundle,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{filename}-wireguard.zip",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8787, debug=False)
