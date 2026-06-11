import { useState, useEffect, useRef } from "react";
import { useGetAgent, getGetAgentQueryKey, useGetAuthMe, getGetAuthMeQueryKey, useTriggerAgent } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, TerminalSquare, Settings, Play, Database,
  Plus, Trash2, ChevronDown, CheckCircle2, Loader2,
  RotateCcw, Mail, Zap
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const AGENT_ID_DISPLAY: Record<string, string> = {
  "hr-agent": "HR-ATS-001",
  "expense-tracker": "FIN-EXP-001",
};

const AGENT_TAGLINE_DISPLAY: Record<string, string> = {
  "hr-agent": "Automatically evaluates, scores, and shortlists AI candidates using ATS-style screening and hiring intelligence.",
  "expense-tracker": "Automatically analyzes weekly spending, identifies financial patterns, and delivers AI-generated expense reports directly to your inbox.",
};

const EXPENSE_CATEGORIES = [
  "Food", "Transport", "Utilities", "Entertainment",
  "Shopping", "Office Supplies", "Healthcare", "Education", "Other",
];

const PROGRESS_STEPS = [
  "Submitting expense data...",
  "Saving to Google Sheets...",
  "Filtering this week's expenses...",
  "AI analyzing spending patterns...",
  "Generating expense report...",
  "Sending email summary...",
];

const STEP_DELAYS = [0, 1000, 2000, 3000, 5000, 7000];

interface ExpenseEntry {
  amount: string;
  category: string;
  description: string;
  date: string;
}

function emptyEntry(): ExpenseEntry {
  return {
    amount: "",
    category: "Food",
    description: "",
    date: new Date().toISOString().split("T")[0],
  };
}

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: agent, isLoading, error } = useGetAgent(slug, {
    query: { enabled: !!slug, queryKey: getGetAgentQueryKey(slug) }
  });

  const { data: user } = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), retry: false }
  });

  const triggerMutation = useTriggerAgent();

  const [panelOpen, setPanelOpen] = useState(false);
  const [entries, setEntries] = useState<ExpenseEntry[]>([emptyEntry()]);
  const [progressStep, setProgressStep] = useState(-1);
  const [result, setResult] = useState<{ summary: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAdmin = !!user;
  const hasWebhook = !!agent?.webhookUrl;
  const isRunning = triggerMutation.isPending || progressStep >= 0;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  function updateEntry(index: number, field: keyof ExpenseEntry, value: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  function addEntry() {
    setEntries(prev => [...prev, emptyEntry()]);
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setEntries([emptyEntry()]);
    setProgressStep(-1);
    setResult(null);
    setRunError(null);
    clearTimers();
    triggerMutation.reset();
  }

  async function handleRun() {
    if (!slug) return;
    setRunError(null);
    setResult(null);
    setProgressStep(0);

    clearTimers();

    STEP_DELAYS.forEach((delay, i) => {
      if (i === 0) return;
      const t = setTimeout(() => {
        setProgressStep(prev => (prev < i && prev >= 0 ? i : prev));
      }, delay);
      timersRef.current.push(t);
    });

    try {
      const data = await triggerMutation.mutateAsync({
        slug,
        data: { entries },
      });
      clearTimers();
      setProgressStep(PROGRESS_STEPS.length);
      setResult({ summary: data.summary });
    } catch (err: unknown) {
      clearTimers();
      setProgressStep(-1);
      const msg = err instanceof Error ? err.message : "Webhook request failed.";
      setRunError(msg);
    }
  }

  const isDone = result !== null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-8 bg-primary/10" />
        <div className="space-y-6">
          <Skeleton className="h-16 w-3/4 bg-primary/10" />
          <Skeleton className="h-24 w-full bg-primary/5" />
          <div className="grid grid-cols-2 gap-6 mt-8">
            <Skeleton className="h-48 w-full bg-primary/5" />
            <Skeleton className="h-48 w-full bg-primary/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block p-6 border border-destructive/20 bg-destructive/5 rounded-lg">
          <p className="text-destructive font-mono mb-4">AGENT_NOT_FOUND: Failed to retrieve profile for [{slug}]</p>
          <Link href="/"><Button variant="outline">Return to Hub</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Link href="/">
        <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Registry
        </Button>
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
                <TerminalSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold text-foreground">{agent.name}</h1>
                <p className="text-sm font-mono text-primary">ID_REF: {AGENT_ID_DISPLAY[agent.slug] ?? agent.slug.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl">{AGENT_TAGLINE_DISPLAY[agent.slug] ?? agent.shortDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" /> Overview
              </h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{agent.description}</p>
            </section>

            <section className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Operational Protocol
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 font-semibold">How It Works</h3>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{agent.howItWorks}</p>
                </div>
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Expected Output</h3>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{agent.expectedOutput}</p>
                </div>
              </div>
            </section>

            <section className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" /> Output Samples
              </h2>
              <Accordion type="single" collapsible className="w-full border-t border-border/50">
                {agent.sampleExamples.map((example, i) => (
                  <AccordionItem value={`item-${i}`} key={i} className="border-border/50">
                    <AccordionTrigger className="hover:text-primary transition-colors font-medium">
                      {example.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <div className="bg-background/80 border border-border rounded p-4">
                          <div className="text-xs text-muted-foreground font-mono mb-2 uppercase">Input Query:</div>
                          <p className="font-mono text-sm">{example.input}</p>
                        </div>
                        <div className="bg-primary/5 border border-primary/20 rounded p-4">
                          <div className="text-xs text-primary/70 font-mono mb-2 uppercase">System Output:</div>
                          <p className="font-mono text-sm whitespace-pre-wrap text-foreground/90">{example.output}</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm sticky top-24">
              <h3 className="font-display font-semibold text-lg mb-4">System Requirements</h3>
              <ul className="space-y-3 mb-8">
                {agent.requirements.split('\n').flatMap(line => line.split(',')).map((req, i) => (
                  req.trim() && (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span>{req.trim()}</span>
                    </li>
                  )
                ))}
              </ul>

              <div className="pt-6 border-t border-border/50">
                {isAdmin && hasWebhook ? (
                  <Button
                    className="w-full shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow gap-2"
                    onClick={() => setPanelOpen(v => !v)}
                    disabled={isRunning}
                  >
                    <Zap className="w-4 h-4" />
                    {panelOpen ? "Close Panel" : "Initialize Agent"}
                    <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", panelOpen && "rotate-180")} />
                  </Button>
                ) : (
                  <Link href="/admin/login">
                    <Button className="w-full shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow">
                      Initialize Agent
                    </Button>
                  </Link>
                )}
                <p className="text-xs text-center text-muted-foreground mt-3 font-mono">
                  {isAdmin ? "Admin access active" : "Requires admin clearance"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Inline Agent Panel ── */}
        <AnimatePresence>
          {panelOpen && isAdmin && hasWebhook && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="mt-8 bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-sm text-primary uppercase tracking-widest">Agent Run Console</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  {agent.name}
                </Badge>
              </div>

              <div className="p-6">
                {/* ── Result state ── */}
                {isDone ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-green-400 text-sm font-mono mb-4">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Workflow complete</span>
                      <span className="flex items-center gap-1 ml-3 text-xs bg-green-400/10 border border-green-400/20 text-green-400 px-2 py-0.5 rounded-full">
                        <Mail className="w-3 h-3" /> Email sent
                      </span>
                    </div>

                    <div className="bg-background/60 border border-border/50 rounded-lg p-5">
                      <div className="text-xs text-primary/70 font-mono uppercase mb-3 flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> AI-Generated Summary
                      </div>
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono">
                        {result.summary}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="border-primary/20 hover:bg-primary/10 hover:text-primary gap-2"
                      onClick={resetForm}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Run Again
                    </Button>
                  </motion.div>

                ) : progressStep >= 0 ? (
                  /* ── Progress state ── */
                  <div className="space-y-3">
                    {PROGRESS_STEPS.map((step, i) => {
                      const isActive = i === progressStep || (progressStep >= PROGRESS_STEPS.length && i === PROGRESS_STEPS.length - 1);
                      const isDoneStep = i < progressStep || progressStep >= PROGRESS_STEPS.length;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: isDoneStep || isActive ? 1 : 0.3, x: 0 }}
                          className="flex items-center gap-3 text-sm"
                        >
                          {isDoneStep ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          ) : isActive ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "font-mono",
                            isDoneStep ? "text-muted-foreground line-through" : isActive ? "text-primary" : "text-muted-foreground/40"
                          )}>
                            {step}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                ) : (
                  /* ── Form state ── */
                  <div className="space-y-6">
                    <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
                      Expense Entries
                    </div>

                    <div className="space-y-4">
                      {entries.map((entry, index) => (
                        <div
                          key={index}
                          className="bg-background/40 border border-border/40 rounded-lg p-4 space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">
                              Entry {(index + 1).toString().padStart(2, "0")}
                            </span>
                            {entries.length > 1 && (
                              <button
                                onClick={() => removeEntry(index)}
                                className="text-muted-foreground/40 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block font-mono">Amount</label>
                              <input
                                type="text"
                                placeholder="e.g. 850"
                                value={entry.amount}
                                onChange={e => updateEntry(index, "amount", e.target.value)}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block font-mono">Date</label>
                              <input
                                type="date"
                                value={entry.date}
                                onChange={e => updateEntry(index, "date", e.target.value)}
                                style={{ colorScheme: "dark" }}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-mono">Category</label>
                            <select
                              value={entry.category}
                              onChange={e => updateEntry(index, "category", e.target.value)}
                              className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                            >
                              {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-mono">Description</label>
                            <input
                              type="text"
                              placeholder="e.g. Team lunch, Office stationery..."
                              value={entry.description}
                              onChange={e => updateEntry(index, "description", e.target.value)}
                              className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border/50 text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                        onClick={addEntry}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Another Entry
                      </Button>
                    </div>

                    {runError && (
                      <div className="text-xs text-destructive font-mono bg-destructive/5 border border-destructive/20 rounded p-3">
                        {runError}
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/40">
                      <Button
                        className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                        onClick={handleRun}
                        disabled={entries.some(e => !e.amount || !e.description)}
                      >
                        <Play className="w-4 h-4" /> Run Agent
                      </Button>
                      <p className="text-[10px] text-muted-foreground font-mono text-center mt-2">
                        Submits to n8n → Google Sheets → GPT-4.1-mini → Gmail
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
