(() => {
  "use strict";

  const deviceInput = document.querySelector("#device");
  const configInput = document.querySelector("#config");
  const fileInput = document.querySelector("#fileInput");
  const dropZone = document.querySelector("#dropZone");
  const clearButton = document.querySelector("#clearButton");
  const message = document.querySelector("#message");
  const statusPill = document.querySelector("#statusPill");
  const qrImage = document.querySelector("#qrImage");
  const qrPlaceholder = document.querySelector("#qrPlaceholder");
  const downloadButtons = [...document.querySelectorAll("[data-download]")];

  const aboutButton = document.querySelector("#aboutButton");
  const aboutModal = document.querySelector("#aboutModal");
  const aboutCloseButton = document.querySelector("#aboutCloseButton");
  const aboutCloseX = document.querySelector("#aboutCloseX");

  const summary = {
    device: document.querySelector("#summaryDevice"),
    endpoint: document.querySelector("#summaryEndpoint"),
    address: document.querySelector("#summaryAddress"),
    dns: document.querySelector("#summaryDns"),
    allowed_ips: document.querySelector("#summaryAllowed"),
    tunnel: document.querySelector("#summaryTunnel"),
  };

  let parseTimer = null;
  let qrUrl = null;

  function payload() {
    return {
      device: deviceInput.value,
      config: configInput.value,
    };
  }

  function setMessage(text, state = "neutral") {
    message.textContent = text;
    message.className = `message ${state}`;
  }

  function setStatus(text, state = "neutral") {
    statusPill.textContent = text;
    statusPill.className = `status-pill ${state}`;
  }

  function setDownloads(enabled) {
    downloadButtons.forEach(button => {
      button.disabled = !enabled;
    });
  }

  function clearQr() {
    if (qrUrl) {
      URL.revokeObjectURL(qrUrl);
      qrUrl = null;
    }
    qrImage.hidden = true;
    qrImage.removeAttribute("src");
    qrPlaceholder.hidden = false;
  }

  function updateSummary(values = {}) {
    for (const [key, element] of Object.entries(summary)) {
      element.textContent = values[key] || "—";
    }
  }

  function resetPage() {
    deviceInput.value = "";
    configInput.value = "";
    fileInput.value = "";
    updateSummary();
    clearQr();
    setDownloads(false);
    setStatus("Empty", "neutral");
    setMessage("Waiting for a configuration.", "neutral");
  }

  async function updateQr() {
    const response = await fetch("/api/qr", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload()),
      cache: "no-store",
    });

    if (!response.ok) {
      clearQr();
      return;
    }

    const blob = await response.blob();
    clearQr();
    qrUrl = URL.createObjectURL(blob);
    qrImage.src = qrUrl;
    qrImage.hidden = false;
    qrPlaceholder.hidden = true;
  }

  async function parseConfiguration() {
    const config = configInput.value.trim();

    if (!config) {
      updateSummary();
      clearQr();
      setDownloads(false);
      setStatus("Empty", "neutral");
      setMessage("Waiting for a configuration.", "neutral");
      return;
    }

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload()),
        cache: "no-store",
      });

      const result = await response.json();
      updateSummary(result.summary || {});

      if (!response.ok || !result.valid) {
        clearQr();
        setDownloads(false);
        setStatus("Invalid", "invalid");
        setMessage((result.errors || ["Invalid configuration."]).join(" "), "error");
        return;
      }

      setStatus("Valid", "valid");
      setMessage("Configuration is valid and ready for export.", "success");
      setDownloads(true);
      await updateQr();
    } catch (error) {
      clearQr();
      setDownloads(false);
      setStatus("Error", "invalid");
      setMessage("The exporter could not process the configuration.", "error");
    }
  }

  function scheduleParse() {
    window.clearTimeout(parseTimer);
    parseTimer = window.setTimeout(parseConfiguration, 280);
  }

  async function loadFile(file) {
    if (!file) return;
    configInput.value = await file.text();

    if (!deviceInput.value.trim()) {
      deviceInput.value = file.name.replace(/\.(conf|txt)$/i, "");
    }

    scheduleParse();
  }

  async function download(kind) {
    const response = await fetch(`/download/${kind}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload()),
    });

    if (!response.ok) {
      let text = "The download could not be created.";
      try {
        const result = await response.json();
        text = (result.errors || [text]).join(" ");
      } catch (_) {}
      setMessage(text, "error");
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const fallback = kind === "conf" ? "wireguard-client.conf" : kind === "png" ? "wireguard-client-qr.png" : "wireguard-client.zip";
    const filename = match ? match[1] : fallback;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function openAboutModal() {
    aboutModal.hidden = false;
    document.body.classList.add("modal-open");
    aboutCloseX.focus();
  }

  function closeAboutModal() {
    aboutModal.hidden = true;
    document.body.classList.remove("modal-open");
    aboutButton.focus();
  }

  aboutButton.addEventListener("click", openAboutModal);
  aboutCloseButton.addEventListener("click", closeAboutModal);
  aboutCloseX.addEventListener("click", closeAboutModal);

  aboutModal.addEventListener("click", event => {
    if (event.target === aboutModal) {
      closeAboutModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !aboutModal.hidden) {
      closeAboutModal();
    }
  });

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  ["dragenter", "dragover"].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", event => loadFile(event.dataTransfer.files[0]));
  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
  configInput.addEventListener("input", scheduleParse);
  deviceInput.addEventListener("input", scheduleParse);
  clearButton.addEventListener("click", resetPage);
  downloadButtons.forEach(button => {
    button.addEventListener("click", () => download(button.dataset.download));
  });

  window.addEventListener("pageshow", resetPage);
})();
