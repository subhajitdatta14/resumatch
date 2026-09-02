# ResuMatch — AI Resume Reviewer & Match Engine

**ResuMatch** is a full-stack, AI-powered resume evaluation and job alignment platform. It compares candidate resumes against industry job rubrics and custom job descriptions to provide instant match scores, verified strengths, skill gaps, and actionable recommendations.

---

## ✨ Features

- 📄 **Instant Document Parsing**: Fast, browser-side and server-side PDF extraction with zero formatting loss.
- 🎯 **Target Role Benchmarking**: Compare candidate resumes against predefined role rubrics (Full Stack, Backend, Frontend, DevOps, ML/AI, Product Management, UI/UX, etc.) or custom job descriptions.
- 📊 **Calibrated Match Scoring**: Detailed match score (0–100%) with qualitative alignment tier classification.
- 💡 **Executive Commentary & Roadmaps**:
  - Key Strengths
  - Missing Capabilities & Skill Gaps
  - Weak / Unsubstantiated Areas
  - Strategic Next Steps & Improvement Plan
- 📜 **Review History & Archiving**: Persistent history backed by Supabase to track progress across multiple reviews over time.
- 🔒 **Secure & Private**: Zero public credential exposure, with private document parsing and encrypted database storage.
- 🌓 **Dark & Light Mode**: High-contrast, responsive user interface.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **PDF Extraction**: `pdfjs-dist` (Client-side) & `pdf-parse` (Serverless fallback)
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Database & Auth**: Supabase (PostgreSQL)
- **Hosting & Backend**: Vercel Serverless Functions (`/api/*`) / Express Node.js

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed on your machine
- A Google Gemini API Key 
- A Supabase project 

---

📁 Project Structure
code
Code
├── api/                   # Vercel Serverless Function entry points
│   ├── evaluate.ts        # AI resume evaluation & scoring endpoint
│   └── parse-resume.ts    # Server-side PDF fallback parser
├── src/
│   ├── components/ui/     # UI primitives (Buttons, Inputs, Cards, etc.)
│   ├── lib/
│   │   ├── pdfParser.ts   # Client-side PDF extraction via pdfjs-dist
│   │   ├── supabase.ts    # Supabase client initialization
│   │   └── utils.ts       # Utility helper functions
│   ├── App.tsx            # Main application component & state workflow
│   └── main.tsx           # React DOM entry point
├── server.ts              # Local Express development server
├── vercel.json            # Vercel routing & rewrite configuration
└── package.json           # Dependencies and build scripts
