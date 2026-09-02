import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  User, 
  Code, 
  History, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Loader2,
  Plus,
  Upload,
  LogOut,
  Calendar,
  Zap,
  Target,
  Trophy,
  Trash2,
  Sun,
  Moon,
  Copy,
  Check,
  FileCheck,
  Layers,
  Cpu,
  Database,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  SlidersHorizontal,
  RefreshCw,
  X,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Mail,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { extractTextFromPdf } from "./lib/pdfParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Types
interface Evaluation {
  id: string;
  user_id: string;
  candidate_name: string;
  resume_text: string;
  role: string;
  score: number;
  feedback: any;
  created_at: string;
}

interface AIResult {
  matchScore: number;
  strengths: string[];
  missingSkills: string[];
  weakAreas: string[];
  improvementSuggestions: string[];
  expertCommentary: string;
  overallFeedback: string;
}

const ROLES = [
  { 
    id: "frontend", 
    name: "Frontend Developer", 
    icon: Layers,
    skills: ["React", "TypeScript", "Tailwind CSS", "Next.js", "State Management"],
    requirements: "React, TypeScript, Tailwind CSS, Responsive Design, State Management, Core Web Vitals" 
  },
  { 
    id: "backend", 
    name: "Backend Developer", 
    icon: Database,
    skills: ["Node.js", "PostgreSQL / SQL", "REST / GraphQL", "Authentication", "Microservices"],
    requirements: "Node.js, Express, SQL, NoSQL, API Design, Authentication, Caching" 
  },
  { 
    id: "fullstack", 
    name: "Fullstack Developer", 
    icon: Code,
    skills: ["React + Node", "System Design", "Cloud / DevOps", "APIs", "Database Modeling"],
    requirements: "React, Node.js, Database Management, System Architecture, Deployment, CI/CD" 
  },
  { 
    id: "data", 
    name: "Data Scientist", 
    icon: Cpu,
    skills: ["Python", "Machine Learning", "Data Visualization", "SQL / Pandas", "Statistics"],
    requirements: "Python, Machine Learning, Statistics, Data Visualization, SQL, PyTorch/TensorFlow" 
  },
  { 
    id: "mobile", 
    name: "Mobile Developer", 
    icon: Smartphone,
    skills: ["React Native", "Flutter / Swift", "Mobile UI/UX", "Offline Storage", "Native APIs"],
    requirements: "React Native, Flutter, iOS/Android Native, Mobile UI/UX, App Store Deployment" 
  },
];

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<"input" | "result" | "history" | "auth">("auth");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    skills: "",
    cgpa: "",
    projects: "",
    resumeText: "",
    role: ROLES[0].id,
    customRequirements: ""
  });
  const [result, setResult] = useState<AIResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [analysisStep, setAnalysisStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setAnalysisStep(0);
      interval = setInterval(() => {
        setAnalysisStep(prev => (prev < 3 ? prev + 1 : 0));
      }, 1200);
    } else {
      setAnalysisStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const copyReport = () => {
    if (!result) return;
    const selectedRole = ROLES.find(r => r.id === formData.role)?.name || "Target Role";
    const text = `RESUMATCH - RESUME REVIEW
Candidate: ${formData.name || "Candidate"}
Target Role: ${selectedRole}
Match Score: ${result.matchScore}%

OVERALL FEEDBACK:
${result.expertCommentary}

KEY STRENGTHS:
${result.strengths.map(s => `• ${s}`).join("\n")}

AREAS TO IMPROVE:
${result.missingSkills.map(s => `• ${s}`).join("\n")}

RECOMMENDED NEXT STEPS:
${result.improvementSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

SUMMARY:
"${result.overallFeedback}"`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setView("input");
        fetchHistory(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView("input");
        fetchHistory(session.user.id);
      } else {
        setView("auth");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const deleteEvaluation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setLoading(true);
    try {
      if (!supabase) {
        throw new Error("Supabase is not configured properly.");
      }

      console.log("Initiating delete for ID:", id);
      
      const { error, data } = await supabase
        .from("evaluations")
        .delete()
        .eq("id", id)
        .select();
      
      if (error) {
        console.error("Supabase deletion error:", error);
        throw error;
      }
      
      console.log("Supabase deletion successful, records affected:", data?.length);
      
      // Update local state
      setHistory(prev => {
        const filtered = prev.filter(item => item.id !== id);
        console.log("History updated locally. Remaining items:", filtered.length);
        return filtered;
      });
      
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error("Critical error during deletion:", error);
      alert(`System Error: ${error.message || "Could not delete from database. Please check your connection or permissions."}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#080d0a] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(82,121,111,0.15),transparent_50%)]" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="glass border-white/10 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-amber-600/20 border border-amber-500/30 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white font-serif">Configuration Required</CardTitle>
              <CardDescription className="text-gray-400">Supabase environment variables are missing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-300 text-center leading-relaxed">
                To enable authentication and historical evaluation records, configure your Supabase credentials in your hosting platform (e.g. <strong>Site configuration &gt; Environment variables</strong> in Netlify, or in your local environment):
              </p>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400">VITE_SUPABASE_URL</span>
                  <span className="text-gray-500 text-[10px]">Project URL</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400">VITE_SUPABASE_ANON_KEY</span>
                  <span className="text-gray-500 text-[10px]">Anon / Public Key</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Once added, trigger a redeploy or refresh to load the sign-in portal.
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full bg-[#52796f] hover:bg-[#416159] text-white font-semibold rounded-xl h-11 transition-all shadow-lg shadow-emerald-950/40"
              >
                Reload Application
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const fetchHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for confirmation!");
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewReport = () => {
    setFormData({
      name: "",
      skills: "",
      cgpa: "",
      projects: "",
      resumeText: "",
      role: ROLES[0].id,
      customRequirements: ""
    });
    setResult(null);
    setView("input");
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime/type;base64, prefix
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setResult(null);

    try {
      const isPlainText = 
        file.type === "text/plain" || 
        file.name.endsWith(".txt") || 
        file.name.endsWith(".md") || 
        file.name.endsWith(".json");

      if (isPlainText) {
        const text = await file.text();
        if (!text || text.trim().length === 0) {
          throw new Error("The uploaded file is empty.");
        }
        setFormData(prev => ({ ...prev, resumeText: text.trim() }));
        return;
      }

      let parsedText = "";

      // Step 1: Direct client-side PDF parsing (Fastest, zero-latency, zero server errors)
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        try {
          const clientExtracted = await extractTextFromPdf(file);
          if (clientExtracted && clientExtracted.trim().length > 0) {
            parsedText = clientExtracted.trim();
          }
        } catch (clientErr) {
          console.warn("Client-side PDF extraction note:", clientErr);
        }
      }

      // Step 2: Server-side fallback if client-side extraction didn't yield text
      if (!parsedText) {
        try {
          const base64 = await fileToBase64(file);
          const res = await fetch("/api/parse-resume", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileBase64: base64,
              fileName: file.name,
              mimeType: file.type || "application/pdf",
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.text) {
              parsedText = data.text;
            }
          }
        } catch (serverErr) {
          console.warn("Server fallback parse attempt note:", serverErr);
        }
      }

      if (parsedText && parsedText.trim().length > 0) {
        setFormData(prev => ({ ...prev, resumeText: parsedText.trim() }));
      } else {
        throw new Error("Could not extract readable text from this file. Please paste your resume text directly into the box below.");
      }
    } catch (error: any) {
      console.error("Upload process encountered error:", error);
      alert(error.message || "Failed to upload file. Please paste your resume text manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setLoading(true);

    const selectedRole = ROLES.find(r => r.id === formData.role);
    const requirements = formData.customRequirements || selectedRole?.requirements;

    // Set a 35-second client timeout to prevent hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      console.log("Submitting resume for evaluation...");
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          name: formData.name,
          resumeText: formData.resumeText,
          roleName: selectedRole?.name,
          requirements: requirements,
        }),
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let aiData: AIResult;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || `Evaluation failed with status ${response.status}`);
        }
        aiData = json as AIResult;
      } else {
        const rawText = await response.text();
        throw new Error(rawText && rawText.length < 200 ? rawText : `Evaluation failed with status ${response.status}`);
      }

      setResult(aiData);

      // Save to Supabase
      try {
        const { error } = await supabase.from("evaluations").insert({
          user_id: session.user.id,
          candidate_name: formData.name || "Unknown Candidate",
          resume_text: formData.resumeText,
          role: selectedRole?.name,
          score: aiData.matchScore,
          feedback: aiData
        });

        if (error) console.error("Save to Supabase failed:", error);
      } catch (dbErr) {
        console.warn("Non-fatal Supabase sync note:", dbErr);
      }

      fetchHistory(session.user.id);
      setView("result");
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Evaluation failed:", error);
      if (error.name === "AbortError") {
        alert("The request took longer than expected. Please verify your GEMINI_API_KEY in your hosting dashboard and try again.");
      } else {
        alert(error.message || "Evaluation failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === "auth") {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden transition-colors duration-500",
        theme === "dark" ? "bg-[#080d0a]" : "bg-[#f4f7f4]"
      )}>
        {/* Animated Background Blobs with Sage/Emerald Hues */}
        <div className={cn(
          "absolute top-[-10%] left-[-10%] w-[50%] h-[50%] blur-[80px] md:blur-[120px] rounded-full animate-pulse",
          theme === "dark" ? "bg-[#2f4f4f]/30" : "bg-emerald-600/10"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] blur-[80px] md:blur-[120px] rounded-full animate-pulse",
          theme === "dark" ? "bg-[#354f52]/25" : "bg-[#84a98c]/15"
        )} />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl relative z-10"
        >
          <div className="text-center mb-8 md:mb-12 space-y-3">
            <h1 className={cn(
              "magazine-title text-4xl md:text-6xl tracking-tight",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>ResuMatch</h1>
            <p className="text-emerald-400 uppercase tracking-[0.25em] md:tracking-[0.3em] text-[9px] md:text-xs font-semibold">AI Resume Reviewer</p>
          </div>

          <Card className={cn(
            "backdrop-blur-3xl border shadow-2xl rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 transition-all duration-500",
            theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-black/[0.02] border-black/10"
          )}>
            <CardHeader className="p-0 mb-8">
              <CardTitle className={cn(
                "text-2xl font-serif italic",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}>
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription className={cn(
                theme === "dark" ? "text-gray-400/70" : "text-gray-500/70"
              )}>
                {authMode === "login" ? "Sign in to review resumes and view your saved feedback." : "Create an account to save your reviews and track improvements."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-400">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input 
                      type="email" 
                      placeholder="you@example.com"
                      className={cn(
                        "h-14 pl-12 focus:border-emerald-500/50 transition-all rounded-xl",
                        theme === "dark" 
                          ? "bg-white/[0.03] border-white/10 focus:bg-white/[0.05] hover:bg-white/[0.06] hover:border-white/20" 
                          : "bg-black/[0.03] border-black/10 focus:bg-black/[0.05] hover:bg-black/[0.06] hover:border-black/20"
                      )}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-400">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input 
                      type="password" 
                      placeholder="••••••••"
                      className={cn(
                        "h-14 pl-12 focus:border-emerald-500/50 transition-all rounded-xl",
                        theme === "dark" 
                          ? "bg-white/[0.03] border-white/10 focus:bg-white/[0.05] hover:bg-white/[0.06] hover:border-white/20" 
                          : "bg-black/[0.03] border-black/10 focus:bg-black/[0.05] hover:bg-black/[0.06] hover:border-black/20"
                      )}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {authError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {authError}
                </div>
              )}

              <Button 
                onClick={handleAuth}
                disabled={loading}
                className="w-full h-14 bg-[#52796f] hover:bg-[#416159] text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-950/30 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === "login" ? "Sign In" : "Create Account")}
              </Button>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                  className="text-xs text-gray-400 hover:text-emerald-400 transition-colors font-medium"
                >
                  {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </CardContent>
          </Card>
          
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 selection:bg-emerald-500/30",
      theme === "dark" ? "bg-[#080d0a] text-gray-200" : "bg-[#f7f9f7] text-gray-900"
    )}>
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse",
          theme === "dark" ? "bg-[#2f4f4f]/15" : "bg-emerald-600/5"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse",
          theme === "dark" ? "bg-[#354f52]/15" : "bg-[#84a98c]/8"
        )} />
      </div>

      {/* Full Screen Loading Animation */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-64 h-64">
              {/* Eye-catching scanning animation */}
              <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-3xl overflow-hidden">
                <motion.div 
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="loading-scan"
                />
              </div>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full"
                  />
                  <Target className="absolute inset-0 m-auto w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className={cn(
                    "magazine-title text-2xl tracking-wide",
                    theme === "dark" ? "text-white" : "text-white"
                  )}>Reviewing Resume</h3>
                  <p className="text-emerald-400 text-xs font-medium tracking-wide animate-pulse">Analyzing experience and matching skills...</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500",
        theme === "dark" ? "border-white/5 bg-black/40" : "border-black/5 bg-white/60"
      )}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center cursor-pointer group" onClick={handleNewReport}>
            <div className="flex flex-col">
              <span className={cn(
                "font-serif font-bold text-lg md:text-xl tracking-tight leading-none group-hover:text-emerald-400 transition-colors",
                theme === "dark" ? "text-white" : "text-black"
              )}>RESUMATCH</span>
              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">Resume Matcher</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleNewReport} 
                className={cn(
                  "px-2 md:px-4 text-xs md:text-sm h-9 md:h-10 rounded-xl transition-all", 
                  view === "input" && (theme === "dark" ? "bg-white/5 text-emerald-300 font-semibold" : "bg-black/5 text-emerald-700 font-semibold")
                )}
              >
                <Plus className="w-4 h-4 md:hidden" />
                <span className="hidden md:inline">New Review</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setView("history")} 
                className={cn(
                  "px-2 md:px-4 text-xs md:text-sm h-9 md:h-10 rounded-xl transition-all", 
                  view === "history" && (theme === "dark" ? "bg-white/5 text-emerald-300 font-semibold" : "bg-black/5 text-emerald-700 font-semibold")
                )}
              >
                <History className="w-4 h-4 md:hidden" />
                <span className="hidden md:inline">History</span>
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6 bg-white/10 hidden lg:block" />
            
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-medium text-gray-300">{session?.user?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium">Account</p>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => supabase.auth.signOut()} 
                className="w-9 h-9 md:w-10 md:h-10 rounded-full border-white/10 hover:bg-red-500/10 hover:text-red-500 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-16">
        <AnimatePresence mode="wait">
          {view === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-10"
            >
              {/* Workspace Header */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
                <div className="space-y-3 max-w-2xl">
                  <h1 className={cn(
                    "magazine-title text-4xl md:text-5xl lg:text-6xl tracking-tight leading-none",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    Resume <span className="text-[#84a98c]">Reviewer</span>
                  </h1>
                  <p className={cn(
                    "text-sm md:text-base font-light leading-relaxed",
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  )}>
                    Get instant, actionable feedback on how well your resume matches your target role and what you can improve.
                  </p>
                </div>

                {/* Progress & Quick Stats */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className={cn(
                    "px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 text-gray-300" : "bg-black/[0.02] border-black/10 text-gray-700"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", formData.resumeText ? "bg-emerald-400" : "bg-amber-400")} />
                    <span>{formData.resumeText ? "Resume Added" : "No Resume Added"}</span>
                  </div>
                  <div className={cn(
                    "px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 text-gray-300" : "bg-black/[0.02] border-black/10 text-gray-700"
                  )}>
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{ROLES.find(r => r.id === formData.role)?.name}</span>
                  </div>
                </div>
              </div>

              {/* Main 2-Column Responsive Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Column: Candidate & Resume Ingestion */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Step 1: Candidate Identity */}
                  <div className="glass-panel p-6 border-emerald-900/20 dark:border-emerald-500/10 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#52796f]/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">Your Name</h2>
                          <p className="text-xs text-gray-400 font-light">Add a name for your personalized review</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-500/30">
                        Step 01
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-400">Full Name (Optional)</Label>
                      <Input 
                        placeholder="e.g. Alex Rivera"
                        className={cn(
                          "h-12 rounded-xl transition-all font-medium",
                          theme === "dark" 
                            ? "bg-white/[0.03] border-white/10 focus:border-emerald-500/60 text-white placeholder:text-gray-600" 
                            : "bg-black/[0.02] border-black/10 focus:border-emerald-500/60 text-black placeholder:text-gray-400"
                        )}
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Step 2: Resume Ingestion */}
                  <div className="glass-panel p-6 border-emerald-900/20 dark:border-emerald-500/10 shadow-lg space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">Resume Content</h2>
                          <p className="text-xs text-gray-400 font-light">Upload a file or paste your resume text</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-teal-300 border-teal-500/30">
                        Step 02
                      </Badge>
                    </div>

                    {/* Mode Selector */}
                    <div className="grid grid-cols-2 p-1 bg-white/[0.03] border border-white/10 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                          activeTab === "upload" 
                            ? "bg-[#52796f] text-white shadow-md" 
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("paste")}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                          activeTab === "paste" 
                            ? "bg-[#52796f] text-white shadow-md" 
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Paste Text</span>
                      </button>
                    </div>

                    {/* Upload Mode */}
                    {activeTab === "upload" && (
                      <div className="space-y-4">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={cn(
                            "border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all cursor-pointer group relative overflow-hidden",
                            isDragging 
                              ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]" 
                              : "border-white/10 bg-white/[0.01] hover:border-emerald-500/40 hover:bg-emerald-500/[0.02]"
                          )}
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".pdf,.txt,.md,.json"
                            onChange={handleFileUpload}
                          />
                          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3.5 group-hover:scale-110 transition-transform border border-white/10 text-gray-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30">
                            <Upload className="w-6 h-6" />
                          </div>
                          <h3 className="text-base font-semibold text-gray-200 mb-1">
                            Choose or drag & drop resume file
                          </h3>
                          <p className="text-xs text-gray-400 font-light mb-4">
                            Supported formats: <span className="font-mono text-emerald-400/90">PDF</span>, <span className="font-mono text-emerald-400/90">TXT</span>, <span className="font-mono text-emerald-400/90">Markdown</span>
                          </p>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Private & securely processed
                          </div>
                        </div>

                        {/* Extracted Status Banner */}
                        {formData.resumeText && (
                          <motion.div 
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                                <FileCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-emerald-300">Resume uploaded successfully</p>
                                <p className="text-[11px] text-emerald-400/70 font-mono">
                                  {formData.resumeText.length.toLocaleString()} characters • ~{Math.round(formData.resumeText.split(/\s+/).length)} words
                                </p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({ ...prev, resumeText: "" }));
                              }}
                              className="h-8 px-2.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Clear
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Paste Mode */}
                    {activeTab === "paste" && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs text-gray-400">
                          <span>Paste your resume text below</span>
                          <span className="font-mono text-[11px] text-emerald-400/80">
                            {formData.resumeText ? `${formData.resumeText.length} chars` : "0 chars"}
                          </span>
                        </div>
                        <Textarea 
                          placeholder="Paste your work experience, skills, projects, and education text here..."
                          className={cn(
                            "min-h-[280px] font-sans text-sm border-white/10 focus:border-emerald-500/60 rounded-xl p-4 leading-relaxed",
                            theme === "dark" ? "bg-white/[0.02] text-gray-200" : "bg-black/[0.02] text-gray-900"
                          )}
                          value={formData.resumeText}
                          onChange={e => setFormData(prev => ({ ...prev, resumeText: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Benchmark Target & Action Deck */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Step 3: Target Role Benchmark */}
                  <div className="glass-panel p-6 border-emerald-900/20 dark:border-emerald-500/10 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#84a98c]/20 border border-[#84a98c]/30 flex items-center justify-center text-[#84a98c]">
                          <Target className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">Target Role</h2>
                          <p className="text-xs text-gray-400 font-light">Choose the role you want to match against</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-[#84a98c] border-[#84a98c]/30">
                        Step 03
                      </Badge>
                    </div>

                    {/* Role Selection Grid */}
                    <div className="space-y-2.5">
                      {ROLES.map(role => {
                        const Icon = role.icon || Layers;
                        const isSelected = formData.role === role.id;
                        return (
                          <div
                            key={role.id}
                            onClick={() => setFormData(prev => ({ ...prev, role: role.id }))}
                            className={cn(
                              "p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 group relative",
                              isSelected 
                                ? "bg-[#52796f]/20 border-emerald-400/50 shadow-md shadow-emerald-950/20" 
                                : "bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                  isSelected ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-gray-400 group-hover:text-gray-200"
                                )}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <h3 className={cn("text-xs font-bold", isSelected ? "text-white" : "text-gray-300")}>
                                    {role.name}
                                  </h3>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {role.skills.slice(0, 3).map((sk, idx) => (
                                      <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono">
                                        {sk}
                                      </span>
                                    ))}
                                    {role.skills.length > 3 && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono">
                                        +{role.skills.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center border transition-all",
                                isSelected ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/20 text-transparent"
                              )}>
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Job Requirements Accordion/Card */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                          Job Description or Specific Requirements
                        </Label>
                        <span className="text-[10px] text-gray-500 uppercase">Optional</span>
                      </div>
                      <Textarea 
                        placeholder="Paste any specific job description, company requirements, or skills you want to highlight..."
                        className={cn(
                          "min-h-[80px] text-xs border-white/10 focus:border-emerald-500/50 rounded-xl p-3",
                          theme === "dark" ? "bg-white/[0.02] text-white placeholder:text-gray-600" : "bg-black/[0.02] text-black placeholder:text-gray-400"
                        )}
                        value={formData.customRequirements}
                        onChange={e => setFormData(prev => ({ ...prev, customRequirements: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Execution Action Deck */}
                  <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-500/[0.03] space-y-4 shadow-xl">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Review Readiness</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {formData.resumeText ? (formData.name ? "100% Ready" : "90% Ready") : "Awaiting Resume"}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#52796f] to-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: formData.resumeText ? (formData.name ? "100%" : "85%") : "20%" }}
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleEvaluate}
                      disabled={loading || !formData.resumeText}
                      className="w-full h-14 bg-[#52796f] hover:bg-[#416159] text-white rounded-xl text-base font-bold shadow-xl shadow-emerald-950/40 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2.5">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Reviewing Resume...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-emerald-300" />
                          <span>Review My Resume</span>
                          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                        </div>
                      )}
                    </Button>
                    <p className="text-[11px] text-center text-gray-400 font-light">
                      Instant feedback and actionable recommendations • ~3-5s
                    </p>
                  </div>

                </div>
              </div>
            </motion.div>
          )}

          {/* Results View: Modern Executive Intelligence Report */}
          {view === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {/* Executive Top Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNewReport}
                  className="text-xs text-gray-400 hover:text-white gap-2 h-9 rounded-lg"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Reviewer
                </Button>
                
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyReport}
                    className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-white/10 rounded-lg text-gray-300 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Summary"}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleNewReport}
                    className="h-9 px-4 bg-[#52796f] hover:bg-[#416159] text-white text-xs font-bold gap-1.5 rounded-lg shadow-md shadow-emerald-950/30"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Review
                  </Button>
                </div>
              </div>

              {/* Report Header Hero Card */}
              <div className="glass-panel p-6 md:p-8 border-emerald-900/30 dark:border-emerald-500/20 bg-gradient-to-br from-[#0e1712] via-[#09100c] to-[#0d1611] shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                      <Target className="w-3 h-3" /> Resume Match Report
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-white">
                      {formData.name || "Resume Review"}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 uppercase font-semibold text-[10px]">Target Role:</span>
                        <span className="text-emerald-300 font-medium">{ROLES.find(r => r.id === formData.role)?.name}</span>
                      </div>
                      <span className="text-gray-600">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 uppercase font-semibold text-[10px]">Reviewed On:</span>
                        <span className="text-gray-300">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Radial Match Score Card */}
                  <div className="flex items-center gap-5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="relative w-24 h-24 shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-white/10" />
                        <motion.circle
                          cx="48"
                          cy="48"
                          r="40"
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="6"
                          strokeDasharray={251.2}
                          initial={{ strokeDashoffset: 251.2 }}
                          animate={{ strokeDashoffset: 251.2 - (251.2 * result.matchScore) / 100 }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="text-emerald-400 stroke-current"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black tracking-tight text-emerald-400 font-mono">{result.matchScore}%</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Match</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase font-bold tracking-wider text-gray-400">Match Level</p>
                      <p className="text-sm font-bold text-white">
                        {result.matchScore >= 85 ? "Excellent Fit" : result.matchScore >= 70 ? "Good Match" : result.matchScore >= 50 ? "Moderate Match" : "Needs Improvement"}
                      </p>
                      <p className="text-[11px] text-gray-400 font-light">
                        {result.matchScore >= 70 ? "Strong alignment with role expectations" : "Adding key skills will boost your match score"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Grid: Insights & Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Summary + Strengths/Gaps */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Summary Card */}
                  <div className="glass-panel p-6 md:p-8 space-y-4 border-emerald-900/20 dark:border-emerald-500/10">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Overview & Summary
                    </h2>
                    <p className="text-base leading-relaxed font-light text-gray-200">
                      {result.expertCommentary}
                    </p>
                  </div>

                  {/* Strengths & Missing Skills Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Strengths Card */}
                    <div className="glass-panel p-6 space-y-4 border-emerald-500/20 bg-emerald-500/[0.02]">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Key Strengths
                      </h3>
                      <div className="space-y-2.5">
                        {result.strengths.map((strength, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-300 leading-relaxed">{strength}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Missing Skills Card */}
                    <div className="glass-panel p-6 space-y-4 border-amber-500/20 bg-amber-500/[0.02]">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-amber-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Skills to Add or Highlight
                      </h3>
                      <div className="space-y-2.5">
                        {result.missingSkills.map((skill, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">{skill}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right Column: Recommendations & Final Notes */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Action Steps */}
                  <div className="glass-panel p-6 space-y-4 border-emerald-900/20 dark:border-emerald-500/10">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Recommended Next Steps
                    </h3>
                    <div className="space-y-4">
                      {result.improvementSuggestions.map((suggestion, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#52796f]/20 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-xs text-gray-300 leading-relaxed">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Takeaway */}
                  <div className="glass-panel p-6 space-y-3 border-white/10 bg-white/[0.02]">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Final Takeaway</h3>
                    <p className="text-xs italic text-gray-300 leading-relaxed border-l-2 border-emerald-500/40 pl-3">
                      "{result.overallFeedback}"
                    </p>
                  </div>

                  <Button 
                    onClick={handleNewReport} 
                    className="w-full h-12 rounded-xl bg-[#52796f] hover:bg-[#416159] text-white font-bold text-xs shadow-lg shadow-emerald-950/40 uppercase tracking-wider"
                  >
                    Review Another Resume
                  </Button>

                </div>
              </div>
            </motion.div>
          )}

          {/* History / Archive View */}
          {view === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-8"
            >
              {/* Archive Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                    <History className="w-3 h-3" /> Past Reviews
                  </div>
                  <h1 className={cn(
                    "magazine-title text-3xl md:text-5xl",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    Review <span className="text-[#84a98c]">History</span>
                  </h1>
                  <p className="text-xs md:text-sm font-light text-gray-400">
                    Access and compare all your previously saved resume reviews.
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <p className="text-2xl font-bold font-mono text-emerald-400">
                      {history.length}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Saved Reviews</p>
                  </div>
                  <Separator orientation="vertical" className="h-8 bg-white/10 hidden md:block" />
                  <Button 
                    onClick={handleNewReport} 
                    className="h-10 px-5 bg-[#52796f] text-white hover:bg-[#416159] rounded-xl font-bold text-xs shadow-lg shadow-emerald-950/40"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> New Review
                  </Button>
                </div>
              </div>

              {/* Archive Cards Grid */}
              {history.length === 0 ? (
                <div className="text-center py-24 space-y-5">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10 text-gray-500">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-gray-200">No Saved Reviews Yet</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Run your first resume review to save and track your progress over time.
                    </p>
                  </div>
                  <Button 
                    onClick={handleNewReport} 
                    className="bg-[#52796f] hover:bg-[#416159] text-white text-xs font-semibold h-10 px-5 rounded-xl"
                  >
                    Start a Review
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -4 }}
                      className="group cursor-pointer"
                      onClick={() => {
                        setResult(item.feedback);
                        setFormData({
                          name: item.candidate_name,
                          skills: "",
                          cgpa: "",
                          projects: "",
                          resumeText: item.resume_text,
                          role: item.role,
                          customRequirements: ""
                        });
                        setView("result");
                      }}
                    >
                      <div className="h-full flex flex-col justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all shadow-lg space-y-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-gray-500 uppercase">
                                ID: {item.id.slice(0, 8)}
                              </span>
                              <h3 className="text-lg font-serif font-bold text-white group-hover:text-emerald-300 transition-colors">
                                {item.candidate_name}
                              </h3>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-[#52796f]/20 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-sm text-emerald-300">
                                {item.score}%
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(confirmDeleteId === item.id ? null : item.id);
                                }}
                                className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Delete Confirmation Alert */}
                          {confirmDeleteId === item.id && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center justify-between text-xs"
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-red-400 font-medium text-[11px]">Delete this review?</span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2.5 text-[10px] font-bold"
                                  onClick={(e) => deleteEvaluation(item.id, e)}
                                >
                                  Delete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[10px] text-gray-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </motion.div>
                          )}

                          <div className="space-y-2 text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                              <Target className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-gray-300 font-medium">{item.role}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-500" />
                              <span>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400/80 font-medium">
                          <span>View Full Review</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
