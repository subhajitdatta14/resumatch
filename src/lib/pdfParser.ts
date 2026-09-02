import * as pdfjsLib from "pdfjs-dist";

// Configure worker from CDN or local bundle
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

/**
 * Extract text from a PDF file directly in the browser
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: true,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageTextPromises: Promise<string>[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    pageTextPromises.push(
      pdf.getPage(pageNum).then(async (page) => {
        const textContent = await page.getTextContent();
        return textContent.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
      })
    );
  }

  const pageTexts = await Promise.all(pageTextPromises);
  return pageTexts.join("\n\n").trim();
}
