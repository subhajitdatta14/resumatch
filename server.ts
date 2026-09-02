import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Helper function to extract text from buffer
async function extractTextFromBuffer(buffer: Buffer, originalName = "", mimetype = ""): Promise<string> {
  const nameLower = originalName.toLowerCase();
  const mimeLower = mimetype.toLowerCase();
  const isPdf = 
    mimeLower.includes("pdf") || 
    nameLower.endsWith(".pdf") ||
    (buffer && buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-");

  let extracted = "";

  if (isPdf) {
    console.log("Attempting local PDF parse, buffer size:", buffer.length);
    try {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        extracted = result?.text || "";
      } finally {
        try {
          await parser.destroy();
        } catch {
          // ignore
        }
      }
    } catch (pdfErr) {
      console.warn("Local PDFParse encountered an error:", pdfErr);
    }

    // If local parsing produced empty or minimal text (e.g. image-based or scanned PDF), use Gemini multimodal OCR
    if (!extracted || extracted.trim().length < 20) {
      console.log("Local PDF parse empty or short. Using Gemini multimodal PDF extraction fallback...");
      try {
        const base64Data = buffer.toString("base64");
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data
              }
            },
            "Extract and transcribe all readable text, experience, skills, education, and details from this resume document cleanly and completely."
          ]
        });
        extracted = response.text || "";
        console.log("Gemini PDF extraction succeeded, length:", extracted.length);
      } catch (geminiOcrErr) {
        console.error("Gemini OCR fallback error:", geminiOcrErr);
      }
    }
  } else {
    // Plain text or markdown or code files
    extracted = buffer.toString("utf-8");
  }

  // Clean null bytes and trim
  return extracted.replace(/\0/g, "").trim();
}

// API Routes
app.post("/api/evaluate", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const { name, resumeText, roleName, requirements } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "No resume text provided" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: `Evaluate this candidate for the role of ${roleName || "Unspecified Role"}. 
      
      Candidate Name: ${name || "Unknown Candidate"}
      
      Resume Content:
      ${resumeText}

      Role Requirements: ${requirements || "Unspecified Requirements"}

      Provide a JSON response with:
      1. matchScore (0-100)
      2. strengths (array of strings highlighting key assets)
      3. missingSkills (array of strings)
      4. weakAreas (array of strings)
      5. improvementSuggestions (array of strings)
      6. expertCommentary (a professional, paragraph-style analysis of the candidate's potential)
      7. overallFeedback (string summary)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            weakAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            expertCommentary: { type: Type.STRING },
            overallFeedback: { type: Type.STRING },
          },
          required: ["matchScore", "strengths", "missingSkills", "weakAreas", "improvementSuggestions", "expertCommentary", "overallFeedback"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini API");
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error) {
    console.error("Gemini evaluation error:", error);
    res.status(500).json({ 
      error: "Evaluation failed: " + (error instanceof Error ? error.message : String(error)) 
    });
  }
});

// Support both multipart/form-data and JSON base64 payloads for maximum browser/network compatibility
app.post("/api/parse-resume", upload.single("resume"), async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  console.log("Received upload request:", req.file ? `File: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size}b)` : "JSON payload");
  
  try {
    let buffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "";

    if (req.file) {
      buffer = req.file.buffer;
      fileName = req.file.originalname || "";
      mimeType = req.file.mimetype || "";
    } else if (req.body?.fileBase64) {
      buffer = Buffer.from(req.body.fileBase64, "base64");
      fileName = req.body.fileName || "resume.pdf";
      mimeType = req.body.mimeType || "application/pdf";
    } else if (req.body?.resumeText) {
      return res.json({ text: req.body.resumeText });
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "No file content or text provided." });
    }

    const text = await extractTextFromBuffer(buffer, fileName, mimeType);

    if (!text || text.length === 0) {
      return res.status(400).json({ error: "Extracted document text is empty. Please try pasting the text directly." });
    }

    return res.json({ text });
  } catch (error) {
    console.error("Failed to parse resume:", error);
    return res.status(500).json({ error: "Failed to parse resume: " + (error instanceof Error ? error.message : String(error)) });
  }
});


// Explicit 404 for unhandled API routes to prevent Vite from returning index.html for failed API calls
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Global API error handler ensuring JSON responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled API error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err?.message || "Internal server error" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
