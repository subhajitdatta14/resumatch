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

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/subhajit14/resumatch
Install dependencies:
code
Bash
npm install
Configure environment variables:
Create a .env file in the root directory:
code
Env
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Credentials (Client-side)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
Start the local development server:
code
Bash
npm run dev
Open http://localhost:3000 in your browser.
🗄️ Database Setup (Supabase)
Run the following SQL snippet inside your Supabase SQL Editor to create the evaluations table:
code
SQL
create table public.evaluations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  candidate_name text default 'Candidate',
  resume_text text not null,
  role text not null,
  score numeric not null,
  feedback jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.evaluations enable row level security;

-- Create policy to allow users to view only their own records
create policy "Users can view their own evaluations"
  on public.evaluations for select
  using (auth.uid() = user_id);

-- Create policy to allow users to insert their own records
create policy "Users can insert their own evaluations"
  on public.evaluations for insert
  with check (auth.uid() = user_id);

-- Create policy to allow users to delete their own records
create policy "Users can delete their own evaluations"
  on public.evaluations for delete
  using (auth.uid() = user_id);
🌐 Deploying to Vercel
Import your Git repository into Vercel.
Framework Preset: Select Vite.
Environment Variables: Add the following keys in your Vercel Project Settings:
GEMINI_API_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
Click Deploy. Vercel will automatically configure the /api serverless functions and host the static application.
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
