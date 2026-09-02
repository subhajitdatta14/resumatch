import { PDFParse } from "pdf-parse";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileBase64, fileName, mimeType } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: "No file content provided" });
    }

    const buffer = Buffer.from(fileBase64, "base64");
    const isPdf = (mimeType && mimeType.includes("pdf")) || (fileName && fileName.toLowerCase().endsWith(".pdf"));

    let extractedText = "";

    if (isPdf) {
      try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        extractedText = result?.text || "";
        await parser.destroy();
      } catch (pdfErr: any) {
        console.warn("PDF-parse failed in serverless, falling back to string:", pdfErr);
        extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      }
    } else {
      extractedText = buffer.toString("utf-8");
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ error: "Unable to extract text from file" });
    }

    return res.status(200).json({ text: extractedText.trim() });
  } catch (err: any) {
    console.error("Vercel parse-resume error:", err);
    return res.status(500).json({
      error: err.message || "Failed to process resume file on server.",
    });
  }
}
