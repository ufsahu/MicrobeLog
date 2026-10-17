import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Download, RotateCcw } from "lucide-react";
import { PageHeader, Panel } from "@/components/AppShell";
import { microImages } from "@/lib/micro-images";
import { useDB } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/microscopy")({
  validateSearch: (s: Record<string, unknown>) => ({ img: typeof s.img === "string" ? s.img : undefined }),
  head: () => seo("Microscopy & image analysis", "Gram-stain sample images with built-in ImageJ-style filters, thresholding, particle counting and measurement."),
  component: Microscopy,
});

type Op = "gray" | "invert" | "blur" | "sharpen" | "edges" | "threshold" | "equalize";

function convolve(d: ImageData, k: number[], div = 1) {
  const { width: w, height: h, data } = d; const out = new Uint8ClampedArray(data.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
    let s = 0; let i = 0;
    for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) s += data[((y + ky) * w + x + kx) * 4 + c] * k[i++];
    out[(y * w + x) * 4 + c] = s / div;
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return new ImageData(out, w, h);
}
const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
function otsu(hist: number[], total: number) {
  let sum = 0; hist.forEach((v, i) => (sum += i * v));
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  return th;
}

function Microscopy() {
  const { img } = Route.useSearch();
  const { t, lang } = useLang();
  const { data: db } = useDB();
  const [sel, setSel] = useState(microImages.findIndex((m) => m.key === img) >= 0 ? microImages.findIndex((m) => m.key === img) : 0);
  const [brightness, setB] = useState(0);
  const [contrast, setC] = useState(1);
  const [ops, setOps] = useState<Op[]>([]);
  const [thr, setThr] = useState<number | null>(null);
  const [umPerPx, setUm] = useState(0.05);
  const [hist, setHist] = useState<number[]>([]);
  const [particles, setParticles] = useState<{ count: number; meanArea: number; coverage: number } | null>(null);
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const m = microImages[sel];

  useEffect(() => { const im = new Image(); im.onload = () => { source.current = im; render(); }; im.src = m.src; setOps([]); setParticles(null); setLine(null); /* eslint-disable-next-line */ }, [sel]);
  useEffect(() => { render(); /* eslint-disable-next-line */ }, [brightness, contrast, ops, thr, line]);

  function render() {
    const cv = canvas.current, im = source.current; if (!cv || !im) return;
    const S = 640; cv.width = S; cv.height = S;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(im, 0, 0, S, S);
    let d = ctx.getImageData(0, 0, S, S);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = (px[i + c] - 128) * contrast + 128 + brightness;
    for (const op of ops) {
      if (op === "gray") for (let i = 0; i < px.length; i += 4) { const l = lum(d.data, i); d.data[i] = d.data[i + 1] = d.data[i + 2] = l; }
      if (op === "invert") for (let i = 0; i < d.data.length; i += 4) for (let c = 0; c < 3; c++) d.data[i + c] = 255 - d.data[i + c];
      if (op === "blur") d = convolve(d, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16);
      if (op === "sharpen") d = convolve(d, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
      if (op === "equalize") {
        const h = new Array(256).fill(0); for (let i = 0; i < d.data.length; i += 4) h[Math.round(lum(d.data, i))]++;
        const cdf: number[] = []; h.reduce((a, v, i) => (cdf[i] = a + v), 0); const n = S * S, mn = cdf.find((v) => v > 0)!;
        for (let i = 0; i < d.data.length; i += 4) for (let c = 0; c < 3; c++) d.data[i + c] = ((cdf[d.data[i + c]] - mn) / (n - mn)) * 255;
      }
      if (op === "edges") {
        const g = new Float32Array(S * S); for (let i = 0; i < S * S; i++) g[i] = lum(d.data, i * 4);
        const out = new Uint8ClampedArray(d.data.length);
        for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
          const p = (dx: number, dy: number) => g[(y + dy) * S + x + dx];
          const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
          const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
          const v = Math.min(255, Math.hypot(gx, gy)); const i = (y * S + x) * 4; out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
        }
        d = new ImageData(out, S, S);
      }
      if (op === "threshold") {
        const h = new Array(256).fill(0); for (let i = 0; i < d.data.length; i += 4) h[Math.round(lum(d.data, i))]++;
        const th = thr ?? otsu(h, S * S);
        for (let i = 0; i < d.data.length; i += 4) { const v = lum(d.data, i) < th ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
      }
    }
    ctx.putImageData(d, 0, 0);
    const h = new Array(256).fill(0); for (let i = 0; i < d.data.length; i += 4) h[Math.round(lum(d.data, i))]++; setHist(h);
    if (line) { ctx.strokeStyle = "#f2734b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(line.x1, line.y1); ctx.lineTo(line.x2, line.y2); ctx.stroke(); }
  }

  function analyzeParticles() {
    const cv = canvas.current!; const S = cv.width; const ctx = cv.getContext("2d")!;
    ctx.drawImage(source.current!, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data; const g = new Uint8Array(S * S); const h = new Array(256).fill(0);
    for (let i = 0; i < S * S; i++) { const l = Math.round(lum(d, i * 4)); h[l]++; g[i] = l; }
    const th = thr ?? otsu(h, S * S);
    const mask = new Uint8Array(S * S); for (let i = 0; i < S * S; i++) mask[i] = g[i] < th && g[i] > 15 ? 1 : 0; // dark objects, exclude black vignette
    const lab = new Int32Array(S * S); const areas: number[] = []; const stack: number[] = [];
    for (let i = 0; i < S * S; i++) if (mask[i] && !lab[i]) {
      let a = 0; stack.push(i); lab[i] = areas.length + 1;
      while (stack.length) { const p = stack.pop()!; a++; const x = p % S, y = (p / S) | 0;
        for (const q of [x > 0 ? p - 1 : -1, x < S - 1 ? p + 1 : -1, y > 0 ? p - S : -1, y < S - 1 ? p + S : -1]) if (q >= 0 && mask[q] && !lab[q]) { lab[q] = lab[i]; stack.push(q); } }
      areas.push(a);
    }
    const valid = areas.filter((a) => a >= 12);
    setParticles({ count: valid.length, meanArea: valid.reduce((s, a) => s + a, 0) / (valid.length || 1), coverage: (100 * valid.reduce((s, a) => s + a, 0)) / (S * S) });
    render();
  }

  const toggle = (o: Op) => setOps((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  const down = useRef<{ x: number; y: number } | null>(null);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 640, y: ((e.clientY - r.top) / r.height) * 640 }; };
  const lenPx = line ? Math.hypot(line.x2 - line.x1, line.y2 - line.y1) : 0;
  const maxH = Math.max(1, ...hist);
  const orgIdx = db?.meta.organisms.indexOf(m.organism) ?? -1;
  const linked = db && orgIdx >= 0 ? db.isolates.filter((i) => i.org === orgIdx).length : 0;
  const opLabels: Record<Op, string> = lang === "en"
    ? { gray: "8-bit grayscale", invert: "Invert", blur: "Gaussian blur", sharpen: "Sharpen", edges: "Find edges (Sobel)", threshold: "Auto threshold (Otsu)", equalize: "Enhance contrast" }
    : { gray: "8-bit harmaasävy", invert: "Käänteinen", blur: "Gaussin sumennus", sharpen: "Terävöitys", edges: "Reunat (Sobel)", threshold: "Automaattinen kynnys (Otsu)", equalize: "Kontrastin parannus" };

  return (
    <>
      <PageHeader title={t("microscopy")} sub={lang === "en" ? "Sample Gram-stain images (illustrative, AI-generated) linked to organisms in isolates.csv. Draw on the image to measure length." : "Esimerkkikuvia Gram-värjäyksistä (havainnollistavia, tekoälyn tuottamia), linkitetty isolates.csv:n mikrobeihin. Piirrä kuvaan mitataksesi pituuden."}
        right={<a href="https://ij.imjoy.io/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">ImageJ.JS <ExternalLink className="h-4 w-4" /></a>} />
      <div className="mb-4 grid grid-cols-4 gap-2">
        {microImages.map((im, i) => (
          <button key={im.key} onClick={() => setSel(i)} className={`overflow-hidden rounded-xl border-2 text-left ${sel === i ? "border-accent" : "border-transparent"}`}>
            <img src={im.src} alt={im.organism} loading="lazy" width={1024} height={1024} className="aspect-square w-full object-cover" />
            <div className="truncate bg-card px-2 py-1 text-xs italic">{im.organism}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel title={<span className="italic">{m.organism}</span>} right={<span className="text-xs text-muted-foreground">Gram {m.gram} · {lang === "en" ? m.shape_en : m.shape_fi} · {linked} {t("isolates_n").toLowerCase()}</span>}>
          <canvas ref={canvas} className="aspect-square w-full touch-none rounded-lg bg-muted"
            onPointerDown={(e) => { down.current = pos(e); }}
            onPointerMove={(e) => { if (down.current) { const p = pos(e); setLine({ x1: down.current.x, y1: down.current.y, x2: p.x, y2: p.y }); } }}
            onPointerUp={() => { down.current = null; }} />
        </Panel>
        <div className="space-y-4">
          <Panel title={lang === "en" ? "Process" : "Käsittely"} right={<button onClick={() => { setOps([]); setB(0); setC(1); setThr(null); setLine(null); setParticles(null); }} aria-label="reset"><RotateCcw className="h-4 w-4" /></button>}>
            <label className="block text-xs text-muted-foreground">Brightness {brightness}<input type="range" min={-100} max={100} value={brightness} onChange={(e) => setB(+e.target.value)} className="w-full accent-primary" /></label>
            <label className="block text-xs text-muted-foreground">Contrast {contrast.toFixed(1)}<input type="range" min={0.2} max={3} step={0.1} value={contrast} onChange={(e) => setC(+e.target.value)} className="w-full accent-primary" /></label>
            <label className="block text-xs text-muted-foreground">Threshold {thr ?? "auto"}<input type="range" min={0} max={255} value={thr ?? 128} onChange={(e) => setThr(+e.target.value)} className="w-full accent-primary" /></label>
            <div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(opLabels) as Op[]).map((o) => (
              <button key={o} onClick={() => toggle(o)} className={`rounded-md border px-2 py-1 text-xs ${ops.includes(o) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{opLabels[o]}</button>))}</div>
          </Panel>
          <Panel title={lang === "en" ? "Histogram" : "Histogrammi"}>
            <div className="flex h-20 items-end gap-px">{hist.filter((_, i) => i % 4 === 0).map((v, i) => <div key={i} className="flex-1 bg-primary" style={{ height: `${(100 * v) / maxH}%` }} />)}</div>
          </Panel>
          <Panel title={lang === "en" ? "Analyze" : "Analyysi"}>
            <button onClick={analyzeParticles} className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">{lang === "en" ? "Analyze particles" : "Analysoi partikkelit"}</button>
            {particles && <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div><dt className="text-muted-foreground">Count</dt><dd className="font-display text-lg font-semibold">{particles.count}</dd></div><div><dt className="text-muted-foreground">Mean area µm²</dt><dd className="font-display text-lg font-semibold">{(particles.meanArea * umPerPx * umPerPx * 2.56).toFixed(2)}</dd></div><div><dt className="text-muted-foreground">%Area</dt><dd className="font-display text-lg font-semibold">{particles.coverage.toFixed(1)}</dd></div></dl>}
            <label className="mt-3 block text-xs text-muted-foreground">Scale (µm / px)<input type="number" step={0.01} value={umPerPx} onChange={(e) => setUm(+e.target.value)} className="mt-1 h-8 w-full rounded border border-input bg-card px-2 text-sm text-foreground" /></label>
            {line && <p className="mt-2 text-sm">{lang === "en" ? "Line" : "Viiva"}: {lenPx.toFixed(0)} px ≈ <b>{(lenPx * umPerPx * 1.6).toFixed(2)} µm</b></p>}
            <button onClick={() => { const a = document.createElement("a"); a.href = canvas.current!.toDataURL("image/png"); a.download = `${m.key}-processed.png`; a.click(); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><Download className="h-4 w-4" />PNG → ImageJ / Fiji</button>
          </Panel>
        </div>
      </div>
    </>
  );
}
