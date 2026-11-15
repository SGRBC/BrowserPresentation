// QR code writing (presenter) and scanning (viewer), using the vendored zxing-wasm library (vendor/zxing, MIT).
// The library and its WASM files are loaded only when needed and always from this site, never from a CDN.

const wasmUrl = (file) => {
  const m = file.match(/_(.+?)\.wasm$/);
  return m ? new URL(`./vendor/zxing/${m[1]}/${file}`, import.meta.url).href : file;
};
const overrides = { locateFile: wasmUrl };

let readerPromise = null;
let writerPromise = null;

function reader() {
  if (!readerPromise) {
    readerPromise = import("./vendor/zxing/reader/index.js").then(async (m) => {
      await m.prepareZXingModule({ overrides, fireImmediately: true });
      return m;
    });
    readerPromise.catch(() => { readerPromise = null; });
  }
  return readerPromise;
}

function writer() {
  if (!writerPromise) {
    writerPromise = import("./vendor/zxing/writer/index.js").then(async (m) => {
      await m.prepareZXingModule({ overrides, fireImmediately: true });
      return m;
    });
    writerPromise.catch(() => { writerPromise = null; });
  }
  return writerPromise;
}

// Returns a PNG Blob of the QR code for `text`.
export async function makeQr(text) {
  const { writeBarcode } = await writer();
  const res = await writeBarcode(text, { format: "QRCode", ecLevel: "M", scale: 6, withQuietZones: true });
  if (res.error || !res.image) throw new Error("QR code could not be created");
  return res.image;
}

// Opens the camera in `video` and calls onText(text) for every QR code it sees, until stop() is called or onText
// returns true. Resolves to { stop }. Needs HTTPS (or localhost) and the user's permission for the camera.
export async function startScanner(video, onText) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("camera-unsupported");
  const [{ readBarcodes }, stream] = await Promise.all([
    reader(),
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
  ]);
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  video.muted = true;
  await video.play();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  const stop = () => {
    stopped = true;
    for (const t of stream.getTracks()) t.stop();
    video.srcObject = null;
  };

  (async () => {
    while (!stopped) {
      if (video.videoWidth > 0) {
        // Scan at most 800 px wide: enough for a QR code and much faster on a phone.
        const scale = Math.min(1, 800 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
            formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 1,
          });
          for (const r of results) {
            if (r.isValid && !stopped && onText(r.text) === true) { stop(); return; }
          }
        } catch (err) { console.error("QR scan failed", err && err.message); }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  })();

  return { stop };
}
