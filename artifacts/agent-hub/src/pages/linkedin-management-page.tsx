import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Brain, PenTool, Sparkles, Image, Mail, Share2,
  CheckCircle2, Loader2, RotateCcw, ArrowRight, Network,
  AlertTriangle, Send, Clock,
} from "lucide-react";

/* ── Pipeline nodes ── */
const PIPELINE_NODES = [
  { icon: Brain,    label: "Structure Designer", color: "text-violet-400", glow: "shadow-violet-500/20", border: "border-violet-500/40", bg: "bg-violet-500/10" },
  { icon: PenTool,  label: "Draft Copywriter",   color: "text-cyan-400",   glow: "shadow-cyan-500/20",   border: "border-cyan-500/40",   bg: "bg-cyan-500/10"   },
  { icon: Sparkles, label: "Style Editor",        color: "text-teal-400",   glow: "shadow-teal-500/20",   border: "border-teal-500/40",   bg: "bg-teal-500/10"   },
  { icon: Image,    label: "Image Architect",     color: "text-blue-400",   glow: "shadow-blue-500/20",   border: "border-blue-500/40",   bg: "bg-blue-500/10"   },
  { icon: Mail,     label: "Your Approval",       color: "text-amber-400",  glow: "shadow-amber-500/20",  border: "border-amber-500/40",  bg: "bg-amber-500/10"  },
  { icon: Share2,   label: "LinkedIn Post",       color: "text-green-400",  glow: "shadow-green-500/20",  border: "border-green-500/40",  bg: "bg-green-500/10"  },
];

/* ── Category options ── */
const CATEGORIES = [
  "General Professional",
  "AI & Technology",
  "Leadership & Management",
  "Product Management",
  "Startups & Entrepreneurship",
  "Career Growth",
  "Marketing & Sales",
  "Custom...",
];

/* ── 7-step pipeline progress ── */
const PIPELINE_STEPS: { label: string; icon: typeof Brain }[] = [
  { label: "Submitting topic to content engine...",                  icon: Send    },
  { label: "Topic queued — AI agents activated",                     icon: Network },
  { label: "Structure & Logic Designer is building the blueprint...", icon: Brain   },
  { label: "Draft Copywriter is writing your post...",               icon: PenTool },
  { label: "Style Editor is polishing and formatting...",            icon: Sparkles },
  { label: "Image Architect is creating a custom visual...",         icon: Image   },
  { label: "Content ready — approval email sent!",                   icon: Mail    },
];

/* steps 0–1 are real (API call), steps 2–6 are simulated */
const SIMULATED_START = 2;
const SIMULATED_INTERVAL = 3000;

/* ── Agent info cards ── */
const AGENT_CARDS = [
  {
    icon: Brain,
    title: "Structure & Logic Designer",
    desc: "Analyzes the topic and creates a teaching blueprint with problem statement, core concept, practical approach, and common mistakes. Focuses on the 'why' behind the advice.",
    topColor: "border-t-violet-500/70",
    iconColor: "text-violet-400",
  },
  {
    icon: PenTool,
    title: "Draft Copywriter",
    desc: "Transforms the blueprint into a scroll-stopping LinkedIn post with a punchy hook, scannable formatting, and expert tone. No AI fluff, no buzzwords.",
    topColor: "border-t-cyan-500/70",
    iconColor: "text-cyan-400",
  },
  {
    icon: Sparkles,
    title: "Style & Compliance Editor",
    desc: "Final polish pass — removes em dashes, kills AI clichés, adds hashtags, ensures brand consistency, and adds a strategic engagement question.",
    topColor: "border-t-teal-500/70",
    iconColor: "text-teal-400",
  },
  {
    icon: Image,
    title: "Image Architect",
    desc: "Creates a visual concept using symbolism and metaphor, then generates a professional image with OpenAI gpt-image-1-mini. No stock photos, no text-heavy overlays.",
    topColor: "border-t-blue-500/70",
    iconColor: "text-blue-400",
  },
];

const inputCls = "w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors";
const labelCls = "text-xs text-muted-foreground font-mono mb-1.5 block uppercase tracking-wider";

export function LinkedInManagementPage() {
  const [topic, setTopic]               = useState("");
  const [category, setCategory]         = useState("General Professional");
  const [customCategory, setCustomCategory] = useState("");
  const [audience, setAudience]         = useState("");

  /* -1 = idle, 0-6 = active step index, 7 = done */
  const [step, setStep]                 = useState(-1);
  const [error, setError]               = useState<string | null>(null);
  const [submittedTopic, setSubmittedTopic] = useState("");

  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const isCustom   = category === "Custom...";
  const effectiveCat = isCustom ? (customCategory.trim() || "General Professional") : category;
  const isRunning  = step >= 0 && step < PIPELINE_STEPS.length;
  const isDone     = step >= PIPELINE_STEPS.length;

  function stopSim() {
    if (simulationRef.current) { clearInterval(simulationRef.current); simulationRef.current = null; }
  }

  function reset() {
    stopSim();
    setStep(-1); setError(null); setSubmittedTopic("");
    setTopic(""); setCategory("General Professional"); setCustomCategory(""); setAudience("");
  }

  useEffect(() => () => stopSim(), []);

  async function handleGenerate() {
    const t = topic.trim();
    if (!t) return;
    setError(null);
    setSubmittedTopic(t);
    setStep(0);
    stopSim();

    try {
      const res = await fetch("/api/agents/linkedin-management/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: t, category: effectiveCat, audience: audience.trim() || undefined }),
      });
      const data = await res.json() as { error?: string; status?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      /* API responded — mark steps 0-1 done, start simulating from step 2 */
      setStep(SIMULATED_START);
      let cur = SIMULATED_START;
      simulationRef.current = setInterval(() => {
        cur += 1;
        if (cur >= PIPELINE_STEPS.length) {
          stopSim();
          setStep(PIPELINE_STEPS.length);
        } else {
          setStep(cur);
        }
      }, SIMULATED_INTERVAL);
    } catch (e: unknown) {
      stopSim();
      setStep(-1);
      setError(e instanceof Error ? e.message : "Failed to submit topic");
    }
  }

  return (
    <div className="space-y-10">

      {/* ── Hero ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">LinkedIn Content Engine</h1>
            <p className="text-sm font-mono text-primary">ID_REF: LINKEDIN-TL-001</p>
          </div>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Submit a topic. Four AI agents collaborate to generate thought-leadership content, create a custom visual, and publish to LinkedIn — with your approval.
        </p>
      </div>

      {/* ── Pipeline flow diagram ── */}
      <div className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-5">Multi-Agent Pipeline</div>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {PIPELINE_NODES.map((node, i) => {
              const Icon = node.icon;
              return (
                <div key={i} className="flex items-center gap-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className={cn(
                      "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border shadow-lg",
                      node.bg, node.border, node.glow
                    )}
                  >
                    <Icon className={cn("w-5 h-5", node.color)} />
                    <span className={cn("text-[10px] font-mono font-semibold whitespace-nowrap", node.color)}>
                      {node.label}
                    </span>
                  </motion.div>
                  {i < PIPELINE_NODES.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Form / Progress / Result ── */}
      <div ref={formRef} className="bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-sm text-primary uppercase tracking-widest">Generate Content</span>
        </div>
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* ── FORM ── */}
            {step === -1 && !error && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div>
                  <label className={labelCls}>Topic <span className="text-primary normal-case">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g., Why most AI projects fail before they start"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && topic.trim() && handleGenerate()}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Category / Niche</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className={inputCls}
                      style={{ colorScheme: "dark" }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {isCustom && (
                      <input
                        type="text"
                        placeholder="Enter your niche..."
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        className={cn(inputCls, "mt-2")}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Target Audience</label>
                    <input
                      type="text"
                      placeholder="e.g., CTOs, Product Managers, Founders"
                      value={audience}
                      onChange={e => setAudience(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!topic.trim()}
                  className="gap-2 shadow-[0_0_20px_rgba(var(--primary),0.25)] hover:shadow-[0_0_30px_rgba(var(--primary),0.45)] transition-shadow"
                >
                  <Send className="w-4 h-4" /> Generate Content
                </Button>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {error && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center gap-2 text-destructive text-sm font-mono">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary">
                  <RotateCcw className="w-3.5 h-3.5" /> Try Again
                </Button>
              </motion.div>
            )}

            {/* ── PROGRESS + RESULT ── */}
            {(isRunning || isDone) && !error && (
              <motion.div key="progress" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                {/* Steps stepper */}
                <div className="space-y-3">
                  {PIPELINE_STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const isPast   = isDone || i < step;
                    const isActive = !isDone && i === step;
                    const isAhead  = !isDone && i > step;
                    const isSimulated = i >= SIMULATED_START;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: isAhead ? 0.25 : 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 text-sm"
                      >
                        {isPast ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                        ) : (
                          <Icon className="w-4 h-4 text-muted-foreground/20 flex-shrink-0" />
                        )}
                        <span className={cn(
                          "font-mono flex-1",
                          isPast   ? "text-muted-foreground line-through" :
                          isActive ? "text-primary" :
                          "text-muted-foreground/25"
                        )}>
                          {s.label}
                        </span>
                        {isSimulated && isActive && (
                          <span className="text-[9px] font-mono text-muted-foreground/40 hidden sm:block shrink-0">
                            pipeline running in background
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Result card — shown when done */}
                {isDone && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Status card */}
                    <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="font-mono text-xs text-green-400 uppercase tracking-widest font-semibold">
                          Topic Accepted
                        </span>
                        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400">
                          ✓ Queued
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">📝</span>
                          <span className="text-foreground font-medium">{submittedTopic}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">📧</span>
                          <span className="text-foreground/80 leading-relaxed">
                            An approval email will be sent to your inbox once all 4 agents complete their work. This usually takes 3–5 minutes.
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground font-mono">
                        Approve from email → auto-publishes to LinkedIn. &nbsp; Reject → discards the draft.
                      </div>
                    </div>

                    {/* Pipeline status */}
                    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
                        Pipeline Status
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PIPELINE_NODES.map((node, i) => {
                          const Icon = node.icon;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 text-[11px] font-mono text-amber-400 min-w-0"
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{node.label}</span>
                              <Clock className="w-3 h-3 ml-auto shrink-0 opacity-60" />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/50 mt-2">
                        n8n pipeline is running asynchronously — check your email for the approval request.
                      </p>
                    </div>

                    <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
                      <RotateCcw className="w-3 h-3" /> Submit Another Topic
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 4-Agent info cards ── */}
      <div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">The 4-Agent Pipeline</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AGENT_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  "bg-card/40 border border-border/50 border-t-2 rounded-xl p-5 backdrop-blur-sm",
                  card.topColor
                )}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <Icon className={cn("w-4 h-4 flex-shrink-0", card.iconColor)} />
                  <h3 className={cn("font-display font-semibold text-sm", card.iconColor)}>{card.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
