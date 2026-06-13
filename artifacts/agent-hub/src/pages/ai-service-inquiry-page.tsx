import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send, CheckCircle2, Loader2, RotateCcw, AlertTriangle,
  Cpu, FileText, Shield, BarChart2, MessageSquare, Settings, Lock,
} from "lucide-react";

const SERVICES = [
  "Machine Learning",
  "AI Automation",
  "Predictive Analytics",
  "Conversational AI",
  "Process Optimization",
  "AI Security",
  "Custom Solution",
] as const;

const BUDGETS = [
  "$5,000 - $10,000",
  "$10,000 - $25,000",
  "$25,000 - $50,000",
  "$50,000 - $100,000",
  "$100,000+",
] as const;

const TIMELINES = [
  "Less than 1 month",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "Ongoing partnership",
] as const;

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "Machine Learning":      <Cpu className="w-5 h-5" />,
  "AI Automation":         <Settings className="w-5 h-5" />,
  "Predictive Analytics":  <BarChart2 className="w-5 h-5" />,
  "Conversational AI":     <MessageSquare className="w-5 h-5" />,
  "Process Optimization":  <Settings className="w-5 h-5" />,
  "AI Security":           <Lock className="w-5 h-5" />,
  "Custom Solution":       <FileText className="w-5 h-5" />,
};

const SERVICE_DESC: Record<string, string> = {
  "Machine Learning":      "Custom ML models trained on your data for prediction, classification, and pattern recognition.",
  "AI Automation":         "End-to-end workflow automation powered by AI to eliminate manual processes.",
  "Predictive Analytics":  "Forecast business outcomes using historical data and advanced modeling techniques.",
  "Conversational AI":     "Intelligent chatbots and voice agents for customer support, sales, and internal ops.",
  "Process Optimization":  "AI-driven analysis to identify bottlenecks and improve operational efficiency.",
  "AI Security":           "Threat detection, anomaly monitoring, and security intelligence powered by AI.",
  "Custom Solution":       "Bespoke AI solutions tailored to your unique business requirements.",
};

const inputCls =
  "w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors";
const labelCls =
  "text-xs text-muted-foreground font-mono mb-1.5 block uppercase tracking-wider";

type SubmitState = "idle" | "sending" | "success" | "error";

interface InquiryResult {
  can_help?: string;
  matched_service?: string;
  reason?: string;
  [key: string]: unknown;
}

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function AiServiceInquiryPage() {
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [service, setService]         = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget]           = useState("");
  const [timeline, setTimeline]       = useState("");

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [result, setResult]           = useState<InquiryResult | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [touched, setTouched]         = useState<Record<string, boolean>>({});

  const errors = {
    name:        name.trim().length < 2 ? "Name must be at least 2 characters" : "",
    email:       !validateEmail(email) ? "Valid email is required" : "",
    service:     !service ? "Please select a service" : "",
    description: description.trim().length < 20 ? "Description must be at least 20 characters" : "",
  };
  const isValid = !Object.values(errors).some(Boolean);

  function touch(field: string) {
    setTouched(p => ({ ...p, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, service: true, description: true });
    if (!isValid) return;

    setSubmitState("sending");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/agents/ai-service/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          service,
          description: description.trim(),
          budget: budget || undefined,
          timeline: timeline || undefined,
        }),
      });

      const data = await res.json() as InquiryResult & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      setResult(data);
      setSubmitState("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitState("error");
    }
  }

  function reset() {
    setName(""); setEmail(""); setPhone(""); setService("");
    setDescription(""); setBudget(""); setTimeline("");
    setSubmitState("idle"); setResult(null); setErrorMsg(null);
    setTouched({});
  }

  const canHelp = result?.can_help?.toString().toUpperCase() === "YES";
  const matchedService = result?.matched_service ?? service;
  const reason = result?.reason;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <div className="relative border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">ID_REF: AI-SVC-001</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            AI Service Inquiry Agent
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Tell us about your project. Our AI evaluates your requirements, matches the right solution,
            and automatically prepares your proposal, NDA, invoice, and data processing agreement.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ── Left: Services overview ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Services We Offer
          </div>
          {SERVICES.map(svc => (
            <div
              key={svc}
              onClick={() => setService(svc)}
              className={cn(
                "p-3.5 rounded-xl border cursor-pointer transition-all",
                service === svc
                  ? "border-primary/50 bg-primary/8 text-foreground"
                  : "border-border/40 bg-card/30 hover:border-primary/30 hover:bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <span className={cn("flex-shrink-0", service === svc ? "text-primary" : "text-muted-foreground")}>
                  {SERVICE_ICONS[svc]}
                </span>
                <span className="text-sm font-medium">{svc}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed pl-7">
                {SERVICE_DESC[svc]}
              </p>
            </div>
          ))}
        </div>

        {/* ── Right: Form ── */}
        <div className="lg:col-span-2">
          <div className="bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-sm text-primary uppercase tracking-widest">Service Inquiry Form</span>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {submitState === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    <div className={cn(
                      "rounded-xl border p-6 text-center space-y-3",
                      canHelp
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    )}>
                      {canHelp ? (
                        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                      )}
                      <p className={cn("font-semibold text-base", canHelp ? "text-green-300" : "text-amber-300")}>
                        {canHelp ? "Great news!" : "Thank you for your interest!"}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                        {canHelp
                          ? `Thank you! We've received your inquiry for ${matchedService}. Our team is preparing your project documents and will reach out shortly.`
                          : `Thank you for your interest! Unfortunately, ${reason ?? "this project falls outside our current service scope"}. We'll keep your details on file for future opportunities.`
                        }
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs w-full">
                      <RotateCcw className="w-3.5 h-3.5" /> Submit Another Inquiry
                    </Button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    {/* Row 1: Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Name <span className="text-primary">*</span></label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          onBlur={() => touch("name")}
                          className={cn(inputCls, touched.name && errors.name && "border-destructive/60")}
                        />
                        {touched.name && errors.name && (
                          <p className="text-[11px] text-destructive font-mono mt-1">{errors.name}</p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Email <span className="text-primary">*</span></label>
                        <input
                          type="email"
                          placeholder="john@company.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onBlur={() => touch("email")}
                          className={cn(inputCls, touched.email && errors.email && "border-destructive/60")}
                        />
                        {touched.email && errors.email && (
                          <p className="text-[11px] text-destructive font-mono mt-1">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Phone + Service */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Phone Number</label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Service <span className="text-primary">*</span></label>
                        <select
                          value={service}
                          onChange={e => setService(e.target.value)}
                          onBlur={() => touch("service")}
                          className={cn(inputCls, "cursor-pointer", touched.service && errors.service && "border-destructive/60")}
                        >
                          <option value="" disabled>Select a service…</option>
                          {SERVICES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {touched.service && errors.service && (
                          <p className="text-[11px] text-destructive font-mono mt-1">{errors.service}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Description */}
                    <div>
                      <label className={labelCls}>Project Description <span className="text-primary">*</span></label>
                      <textarea
                        placeholder="Describe your project goals, challenges, and what success looks like..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onBlur={() => touch("description")}
                        rows={4}
                        className={cn(inputCls, "resize-y min-h-[100px]", touched.description && errors.description && "border-destructive/60")}
                      />
                      <div className="flex justify-between mt-1">
                        {touched.description && errors.description
                          ? <p className="text-[11px] text-destructive font-mono">{errors.description}</p>
                          : <span />
                        }
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{description.length} chars</span>
                      </div>
                    </div>

                    {/* Row 4: Budget + Timeline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Budget Range</label>
                        <select
                          value={budget}
                          onChange={e => setBudget(e.target.value)}
                          className={cn(inputCls, "cursor-pointer")}
                        >
                          <option value="">Select budget…</option>
                          {BUDGETS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Timeline</label>
                        <select
                          value={timeline}
                          onChange={e => setTimeline(e.target.value)}
                          className={cn(inputCls, "cursor-pointer")}
                        >
                          <option value="">Select timeline…</option>
                          {TIMELINES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Error banner */}
                    {submitState === "error" && errorMsg && (
                      <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="font-mono">{errorMsg}</span>
                      </div>
                    )}

                    {/* Submit */}
                    <Button
                      type="submit"
                      className="w-full gap-2 shadow-[0_0_20px_rgba(var(--primary),0.25)]"
                      disabled={submitState === "sending"}
                    >
                      {submitState === "sending" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Send Message
                        </>
                      )}
                    </Button>

                    <p className="text-[10px] text-muted-foreground font-mono text-center">
                      Your inquiry → Make.com → OpenAI o4-mini evaluates fit → Documents generated in Google Drive
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Flow info cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "01", label: "Inquiry Received",   desc: "Your details are logged to Google Sheets and evaluated by AI." },
              { step: "02", label: "AI Evaluation",      desc: "OpenAI o4-mini assesses fit and selects the right service match." },
              { step: "03", label: "Documents Generated", desc: "Proposal, NDA, Invoice, and DPA auto-generated in Google Drive." },
            ].map(card => (
              <div key={card.step} className="p-4 bg-card/30 border border-border/40 rounded-xl">
                <div className="text-[10px] font-mono text-primary/60 mb-1">{card.step}</div>
                <div className="text-sm font-semibold text-foreground mb-1.5">{card.label}</div>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
