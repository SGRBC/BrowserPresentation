// Viewer for the online mirror (host this folder on GitHub Pages and open client.html on the phone).
// It renders the slides with the same code as the output window (screen.js).
import { applyTheme, renderSlide } from "./screen.js";
import { DEFAULT_SERVER, normalizeServer, isValidCode, subscribe, parseJoin } from "./relay.js";

const $ = (id) => document.getElementById(id);
const KEY = "presentation-client-v1";
const screen = $("screen");

let close = null;
let theme = null;
let state = null;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {};
    const server = normalizeServer(raw.server);
    return server && isValidCode(raw.code) ? { server, code: raw.code } : null;
  } catch { return null; }
}

function setStatus(text) { $("status").textContent = text; }

function show(msg) {
  theme = msg.theme;
  state = msg.state;
  applyTheme(screen, theme);
  renderSlide(screen, state, theme, { mute: true });
  const notice = $("notice");
  notice.hidden = !(state.media && !state.blank);
  notice.textContent = "This slide is a picture, video or presentation slide. It is only shown on the presenter's screen.";
  setStatus(`Live. Updated ${new Date().toLocaleTimeString()}`);
}

function connect(s) {
  if (close) close();
  $("join").hidden = true;
  setStatus("Connecting…");
  close = subscribe(s.server, s.code, {
    onMessage: show,
    onStatus: (st) => {
      if (st === "connected") setStatus(state ? "Live" : "Connected. Waiting for the presenter");
      else setStatus("Connection lost. Reconnecting…");
    },
  });
}

function openJoin(error) {
  const s = load();
  $("code").value = s ? s.code : "";
  $("server").value = s ? s.server : DEFAULT_SERVER;
  $("join-error").hidden = !error;
  $("join-error").textContent = error || "";
  $("join").hidden = false;
  $("code").focus();
}

$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("code").value.trim();
  const server = normalizeServer($("server").value);
  if (!isValidCode(code)) { openJoin("The access code is not valid. Copy it again from the presenter."); return; }
  if (!server) { openJoin("The relay server must be an HTTPS address."); return; }
  localStorage.setItem(KEY, JSON.stringify({ server, code }));
  state = null;
  connect({ server, code });
});

$("change").addEventListener("click", () => openJoin(""));

// ---------- QR code scanner ----------
let scanner = null;

function closeScanner() {
  if (scanner) { scanner.stop(); scanner = null; }
  $("scanner").hidden = true;
}

function scanError(text) {
  $("scan-error").textContent = text;
  $("scan-error").hidden = !text;
}

async function openScanner() {
  $("join").hidden = true;
  $("scanner").hidden = false;
  scanError("");
  try {
    const { startScanner } = await import("./qr.js");
    const handle = await startScanner($("scan-video"), (text) => {
      const join = parseJoin(text);
      if (!join) { scanError("That QR code is not from the presenter's Online mirror."); return false; }
      localStorage.setItem(KEY, JSON.stringify(join));
      closeScanner();
      state = null;
      connect(join);
      return true;
    });
    if ($("scanner").hidden) handle.stop(); else scanner = handle;
  } catch (err) {
    console.error("Scanner failed", err && err.name, err && err.message);
    scanError(err && err.name === "NotAllowedError"
      ? "Camera access was denied. Allow the camera for this site, or enter the code by hand."
      : "The camera could not be started. Enter the code by hand instead.");
  }
}

$("scan").addEventListener("click", openScanner);
$("scan-cancel").addEventListener("click", () => { closeScanner(); openJoin(""); });

if (document.fullscreenEnabled) {
  $("fullscreen").hidden = false;
  $("fullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else screen.requestFullscreen().catch((err) => console.error(err));
  });
}

// A link made by the presenter carries the code in the fragment: store it, then remove it from the address bar.
function readLink() {
  if (!location.hash) return;
  const join = parseJoin(location.hash);
  if (join) localStorage.setItem(KEY, JSON.stringify(join));
  history.replaceState(null, "", location.pathname + location.search);
}

readLink();
const saved = load();
if (saved) connect(saved); else openJoin("");
