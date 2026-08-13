(() => {
  "use strict";

  const deviceInput = document.querySelector("#device");
  const configInput = document.querySelector("#config");
  const fileInput = document.querySelector("#fileInput");
  const dropZone = document.querySelector("#dropZone");
  const qrFileInput = document.querySelector("#qrFileInput");
  const qrDropZone = document.querySelector("#qrDropZone");
  const clearButton = document.querySelector("#clearButton");
  const message = document.querySelector("#message");
  const statusPill = document.querySelector("#statusPill");
  const qrImage = document.querySelector("#qrImage");
  const qrPlaceholder = document.querySelector("#qrPlaceholder");
  const downloadButtons = [...document.querySelectorAll("[data-download]")];

  const manualNavButton = document.querySelector("#manualNavButton");
  const apiGeneratorNavButton = document.querySelector("#apiGeneratorNavButton");
  const opnsenseSettingsNavButton = document.querySelector("#opnsenseSettingsNavButton");

  const manualView = document.querySelector("#manualView");
  const apiGeneratorView = document.querySelector("#apiGeneratorView");
  const opnsenseSettingsView = document.querySelector("#opnsenseSettingsView");

  const apiGeneratorRefreshButton = document.querySelector("#apiGeneratorRefreshButton");
  const apiGeneratorMessage = document.querySelector("#apiGeneratorMessage");
  const apiGeneratorConnectionStatus = document.querySelector("#apiGeneratorConnectionStatus");
  const apiGeneratorWireguardStatus = document.querySelector("#apiGeneratorWireguardStatus");
  const apiGeneratorServerCount = document.querySelector("#apiGeneratorServerCount");
  const apiServerCard = document.querySelector("#apiServerCard");
  const apiServerSelect = document.querySelector("#apiServerSelect");
  const apiCreateClientButton = document.querySelector("#apiCreateClientButton");

  const createClientModal = document.querySelector("#createClientModal");
  const createClientCloseX = document.querySelector("#createClientCloseX");
  const createClientCancelButton = document.querySelector("#createClientCancelButton");
  const createClientConfirmButton = document.querySelector("#createClientConfirmButton");
  const createClientName = document.querySelector("#createClientName");
  const createClientAddress = document.querySelector("#createClientAddress");
  const createAllowedIps = document.querySelector("#createAllowedIps");
  const createKeepalive = document.querySelector("#createKeepalive");
  const createUsePsk = document.querySelector("#createUsePsk");
  const createClientMessage = document.querySelector("#createClientMessage");

  const apiClientSection = document.querySelector("#apiClientSection");
  const apiClientSelect = document.querySelector("#apiClientSelect");
  const apiClientMessage = document.querySelector("#apiClientMessage");

  const apiPeerDetails = document.querySelector("#apiPeerDetails");
  const apiPeerName = document.querySelector("#apiPeerName");
  const apiPeerAddress = document.querySelector("#apiPeerAddress");
  const apiPeerEndpoint = document.querySelector("#apiPeerEndpoint");
  const apiPeerDns = document.querySelector("#apiPeerDns");
  const apiPeerPsk = document.querySelector("#apiPeerPsk");
  const apiPeerPrivateKey = document.querySelector("#apiPeerPrivateKey");
  const apiAllowedIps = document.querySelector("#apiAllowedIps");
  const apiRegenerateButton = document.querySelector("#apiRegenerateButton");
  const apiDeleteButton = document.querySelector("#apiDeleteButton");

  const deleteClientModal = document.querySelector("#deleteClientModal");
  const deleteClientCloseX = document.querySelector("#deleteClientCloseX");
  const deleteClientCancelButton = document.querySelector("#deleteClientCancelButton");
  const deleteClientConfirmButton = document.querySelector("#deleteClientConfirmButton");
  const deleteClientName = document.querySelector("#deleteClientName");

  const regenerateModal = document.querySelector("#regenerateModal");
  const regenerateCloseX = document.querySelector("#regenerateCloseX");
  const regenerateCancelButton = document.querySelector("#regenerateCancelButton");
  const regenerateConfirmButton = document.querySelector("#regenerateConfirmButton");
  const regenerateClientName = document.querySelector("#regenerateClientName");

  const opnsenseUrl = document.querySelector("#opnsenseUrl");
  const opnsenseApiKey = document.querySelector("#opnsenseApiKey");
  const opnsenseApiSecret = document.querySelector("#opnsenseApiSecret");
  const opnsenseVerifyTls = document.querySelector("#opnsenseVerifyTls");
  const opnsenseTestButton = document.querySelector("#opnsenseTestButton");
  const opnsenseSaveButton = document.querySelector("#opnsenseSaveButton");
  const opnsenseRemoveButton = document.querySelector("#opnsenseRemoveButton");

  const opnsenseConnectionMessage = document.querySelector("#opnsenseConnectionMessage");
  const opnsenseConnectionStatus = document.querySelector("#opnsenseConnectionStatus");
  const opnsenseConnectionHost = document.querySelector("#opnsenseConnectionHost");
  const opnsenseWireguardStatus = document.querySelector("#opnsenseWireguardStatus");

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
  let opnsenseTestSucceeded = false;

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
    qrFileInput.value = "";
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

  async function loadQrFile(file) {
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setStatus("Invalid", "invalid");
      setMessage(
        "Unsupported QR image type. Use PNG, JPG, JPEG or WebP.",
        "error",
      );
      qrFileInput.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setStatus("Invalid", "invalid");
      setMessage(
        "QR code image is too large. Maximum size is 8 MB.",
        "error",
      );
      qrFileInput.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setStatus("Reading QR", "neutral");
    setMessage("Reading WireGuard QR code...", "neutral");

    try {
      const response = await fetch("/api/qr/decode", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.decoded) {
        setStatus("Invalid", "invalid");
        setMessage(
          result.error || "The QR code could not be decoded.",
          "error",
        );
        return;
      }

      configInput.value = result.config || "";

      if (!deviceInput.value.trim()) {
        deviceInput.value = file.name.replace(
          /\.(png|jpe?g|webp)$/i,
          "",
        );
      }

      setMessage(
        "WireGuard configuration imported successfully from QR code.",
        "success",
      );

      scheduleParse();

    } catch (_) {
      setStatus("Error", "invalid");
      setMessage(
        "The QR code image could not be processed.",
        "error",
      );
    }
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

  function showView(view) {
    const manualActive = view === "manual";
    const apiGeneratorActive = view === "api-generator";
    const settingsActive = view === "settings";

    manualView.hidden = !manualActive;
    apiGeneratorView.hidden = !apiGeneratorActive;
    opnsenseSettingsView.hidden = !settingsActive;

    manualNavButton.classList.toggle("active", manualActive);
    apiGeneratorNavButton.classList.toggle("active", apiGeneratorActive);
    opnsenseSettingsNavButton.classList.toggle("active", settingsActive);

    for (const button of [
      manualNavButton,
      apiGeneratorNavButton,
      opnsenseSettingsNavButton,
    ]) {
      button.removeAttribute("aria-current");
    }

    if (manualActive) {
      manualNavButton.setAttribute("aria-current", "page");
    } else if (apiGeneratorActive) {
      apiGeneratorNavButton.setAttribute("aria-current", "page");
    } else {
      opnsenseSettingsNavButton.setAttribute("aria-current", "page");
    }
  }

  manualNavButton.addEventListener("click", () => {
    showView("manual");
  });

  apiGeneratorNavButton.addEventListener("click", () => {
    showView("api-generator");
    loadApiGenerator();
  });

  apiGeneratorRefreshButton.addEventListener(
    "click",
    loadApiGenerator,
  );

  apiServerSelect.addEventListener(
    "change",
    async () => {
      apiCreateClientButton.disabled =
        !apiServerSelect.value;

      await loadApiClients();
    },
  );

  apiClientSelect.addEventListener(
    "change",
    loadApiPeerDetails,
  );

  opnsenseSettingsNavButton.addEventListener("click", () => {
    showView("settings");
  });


  function setApiGeneratorMessage(
    text,
    state = "neutral",
  ) {
    apiGeneratorMessage.textContent = text;
    apiGeneratorMessage.className = `message ${state}`;
  }


  function resetApiGenerator() {
    apiGeneratorConnectionStatus.textContent = "Not configured";
    apiGeneratorConnectionStatus.className = "api-status-offline";

    apiGeneratorWireguardStatus.textContent = "Unavailable";
    apiGeneratorServerCount.textContent = "—";

    apiServerCard.hidden = true;

    apiServerSelect.innerHTML = `
      <option value="">
        Select a WireGuard server
      </option>
    `;
  }


  function normalizeServerList(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    if (Array.isArray(payload.rows)) {
      return payload.rows;
    }

    if (Array.isArray(payload.servers)) {
      return payload.servers;
    }

    return Object.entries(payload).map(
      ([uuid, value]) => {
        if (
          value &&
          typeof value === "object"
        ) {
          return {
            uuid,
            ...value,
          };
        }

        return {
          uuid,
          name: String(value),
        };
      },
    );
  }


  function serverDisplayName(server, index) {
    return (
      server.name ||
      server.description ||
      server.descr ||
      server.server ||
      server.interface ||
      server.uuid ||
      `WireGuard server ${index + 1}`
    );
  }



  function normalizeClientList(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    if (Array.isArray(payload.rows)) {
      return payload.rows;
    }

    if (Array.isArray(payload.clients)) {
      return payload.clients;
    }

    return Object.entries(payload).map(
      ([uuid, value]) => {
        if (
          value &&
          typeof value === "object"
        ) {
          return {
            uuid,
            ...value,
          };
        }

        return {
          uuid,
          name: String(value),
        };
      },
    );
  }


  function clientDisplayName(client, index) {
    return (
      client.name ||
      client.description ||
      client.descr ||
      client.client ||
      client.peer ||
      client.uuid ||
      `WireGuard client ${index + 1}`
    );
  }



  function resetPeerDetails() {
    apiPeerDetails.hidden = true;

    apiPeerName.textContent = "—";
    apiPeerAddress.textContent = "—";
    apiPeerEndpoint.textContent = "—";
    apiPeerDns.textContent = "—";
    apiPeerPsk.textContent = "—";
    apiPeerPrivateKey.textContent = "Unavailable";
  }


  async function loadApiPeerDetails() {
    const serverUuid = apiServerSelect.value;
    const clientUuid = apiClientSelect.value;

    resetPeerDetails();

    if (!serverUuid || !clientUuid) {
      return;
    }

    apiClientMessage.textContent =
      "Loading WireGuard client details...";

    apiClientMessage.className =
      "message neutral";

    try {
      const response = await fetch(
        `/api/opnsense/client/${encodeURIComponent(clientUuid)}/details?server=${encodeURIComponent(serverUuid)}`,
        {cache: "no-store"},
      );

      const result = await response.json();

      if (!response.ok || !result.available) {
        apiClientMessage.textContent =
          result.error ||
          "The WireGuard client details could not be loaded.";

        apiClientMessage.className =
          "message error";

        return;
      }

      apiPeerName.textContent =
        result.client.name || "—";

      apiPeerAddress.textContent =
        result.client.tunnel_address || "—";

      apiPeerEndpoint.textContent =
        result.server.endpoint || "—";

      apiPeerDns.textContent =
        result.server.dns || "—";

      apiPeerPsk.textContent =
        result.client.psk_available
          ? "Available"
          : "Not configured";

      apiPeerPrivateKey.textContent =
        "Unavailable";

      apiPeerDetails.hidden = false;

      apiClientMessage.textContent =
        "Existing peer loaded. Its original private key is not available.";

      apiClientMessage.className =
        "message neutral";

    } catch (_) {
      apiClientMessage.textContent =
        "The WireGuard client details could not be loaded.";

      apiClientMessage.className =
        "message error";
    }
  }


  async function loadApiClients() {
    const serverUuid = apiServerSelect.value;

    apiClientSelect.innerHTML = `
      <option value="">
        Select a WireGuard client
      </option>
    `;

    if (!serverUuid) {
      apiClientSection.hidden = true;
      return;
    }

    apiClientSection.hidden = false;

    apiClientMessage.textContent = "Loading WireGuard clients...";
    apiClientMessage.className = "message neutral";

    apiClientSelect.disabled = true;

    try {
      const response = await fetch(
        `/api/opnsense/clients?server=${encodeURIComponent(serverUuid)}`,
        {cache: "no-store"},
      );

      const result = await response.json();

      if (!response.ok || !result.connected) {
        apiClientMessage.textContent =
          result.error ||
          "The WireGuard client list could not be loaded.";

        apiClientMessage.className = "message error";
        return;
      }

      const clients = normalizeClientList(
        result.clients,
      );

      clients.forEach((client, index) => {
        const option = document.createElement("option");

        option.value =
          client.uuid ||
          client.id ||
          client.value ||
          String(index);

        option.textContent =
          clientDisplayName(client, index);

        apiClientSelect.appendChild(option);
      });

      if (clients.length === 0) {
        apiClientMessage.textContent =
          "No WireGuard clients were returned by OPNsense.";

        apiClientMessage.className = "message neutral";
        return;
      }

      apiClientMessage.textContent =
        `${clients.length} WireGuard client${clients.length === 1 ? "" : "s"} available.`;

      apiClientMessage.className = "message success";

    } catch (_) {
      apiClientMessage.textContent =
        "The WireGuard client list could not be loaded.";

      apiClientMessage.className = "message error";

    } finally {
      apiClientSelect.disabled = false;
    }
  }


  async function loadApiGenerator() {
    apiGeneratorRefreshButton.disabled = true;
    apiGeneratorRefreshButton.textContent = "Loading...";

    setApiGeneratorMessage(
      "Checking saved OPNsense connection...",
      "neutral",
    );

    resetApiGenerator();

    try {
      const statusResponse = await fetch(
        "/api/opnsense/status",
        {cache: "no-store"},
      );

      const status = await statusResponse.json();

      if (!status.configured) {
        setApiGeneratorMessage(
          "No saved OPNsense connection. Configure one under OPNsense Settings.",
          "error",
        );
        return;
      }

      if (!status.connected) {
        apiGeneratorConnectionStatus.textContent = "Unavailable";

        setApiGeneratorMessage(
          status.error ||
          "The saved OPNsense connection is currently unavailable.",
          "error",
        );
        return;
      }

      apiGeneratorConnectionStatus.textContent = "Connected";
      apiGeneratorConnectionStatus.className = "api-status-online";
      apiGeneratorWireguardStatus.textContent = "Available";

      const serverResponse = await fetch(
        "/api/opnsense/servers",
        {cache: "no-store"},
      );

      const result = await serverResponse.json();

      if (!serverResponse.ok || !result.connected) {
        apiGeneratorWireguardStatus.textContent = "Unavailable";

        setApiGeneratorMessage(
          result.error ||
          "The WireGuard server list could not be loaded.",
          "error",
        );
        return;
      }

      const servers = normalizeServerList(
        result.servers,
      );

      apiGeneratorServerCount.textContent =
        String(servers.length);

      apiServerSelect.innerHTML = `
        <option value="">
          Select a WireGuard server
        </option>
      `;

      servers.forEach((server, index) => {
        const option = document.createElement("option");

        option.value =
          server.uuid ||
          server.id ||
          server.value ||
          String(index);

        option.textContent =
          serverDisplayName(server, index);

        apiServerSelect.appendChild(option);
      });

      if (servers.length === 0) {
        setApiGeneratorMessage(
          "The OPNsense connection works, but no WireGuard servers were returned by the API.",
          "neutral",
        );

        apiServerCard.hidden = true;
        return;
      }

      apiServerCard.hidden = false;

      setApiGeneratorMessage(
        `${servers.length} WireGuard server${servers.length === 1 ? "" : "s"} available.`,
        "success",
      );

    } catch (_) {
      resetApiGenerator();

      setApiGeneratorMessage(
        "The API Generator could not load the OPNsense connection.",
        "error",
      );

    } finally {
      apiGeneratorRefreshButton.disabled = false;
      apiGeneratorRefreshButton.textContent = "Refresh";
    }
  }


  function setOpnsenseConnectionState({
    status = "Not connected",
    host = "Not configured",
    wireguard = "Not checked",
    message = "No OPNsense connection configured.",
    state = "neutral",
    connected = false,
    wireguardAvailable = null,
  } = {}) {
    opnsenseConnectionStatus.textContent = status;
    opnsenseConnectionHost.textContent = host;
    opnsenseWireguardStatus.textContent = wireguard;

    opnsenseConnectionStatus.className =
      connected ? "api-status-online" : "api-status-offline";

    if (wireguardAvailable === true) {
      opnsenseWireguardStatus.className = "api-status-online";
    } else if (wireguardAvailable === false) {
      opnsenseWireguardStatus.className = "api-status-offline";
    } else {
      opnsenseWireguardStatus.className = "";
    }

    opnsenseConnectionMessage.textContent = message;
    opnsenseConnectionMessage.className = `message ${state}`;
  }


  async function loadSavedOpnsenseConfig() {
    try {
      const response = await fetch(
        "/api/opnsense/config",
        {cache: "no-store"},
      );

      const result = await response.json();

      if (!response.ok || !result.configured) {
        opnsenseRemoveButton.hidden = true;
        opnsenseSaveButton.disabled = true;

        setOpnsenseConnectionState();
        return;
      }

      opnsenseUrl.value = result.url || "";
      opnsenseVerifyTls.checked = Boolean(result.verify_tls);

      opnsenseApiKey.value = "";
      opnsenseApiSecret.value = "";

      opnsenseApiKey.placeholder = "Saved API key";
      opnsenseApiSecret.placeholder = "Saved API secret";

      opnsenseRemoveButton.hidden = false;
      opnsenseSaveButton.disabled = true;

      /*
       * A saved configuration exists, but "saved" does not mean
       * that OPNsense is currently reachable. Verify the real
       * connection state automatically on page load.
       */
      setOpnsenseConnectionState({
        host: result.url || "Configured",
        status: "Checking",
        wireguard: "Checking",
        message: "Checking saved OPNsense connection...",
        state: "neutral",
        connected: false,
        wireguardAvailable: null,
      });

      const statusResponse = await fetch(
        "/api/opnsense/status",
        {cache: "no-store"},
      );

      const statusResult = await statusResponse.json();

      if (!statusResponse.ok || !statusResult.connected) {
        setOpnsenseConnectionState({
          host: result.url || "Configured",
          status: "Unavailable",
          wireguard: "Unavailable",
          message:
            statusResult.error ||
            "The saved OPNsense connection is currently unavailable.",
          state: "error",
          connected: false,
          wireguardAvailable: false,
        });

        return;
      }

      const wireguardResponse = await fetch(
        "/api/opnsense/servers",
        {cache: "no-store"},
      );

      const wireguardResult = await wireguardResponse.json();

      if (!wireguardResponse.ok || !wireguardResult.connected) {
        setOpnsenseConnectionState({
          host:
            statusResult.url ||
            result.url ||
            "Configured",
          status: "Connected",
          wireguard: "Unavailable",
          message:
            wireguardResult.error ||
            "OPNsense is connected, but the WireGuard API is unavailable.",
          state: "error",
          connected: true,
          wireguardAvailable: false,
        });

        return;
      }

      setOpnsenseConnectionState({
        host:
          statusResult.url ||
          result.url ||
          "Configured",
        status: "Connected",
        wireguard: "Available",
        message:
          "Saved OPNsense configuration is connected and available.",
        state: "success",
        connected: true,
        wireguardAvailable: true,
      });

    } catch (_) {
      setOpnsenseConnectionState({
        status: "Unavailable",
        wireguard: "Unavailable",
        message:
          "Saved OPNsense configuration could not be checked.",
        state: "error",
        connected: false,
        wireguardAvailable: false,
      });
    }
  }


  async function saveOpnsenseConfiguration() {
    if (!opnsenseTestSucceeded) {
      return;
    }

    const url = opnsenseUrl.value.trim();
    const apiKey = opnsenseApiKey.value.trim();
    const apiSecret = opnsenseApiSecret.value.trim();

    opnsenseSaveButton.disabled = true;
    opnsenseSaveButton.textContent = "Saving...";

    try {
      const response = await fetch("/api/opnsense/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          api_key: apiKey,
          api_secret: apiSecret,
          verify_tls: opnsenseVerifyTls.checked,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.saved) {
        setOpnsenseConnectionState({
          host: url,
          status: "Not saved",
          wireguard: "Unavailable",
          message: result.error || "Configuration could not be saved.",
          state: "error",
        });

        opnsenseSaveButton.disabled = false;
        return;
      }

      opnsenseTestSucceeded = false;

      opnsenseApiKey.value = "";
      opnsenseApiSecret.value = "";

      opnsenseApiKey.placeholder = "Saved API key";
      opnsenseApiSecret.placeholder = "Saved API secret";

      opnsenseRemoveButton.hidden = false;

      setOpnsenseConnectionState({
        host: result.url || url,
        status: "Connected",
        wireguard: "Available",
        message: "OPNsense configuration was saved successfully and is connected.",
        state: "success",
        connected: true,
        wireguardAvailable: true,
      });

    } catch (_) {
      setOpnsenseConnectionState({
        host: url,
        status: "Not saved",
        wireguard: "Unavailable",
        message: "Configuration could not be saved.",
        state: "error",
      });

    } finally {
      opnsenseSaveButton.textContent = "Save configuration";
    }
  }


  async function removeOpnsenseConfiguration() {
    try {
      const response = await fetch(
        "/api/opnsense/config",
        {method: "DELETE"},
      );

      const result = await response.json();

      if (!response.ok || !result.removed) {
        throw new Error("Remove failed");
      }

      opnsenseTestSucceeded = false;

      opnsenseUrl.value = "";
      opnsenseApiKey.value = "";
      opnsenseApiSecret.value = "";
      opnsenseVerifyTls.checked = true;

      opnsenseApiKey.placeholder = "API key";
      opnsenseApiSecret.placeholder = "API secret";

      opnsenseSaveButton.disabled = true;
      opnsenseRemoveButton.hidden = true;

      setOpnsenseConnectionState();

    } catch (_) {
      setOpnsenseConnectionState({
        message: "Saved configuration could not be removed.",
        state: "error",
      });
    }
  }


  async function testOpnsenseConnection() {
    const url = opnsenseUrl.value.trim();
    const apiKey = opnsenseApiKey.value.trim();
    const apiSecret = opnsenseApiSecret.value.trim();

    if (!url) {
      setOpnsenseConnectionState({
        message: "Enter an OPNsense URL before testing the connection.",
        state: "error",
      });
      return;
    }

    opnsenseTestButton.disabled = true;
    opnsenseTestButton.textContent = "Testing...";

    setOpnsenseConnectionState({
      host: url,
      status: "Connecting",
      wireguard: "Checking",
      message: "Connecting to OPNsense...",
      state: "neutral",
    });

    try {

      /*
       * No credentials entered:
       * test the already saved encrypted server-side configuration.
       */
      if (!apiKey && !apiSecret) {
        const configResponse = await fetch(
          "/api/opnsense/config",
          {cache: "no-store"},
        );

        const configResult = await configResponse.json();

        if (!configResult.configured) {
          setOpnsenseConnectionState({
            host: url,
            status: "Not connected",
            wireguard: "Not checked",
            message: "API key and API secret are required.",
            state: "error",
          });
          return;
        }

        const statusResponse = await fetch(
          "/api/opnsense/status",
          {cache: "no-store"},
        );

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok || !statusResult.connected) {
          setOpnsenseConnectionState({
            host: url,
            status: "Not connected",
            wireguard: "Unavailable",
            message:
              statusResult.error ||
              "Could not connect using the saved OPNsense configuration.",
            state: "error",
            connected: false,
            wireguardAvailable: false,
          });
          return;
        }

        const wireguardResponse = await fetch(
          "/api/opnsense/servers",
          {cache: "no-store"},
        );

        const wireguardResult = await wireguardResponse.json();

        if (!wireguardResponse.ok || !wireguardResult.connected) {
          setOpnsenseConnectionState({
            host: statusResult.url || url,
            status: "Connected",
            wireguard: "Unavailable",
            message: "OPNsense is connected, but the WireGuard API is unavailable.",
            state: "error",
            connected: true,
            wireguardAvailable: false,
          });
          return;
        }

        setOpnsenseConnectionState({
          host: statusResult.url || url,
          status: "Connected",
          wireguard: "Available",
          message: "Connection to OPNsense and the WireGuard API was successful.",
          state: "success",
          connected: true,
          wireguardAvailable: true,
        });

        return;
      }

      /*
       * Only one credential was entered.
       */
      if (!apiKey || !apiSecret) {
        setOpnsenseConnectionState({
          host: url,
          status: "Not connected",
          wireguard: "Not checked",
          message: "Enter both API key and API secret, or leave both empty to test the saved configuration.",
          state: "error",
        });
        return;
      }

      /*
       * New credentials entered:
       * test them before allowing them to be saved.
       */
      const response = await fetch("/api/opnsense/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          api_key: apiKey,
          api_secret: apiSecret,
          verify_tls: opnsenseVerifyTls.checked,
        }),
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.connected) {
        setOpnsenseConnectionState({
          host: url,
          status: "Not connected",
          wireguard: "Unavailable",
          message: result.error || "Could not connect to OPNsense.",
          state: "error",
          wireguardAvailable: false,
        });
        return;
      }

      opnsenseTestSucceeded = true;
      opnsenseSaveButton.disabled = false;

      setOpnsenseConnectionState({
        host: result.url || url,
        status: "Connected",
        wireguard: "Available",
        message: "Connection to OPNsense was successful. The configuration can now be saved.",
        state: "success",
        connected: true,
        wireguardAvailable: true,
      });

    } catch (_) {
      setOpnsenseConnectionState({
        host: url,
        status: "Not connected",
        wireguard: "Unavailable",
        message: "The connection test could not be completed.",
        state: "error",
        connected: false,
        wireguardAvailable: false,
      });

    } finally {
      opnsenseTestButton.disabled = false;
      opnsenseTestButton.textContent = "Test connection";
    }
  }


  opnsenseTestButton.addEventListener(
    "click",
    testOpnsenseConnection,
  );

  opnsenseSaveButton.addEventListener(
    "click",
    saveOpnsenseConfiguration,
  );

  opnsenseRemoveButton.addEventListener(
    "click",
    removeOpnsenseConfiguration,
  );

  loadSavedOpnsenseConfig();




  function openCreateClientModal() {
    if (!apiServerSelect.value) {
      return;
    }

    createClientName.value = "";
    createClientAddress.value = "Assigned by OPNsense";
    createAllowedIps.value = "0.0.0.0/0,::/0";
    createKeepalive.value = "25";
    createUsePsk.checked = true;

    createClientMessage.textContent =
      "OPNsense will assign the next available tunnel address when the client is created.";

    createClientMessage.className =
      "message neutral";

    createClientModal.hidden = false;
    document.body.classList.add("modal-open");

    createClientName.focus();
  }


  function closeCreateClientModal() {
    createClientModal.hidden = true;
    document.body.classList.remove("modal-open");

    apiCreateClientButton.focus();
  }


  async function confirmCreateClient() {
    const serverUuid = apiServerSelect.value;
    const name = createClientName.value.trim();
    const allowedIps = createAllowedIps.value.trim();
    const keepalive = createKeepalive.value.trim();

    if (!name) {
      createClientMessage.textContent =
        "Enter a client name.";

      createClientMessage.className =
        "message error";

      return;
    }

    if (!allowedIps) {
      createClientMessage.textContent =
        "Allowed IPs must not be empty.";

      createClientMessage.className =
        "message error";

      return;
    }

    createClientConfirmButton.disabled = true;
    createClientConfirmButton.textContent =
      "Creating...";

    try {
      const response = await fetch(
        "/api/opnsense/client/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            server: serverUuid,
            name,
            allowed_ips: allowedIps,
            keepalive,
            use_psk: createUsePsk.checked,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.created) {
        createClientMessage.textContent =
          result.error ||
          "The WireGuard client could not be created.";

        createClientMessage.className =
          "message error";

        return;
      }

      closeCreateClientModal();

      deviceInput.value =
        result.client?.name ||
        name;

      configInput.value =
        result.config || "";

      showView("manual");

      await parseConfiguration();

      setMessage(
        `New WireGuard client created successfully with tunnel address ${result.client?.tunnel_address || ""}. `
        + "Download and import the generated configuration now.",
        "success",
      );

    } catch (_) {
      createClientMessage.textContent =
        "The WireGuard client could not be created.";

      createClientMessage.className =
        "message error";

    } finally {
      createClientConfirmButton.disabled = false;
      createClientConfirmButton.textContent =
        "Create & Export";
    }
  }


  apiCreateClientButton.addEventListener(
    "click",
    openCreateClientModal,
  );

  createClientCancelButton.addEventListener(
    "click",
    closeCreateClientModal,
  );

  createClientCloseX.addEventListener(
    "click",
    closeCreateClientModal,
  );

  createClientConfirmButton.addEventListener(
    "click",
    confirmCreateClient,
  );

  createClientModal.addEventListener(
    "click",
    event => {
      if (event.target === createClientModal) {
        closeCreateClientModal();
      }
    },
  );


  function openDeleteClientModal() {
    if (!apiClientSelect.value) {
      return;
    }

    deleteClientName.textContent =
      apiPeerName.textContent || "Selected client";

    deleteClientModal.hidden = false;
    document.body.classList.add("modal-open");

    deleteClientCancelButton.focus();
  }


  function closeDeleteClientModal() {
    deleteClientModal.hidden = true;
    document.body.classList.remove("modal-open");

    apiDeleteButton.focus();
  }


  async function confirmDeleteClient() {
    const clientUuid = apiClientSelect.value;

    if (!clientUuid) {
      closeDeleteClientModal();
      return;
    }

    deleteClientConfirmButton.disabled = true;
    deleteClientConfirmButton.textContent = "Deleting...";

    try {
      const response = await fetch(
        `/api/opnsense/client/${encodeURIComponent(clientUuid)}/delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const result = await response.json();

      if (!response.ok || !result.deleted) {
        closeDeleteClientModal();

        apiClientMessage.textContent =
          result.error ||
          "The WireGuard client could not be deleted.";

        apiClientMessage.className = "message error";
        return;
      }

      closeDeleteClientModal();

      resetPeerDetails();

      apiClientMessage.textContent =
        "WireGuard client deleted successfully.";

      apiClientMessage.className = "message success";

      await loadApiClients();

    } catch (_) {
      closeDeleteClientModal();

      apiClientMessage.textContent =
        "The WireGuard client could not be deleted.";

      apiClientMessage.className = "message error";

    } finally {
      deleteClientConfirmButton.disabled = false;
      deleteClientConfirmButton.textContent =
        "Yes, delete client";
    }
  }


  apiDeleteButton.addEventListener(
    "click",
    openDeleteClientModal,
  );

  deleteClientCancelButton.addEventListener(
    "click",
    closeDeleteClientModal,
  );

  deleteClientCloseX.addEventListener(
    "click",
    closeDeleteClientModal,
  );

  deleteClientConfirmButton.addEventListener(
    "click",
    confirmDeleteClient,
  );

  deleteClientModal.addEventListener(
    "click",
    event => {
      if (event.target === deleteClientModal) {
        closeDeleteClientModal();
      }
    },
  );


  function openRegenerateModal() {
    const clientUuid = apiClientSelect.value;

    if (!clientUuid) {
      return;
    }

    regenerateClientName.textContent =
      apiPeerName.textContent || "Selected client";

    regenerateModal.hidden = false;
    document.body.classList.add("modal-open");

    regenerateCancelButton.focus();
  }


  function closeRegenerateModal() {
    regenerateModal.hidden = true;
    document.body.classList.remove("modal-open");

    apiRegenerateButton.focus();
  }


  apiRegenerateButton.addEventListener(
    "click",
    openRegenerateModal,
  );

  regenerateCancelButton.addEventListener(
    "click",
    closeRegenerateModal,
  );

  regenerateCloseX.addEventListener(
    "click",
    closeRegenerateModal,
  );

  regenerateModal.addEventListener(
    "click",
    event => {
      if (event.target === regenerateModal) {
        closeRegenerateModal();
      }
    },
  );



  async function confirmRegenerateAndExport() {
    const serverUuid = apiServerSelect.value;
    const clientUuid = apiClientSelect.value;
    const allowedIps = apiAllowedIps.value.trim();

    if (!serverUuid || !clientUuid) {
      closeRegenerateModal();
      return;
    }

    if (!allowedIps) {
      closeRegenerateModal();

      apiClientMessage.textContent =
        "Allowed IPs must not be empty.";

      apiClientMessage.className =
        "message error";

      return;
    }

    regenerateConfirmButton.disabled = true;
    regenerateConfirmButton.textContent =
      "Regenerating...";

    try {
      const response = await fetch(
        `/api/opnsense/client/${encodeURIComponent(clientUuid)}/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            server: serverUuid,
            allowed_ips: allowedIps,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.generated) {
        closeRegenerateModal();

        apiClientMessage.textContent =
          result.error ||
          "The WireGuard client could not be regenerated.";

        apiClientMessage.className =
          "message error";

        return;
      }

      closeRegenerateModal();

      /*
       * Reuse the existing Manual Generator export flow.
       * The private key exists only in this generated configuration
       * and is not stored by the application.
       */
      deviceInput.value =
        result.client?.name ||
        "wireguard-client";

      configInput.value =
        result.config || "";

      showView("manual");

      await parseConfiguration();

      setMessage(
        "New WireGuard configuration generated successfully. "
        + "All previous configurations for this client are now invalid. "
        + "Download and import the new configuration.",
        "success",
      );

    } catch (_) {
      closeRegenerateModal();

      apiClientMessage.textContent =
        "The WireGuard client could not be regenerated.";

      apiClientMessage.className =
        "message error";

    } finally {
      regenerateConfirmButton.disabled = false;
      regenerateConfirmButton.textContent =
        "Yes, regenerate & export";
    }
  }


  regenerateConfirmButton.addEventListener(
    "click",
    confirmRegenerateAndExport,
  );


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
    if (event.key !== "Escape") {
      return;
    }

    if (!createClientModal.hidden) {
      closeCreateClientModal();
      return;
    }

    if (!deleteClientModal.hidden) {
      closeDeleteClientModal();
      return;
    }

    if (!regenerateModal.hidden) {
      closeRegenerateModal();
      return;
    }

    if (!aboutModal.hidden) {
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

  qrDropZone.addEventListener("click", () => qrFileInput.click());

  qrDropZone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      qrFileInput.click();
    }
  });

  ["dragenter", "dragover"].forEach(type => {
    qrDropZone.addEventListener(type, event => {
      event.preventDefault();
      qrDropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    qrDropZone.addEventListener(type, event => {
      event.preventDefault();
      qrDropZone.classList.remove("dragover");
    });
  });

  qrDropZone.addEventListener(
    "drop",
    event => loadQrFile(event.dataTransfer.files[0]),
  );

  qrFileInput.addEventListener(
    "change",
    () => loadQrFile(qrFileInput.files[0]),
  );
  configInput.addEventListener("input", scheduleParse);
  deviceInput.addEventListener("input", scheduleParse);
  clearButton.addEventListener("click", resetPage);
  downloadButtons.forEach(button => {
    button.addEventListener("click", () => download(button.dataset.download));
  });

  window.addEventListener("pageshow", resetPage);
})();
