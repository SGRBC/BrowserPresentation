// Online mirror: lets the presenter (index.html) send the slide that is on screen to a phone (client.html).
// BroadcastChannel only works inside one browser on one device, so the slide is sent through an HTTPS publish/subscribe
// relay (ntfy, https://ntfy.sh by default, or your own ntfy server). The topic name is derived from a random access code
// that only the presenter and the viewer know. Only text, colours and the blank flag are sent; stored pictures, videos,
// presentation slides and background images stay on the presenter's computer.

const KEY = "presentation-relay-v1";
export const DEFAULT_SERVER = "https://ntfy.sh";
const CODE_RE = /^[A-Za-z0-9_-]{24,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FONT_RE = /^[\w\s,"'-]{1,100}$/;
const MAX_BYTES = 3800;        // ntfy accepts messages up to 4096 bytes
const MAX_TEXT = 4000;
const TIMEOUT_MS = 8000;

export function isValidCode(code) { return typeof code === "string" && CODE_RE.test(code); }

// 24 random bytes (192 bits) as URL-safe base64.
export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns a clean https base URL without trailing slash, or "" if the value is not acceptable.
export function normalizeServer(value) {
  const v = String(value || "").trim() || DEFAULT_SERVER;
  let u;
  try { u = new URL(v); } catch { return ""; }
  if (u.protocol !== "https:" || u.username || u.password) return "";
  return (u.origin + u.pathname).replace(/\/+$/, "");
}

function topicUrl(server, code) { return `${server}/bp-${code}`; }

// ---------- presenter side ----------
export function loadSettings() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* use defaults */ }
  return {
    enabled: raw.enabled === true,
    server: normalizeServer(raw.server) || DEFAULT_SERVER,
    code: isValidCode(raw.code) ? raw.code : "",
    viewerUrl: typeof raw.viewerUrl === "string" && normalizeViewerUrl(raw.viewerUrl) ? raw.viewerUrl : "",
  };
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify({
    enabled: s.enabled === true, server: s.server, code: s.code, viewerUrl: normalizeViewerUrl(s.viewerUrl) ? s.viewerUrl : "",
  }));
}

function normalizeViewerUrl(value) {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.origin + u.pathname : "";
  } catch { return ""; }
}

// The code and server as "code=...&server=...". Used in the link fragment and in the QR code.
export function joinParams(s) {
  const params = new URLSearchParams({ code: s.code });
  if (s.server !== DEFAULT_SERVER) params.set("server", s.server);
  return params.toString();
}

// Link to open on the phone. The code and server are in the fragment (#...), which browsers never send to any server.
export function viewerLink(s) {
  const base = normalizeViewerUrl(s.viewerUrl);
  if (!base || !s.code) return "";
  return `${base}#${joinParams(s)}`;
}

// What the QR code holds: the full viewer link when its address is known, otherwise just the join parameters.
export function qrText(s) {
  return s.code ? viewerLink(s) || joinParams(s) : "";
}

// Reads a link, a "#code=..." fragment or bare "code=..." text (from the address bar or a scanned QR code).
// Returns { code, server } or null. The input is untrusted, so both values are validated.
export function parseJoin(text) {
  const t = String(text || "").trim().slice(0, 500);
  const hash = t.indexOf("#");
  const params = new URLSearchParams(hash >= 0 ? t.slice(hash + 1) : t.replace(/^\?/, ""));
  const code = params.get("code") || "";
  const server = normalizeServer(params.get("server") || DEFAULT_SERVER);
  return isValidCode(code) && server ? { code, server } : null;
}

// msg: { state, theme } exactly as sent to the output window.
export function buildPayload(msg) {
  const s = msg.state || {};
  const t = msg.theme || {};
  const payload = {
    v: 1,
    state: {
      title: String(s.title || "").slice(0, 300),
      author: String(s.author || "").slice(0, 300),
      isTitle: Boolean(s.isTitle),
      text: String(s.text || "").slice(0, MAX_TEXT),
      blank: Boolean(s.blank),
      media: Boolean(s.video || s.image),
    },
    theme: {
      background: t.background, color: t.color, fontFamily: t.fontFamily, fontSize: t.fontSize,
      autoFit: Boolean(t.autoFit), align: t.align, uppercase: Boolean(t.uppercase),
    },
  };
  let json = JSON.stringify(payload);
  while (new TextEncoder().encode(json).length > MAX_BYTES && payload.state.text.length > 0) {
    payload.state.text = payload.state.text.slice(0, Math.floor(payload.state.text.length * 0.8));
    json = JSON.stringify(payload);
  }
  return json;
}

// Sends the newest slide only: if several arrive while a request is running, the older ones are skipped.
export function createPublisher(onStatus) {
  let busy = false;
  let pending = null;
  async function run() {
    busy = true;
    while (pending) {
      const msg = pending;
      pending = null;
      const s = loadSettings();
      if (!s.enabled || !s.code) { onStatus("Off"); continue; }
      try {
        const res = await fetch(topicUrl(s.server, s.code), {
          method: "POST",
          body: buildPayload(msg),
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        onStatus(`Online. Last slide sent at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error("Online mirror: send failed", err && err.message);
        onStatus("Could not send to the relay (offline, rate limited or wrong server)");
      }
    }
    busy = false;
  }
  return { send(msg) { pending = msg; if (!busy) run(); } };
}

// ---------- viewer side ----------
// Validates everything received from the relay: it is untrusted input.
export function parsePayload(raw) {
  let p;
  try { p = JSON.parse(raw); } catch { return null; }
  if (!p || p.v !== 1 || typeof p.state !== "object" || typeof p.theme !== "object" || !p.state || !p.theme) return null;
  const s = p.state, t = p.theme;
  if (typeof s.text !== "string" || typeof s.title !== "string" || typeof s.author !== "string") return null;
  const size = Number(t.fontSize);
  return {
    state: {
      title: s.title.slice(0, 300),
      author: s.author.slice(0, 300),
      isTitle: s.isTitle === true,
      text: s.text.slice(0, MAX_TEXT),
      blank: s.blank === true,
      media: s.media === true,
    },
    theme: {
      background: COLOR_RE.test(t.background) ? t.background : "#000000",
      color: COLOR_RE.test(t.color) ? t.color : "#ffffff",
      fontFamily: typeof t.fontFamily === "string" && FONT_RE.test(t.fontFamily) ? t.fontFamily : "sans-serif",
      fontSize: Number.isFinite(size) ? Math.max(1, Math.min(100, size)) : 7,
      autoFit: t.autoFit === true,
      align: ["left", "center", "right"].includes(t.align) ? t.align : "center",
      uppercase: t.uppercase === true,
    },
  };
}

// Returns a function that closes the connection. EventSource reconnects by itself; "since=latest" makes the relay
// send the most recent slide on every (re)connect, so a phone that was asleep catches up immediately.
export function subscribe(server, code, { onMessage, onStatus }) {
  const es = new EventSource(`${topicUrl(server, code)}/sse?since=latest`);
  es.onopen = () => onStatus("connected");
  es.onerror = () => onStatus("reconnecting");
  es.addEventListener("message", (e) => {
    try {
      const outer = JSON.parse(e.data);
      if (!outer || outer.event !== "message" || typeof outer.message !== "string") return;
      const p = parsePayload(outer.message);
      if (p) onMessage(p);
    } catch { /* ignore malformed events */ }
  });
  return () => es.close();
}
