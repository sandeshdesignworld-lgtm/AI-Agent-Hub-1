import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGetAgent, getGetAgentQueryKey, useGetAuthMe, getGetAuthMeQueryKey, useTriggerAgent } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, TerminalSquare, Settings, Play, Database,
  Plus, Trash2, ChevronDown, CheckCircle2, Loader2,
  RotateCcw, Mail, Zap, AlertTriangle, Upload, FileText, X,
  User, Phone, MapPin, GraduationCap, PhoneCall, PhoneOff, PhoneMissed,
  RefreshCw, ChevronRight
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { HospitalReceptionistPage } from "./hospital-receptionist-page";
import { LinkedInManagementPage } from "./linkedin-management-page";
import { AiServiceInquiryPage } from "./ai-service-inquiry-page";
import { OnboardingAgentPage } from "./onboarding-agent-page";


/* ── Expense Tracker constants ── */
const EXPENSE_CATEGORIES = [
  "Food", "Transport", "Utilities", "Entertainment",
  "Shopping", "Office Supplies", "Healthcare", "Education", "Other",
];

const EXPENSE_STEPS = [
  "Submitting expense data...",
  "Saving to Google Sheets...",
  "Filtering this week's expenses...",
  "AI analyzing spending patterns...",
  "Generating expense report...",
  "Sending email summary...",
];
const EXPENSE_DELAYS = [0, 1000, 2000, 3000, 5000, 7000];

interface ExpenseEntry {
  amount: string;
  category: string;
  description: string;
  date: string;
}

function emptyExpenseEntry(): ExpenseEntry {
  return { amount: "", category: "Food", description: "", date: new Date().toISOString().split("T")[0] };
}

/* ── Deadline Tracker constants ── */
const DEADLINE_STEPS = [
  "Saving tasks to Google Sheets...",
  "Fetching all pending tasks...",
  "Filtering by status...",
  "Aggregating task data...",
  "AI classifying deadlines (Today / Upcoming / Overdue)...",
  "Generating email digest...",
  "Sending email digest...",
];
const DEADLINE_DELAYS = [0, 1500, 3000, 5000, 7000, 10000, 13000];

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Pending", "In Progress", "Completed"];

interface DeadlineEntry {
  task: string;
  lastDate: string;
  piority: string;
  status: string;
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function emptyDeadlineEntry(): DeadlineEntry {
  return { task: "", lastDate: tomorrow(), piority: "High", status: "Pending" };
}

/* ── HR Bot constants ── */
const HR_STEPS = [
  "Uploading resume...",
  "Saving to Google Drive...",
  "Converting PDF to text...",
  "AI analyzing candidate profile...",
  "Scoring against ATS criteria...",
  "Logging results to Google Sheets...",
  "Processing final decision...",
];
const HR_DELAYS = [0, 5000, 15000, 30000, 55000, 75000, 95000];

interface HRResult {
  candidate_name?: string;
  email?: string;
  phone?: string;
  degree_detected?: string;
  location_detected?: string;
  relocate_detected?: boolean | string;
  keywords_hit?: string[];
  degree_score?: number;
  keywords_score?: number;
  experience_score?: number;
  location_score?: number;
  relocate_score?: number;
  total_score?: number;
  status?: "Shortlisted" | "Needs Review" | "Rejected" | string;
  raw?: string;
}

/* ── Score Ring ── */
function ScoreRing({ score, max = 100 }: { score: number; max?: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score, 0), max) / max;
  const strokeDashoffset = circumference * (1 - pct);
  const color = score >= 65 ? "#4ade80" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
        <motion.circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground font-mono">/{max}</span>
      </div>
    </div>
  );
}

/* ── Score Bar ── */
function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ── Candidate Analysis Card ── */
function CandidateAnalysisCard({ result }: { result: HRResult }) {
  const status = result.status ?? "Needs Review";
  const total = result.total_score ?? 0;
  const statusColor =
    status === "Shortlisted" ? { text: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30", bar: "#4ade80" } :
    status === "Rejected"    ? { text: "text-red-400",   bg: "bg-red-400/10",   border: "border-red-400/30",   bar: "#f87171" } :
                               { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30", bar: "#fbbf24" };

  const bars = [
    { label: "Degree",      value: result.degree_score ?? 0,     max: 30, color: "#818cf8" },
    { label: "Keywords",    value: result.keywords_score ?? 0,   max: 25, color: "#22d3ee" },
    { label: "Experience",  value: result.experience_score ?? 0, max: 20, color: "#a78bfa" },
    { label: "Location",    value: result.location_score ?? 0,   max: 15, color: "#34d399" },
    { label: "Relocation",  value: result.relocate_score ?? 0,   max: 10, color: "#fb923c" },
  ];

  const keywords: string[] = Array.isArray(result.keywords_hit) ? result.keywords_hit : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header: name + score ring + status */}
      <div className="flex items-start gap-4 p-4 bg-background/60 border border-border/50 rounded-xl">
        <ScoreRing score={total} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display font-semibold text-lg text-foreground truncate">
              {result.candidate_name ?? "Candidate"}
            </span>
            <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold", statusColor.text, statusColor.bg, statusColor.border)}>
              {status}
            </span>
          </div>
          {result.degree_detected && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{result.degree_detected}</span>
            </div>
          )}
          {result.location_detected && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{result.location_detected}</span>
              {result.relocate_detected === true || result.relocate_detected === "Yes" ? (
                <span className="ml-1 text-[10px] text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-px rounded-full font-mono">Open to Relocate</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Score bars */}
      {(bars.some(b => b.value > 0)) && (
        <div className="p-4 bg-background/60 border border-border/50 rounded-xl space-y-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">ATS Score Breakdown</div>
          {bars.map(bar => (
            <ScoreBar key={bar.label} label={bar.label} value={bar.value} max={bar.max} color={bar.color} />
          ))}
        </div>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div className="p-4 bg-background/60 border border-border/50 rounded-xl">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Matched Keywords</div>
          <div className="flex flex-wrap gap-2">
            {keywords.map(kw => (
              <span key={kw} className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contact info */}
      {(result.email || result.phone) && (
        <div className="p-4 bg-background/60 border border-border/50 rounded-xl">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Contact</div>
          <div className="space-y-1.5">
            {result.email && (
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-mono">{result.email}</span>
              </div>
            )}
            {result.phone && (
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-mono">{result.phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status footer banner */}
      <div className={cn("rounded-xl p-3 text-center text-sm font-semibold font-mono border", statusColor.text, statusColor.bg, statusColor.border)}>
        {status === "Shortlisted" && "✓ Candidate shortlisted — interview workflow triggered"}
        {status === "Needs Review" && "⚠ Manual review recommended for this candidate"}
        {status === "Rejected"    && "✗ Candidate does not meet minimum criteria"}
        {status !== "Shortlisted" && status !== "Needs Review" && status !== "Rejected" && `Status: ${status}`}
      </div>
    </motion.div>
  );
}

/* ── Shared progress stepper ── */
function ProgressStepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isActive = i === currentStep || (currentStep >= steps.length && i === steps.length - 1);
        const isDone = i < currentStep || currentStep >= steps.length;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
            className="flex items-center gap-3 text-sm"
          >
            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : isActive ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0" />
            )}
            <span className={cn(
              "font-mono",
              isDone ? "text-muted-foreground line-through" : isActive ? "text-primary" : "text-muted-foreground/40"
            )}>
              {step}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Campus Concierge — Bolna voice call panel
══════════════════════════════════════════════════════ */
type CcCallStatus = "idle" | "connecting" | "ringing" | "in-progress" | "completed" | "failed";

function mapBolnaStatus(raw: string): CcCallStatus {
  const s = raw.toLowerCase().replace(/-/g, "_");
  if (["queued", "scheduled", "initiated"].includes(s)) return "ringing";
  if (s === "in_progress") return "in-progress";
  if (["completed", "call_completed"].includes(s)) return "completed";
  if (["failed", "error", "no_answer", "busy"].includes(s)) return "failed";
  return "ringing";
}

function CampusConciergePanel() {
  const [phoneInput, setPhoneInput] = useState("");
  const [callStatus, setCallStatus] = useState<CcCallStatus>("idle");
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [ccError, setCcError] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  function reset() {
    stopPolling();
    setPhoneInput(""); setCallStatus("idle"); setExecutionId(null);
    setCcError(null); setDuration(null); setTranscript(null); setSummary(null); setRecordingUrl(null);
  }

  useEffect(() => () => stopPolling(), []);

  async function pollStatus(execId: string) {
    try {
      const res = await fetch(`/api/bolna/call-status/${execId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { status?: string; transcript?: string; summary?: string; duration?: string | number; recording_url?: string };
      if (!data.status) return;
      const mapped = mapBolnaStatus(data.status);
      setCallStatus(mapped);
      if (data.duration) setDuration(String(data.duration));
      if (data.transcript) setTranscript(data.transcript);
      if (data.summary) setSummary(data.summary);
      if (data.recording_url) setRecordingUrl(data.recording_url);
      if (mapped === "completed" || mapped === "failed") stopPolling();
    } catch { /* ignore poll errors */ }
  }

  async function handleGetCall() {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) return;
    setCcError(null); setCallStatus("connecting");
    try {
      const res = await fetch("/api/agents/campus-concierge/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: `+91${digits}` }),
      });
      const data = await res.json() as { executionId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const execId = data.executionId ?? null;
      setExecutionId(execId);
      setCallStatus("ringing");
      if (execId) { pollingRef.current = setInterval(() => pollStatus(execId), 3000); }
    } catch (e: unknown) {
      setCcError(e instanceof Error ? e.message : "Failed to place call");
      setCallStatus("failed");
    }
  }

  const isTerminal = callStatus === "completed" || callStatus === "failed";

  return (
    <section className="bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="font-mono text-sm text-primary uppercase tracking-widest">Try This Agent</span>
      </div>
      <div className="p-6">
        <AnimatePresence mode="wait">
          {callStatus === "idle" ? (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your phone number and the Campus Concierge will call you for a live demo.
              </p>
              <div className="flex gap-3">
                <div className="flex items-center flex-1 bg-background/60 border border-border/50 rounded-lg overflow-hidden focus-within:border-primary/60 transition-colors">
                  <span className="px-3 py-2 text-sm font-mono text-muted-foreground border-r border-border/50 bg-muted/20 select-none shrink-0">+91</span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onKeyDown={e => e.key === "Enter" && phoneInput.replace(/\D/g, "").length >= 10 && handleGetCall()}
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none min-w-0"
                  />
                </div>
                <Button
                  onClick={handleGetCall}
                  disabled={phoneInput.replace(/\D/g, "").length < 10}
                  className="gap-2 shrink-0 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                >
                  <PhoneCall className="w-4 h-4" /> Get a Call
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className={cn(
                "rounded-xl border p-5 space-y-3",
                callStatus === "completed" ? "bg-green-500/5 border-green-500/30" :
                callStatus === "failed"    ? "bg-destructive/5 border-destructive/30" :
                "bg-primary/5 border-primary/30"
              )}>
                <div className="flex items-center gap-3">
                  {(callStatus === "connecting" || callStatus === "ringing" || callStatus === "in-progress") && (
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  )}
                  {callStatus === "completed" && <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />}
                  {callStatus === "failed"    && <PhoneOff className="w-5 h-5 text-destructive shrink-0" />}
                  <div>
                    <p className={cn(
                      "font-medium text-sm",
                      callStatus === "completed" ? "text-green-400" :
                      callStatus === "failed"    ? "text-destructive" : "text-primary"
                    )}>
                      {callStatus === "connecting"  && "Connecting…"}
                      {callStatus === "ringing"     && "Ringing your phone…"}
                      {callStatus === "in-progress" && "Call in progress…"}
                      {callStatus === "completed"   && "Call completed"}
                      {callStatus === "failed"      && "Call could not be placed"}
                    </p>
                    {executionId && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">ID: {executionId}</p>}
                  </div>
                </div>
                {ccError && <p className="text-xs text-destructive font-mono">{ccError}</p>}
                {duration && <p className="text-xs text-muted-foreground font-mono">Duration: {duration}s</p>}
              </div>

              {transcript && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/50 bg-background/60 p-4">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Transcript</div>
                  <p className="text-sm font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">{transcript}</p>
                </motion.div>
              )}

              {summary && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-[10px] font-mono text-primary/70 uppercase tracking-widest mb-2">Call Summary</div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
                </motion.div>
              )}

              {recordingUrl && (
                <a href={recordingUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline">
                  <PhoneCall className="w-3 h-3" /> Recording
                </a>
              )}

              {isTerminal && (
                <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
                  <RotateCcw className="w-3 h-3" /> Try Another Call
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   Campus Concierge — Call Log panel
══════════════════════════════════════════════════════ */
interface CcCallLogEntry {
  id: number;
  calledAt: string;
  phoneNumber: string | null;
  executionId: string | null;
  status: string;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
}

const CC_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  triggered:    { label: "Triggered",    cls: "bg-primary/10 border-primary/30 text-primary" },
  ringing:      { label: "Ringing",      cls: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" },
  in_progress:  { label: "In Progress",  cls: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  in_call:      { label: "In Progress",  cls: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  completed:    { label: "Completed",    cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  call_completed: { label: "Completed",  cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  failed:       { label: "Failed",       cls: "bg-destructive/10 border-destructive/30 text-destructive" },
  no_answer:    { label: "No Answer",    cls: "bg-destructive/10 border-destructive/30 text-destructive" },
  busy:         { label: "Busy",         cls: "bg-destructive/10 border-destructive/30 text-destructive" },
};

function formatCcTs(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

function CampusConciergeCallLog() {
  const [calls, setCalls] = useState<CcCallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  async function fetchCalls(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/agents/campus-concierge/call-log", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { calls: CcCallLogEntry[] };
      setCalls(json.calls ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load call log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchCalls();
    const interval = setInterval(() => fetchCalls(), 30_000);
    return () => clearInterval(interval);
  }, []);

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <section className="bg-card/40 border border-border/50 rounded-xl overflow-hidden backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-widest">Call Log</span>
          {!loading && calls.length > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground font-mono">{calls.length} entries</span>
          )}
        </div>
        <button
          onClick={() => fetchCalls(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading call history…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
          <PhoneCall className="w-8 h-8 text-muted-foreground/30 mb-1" />
          <p className="text-sm text-muted-foreground">No calls recorded yet.</p>
          <p className="text-xs text-muted-foreground/60">Place a call above to see entries here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
              <tr className="border-b border-border/40">
                <th className="w-6 px-3 py-2.5" />
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">#</th>
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">Timestamp</th>
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">Phone</th>
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">Duration</th>
                <th className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">Summary</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call, idx) => {
                const style = CC_STATUS_STYLES[call.status.toLowerCase().replace(/-/g, "_")] ?? { label: call.status, cls: "bg-muted/20 border-border/50 text-muted-foreground" };
                const isOpen = expanded.has(call.id);
                const hasDetail = !!(call.transcript || call.summary);
                return (
                  <React.Fragment key={call.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      onClick={() => hasDetail && toggleExpand(call.id)}
                      className={cn(
                        "border-b border-border/20 transition-colors",
                        idx % 2 === 0 ? "bg-background/20" : "bg-muted/5",
                        hasDetail && "cursor-pointer hover:bg-primary/5"
                      )}
                    >
                      <td className="px-3 py-2.5 text-muted-foreground/40">
                        {hasDetail && (
                          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-90")} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground/60">{call.id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatCcTs(call.calledAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {call.phoneNumber ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium", style.cls)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {call.duration != null ? `${call.duration}s` : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                        {call.summary ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </motion.tr>
                    {isOpen && hasDetail && (
                      <tr key={`${call.id}-detail`} className="border-b border-border/20 bg-primary/3">
                        <td colSpan={7} className="px-5 py-4">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-3"
                          >
                            {call.summary && (
                              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                                <div className="text-[10px] font-mono text-primary/70 uppercase tracking-widest mb-1.5">Summary</div>
                                <p className="text-xs text-foreground/80 leading-relaxed">{call.summary}</p>
                              </div>
                            )}
                            {call.transcript && (
                              <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Transcript</div>
                                <p className="text-xs font-mono text-foreground/70 whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
                              </div>
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
  const [progressStep, setProgressStep] = useState(-1);
  const [runError, setRunError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* Expense Tracker state */
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([emptyExpenseEntry()]);
  const [expenseResult, setExpenseResult] = useState<string | null>(null);

  /* Deadline Tracker state */
  const [deadlineEntries, setDeadlineEntries] = useState<DeadlineEntry[]>([emptyDeadlineEntry()]);
  const [deadlineHtml, setDeadlineHtml] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const sentEmailRef = useRef<string>("");

  /* HR Bot state */
  const [hrFile, setHrFile] = useState<File | null>(null);
  const [hrDragOver, setHrDragOver] = useState(false);
  const [hrResult, setHrResult] = useState<HRResult | null>(null);
  const [hrLoading, setHrLoading] = useState(false);
  const hrAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = !!user;
  const hasWebhook = !!agent?.webhookUrl;
  const isExpenseTracker = slug === "expense-tracker";
  const isDeadlineTracker = slug === "deadline-tracker";
  const isHRAgent = slug === "hr-agent";
  const isHospitalReceptionist = slug === "hospital-receptionist";
  const isCampusConcierge = slug === "campus-concierge";
  const isLinkedInManagement = slug === "linkedin-management";
  const isAiService = slug === "ai-service";
  const isOnboardingAgent = slug === "onboarding-agent";
  const isRunning = triggerMutation.isPending || progressStep >= 0 || hrLoading;
  const isDone = isHRAgent
    ? hrResult !== null
    : isExpenseTracker
      ? expenseResult !== null
      : deadlineHtml !== null;

  const progressSteps = isHRAgent ? HR_STEPS : isDeadlineTracker ? DEADLINE_STEPS : EXPENSE_STEPS;
  const progressDelays = isHRAgent ? HR_DELAYS : isDeadlineTracker ? DEADLINE_DELAYS : EXPENSE_DELAYS;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => () => {
    clearTimers();
    hrAbortRef.current?.abort();
  }, []);

  /* Reset panel state when slug changes */
  useEffect(() => {
    hrAbortRef.current?.abort();
    hrAbortRef.current = null;
    setPanelOpen(false);
    setProgressStep(-1);
    setRunError(null);
    setExpenseResult(null);
    setDeadlineHtml(null);
    setExpenseEntries([emptyExpenseEntry()]);
    setDeadlineEntries([emptyDeadlineEntry()]);
    setRecipientEmail("");
    setHrFile(null);
    setHrResult(null);
    setHrLoading(false);
    clearTimers();
    triggerMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function resetForm() {
    hrAbortRef.current?.abort();
    hrAbortRef.current = null;
    setProgressStep(-1);
    setRunError(null);
    setExpenseResult(null);
    setDeadlineHtml(null);
    setExpenseEntries([emptyExpenseEntry()]);
    setDeadlineEntries([emptyDeadlineEntry()]);
    setRecipientEmail("");
    setHrFile(null);
    setHrResult(null);
    setHrLoading(false);
    clearTimers();
    triggerMutation.reset();
  }

  function startProgress(delays: number[], steps: number) {
    setProgressStep(0);
    clearTimers();
    delays.forEach((delay, i) => {
      if (i === 0) return;
      const t = setTimeout(() => {
        setProgressStep(prev => (prev < i && prev >= 0 ? i : prev));
      }, delay);
      timersRef.current.push(t);
    });
    return steps;
  }

  async function handleRun() {
    if (!slug) return;
    setRunError(null);
    setExpenseResult(null);
    setDeadlineHtml(null);

    const totalSteps = startProgress(progressDelays, progressSteps.length);

    try {
      let entries: Record<string, string>[];
      if (isDeadlineTracker) {
        entries = deadlineEntries.map(e => ({
          "Task": e.task,
          "Last Date": e.lastDate,
          "Piority": e.piority,
          "Status": e.status,
        }));
      } else {
        entries = expenseEntries as unknown as Record<string, string>[];
      }

      const payload: { entries: Record<string, string>[]; email?: string } = { entries };
      if (recipientEmail.trim()) payload.email = recipientEmail.trim();
      const data = await triggerMutation.mutateAsync({ slug, data: payload });
      clearTimers();
      setProgressStep(totalSteps);
      sentEmailRef.current = recipientEmail.trim();

      if (isDeadlineTracker) {
        setDeadlineHtml(data.html ?? data.summary ?? "");
      } else {
        setExpenseResult(data.summary ?? "");
      }
    } catch (err: unknown) {
      clearTimers();
      setProgressStep(-1);
      const msg = err instanceof Error ? err.message : "Webhook request failed.";
      setRunError(msg);
    }
  }

  const handleHRRun = useCallback(async () => {
    if (!hrFile) return;
    setRunError(null);
    setHrResult(null);

    const totalSteps = startProgress(HR_DELAYS, HR_STEPS.length);
    setHrLoading(true);

    const controller = new AbortController();
    hrAbortRef.current = controller;

    const formData = new FormData();
    formData.append("resume", hrFile);

    try {
      const response = await fetch("/api/agents/hr-agent/trigger", {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json() as { error?: string };
          if (errData.error) errMsg = errData.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const json = await response.json() as { success: boolean; data?: HRResult };
      clearTimers();
      setProgressStep(totalSteps);
      setHrResult(json.data ?? {});
    } catch (err: unknown) {
      clearTimers();
      setProgressStep(-1);
      if (err instanceof Error && err.name === "AbortError") {
        setRunError("Webhook timed out. Please try again.");
      } else {
        setRunError(err instanceof Error ? err.message : "Request failed.");
      }
    } finally {
      setHrLoading(false);
      hrAbortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrFile]);

  function handleHRFileSelect(file: File) {
    if (file.type !== "application/pdf") {
      setRunError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setRunError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setRunError(null);
    setHrFile(file);
  }

  /* ── Expense entry helpers ── */
  function updateExpenseEntry(index: number, field: keyof ExpenseEntry, value: string) {
    setExpenseEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  /* ── Deadline entry helpers ── */
  function updateDeadlineEntry(index: number, field: keyof DeadlineEntry, value: string) {
    setDeadlineEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  /* ── Disable check ── */
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());
  const isSubmitDisabled = isHRAgent
    ? !hrFile
    : isDeadlineTracker
      ? !emailValid || deadlineEntries.some(e => !e.task)
      : !emailValid || expenseEntries.some(e => !e.amount || !e.description);

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

  if (isHospitalReceptionist) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Registry
          </Button>
        </Link>
        <HospitalReceptionistPage />
      </div>
    );
  }

  if (isLinkedInManagement) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Registry
          </Button>
        </Link>
        <LinkedInManagementPage />
      </div>
    );
  }

  if (isOnboardingAgent) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Registry
          </Button>
        </Link>
        <OnboardingAgentPage />
      </div>
    );
  }

  if (isAiService) {
    return <AiServiceInquiryPage />;
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
                <p className="text-sm font-mono text-primary">ID_REF: {agent.displayId ?? agent.slug.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl">{agent.tagline ?? agent.shortDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {isCampusConcierge && <CampusConciergePanel />}
            {isCampusConcierge && <CampusConciergeCallLog />}

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
                {!isAdmin ? (
                  <Link href="/admin/login">
                    <Button className="w-full shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow">
                      Initialize Agent
                    </Button>
                  </Link>
                ) : hasWebhook ? (
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
                  <Button
                    className="w-full gap-2"
                    disabled
                    variant="outline"
                  >
                    <Zap className="w-4 h-4" />
                    No Webhook Configured
                  </Button>
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
                {/* ── Error state ── */}
                {runError ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-destructive text-sm font-mono">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Something went wrong. Check the webhook and try again.</span>
                    </div>
                    <div className="text-xs text-destructive/80 font-mono bg-destructive/5 border border-destructive/20 rounded p-3">
                      {runError}
                    </div>
                    <Button
                      variant="outline"
                      className="border-primary/20 hover:bg-primary/10 hover:text-primary gap-2"
                      onClick={resetForm}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Try Again
                    </Button>
                  </motion.div>

                ) : isDone ? (
                  /* ── Result state ── */
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {isHRAgent && hrResult ? (
                      <>
                        <div className="flex items-center gap-2 text-green-400 text-sm font-mono mb-4">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Analysis complete</span>
                        </div>
                        <CandidateAnalysisCard result={hrResult} />
                        <Button
                          variant="outline"
                          className="border-primary/20 hover:bg-primary/10 hover:text-primary gap-2 mt-2"
                          onClick={resetForm}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Upload Another Resume
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-green-400 text-sm font-mono mb-4">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Workflow complete</span>
                          <span className="flex items-center gap-1 ml-3 text-xs bg-green-400/10 border border-green-400/20 text-green-400 px-2 py-0.5 rounded-full">
                            <Mail className="w-3 h-3" />
                            {sentEmailRef.current
                              ? `Email sent to ${sentEmailRef.current}`
                              : "Email sent"}
                          </span>
                        </div>

                        {isDeadlineTracker && deadlineHtml ? (
                          <div>
                            <div className="text-xs text-muted-foreground font-mono uppercase mb-2">Email Preview</div>
                            <div className="rounded-lg overflow-hidden border border-border/50">
                              <iframe
                                srcDoc={deadlineHtml}
                                sandbox=""
                                className="w-full bg-white"
                                style={{ minHeight: "400px", maxHeight: "500px", display: "block" }}
                                title="Email Preview"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-background/60 border border-border/50 rounded-lg p-5">
                            <div className="text-xs text-primary/70 font-mono uppercase mb-3 flex items-center gap-1.5">
                              <Zap className="w-3 h-3" /> AI-Generated Summary
                            </div>
                            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono">
                              {expenseResult}
                            </div>
                          </div>
                        )}

                        <Button
                          variant="outline"
                          className="border-primary/20 hover:bg-primary/10 hover:text-primary gap-2"
                          onClick={resetForm}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Run Again
                        </Button>
                      </>
                    )}
                  </motion.div>

                ) : progressStep >= 0 ? (
                  /* ── Progress state ── */
                  <ProgressStepper steps={progressSteps} currentStep={progressStep} />

                ) : isHRAgent ? (
                  /* ── HR Bot upload form ── */
                  <div className="space-y-5">
                    <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                      Resume Upload
                    </div>

                    {/* Drop zone */}
                    {!hrFile ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all",
                          hrDragOver
                            ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                            : "border-border/40 hover:border-primary/50 hover:bg-primary/5"
                        )}
                        onDragOver={e => { e.preventDefault(); setHrDragOver(true); }}
                        onDragLeave={() => setHrDragOver(false)}
                        onDrop={e => {
                          e.preventDefault();
                          setHrDragOver(false);
                          const file = e.dataTransfer.files[0];
                          if (file) handleHRFileSelect(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                      >
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors", hrDragOver ? "bg-primary/20" : "bg-primary/10")}>
                          <Upload className={cn("w-6 h-6 transition-colors", hrDragOver ? "text-primary" : "text-primary/60")} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">Drag &amp; drop your resume (PDF)</p>
                          <p className="text-xs text-muted-foreground mt-1">or click to browse &mdash; max 10 MB</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleHRFileSelect(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    ) : (
                      /* Selected file preview */
                      <div className="flex items-center gap-3 p-3 bg-background/60 border border-primary/20 rounded-lg">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-foreground truncate">{hrFile.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {(hrFile.size / 1024).toFixed(0)} KB &bull; PDF
                          </p>
                        </div>
                        <button
                          onClick={() => setHrFile(null)}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/40">
                      <Button
                        className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                        onClick={handleHRRun}
                        disabled={isRunning || isSubmitDisabled}
                      >
                        <User className="w-4 h-4" /> Analyze Resume
                      </Button>
                      <p className="text-[10px] text-muted-foreground font-mono text-center mt-2">
                        PDF → Make.com → OpenAI → ATS Scoring → Google Sheets
                      </p>
                    </div>
                  </div>

                ) : isDeadlineTracker ? (
                  /* ── Deadline Tracker form ── */
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-widest">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. you@company.com"
                        value={recipientEmail}
                        onChange={e => setRecipientEmail(e.target.value)}
                        className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
                      />
                      {recipientEmail && !emailValid && (
                        <p className="text-[10px] text-destructive font-mono mt-1">Enter a valid email address</p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                      Task Entries
                    </div>

                    <div className="space-y-4">
                      {deadlineEntries.map((entry, index) => (
                        <div key={index} className="bg-background/40 border border-border/40 rounded-lg p-4 space-y-3 relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">
                              Task {index + 1} of {deadlineEntries.length}
                            </span>
                            {deadlineEntries.length > 1 && (
                              <button
                                onClick={() => setDeadlineEntries(prev => prev.filter((_, i) => i !== index))}
                                className="text-muted-foreground/40 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-mono">Task</label>
                            <input
                              type="text"
                              placeholder="e.g. Submit quarterly report"
                              value={entry.task}
                              onChange={e => updateDeadlineEntry(index, "task", e.target.value)}
                              className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-mono">Last Date</label>
                            <input
                              type="date"
                              value={entry.lastDate}
                              onChange={e => updateDeadlineEntry(index, "lastDate", e.target.value)}
                              style={{ colorScheme: "dark" }}
                              className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block font-mono">Piority</label>
                              <select
                                value={entry.piority}
                                onChange={e => updateDeadlineEntry(index, "piority", e.target.value)}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                              >
                                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block font-mono">Status</label>
                              <select
                                value={entry.status}
                                onChange={e => updateDeadlineEntry(index, "status", e.target.value)}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                              >
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                      onClick={() => setDeadlineEntries(prev => [...prev, emptyDeadlineEntry()])}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </Button>

                    <div className="pt-2 border-t border-border/40">
                      <Button
                        className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                        onClick={handleRun}
                        disabled={isRunning || isSubmitDisabled}
                      >
                        <Play className="w-4 h-4" /> Run Agent
                      </Button>
                      <p className="text-[10px] text-muted-foreground font-mono text-center mt-2">
                        Tasks will be saved to Google Sheets, analysed by AI, and a digest will be emailed.
                      </p>
                    </div>
                  </div>

                ) : (
                  /* ── Expense Tracker form ── */
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-mono uppercase tracking-widest">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. you@company.com"
                        value={recipientEmail}
                        onChange={e => setRecipientEmail(e.target.value)}
                        className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
                      />
                      {recipientEmail && !emailValid && (
                        <p className="text-[10px] text-destructive font-mono mt-1">Enter a valid email address</p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                      Expense Entries
                    </div>

                    <div className="space-y-4">
                      {expenseEntries.map((entry, index) => (
                        <div key={index} className="bg-background/40 border border-border/40 rounded-lg p-4 space-y-3 relative group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">
                              Entry {(index + 1).toString().padStart(2, "0")}
                            </span>
                            {expenseEntries.length > 1 && (
                              <button
                                onClick={() => setExpenseEntries(prev => prev.filter((_, i) => i !== index))}
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
                                onChange={e => updateExpenseEntry(index, "amount", e.target.value)}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block font-mono">Date</label>
                              <input
                                type="date"
                                value={entry.date}
                                onChange={e => updateExpenseEntry(index, "date", e.target.value)}
                                style={{ colorScheme: "dark" }}
                                className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block font-mono">Category</label>
                            <select
                              value={entry.category}
                              onChange={e => updateExpenseEntry(index, "category", e.target.value)}
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
                              onChange={e => updateExpenseEntry(index, "description", e.target.value)}
                              className="w-full bg-card border border-border/50 rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                      onClick={() => setExpenseEntries(prev => [...prev, emptyExpenseEntry()])}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Entry
                    </Button>

                    <div className="pt-2 border-t border-border/40">
                      <Button
                        className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                        onClick={handleRun}
                        disabled={isRunning || isSubmitDisabled}
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
