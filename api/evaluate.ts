import { GoogleGenAI, Type } from "@google/genai";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment variables." });
  }

  const { name, resumeText, roleName, requirements } = req.body || {};

  if (!resumeText || !resumeText.trim()) {
    return res.status(400).json({ error: "Resume text is required for evaluation." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a Principal Talent Assessor and Executive Tech Recruiter.
Analyze this resume for the candidate against the specified target role and benchmark rubrics.

Candidate Name: ${name || "Candidate"}
Target Role: ${roleName || "Target Role"}
Custom Job Requirements / Focus Areas: ${requirements || "Standard Industry Benchmarks"}

Candidate Resume Content:
${resumeText}

Provide an objective, calibrated evaluation return JSON matching the schema with:
- matchScore: integer between 0 and 100 representing readiness percentage
- strengths: list of 3-5 verified key candidate strengths
- missingSkills: list of 3-5 critical skills or missing capabilities
- weakAreas: list of 2-4 areas needing improvement
- improvementSuggestions: list of 3-5 actionable recommendations
- expertCommentary: a thorough 2-3 paragraph breakdown of candidate alignment
- overallFeedback: a concise 1-2 sentence executive summary`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: { type: Type.NUMBER },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            missingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            weakAreas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            improvementSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            expertCommentary: { type: Type.STRING },
            overallFeedback: { type: Type.STRING },
          },
          required: [
            "matchScore",
            "strengths",
            "missingSkills",
            "weakAreas",
            "improvementSuggestions",
            "expertCommentary",
            "overallFeedback",
          ],
        },
      },
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Vercel evaluation error:", err);
    return res.status(500).json({
      error: err.message || "Failed to evaluate resume. Please try again.",
    });
  }
}
