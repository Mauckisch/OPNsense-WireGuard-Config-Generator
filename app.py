#!/usr/bin/env python3
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

import qrcode
from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)

VERSION_FILE = Path(__file__).with_name("VERSION")


def get_version() -> str:
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip() or "3.0.0"
    except OSError:
        return "3.0.0"


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
