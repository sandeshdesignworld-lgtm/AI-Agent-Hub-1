import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEBHOOK_URLS } from "@/lib/config";
import {
  FileText, CheckCircle2, Loader2, RotateCcw,
  AlertTriangle, Send, Briefcase,
} from "lucide-react";

const DOCUMENT_TYPES = ["Proposal", "SOW", "NDA", "DPA", "Commercial Invoice"] as const;

const DOC_STEPS = [
  "Submitting request to document engine...",
  "Analyzing client requirements...",
  "Classifying document type and template...",
  "AI generating document structure...",
  "Drafting document content...",
  "Formatting and finalizing document...",
];
const STEP_INTERVAL_MS = 10_000;
const LAST_ANIMATED_STEP = DOC_STEPS.length - 1;

const inputCls =
  "w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors";
const labelCls =
  "text-xs text-muted-foreground font-mono mb-1.5 block uppercase tracking-wider";

type DocResult = {
  document?: string;
  content?: string;
  output?: string;
  raw?: string;
};

function parseResult(data: unknown): DocResult {
  if (!data || typeof data !== "object") {
    if (typeof data === "string") return { document: data };
    return {};
  }
  const obj = data as Record<string, unknown>;
  return {
    document: (obj.document ?? obj.content ?? obj.output) as string | undefined,
    raw: typeof data === "string" ? data : undefined,
  };
}

export function BusinessDocumentationPage() {
  const [clientName, setClientName]             = useState("");
  const [companyName, setCompanyName]           = useState("");
  const [documentType, setDocumentType]         = useState<string>(DOCUMENT_TYPES[0]);
  const [projectDescription, setProjectDescription] = useState("");
  const [budget, setBudget]                     = useState("");
  const [timeline, setTimeline]                 = useState("");

  const [step, setStep]   = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocResult | null>(null);

  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = step >= 0 && step < DOC_STEPS.length;
  const isDone    = step >= DOC_STEPS.length;

  function stopSim() {
    if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
  }

  function reset() {
    stopSim();
    setStep(-1); setError(null); setResult(null);
    setClientName(""); setCompanyName(""); setDocumentType(DOCUMENT_TYPES[0]);
    setProjectDescription(""); setBudget(""); setTimeline("");
  }

  function startSimulation() {
    let cur = 0;
    setStep(0);
    simTimerRef.current = setInterval(() => {
      cur += 1;
      if (cur <= LAST_ANIMATED_STEP) setStep(cur);
      if (cur >= LAST_ANIMATED_STEP) stopSim();
    }, STEP_INTERVAL_MS);
  }

  useEffect(() => () => stopSim(), []);

  const isFormValid =
    clientName.trim() &&
    companyName.trim() &&
    documentType &&
    projectDescription.trim();

  async function handleGenerate() {
    if (!isFormValid) return;
    setError(null);
    setResult(null);
    stopSim();
    startSimulation();

    try {
      const res = await fetch(WEBHOOK_URLS.businessDoc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          companyName: companyName.trim(),
          documentType,
          projectDescription: projectDescription.trim(),
          budget: budget.trim() || undefined,
          timeline: timeline.trim() || undefined,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      let data: unknown;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in (data as Record<string, unknown>)
            ? String((data as Record<string, unknown>).error)
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      stopSim();
      setResult(parseResult(data));
      setStep(DOC_STEPS.length);
    } catch (e: unknown) {
      stopSim();
      setStep(-1);
      if (e instanceof Error && e.name === "TimeoutError") {
        setError("The request timed out. The document engine may still be processing — please try again.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to generate document");
      }
    }
  }

  const documentContent =
    result?.document ??
    result?.content ??
    result?.output ??
    result?.raw;

  return (
    <div className="space-y-10">

      {/* ── Hero ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Business Documentation Agent</h1>
            <p className="text-sm font-mono text-primary">ID_REF: DOC-AUTO-001</p>
          </div>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Submit your client requirements and receive a professionally generated business document — proposal, contract, compliance agreement, or invoice — ready for immediate use.
        </p>
      </div>

      {/* ── Form / Progress / Result ── */}
      <div className="bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-sm text-primary uppercase tracking-widest">Generate Document</span>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ── FORM ── */}
            {step === -1 && !error && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Client Name <span className="text-primary normal-case">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Company Name <span className="text-primary normal-case">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. ABC Technologies Pvt Ltd"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Document Type <span className="text-primary normal-case">*</span></label>
                  <select
                    value={documentType}
                    onChange={e => setDocumentType(e.target.value)}
                    className={inputCls}
                    style={{ colorScheme: "dark" }}
                  >
                    {DOCUMENT_TYPES.map(dt => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Project Description <span className="text-primary normal-case">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="e.g. AI chatbot implementation for customer support, including knowledge base integration and UAT support."
                    value={projectDescription}
                    onChange={e => setProjectDescription(e.target.value)}
                    className={cn(inputCls, "resize-none")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Budget</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹4,50,000"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Timeline</label>
                    <input
                      type="text"
                      placeholder="e.g. 6 weeks"
                      value={timeline}
                      onChange={e => setTimeline(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!isFormValid}
                  className="gap-2 shadow-[0_0_20px_rgba(var(--primary),0.25)] hover:shadow-[0_0_30px_rgba(var(--primary),0.45)] transition-shadow"
                >
                  <Send className="w-4 h-4" /> Generate Document
                </Button>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {error && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-start gap-2 text-destructive text-sm font-mono">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
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

                {/* Steps */}
                <div className="space-y-3">
                  {DOC_STEPS.map((s, i) => {
                    const isPast   = isDone || i < step;
                    const isActive = !isDone && i === step;
                    const isAhead  = !isDone && i > step;
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
                          <div className="w-4 h-4 rounded-full border border-border/30 flex-shrink-0" />
                        )}
                        <span className={cn(
                          "font-mono flex-1",
                          isPast   ? "text-muted-foreground line-through" :
                          isActive ? "text-primary" :
                          "text-muted-foreground/25"
                        )}>
                          {s}
                        </span>
                        {isActive && i === LAST_ANIMATED_STEP && (
                          <span className="text-[9px] font-mono text-muted-foreground/40 hidden sm:block shrink-0">
                            awaiting document engine…
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── RESULT ── */}
                {isDone && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4">

                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="font-mono text-xs text-green-400 uppercase tracking-widest font-semibold">
                        Document Generated
                      </span>
                      <span className="ml-auto text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400">
                        ✓ Success
                      </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
                      <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-mono text-foreground/80">
                        {documentType} — {companyName}
                      </span>
                    </div>

                    {documentContent ? (
                      <div className="rounded-xl border border-border/60 bg-background/80 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/10 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-foreground/80 leading-none">{documentType}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Generated for {clientName}</div>
                          </div>
                          <span className="ml-auto text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                            Output
                          </span>
                        </div>
                        <div className="px-5 py-4">
                          <pre className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                            {documentContent}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4 text-sm text-green-400 font-mono">
                        ✓ Document request submitted successfully. The generated document will be delivered to your configured output destination.
                      </div>
                    )}

                    <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
                      <RotateCcw className="w-3 h-3" /> Generate Another Document
                    </Button>
                  </motion.div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Document types overview ── */}
      <div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">Supported Document Types</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { type: "Proposal",          desc: "Professional services proposals with scope, timeline, and commercials.",      color: "border-t-violet-500/70", iconColor: "text-violet-400" },
            { type: "SOW",               desc: "Statements of Work defining deliverables, milestones, and acceptance criteria.", color: "border-t-cyan-500/70",   iconColor: "text-cyan-400"   },
            { type: "NDA",               desc: "Non-Disclosure Agreements protecting confidential business information.",        color: "border-t-teal-500/70",   iconColor: "text-teal-400"   },
            { type: "DPA",               desc: "Data Processing Agreements for GDPR and compliance-aligned engagements.",       color: "border-t-blue-500/70",   iconColor: "text-blue-400"   },
            { type: "Commercial Invoice", desc: "Milestone-based invoices with payment terms and service line breakdowns.",     color: "border-t-amber-500/70",  iconColor: "text-amber-400"  },
          ].map((item, i) => (
            <motion.div
              key={item.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn("bg-card/40 border border-border/50 border-t-2 rounded-xl p-5 backdrop-blur-sm", item.color)}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className={cn("w-4 h-4 flex-shrink-0", item.iconColor)} />
                <h3 className={cn("font-display font-semibold text-sm", item.iconColor)}>{item.type}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
}
