import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are MicrobeLog Assistant, helping hospital staff, R&D professionals and patients understand a SYNTHETIC antimicrobial surveillance dataset (no real patients).
Answer in the same language as the user (Finnish or English), in plain, friendly language. Use short paragraphs, bullet points and small markdown tables.
Use ONLY the data context provided. Resistance % follow the surveillance rule: first isolate per patient per species per specimen type per year, shown only with >= 30 isolates (otherwise say "too few isolates").
Quantity zones: urine >=10^5 CFU/mL red (significant), 10^4 yellow (borderline), 10^3 green (low); wound +++ red, ++ yellow, + green; blood any growth significant.
The dataset has no diagnoses or medication: never diagnose or prescribe; suggest talking to a clinician when relevant.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured.", { status: 500 });
        let body: { messages: { role: "user" | "assistant"; content: string }[]; context: string };
        try { body = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
        const msgs = (body.messages ?? []).slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            instructions: `${SYSTEM}\n\nDATA CONTEXT:\n${String(body.context ?? "").slice(0, 60000)}`,
            input: msgs,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const txt = await upstream.text().catch(() => "");
          let msg = "The assistant is unavailable right now.";
          if (upstream.status === 429) msg = "Too many requests — please wait a moment and try again.";
          else if (upstream.status === 402) msg = "AI credits are used up. Add credits in Settings → Plans & credits.";
          else { try { msg = JSON.parse(txt)?.error?.message ?? msg; } catch { /* ignore */ } }
          return new Response(msg, { status: upstream.status });
        }
        const reader = upstream.body.getReader();
        const dec = new TextDecoder(), enc = new TextEncoder();
        let buf = "";
        const stream = new ReadableStream({
          async pull(ctrl) {
            const { done, value } = await reader.read();
            if (done) { ctrl.close(); return; }
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const l of lines) {
              if (!l.startsWith("data:")) continue;
              const data = l.slice(5).trim(); if (!data || data === "[DONE]") continue;
              try { const ev = JSON.parse(data); if (ev.type === "response.output_text.delta" && ev.delta) ctrl.enqueue(enc.encode(ev.delta)); } catch { /* partial */ }
            }
          },
          cancel() { reader.cancel(); },
        });
        const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
        upstream.headers.forEach((v, k) => { if (k.toLowerCase().startsWith("x-lovable-aig-")) headers.set(k, v); });
        return new Response(stream, { headers });
      },
    },
  },
});
