import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Users, ClipboardList, FileCheck2, CheckCircle2, AlertTriangle, Clock,
  Loader2, Plus, ArrowLeft, ChevronRight, Mail, Calendar, MapPin,
  Stethoscope, Building2, FileText, ShieldCheck, HeartPulse, GraduationCap,
  Bell, ExternalLink, Eye, Briefcase, RefreshCw, Trash2, Sun, Moon,
} from "lucide-react";

/* ══════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════ */
interface Candidate {
  RefCode: string;
  Name: string;
  Email: string;
  DOB: string;
  Position: string;
  CreatedAt: string;
  FolderID: string;
  FolderURL: string;
  CurrentStage: string;
  DocCheckApproval: string;
  MedicalDate: string;
  MedicalTime: string;
  MedicalAddress: string;
  MedicalStatus: string;
  TrainingComplete: string;
  AllocatedBranch: string;
  BranchPOC: string;
  BranchPOCContact: string;
}

interface ChecklistItem {
  Key: string;
  RefCode: string;
  DocType: string;
  DisplayName: string;
  Status: string;
  Verdict: string;
  IssueText: string;
  SubmittedDate: string;
}

/* ══════════════════════════════════════════════════════
   Theme (scoped to this dashboard only — see .light-mode in index.css)
══════════════════════════════════════════════════════ */
type DashTheme = "dark" | "light";
const THEME_STORAGE_KEY = "onboarding-dashboard-theme";

const ThemeContext = createContext<DashTheme>("dark");

/** True when the dashboard is rendering in light mode. */
function useLight(): boolean {
  return useContext(ThemeContext) === "light";
}

/** Dashboard theme state, persisted to localStorage (defaults to dark). */
function useDashTheme() {
  const [theme, setTheme] = useState<DashTheme>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}

function ThemeToggle({ theme, onToggle }: { theme: DashTheme; onToggle: () => void }) {
  const light = theme === "light";
  return (
    <button
      onClick={onToggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "w-9 h-9 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0",
        light
          ? "border-gray-200 bg-white text-gray-600 hover:text-primary hover:border-primary/40"
          : "border-border/50 bg-card/40 text-muted-foreground hover:text-primary hover:border-primary/40",
      )}
    >
      {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   Stage configuration
══════════════════════════════════════════════════════ */
type StageKey =
  | "OfferSent" | "AwaitingDocs" | "DocsUnderCheck"
  | "DVBooked" | "MedicalPending" | "Training" | "Completed";

interface StageStyle {
  label: string;
  pill: string;
  dot: string;
  soft: string;
  text: string;
  icon: typeof FileText;
}

/* Same hues in both themes — light mode just deepens the text and softens the fill. */
const STAGE_CONFIG: Record<StageKey, StageStyle> = {
  OfferSent:      { label: "Offer Sent",       pill: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",   dot: "bg-indigo-400",  soft: "bg-indigo-500/10 border-indigo-500/30",   text: "text-indigo-400",  icon: Mail },
  AwaitingDocs:   { label: "Awaiting Docs",     pill: "bg-blue-500/10 text-blue-400 border-blue-500/30",         dot: "bg-blue-400",    soft: "bg-blue-500/10 border-blue-500/30",       text: "text-blue-400",    icon: ClipboardList },
  DocsUnderCheck: { label: "Docs Under Check",  pill: "bg-amber-500/10 text-amber-400 border-amber-500/30",      dot: "bg-amber-400",   soft: "bg-amber-500/10 border-amber-500/30",     text: "text-amber-400",   icon: FileCheck2 },
  DVBooked:       { label: "DV Booked",         pill: "bg-green-500/10 text-green-400 border-green-500/30",       dot: "bg-green-400",   soft: "bg-green-500/10 border-green-500/30",     text: "text-green-400",   icon: ShieldCheck },
  MedicalPending: { label: "Medical Pending",   pill: "bg-purple-500/10 text-purple-400 border-purple-500/30",   dot: "bg-purple-400",  soft: "bg-purple-500/10 border-purple-500/30",   text: "text-purple-400",  icon: HeartPulse },
  Training:       { label: "Training",          pill: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",          dot: "bg-cyan-400",    soft: "bg-cyan-500/10 border-cyan-500/30",       text: "text-cyan-400",    icon: GraduationCap },
  Completed:      { label: "Completed",         pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400", soft: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", icon: CheckCircle2 },
};

const STAGE_CONFIG_LIGHT: Record<StageKey, StageStyle> = {
  OfferSent:      { ...STAGE_CONFIG.OfferSent,      pill: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",   soft: "bg-indigo-500/5 border-indigo-500/30",   text: "text-indigo-700",  dot: "bg-indigo-500" },
  AwaitingDocs:   { ...STAGE_CONFIG.AwaitingDocs,   pill: "bg-blue-500/10 text-blue-700 border-blue-500/30",         soft: "bg-blue-500/5 border-blue-500/30",       text: "text-blue-700",    dot: "bg-blue-500" },
  DocsUnderCheck: { ...STAGE_CONFIG.DocsUnderCheck, pill: "bg-amber-500/10 text-amber-700 border-amber-500/30",      soft: "bg-amber-500/5 border-amber-500/30",     text: "text-amber-700",   dot: "bg-amber-500" },
  DVBooked:       { ...STAGE_CONFIG.DVBooked,       pill: "bg-green-500/10 text-green-700 border-green-500/30",      soft: "bg-green-500/5 border-green-500/30",     text: "text-green-700",   dot: "bg-green-500" },
  MedicalPending: { ...STAGE_CONFIG.MedicalPending, pill: "bg-purple-500/10 text-purple-700 border-purple-500/30",   soft: "bg-purple-500/5 border-purple-500/30",   text: "text-purple-700",  dot: "bg-purple-500" },
  Training:       { ...STAGE_CONFIG.Training,       pill: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",         soft: "bg-cyan-500/5 border-cyan-500/30",       text: "text-cyan-700",    dot: "bg-cyan-500" },
  Completed:      { ...STAGE_CONFIG.Completed,      pill: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", soft: "bg-emerald-500/5 border-emerald-500/30", text: "text-emerald-700", dot: "bg-emerald-500" },
};

/** Stage styling for the active theme. */
function stageStyle(stage: StageKey, light: boolean): StageStyle {
  return light ? STAGE_CONFIG_LIGHT[stage] : STAGE_CONFIG[stage];
}

const STAGE_ORDER: StageKey[] = [
  "OfferSent", "AwaitingDocs", "DocsUnderCheck",
  "DVBooked", "MedicalPending", "Training", "Completed",
];

/** Normalize a raw sheet CurrentStage value into a canonical UI stage. */
function normalizeStage(raw: string): StageKey {
  const s = (raw ?? "").trim();
  switch (s) {
    case "DocumentCollection":
    case "AwaitingDocs":        return "AwaitingDocs";
    case "DocsUnderCheck":      return "DocsUnderCheck";
    case "DVBooked":            return "DVBooked";
    case "MedicalPending":      return "MedicalPending";
    case "Training":            return "Training";
    case "Completed":           return "Completed";
    case "OfferSent":
    case "":                    return "OfferSent";
    default:                    return "OfferSent";
  }
}

/* Canonical document set (used to render a full grid even before docs arrive) */
const DOC_TYPES: { type: string; name: string }[] = [
  { type: "PAN_CARD",       name: "PAN Card" },
  { type: "AADHAAR",        name: "Aadhaar" },
  { type: "MARKSHEET_10",   name: "Class 10 Marksheet" },
  { type: "MARKSHEET_12",   name: "Class 12 Marksheet" },
  { type: "DEGREE_CERT",    name: "Degree Certificate" },
  { type: "PASSPORT_PHOTO", name: "Passport Photo" },
  { type: "ADDRESS_PROOF",  name: "Address Proof" },
];

const POSITIONS = ["PO", "SO", "Clerk", "Specialist"];

/* ══════════════════════════════════════════════════════
   API helpers
══════════════════════════════════════════════════════ */
const API = "/api/onboarding";

async function fetchCandidates(): Promise<Candidate[]> {
  const res = await fetch(`${API}/candidates`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load candidates (HTTP ${res.status})`);
  return res.json();
}

async function fetchChecklist(refCode: string): Promise<ChecklistItem[]> {
  const res = await fetch(`${API}/checklist/${encodeURIComponent(refCode)}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load checklist (HTTP ${res.status})`);
  return res.json();
}

async function apiSend(path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status})`;
    try {
      const j = await res.json() as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

/* ── Formatting helpers ── */
function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function to12Hour(time: string): string {
  if (!time) return "";
  const [hStr, min] = time.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${min} ${ampm}`;
}

/** True when an ISO timestamp is older than `days` days ago (false if empty/unparseable). */
function isOlderThanDays(iso: string, days: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/* ── Checklist stats ── */
interface DocStats { received: number; flagged: number; pending: number; total: number }
function computeDocStats(items: ChecklistItem[]): DocStats {
  const total = Math.max(items.length, DOC_TYPES.length);
  const received = items.filter((i) => i.Status === "Received").length;
  const flagged = items.filter((i) => i.Status === "Flagged").length;
  const pending = total - received - flagged;
  return { received, flagged, pending: Math.max(pending, 0), total };
}

/* ══════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════ */
export function OnboardingAgentPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"All" | StageKey>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null);
  const { theme, toggle } = useDashTheme();

  /* Candidates — polled every 30s to stay in sync with n8n */
  const {
    data: candidates,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["onboarding-candidates"],
    queryFn: fetchCandidates,
    refetchInterval: 30_000,
  });

  const list = candidates ?? [];

  /* Per-candidate checklists — powers row progress bars and the detail grid */
  const checklistResults = useQueries({
    queries: list.map((c) => ({
      queryKey: ["onboarding-checklist", c.RefCode],
      queryFn: () => fetchChecklist(c.RefCode),
      enabled: !!c.RefCode,
      refetchInterval: 30_000,
      staleTime: 20_000,
    })),
  });

  const checklistByRef = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    list.forEach((c, i) => {
      map[c.RefCode] = (checklistResults[i]?.data as ChecklistItem[] | undefined) ?? [];
    });
    return map;
  }, [list, checklistResults]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["onboarding-candidates"] });
    qc.invalidateQueries({ queryKey: ["onboarding-checklist"] });
  }

  /** Drop the candidate from the caches and return to the pipeline. */
  function handleDeleted(refCode: string) {
    setSelectedRef(null);
    qc.removeQueries({ queryKey: ["onboarding-checklist", refCode] });
    invalidateAll();
  }

  const selected = selectedRef ? list.find((c) => c.RefCode === selectedRef) ?? null : null;
  const light = theme === "light";
  const shell = cn(light && "light-mode rounded-2xl p-5 sm:p-6");

  /* ── Loading / error states ── */
  if (isLoading) {
    return (
      <div className={shell}>
        <PipelineSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={shell}>
        <div className="p-10 text-center border border-destructive/20 bg-destructive/5 rounded-xl">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-mono text-sm mb-1">Failed to load onboarding data.</p>
          <p className="text-xs text-muted-foreground font-mono mb-4">{(error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div className={shell}>
        <AnimatePresence mode="wait">
          {selected ? (
            <CandidateDetail
              key="detail"
              candidate={selected}
              checklist={checklistByRef[selected.RefCode] ?? []}
              onBack={() => setSelectedRef(null)}
              onMutated={invalidateAll}
              onDelete={() => setPendingDelete(selected)}
              theme={theme}
              onToggleTheme={toggle}
              toast={toast}
            />
          ) : (
            <PipelineView
              key="pipeline"
              candidates={list}
              checklistByRef={checklistByRef}
              stageFilter={stageFilter}
              onStageFilter={setStageFilter}
              onSelect={setSelectedRef}
              onAdd={() => setAddOpen(true)}
              onDelete={setPendingDelete}
              theme={theme}
              onToggleTheme={toggle}
              isSyncing={isFetching}
            />
          )}
        </AnimatePresence>

        <AddCandidateDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={invalidateAll}
          toast={toast}
        />

        <DeleteCandidateDialog
          candidate={pendingDelete}
          onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
          onDeleted={handleDeleted}
          toast={toast}
        />
      </div>
    </ThemeContext.Provider>
  );
}

/* ══════════════════════════════════════════════════════
   Pipeline view
══════════════════════════════════════════════════════ */
function PipelineView({
  candidates, checklistByRef, stageFilter, onStageFilter, onSelect, onAdd, onDelete,
  theme, onToggleTheme, isSyncing,
}: {
  candidates: Candidate[];
  checklistByRef: Record<string, ChecklistItem[]>;
  stageFilter: "All" | StageKey;
  onStageFilter: (s: "All" | StageKey) => void;
  onSelect: (ref: string) => void;
  onAdd: () => void;
  onDelete: (c: Candidate) => void;
  theme: DashTheme;
  onToggleTheme: () => void;
  isSyncing: boolean;
}) {
  const light = useLight();
  const withStage = candidates.map((c) => ({ c, stage: normalizeStage(c.CurrentStage) }));

  const counts = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<StageKey, number>;
    withStage.forEach(({ stage }) => { map[stage] += 1; });
    return map;
  }, [withStage]);

  const total = candidates.length;
  const awaitingDocs = counts.AwaitingDocs;
  const underCheck = counts.DocsUnderCheck;
  const completed = counts.Completed;

  const toReview = withStage.filter(({ stage }) => stage === "DocsUnderCheck");
  // No response 7+ days: still awaiting docs (DocumentCollection / AwaitingDocs) and added > 7 days ago.
  const awaitingResponse = withStage.filter(
    ({ c, stage }) => stage === "AwaitingDocs" && isOlderThanDays(c.CreatedAt, 7),
  );

  const filtered = stageFilter === "All"
    ? withStage
    : withStage.filter(({ stage }) => stage === stageFilter);

  const FILTER_TABS: ("All" | StageKey)[] = [
    "All", "AwaitingDocs", "DocsUnderCheck", "DVBooked", "MedicalPending", "Training", "Completed",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">IDBI Onboarding</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Post-selection pipeline dashboard
              {isSyncing && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={onAdd} className="gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow">
            <Plus className="w-4 h-4" /> Add Candidate
          </Button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Total Candidates" value={total}        tone="text-primary" />
        <StatCard icon={ClipboardList} label="Awaiting Docs"    value={awaitingDocs} tone={light ? "text-blue-700" : "text-blue-400"} />
        <StatCard icon={FileCheck2}    label="Docs Under Check" value={underCheck}   tone={light ? "text-amber-700" : "text-amber-400"} />
        <StatCard icon={CheckCircle2}  label="Completed"        value={completed}    tone={light ? "text-emerald-700" : "text-emerald-400"} />
      </div>

      {/* Pipeline funnel */}
      <section className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Pipeline</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {STAGE_ORDER.map((stage) => {
            const cfg = stageStyle(stage, light);
            const Icon = cfg.icon;
            return (
              <button
                key={stage}
                onClick={() => onStageFilter(stage === "OfferSent" ? "All" : stage)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-left transition-all hover:scale-[1.02]",
                  cfg.soft,
                )}
              >
                <Icon className={cn("w-4 h-4", cfg.text)} />
                <div className={cn("text-2xl font-display font-bold", cfg.text)}>{counts[stage]}</div>
                <div className="text-[10px] font-mono text-muted-foreground leading-tight">{cfg.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Action alerts */}
      {(toReview.length > 0 || awaitingResponse.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {toReview.length > 0 && (
            <AlertPanel
              icon={FileCheck2}
              tone="amber"
              title="Documents to review"
              count={toReview.length}
            >
              {toReview.map(({ c }) => (
                <AlertRow key={c.RefCode} name={c.Name} sub={c.RefCode} onClick={() => onSelect(c.RefCode)} actionLabel="Review" />
              ))}
            </AlertPanel>
          )}
          {awaitingResponse.length > 0 && (
            <AlertPanel
              icon={Bell}
              tone="blue"
              title="No response 7+ days"
              count={awaitingResponse.length}
            >
              {awaitingResponse.map(({ c }) => (
                <AlertRow key={c.RefCode} name={c.Name} sub={c.RefCode} onClick={() => onSelect(c.RefCode)} actionLabel="Send Reminder" />
              ))}
            </AlertPanel>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const label = tab === "All" ? "All" : STAGE_CONFIG[tab].label;
          const active = stageFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => onStageFilter(tab)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-mono border transition-all",
                active
                  ? "bg-primary text-background border-primary"
                  : "bg-card/30 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Candidate list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-border/50 rounded-xl bg-card/20">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No candidates in this stage.</p>
          </div>
        ) : (
          filtered.map(({ c, stage }, idx) => {
            const stats = computeDocStats(checklistByRef[c.RefCode] ?? []);
            const cfg = stageStyle(stage, light);
            const pct = stats.total ? Math.round((stats.received / stats.total) * 100) : 0;
            return (
              <motion.div
                key={c.RefCode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(c.RefCode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(c.RefCode);
                  }
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/50 hover:bg-card/60 transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-display font-semibold text-sm flex-shrink-0">
                  {initials(c.Name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">{c.Name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-background/50 border border-border/50 px-1.5 py-0.5 rounded">{c.RefCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Briefcase className="w-3 h-3" />
                    <span>{c.Position || "—"}</span>
                    {c.AllocatedBranch && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{c.AllocatedBranch}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Doc progress */}
                <div className="hidden sm:flex flex-col items-end gap-1 w-32 flex-shrink-0">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{stats.received}/{stats.total} docs</span>
                    {stats.flagged > 0 && (
                      <span className={cn("flex items-center gap-0.5", light ? "text-amber-700" : "text-amber-400")}>
                        <AlertTriangle className="w-3 h-3" /> {stats.flagged}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium flex-shrink-0", cfg.pill)}>
                  {cfg.label}
                </span>
                <DeleteButton
                  label={`Delete ${c.Name}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(c); }}
                />
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

/* ── Small pieces ── */
function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="bg-card/40 border border-border/50 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn("w-4 h-4", tone)} />
      </div>
      <div className={cn("text-3xl font-display font-bold", tone)}>{value}</div>
    </div>
  );
}

/** Small red ghost trash button — used on pipeline rows and the detail header. */
function DeleteButton({ label, onClick, size = "sm" }: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0",
        size === "sm" ? "w-7 h-7" : "w-9 h-9",
      )}
    >
      <Trash2 className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
    </button>
  );
}

function AlertPanel({ icon: Icon, tone, title, count, children }: {
  icon: typeof FileCheck2; tone: "amber" | "blue"; title: string; count: number; children: React.ReactNode;
}) {
  const light = useLight();
  const toneCls = tone === "amber"
    ? light
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
      : "border-amber-500/30 bg-amber-500/5 text-amber-400"
    : light
      ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
      : "border-blue-500/30 bg-blue-500/5 text-blue-400";
  return (
    <div className={cn("rounded-xl border p-4", toneCls)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[10px] font-mono bg-background/40 border border-current/20 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AlertRow({ name, sub, onClick, actionLabel }: { name: string; sub: string; onClick: () => void; actionLabel: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background/40 hover:bg-background/70 transition-colors text-left">
      <div className="min-w-0">
        <div className="text-sm text-foreground truncate">{name}</div>
        <div className="text-[10px] font-mono text-muted-foreground">{sub}</div>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground border border-border/50 rounded-full px-2 py-0.5 flex-shrink-0">{actionLabel}</span>
    </button>
  );
}

function PipelineSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-64 bg-primary/10" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-primary/5" />)}
      </div>
      <Skeleton className="h-40 w-full bg-primary/5" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full bg-primary/5" />)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Candidate detail view
══════════════════════════════════════════════════════ */
type ToastFn = ReturnType<typeof useToast>["toast"];

function CandidateDetail({
  candidate, checklist, onBack, onMutated, onDelete, theme, onToggleTheme, toast,
}: {
  candidate: Candidate;
  checklist: ChecklistItem[];
  onBack: () => void;
  onMutated: () => void;
  onDelete: () => void;
  theme: DashTheme;
  onToggleTheme: () => void;
  toast: ToastFn;
}) {
  const light = useLight();
  const stage = normalizeStage(candidate.CurrentStage);
  const cfg = stageStyle(stage, light);
  const stageIdx = STAGE_ORDER.indexOf(stage);

  const [modal, setModal] = useState<null | "medical" | "result" | "branch">(null);

  /* Merge canonical doc set with whatever the sheet has for this candidate */
  const docs = DOC_TYPES.map((d) => {
    const found = checklist.find((c) => c.DocType === d.type);
    return {
      type: d.type,
      name: found?.DisplayName || d.name,
      status: found?.Status || "Pending",
      verdict: found?.Verdict || "",
      issue: found?.IssueText || "",
    };
  });
  // Include any doc types present in the sheet but outside the canonical set
  checklist.forEach((c) => {
    if (!DOC_TYPES.some((d) => d.type === c.DocType)) {
      docs.push({ type: c.DocType, name: c.DisplayName || c.DocType, status: c.Status || "Pending", verdict: c.Verdict || "", issue: c.IssueText || "" });
    }
  });

  const actionButton = (() => {
    if (stage === "DocsUnderCheck") return { label: "Approve & Schedule Medical", icon: Stethoscope, onClick: () => setModal("medical") };
    if (stage === "MedicalPending") return { label: "Record Medical Result", icon: HeartPulse, onClick: () => setModal("result") };
    if (stage === "Training")       return { label: "Allocate Branch", icon: Building2, onClick: () => setModal("branch") };
    return null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to pipeline
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-display font-bold text-lg flex-shrink-0">
            {initials(candidate.Name)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-foreground">{candidate.Name}</h1>
              <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium", cfg.pill)}>{cfg.label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1">
              <span>{candidate.RefCode}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{candidate.Position}</span>
              {candidate.DOB && <><span className="text-muted-foreground/40">·</span><span>DOB {candidate.DOB}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {actionButton && (
            <Button onClick={actionButton.onClick} className="gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow flex-shrink-0">
              <actionButton.icon className="w-4 h-4" /> {actionButton.label}
            </Button>
          )}
          <DeleteButton label={`Delete ${candidate.Name}`} size="md" onClick={onDelete} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Journey stepper */}
      <section className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm overflow-x-auto">
        <div className="flex items-center min-w-[640px]">
          {STAGE_ORDER.map((s, i) => {
            const sc = stageStyle(s, light);
            const done = i < stageIdx;
            const current = i === stageIdx;
            const Icon = sc.icon;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center transition-colors",
                    done
                      ? light
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                        : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : current ? cn(sc.soft, sc.text)
                      : "bg-background/40 border-border/50 text-muted-foreground/40",
                  )}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={cn(
                    "text-[9px] font-mono text-center leading-tight w-16",
                    current ? sc.text
                      : done ? (light ? "text-emerald-700/80" : "text-emerald-400/70")
                      : "text-muted-foreground/40",
                  )}>
                    {sc.label}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className={cn("h-px flex-1 mx-1 -mt-6", i < stageIdx ? "bg-emerald-500/40" : "bg-border/50")} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="space-y-4">
          <section className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Candidate Details</div>
            <div className="space-y-3">
              <DetailRow icon={Mail} label="Email" value={candidate.Email} mono />
              <DetailRow icon={Calendar} label="DOB" value={candidate.DOB} mono />
              <DetailRow icon={Briefcase} label="Position" value={candidate.Position} />
              {candidate.FolderURL && (
                <a href={candidate.FolderURL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Document folder
                </a>
              )}
            </div>
          </section>

          {/* Contextual info */}
          {(candidate.MedicalDate || candidate.MedicalStatus) && (
            <section className="bg-card/40 border border-purple-500/20 rounded-xl p-5 backdrop-blur-sm">
              <div className={cn(
                "text-[10px] font-mono uppercase tracking-widest mb-4 flex items-center gap-1.5",
                light ? "text-purple-700" : "text-purple-400/80",
              )}>
                <HeartPulse className="w-3.5 h-3.5" /> Medical
              </div>
              <div className="space-y-3">
                {candidate.MedicalDate && <DetailRow icon={Calendar} label="Date" value={`${candidate.MedicalDate} ${candidate.MedicalTime}`.trim()} />}
                {candidate.MedicalAddress && <DetailRow icon={MapPin} label="Hospital" value={candidate.MedicalAddress} />}
                {candidate.MedicalStatus && (
                  <DetailRow
                    icon={candidate.MedicalStatus === "Fit" ? CheckCircle2 : AlertTriangle}
                    label="Result"
                    value={candidate.MedicalStatus}
                  />
                )}
              </div>
            </section>
          )}

          {candidate.AllocatedBranch && (
            <section className="bg-card/40 border border-emerald-500/20 rounded-xl p-5 backdrop-blur-sm">
              <div className={cn(
                "text-[10px] font-mono uppercase tracking-widest mb-4 flex items-center gap-1.5",
                light ? "text-emerald-700" : "text-emerald-400/80",
              )}>
                <Building2 className="w-3.5 h-3.5" /> Branch Allocation
              </div>
              <div className="space-y-3">
                <DetailRow icon={Building2} label="Branch" value={candidate.AllocatedBranch} />
                {candidate.BranchPOC && <DetailRow icon={Users} label="POC" value={candidate.BranchPOC} />}
                {candidate.BranchPOCContact && <DetailRow icon={Mail} label="Contact" value={candidate.BranchPOCContact} mono />}
              </div>
            </section>
          )}
        </div>

        {/* Right: document checklist */}
        <div className="lg:col-span-2">
          <section className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Document Checklist</div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {docs.filter((d) => d.status === "Received").length}/{docs.length} received
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docs.map((doc) => (
                <DocCard key={doc.type} doc={doc} folderUrl={candidate.FolderURL} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      <ScheduleMedicalDialog
        open={modal === "medical"}
        onOpenChange={(o) => !o && setModal(null)}
        refCode={candidate.RefCode}
        onDone={onMutated}
        toast={toast}
      />
      <MedicalResultDialog
        open={modal === "result"}
        onOpenChange={(o) => !o && setModal(null)}
        refCode={candidate.RefCode}
        onDone={onMutated}
        toast={toast}
      />
      <AllocateBranchDialog
        open={modal === "branch"}
        onOpenChange={(o) => !o && setModal(null)}
        refCode={candidate.RefCode}
        onDone={onMutated}
        toast={toast}
      />
    </motion.div>
  );
}

function DetailRow({ icon: Icon, label, value, mono }: { icon: typeof Mail; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-mono text-muted-foreground uppercase">{label}</div>
        <div className={cn("text-sm text-foreground/90 break-words", mono && "font-mono")}>{value || "—"}</div>
      </div>
    </div>
  );
}

function DocCard({ doc, folderUrl }: { doc: { type: string; name: string; status: string; verdict: string; issue: string }; folderUrl: string }) {
  const light = useLight();
  const flagged = doc.status === "Flagged";
  const received = doc.status === "Received";

  const cls = flagged
    ? light ? "border-amber-500/40 bg-amber-500/10" : "border-amber-500/40 bg-amber-500/5"
    : received
      ? light ? "border-green-500/40 bg-green-500/10" : "border-green-500/40 bg-green-500/5"
      : "border-border/50 bg-background/40";

  const Icon = flagged ? AlertTriangle : received ? CheckCircle2 : Clock;
  const iconCls = flagged
    ? light ? "text-amber-700" : "text-amber-400"
    : received
      ? light ? "text-green-700" : "text-green-400"
      : "text-muted-foreground/50";

  return (
    <div className={cn("rounded-lg border p-3.5 transition-colors", cls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("w-4 h-4 flex-shrink-0", iconCls)} />
          <span className="text-sm font-medium text-foreground/90 truncate">{doc.name}</span>
        </div>
        {folderUrl && received && (
          <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0" title="View in folder">
            <Eye className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={cn(
          "text-[9px] font-mono px-1.5 py-0.5 rounded-full border",
          flagged ? cn(light ? "text-amber-700" : "text-amber-400", "border-amber-500/30 bg-amber-500/10")
            : received ? cn(light ? "text-green-700" : "text-green-400", "border-green-500/30 bg-green-500/10")
            : "text-muted-foreground border-border/50 bg-background/40",
        )}>
          {flagged ? "Flagged" : received ? "Received" : "Pending"}
        </span>
        {received && doc.verdict && doc.verdict !== "OK" && (
          <span className={cn("text-[9px] font-mono", light ? "text-amber-700" : "text-amber-400")}>{doc.verdict}</span>
        )}
      </div>
      {flagged && doc.issue && (
        <div className={cn(
          "mt-2.5 text-[11px] bg-amber-500/10 border border-amber-500/20 rounded p-2 leading-relaxed",
          light ? "text-amber-800" : "text-amber-300/90",
        )}>
          {doc.issue}
        </div>
      )}
      {!received && !flagged && (
        <div className="mt-2 text-[10px] text-muted-foreground/60 font-mono">Awaiting submission</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Shared automation note
══════════════════════════════════════════════════════ */
function AutomationNote() {
  return (
    <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
      <Loader2 className="w-3 h-3" /> Changes will be processed on the next automation cycle.
    </p>
  );
}

/* ══════════════════════════════════════════════════════
   Dialogs
══════════════════════════════════════════════════════ */
function AddCandidateDialog({ open, onOpenChange, onAdded, toast }: {
  open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void; toast: ToastFn;
}) {
  const light = useLight();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [position, setPosition] = useState("PO");

  const mutation = useMutation({
    mutationFn: () => apiSend("/candidates", "POST", {
      name: name.trim(),
      email: email.trim(),
      dob: isoToDDMMYYYY(dob),
      position,
    }),
    onSuccess: () => {
      toast({ title: "Candidate added", description: "Row written to the Candidates sheet. WF-1 will pick it up on the next cycle." });
      onAdded();
      reset();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Failed to add candidate", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function reset() { setName(""); setEmail(""); setDob(""); setPosition("PO"); }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim() && emailValid && dob && position;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className={cn("bg-card border-border/60", light && "light-mode")}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Add Candidate
          </DialogTitle>
          <DialogDescription>RefCode is generated automatically. The candidate is added to the pipeline immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Nair" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="arjun.n@gmail.com" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth">
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Position">
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCandidateDialog({ candidate, onOpenChange, onDeleted, toast }: {
  candidate: Candidate | null;
  onOpenChange: (o: boolean) => void;
  onDeleted: (refCode: string) => void;
  toast: ToastFn;
}) {
  const light = useLight();
  const refCode = candidate?.RefCode ?? "";
  const name = candidate?.Name ?? "";

  const mutation = useMutation({
    mutationFn: () => apiSend(`/candidates/${encodeURIComponent(refCode)}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Candidate deleted", description: `${name} was removed from the Candidates and Checklist sheets.` });
      onDeleted(refCode);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Failed to delete candidate", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className={cn("bg-card border-border/60", light && "light-mode")}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" /> Delete candidate
          </DialogTitle>
          <DialogDescription>
            Delete {name}? This will remove them from the sheet permanently.
          </DialogDescription>
        </DialogHeader>
        <p className="text-[11px] font-mono text-muted-foreground py-1">{refCode}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2 bg-red-600 text-white hover:bg-red-700"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleMedicalDialog({ open, onOpenChange, refCode, onDone, toast }: {
  open: boolean; onOpenChange: (o: boolean) => void; refCode: string; onDone: () => void; toast: ToastFn;
}) {
  const light = useLight();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiSend(`/candidates/${encodeURIComponent(refCode)}/approve-docs`, "PATCH", {
      medicalDate: isoToDDMMYYYY(date),
      medicalTime: to12Hour(time),
      medicalAddress: address.trim(),
    }),
    onSuccess: () => {
      toast({ title: "Documents approved", description: "Medical details saved. WF-3 will email the candidate on the next cycle." });
      onDone();
      reset();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function reset() { setDate(""); setTime(""); setAddress(""); }
  const valid = date && time && address.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className={cn("bg-card border-border/60", light && "light-mode")}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Approve &amp; Schedule Medical
          </DialogTitle>
          <DialogDescription>Documents will be marked approved and the medical appointment recorded.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Medical Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Hospital / Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Apollo Hospital, Andheri West, Mumbai" />
          </Field>
          <AutomationNote />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve &amp; Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicalResultDialog({ open, onOpenChange, refCode, onDone, toast }: {
  open: boolean; onOpenChange: (o: boolean) => void; refCode: string; onDone: () => void; toast: ToastFn;
}) {
  const light = useLight();
  const [status, setStatus] = useState<"Fit" | "Unfit" | null>(null);

  const mutation = useMutation({
    mutationFn: (result: "Fit" | "Unfit") => apiSend(`/candidates/${encodeURIComponent(refCode)}/medical-result`, "PATCH", { status: result }),
    onSuccess: (_data, result) => {
      toast({ title: `Medical result recorded: ${result}`, description: "WF-3 will advance the candidate on the next cycle." });
      onDone();
      setStatus(null);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) { onOpenChange(o); if (!o) setStatus(null); } }}>
      <DialogContent className={cn("bg-card border-border/60", light && "light-mode")}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" /> Record Medical Result
          </DialogTitle>
          <DialogDescription>Record the outcome of the candidate's medical examination.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <button
            onClick={() => setStatus("Fit")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-6 transition-all",
              status === "Fit" ? "border-green-500/50 bg-green-500/10" : "border-border/50 bg-background/40 hover:border-green-500/30",
            )}
          >
            <CheckCircle2 className={cn("w-8 h-8", status === "Fit" ? (light ? "text-green-700" : "text-green-400") : "text-muted-foreground/50")} />
            <span className={cn("text-sm font-medium", status === "Fit" ? (light ? "text-green-700" : "text-green-400") : "text-muted-foreground")}>Fit</span>
          </button>
          <button
            onClick={() => setStatus("Unfit")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-6 transition-all",
              status === "Unfit" ? "border-red-500/50 bg-red-500/10" : "border-border/50 bg-background/40 hover:border-red-500/30",
            )}
          >
            <AlertTriangle className={cn("w-8 h-8", status === "Unfit" ? (light ? "text-red-700" : "text-red-400") : "text-muted-foreground/50")} />
            <span className={cn("text-sm font-medium", status === "Unfit" ? (light ? "text-red-700" : "text-red-400") : "text-muted-foreground")}>Unfit</span>
          </button>
        </div>
        <AutomationNote />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => status && mutation.mutate(status)} disabled={!status || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocateBranchDialog({ open, onOpenChange, refCode, onDone, toast }: {
  open: boolean; onOpenChange: (o: boolean) => void; refCode: string; onDone: () => void; toast: ToastFn;
}) {
  const light = useLight();
  const [branch, setBranch] = useState("");
  const [poc, setPoc] = useState("");
  const [pocContact, setPocContact] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiSend(`/candidates/${encodeURIComponent(refCode)}/allocate-branch`, "PATCH", {
      branch: branch.trim(),
      poc: poc.trim(),
      pocContact: pocContact.trim(),
    }),
    onSuccess: () => {
      toast({ title: "Branch allocated", description: "WF-3 will send the final reporting letter on the next cycle." });
      onDone();
      reset();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function reset() { setBranch(""); setPoc(""); setPocContact(""); }
  const valid = branch.trim() && poc.trim() && pocContact.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className={cn("bg-card border-border/60", light && "light-mode")}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Allocate Branch
          </DialogTitle>
          <DialogDescription>Assign the candidate to a branch and mark training complete.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Branch">
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="IDBI Bank, Andheri West" />
          </Field>
          <Field label="POC Name">
            <Input value={poc} onChange={(e) => setPoc(e.target.value)} placeholder="Branch manager name" />
          </Field>
          <Field label="POC Contact">
            <Input value={pocContact} onChange={(e) => setPocContact(e.target.value)} placeholder="Phone or email" />
          </Field>
          <AutomationNote />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Allocate Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}
