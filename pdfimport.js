// Renders every page of a PDF to a picture, in the browser, using the vendored pdf.js (vendor/pdfjs, Apache-2.0).
// A page is drawn exactly as the PDF defines it (layout, fonts, graphics), then stored as an image, so the slide
// looks like the PDF page. Nothing is uploaded: the file never leaves this computer.
// The library, its worker and its data files are loaded only when a PDF is imported, always from this site.
import { ImportError } from "./media.js";

const MAX_FILE = 200 * 1024 * 1024;
export const MAX_PDF_PAGES = 300;
const BOX_W = 2560;      // pages are rendered to fit inside this box (about twice 1080p) ...
const BOX_H = 1440;
const MAX_SCALE = 4;     // ... but never enlarged more than this (small pages stay sharp without huge images)
const JPEG_QUALITY = 0.92;

const BASE = new URL("./vendor/pdfjs/", import.meta.url).href;
let libPromise = null;

function lib() {
  if (!libPromise) {
    libPromise = import("./vendor/pdfjs/pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.min.mjs`;
      return m;
    });
    libPromise.catch(() => { libPromise = null; });
  }
  return libPromise;
}

function toBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encode failed"))), "image/jpeg", JPEG_QUALITY));
}

// Calls `store(blob)` for each page in order (so pages do not pile up in memory) and returns the number of pages.
// onProgress(done, total) is called after each page.
export async function renderPdf(file, store, onProgress = () => {}) {
  if (file.size > MAX_FILE) throw new ImportError("This PDF is too large (200 MB maximum)");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(1024, bytes.length)));
  if (!head.includes("%PDF-")) throw new ImportError("This is not a valid PDF file");

  const pdfjs = await lib();
  const task = pdfjs.getDocument({
    data: bytes,
    standardFontDataUrl: `${BASE}standard_fonts/`,
    wasmUrl: `${BASE}wasm/`,
    iccUrl: `${BASE}iccs/`,
    isEvalSupported: false, // no dynamic code generation
    enableXfa: false,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err && err.name === "PasswordException") throw new ImportError("Password-protected PDFs are not supported");
    if (err && (err.name === "InvalidPDFException" || err.name === "FormatError")) throw new ImportError("This PDF looks damaged or is not a valid PDF");
    throw err;
  }

  try {
    const total = doc.numPages;
    if (total > MAX_PDF_PAGES) throw new ImportError(`Too many pages (${MAX_PDF_PAGES} maximum)`);
    const canvas = document.createElement("canvas");
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(MAX_SCALE, BOX_W / base.width, BOX_H / base.height);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      await page.render({ canvas, viewport }).promise; // white page background, annotations and form fields included
      await store(await toBlob(canvas));
      page.cleanup();
      onProgress(n, total);
    }
    canvas.width = canvas.height = 0;
    return total;
  } finally {
    await task.destroy();
  }
}
