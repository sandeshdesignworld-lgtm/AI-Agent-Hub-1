import { useState, useEffect, useRef } from "react";
import { useGetAuthMe, useListAgents, useAdminLogout, useTriggerAgent, getGetAuthMeQueryKey, getListAgentsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Activity, Loader2, ChevronRight, Lock, Zap, LogOut,
  Plus, Trash2, Play, CheckCircle2, RotateCcw, Mail,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: authLoading, error: authError } = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), retry: false }
  });

  const { data: agents, isLoading: agentsLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey(), enabled: !!user }
  });

  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  const logoutMutation = useAdminLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuthMeQueryKey() });
        setLocation("/admin/login");
      },
    },
  });

  useEffect(() => {
    if (agents && agents.length > 0 && !activeAgent) {
      setActiveAgent(agents[0].slug);
    }
  }, [agents, activeAgent]);

  useEffect(() => {
    if (authError) setLocation("/admin/login");
  }, [authError, setLocation]);

  /* ── Expense form state ── */
  const triggerMutation = useTriggerAgent();
  const [entries, setEntries] = useState<ExpenseEntry[]>([emptyEntry()]);
  const [progressStep, setProgressStep] = useState(-1);
  const [result, setResult] = useState<{ summary: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  async function handleRun(slug: string) {
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
      const data = await triggerMutation.mutateAsync({ slug, data: { entries } });
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

  /* When switching agents, reset expense form */
  function handleSelectAgent(slug: string) {
    if (slug !== activeAgent) {
      resetForm();
      setActiveAgent(slug);
    }
  }

  const isRunning = triggerMutation.isPending || progressStep >= 0;
  const isDone = result !== null;

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (authError || !user) return null;

  const selectedAgentData = agents?.find(a => a.slug === activeAgent);
  const isExpenseTracker = activeAgent === "expense-tracker" && !!selectedAgentData?.webhookUrl;

  return (
    <div className="flex-1 flex overflow-hidden border-t border-border">
      {/* Sidebar */}
      <aside className="w-72 bg-card/30 border-r border-border/50 flex flex-col">
        <div className="p-4 border-b border-border/50 bg-background/50">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Active Operator</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-medium">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {user.username}
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-card"
              data-testid="button-logout"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <LogOut className="w-3 h-3" />
              )}
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Available Agents</div>

          {agentsLoading ? (
            Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-primary/5 rounded-md" />
            ))
          ) : (
            agents?.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent.slug)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 border",
                  activeAgent === agent.slug
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                data-testid={`select-agent-${agent.slug}`}
              >
                <span className="font-mono text-sm truncate pr-2">{agent.name}</span>
                {activeAgent === agent.slug && (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-background relative flex flex-col overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

        {selectedAgentData ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col p-8"
            >
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-display font-bold text-foreground mb-2 flex items-center gap-3">
                    <Terminal className="w-6 h-6 text-primary" />
                    {selectedAgentData.name}
                  </h2>
                  <p className="text-muted-foreground font-mono text-sm uppercase">
                    Interface Module [{selectedAgentData.slug}]
                  </p>
                </div>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border",
                  isExpenseTracker
                    ? "bg-green-400/10 border-green-400/20 text-green-400"
                    : "bg-primary/10 border-primary/20 text-primary"
                )}>
                  <Activity className="w-4 h-4" />
                  {isExpenseTracker ? "ONLINE" : "STANDBY"}
                </div>
              </div>

              {/* ── Expense Tracker Live Panel ── */}
              {isExpenseTracker ? (
                <div className="flex-1 border border-primary/20 bg-card/20 rounded-xl overflow-hidden backdrop-blur-sm">
                  {/* Panel header */}
                  <div className="px-6 py-4 border-b border-border/50 bg-background/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-mono text-sm text-primary uppercase tracking-widest">Agent Run Console</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      {selectedAgentData.name}
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
                              className="bg-background/40 border border-border/40 rounded-lg p-4 space-y-3 relative"
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

                        <div className="flex items-center gap-3">
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
                            onClick={() => handleRun(selectedAgentData.slug)}
                            disabled={isRunning || entries.some(e => !e.amount || !e.description)}
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
                </div>

              ) : (
                /* ── Coming Soon placeholder for other agents ── */
                <div className="flex-1 border border-border/50 bg-card/20 rounded-xl relative overflow-hidden backdrop-blur-sm flex items-center justify-center">
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                  }} />
                  <div className="relative z-10 text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 mx-auto bg-background border border-primary/30 rounded-full flex items-center justify-center mb-6 relative shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '3s' }} />
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-display font-semibold mb-2">Module Initializing</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      The playground for <span className="text-primary font-medium">{selectedAgentData.name}</span> is currently under construction. Live execution capabilities will be deployed in the next update.
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs font-mono text-primary/70 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                      <Lock className="w-3 h-3" />
                      COMING SOON
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select an agent from the registry to initialize module.
          </div>
        )}
      </main>
    </div>
  );
}
