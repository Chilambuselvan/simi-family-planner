/** Extract text from a PDF in the browser, one line per text row. pdfjs is loaded lazily. */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const row = rows.get(y) ?? [];
      row.push({ x: it.transform[4], s: it.str.trim() });
      rows.set(y, row);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map((p) => p.s).join("  ")));
  }
  return lines.join("\n");
}
