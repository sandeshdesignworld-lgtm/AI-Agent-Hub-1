import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Building2, Phone, UserSearch, CalendarPlus, CalendarX2,
  CalendarClock, BellRing, CalendarCheck, CheckCircle2,
  AlertTriangle, Loader2, RotateCcw, ChevronRight,
} from "lucide-react";

const VOICE_AGENT_PHONE = "+12296090223";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00",
];

const TODAY = new Date().toISOString().split("T")[0];

/* ── Types ── */
interface Appointment {
  id: string | number;
  doctor?: string;
  date?: string;
  time?: string;
  reason?: string;
  [key: string]: unknown;
}

interface PatientData {
  found: string;
  patient_id?: string | number;
  patient_name?: string;
  phone?: string;
  appointments_count?: string | number;
  appointments?: Appointment[];
  message?: string;
}

interface BookData {
  success: string;
  appointment_id?: string | number;
  message?: string;
}

interface ActionData {
  success: string;
  message?: string;
  new_date?: string;
  new_time?: string;
  appointment_id?: string | number;
}

/* ── API helper ── */
async function callHospitalAgent(action: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/agents/hospital-receptionist/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action, args }),
  });
  const json = await res.json() as { error?: string; data?: unknown };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

/* ── Stepper ── */
function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="space-y-2.5 py-2">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 * i }}
          className="flex items-center gap-3 text-sm font-mono"
        >
          {current > i ? (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          ) : current === i ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full border border-border/40 shrink-0" />
          )}
          <span className={cn("transition-colors", current >= i ? "text-foreground" : "text-muted-foreground/50")}>
            {step}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Error card ── */
function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center gap-2 text-destructive text-sm font-mono">
        <AlertTriangle className="w-4 h-4" />
        <span>{message}</span>
      </div>
      <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:text-primary" onClick={onRetry}>
        <RotateCcw className="w-3.5 h-3.5" /> Try Again
      </Button>
    </motion.div>
  );
}

/* ── Input / Select shared styles ── */
const inputCls = "w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors";
const labelCls = "text-xs text-muted-foreground font-mono mb-1.5 block";

/* ═══════════════════════════════════════
   TAB 1 — Patient Lookup
═══════════════════════════════════════ */
const LOOKUP_STEPS = [
  "Searching patient database...",
  "Fetching appointment records...",
  "Compiling patient profile...",
];
const LOOKUP_DELAYS = [0, 1200, 2800];

function PatientLookupTab() {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<PatientData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [rowState, setRowState] = useState<Record<string, {
    cancelled: boolean;
    cancelling: boolean;
    rescheduling: boolean;
    rescheduled: boolean;
    rescheduleLoading: boolean;
    newDate: string;
    newTime: string;
  }>>({});

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function reset() {
    clearTimers();
    setStep(-1);
    setResult(null);
    setError(null);
    setRowState({});
  }

  async function handleSearch() {
    if (!phone.trim()) return;
    reset();
    setStep(0);
    clearTimers();
    LOOKUP_DELAYS.forEach((d, i) => {
      if (i === 0) return;
      timersRef.current.push(setTimeout(() => setStep(i), d));
    });
    try {
      const data = await callHospitalAgent("patient_lookup", { phone_number: phone.trim() }) as PatientData;
      clearTimers();
      setStep(LOOKUP_STEPS.length);
      let appointments = data.appointments ?? [];
      if (typeof appointments === "string") {
        try { appointments = JSON.parse(appointments as unknown as string); } catch { appointments = []; }
      }
      setResult({ ...data, appointments: appointments as Appointment[] });
    } catch (e: unknown) {
      clearTimers();
      setStep(-1);
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  function initRow(id: string | number) {
    const key = String(id);
    if (!rowState[key]) {
      setRowState(prev => ({
        ...prev,
        [key]: { cancelled: false, cancelling: false, rescheduling: false, rescheduled: false, rescheduleLoading: false, newDate: "", newTime: "" },
      }));
    }
  }

  async function handleCancel(appointmentId: string | number) {
    const key = String(appointmentId);
    setRowState(prev => ({ ...prev, [key]: { ...prev[key], cancelling: true } }));
    try {
      await callHospitalAgent("cancel_appointment", { appointment_id: parseInt(String(appointmentId), 10) });
      setRowState(prev => ({ ...prev, [key]: { ...prev[key], cancelling: false, cancelled: true } }));
    } catch (e: unknown) {
      setRowState(prev => ({ ...prev, [key]: { ...prev[key], cancelling: false } }));
      alert(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  async function handleReschedule(appointmentId: string | number) {
    const key = String(appointmentId);
    const rs = rowState[key];
    if (!rs?.newDate || !rs?.newTime) return;
    setRowState(prev => ({ ...prev, [key]: { ...prev[key], rescheduleLoading: true } }));
    try {
      await callHospitalAgent("reschedule_appointment", {
        appointment_id: parseInt(String(appointmentId), 10),
        new_date: rs.newDate,
        new_time: rs.newTime,
      });
      setRowState(prev => ({ ...prev, [key]: { ...prev[key], rescheduleLoading: false, rescheduled: true, rescheduling: false } }));
      setResult(prev => {
        if (!prev?.appointments) return prev;
        return {
          ...prev,
          appointments: prev.appointments.map(a =>
            String(a.id) === key ? { ...a, date: rs.newDate, time: rs.newTime } : a
          ),
        };
      });
    } catch (e: unknown) {
      setRowState(prev => ({ ...prev, [key]: { ...prev[key], rescheduleLoading: false } }));
      alert(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  const appointments = result?.appointments ?? [];

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && step < 0 && handleSearch()}
          className={cn(inputCls, "flex-1")}
        />
        <Button
          onClick={handleSearch}
          disabled={!phone.trim() || step >= 0}
          className="gap-2 shrink-0"
        >
          {step >= 0 && step < LOOKUP_STEPS.length
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <UserSearch className="w-4 h-4" />}
          Search Patient
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {step >= 0 && step < LOOKUP_STEPS.length && (
          <motion.div key="stepper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Stepper steps={LOOKUP_STEPS} current={step} />
          </motion.div>
        )}

        {error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorCard message={error} onRetry={reset} />
          </motion.div>
        )}

        {result && step >= LOOKUP_STEPS.length && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {result.found === "true" ? (
              <>
                {/* Patient card */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase mb-3">
                    <CheckCircle2 className="w-4 h-4" /> Patient Found
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{result.patient_name ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">{result.patient_id ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{result.phone ?? phone}</span></div>
                    <div><span className="text-muted-foreground">Appointments:</span> <span className="font-medium">{result.appointments_count ?? appointments.length}</span></div>
                  </div>
                </div>

                {/* Appointments table */}
                {appointments.length > 0 && (
                  <div>
                    <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Appointments</div>
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50 bg-muted/20">
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">ID</th>
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">Doctor</th>
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">Date</th>
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">Time</th>
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">Reason</th>
                              <th className="text-left px-3 py-2 text-xs font-mono text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appointments.map((appt, idx) => {
                              const key = String(appt.id);
                              const rs = rowState[key] ?? { cancelled: false, cancelling: false, rescheduling: false, rescheduled: false, rescheduleLoading: false, newDate: "", newTime: "" };
                              return (
                                <>
                                  <tr
                                    key={key}
                                    className={cn(
                                      "border-b border-border/30 transition-opacity",
                                      idx % 2 === 0 ? "bg-background/30" : "bg-muted/10",
                                      rs.cancelled && "opacity-40"
                                    )}
                                  >
                                    <td className="px-3 py-2 font-mono text-xs">{appt.id}</td>
                                    <td className="px-3 py-2">{(appt.doctor as string) || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{rs.rescheduled ? rs.newDate : ((appt.date as string) || "—")}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{rs.rescheduled ? rs.newTime : ((appt.time as string) || "—")}</td>
                                    <td className="px-3 py-2 text-muted-foreground text-xs">{(appt.reason as string) || "—"}</td>
                                    <td className="px-3 py-2">
                                      {rs.cancelled ? (
                                        <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">Cancelled</Badge>
                                      ) : rs.rescheduled ? (
                                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Rescheduled</Badge>
                                      ) : (
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => handleCancel(appt.id)}
                                            disabled={rs.cancelling}
                                            className="text-[11px] px-2 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                          >
                                            {rs.cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                                          </button>
                                          <button
                                            onClick={() => { initRow(appt.id); setRowState(prev => ({ ...prev, [key]: { ...prev[key] ?? rs, rescheduling: !prev[key]?.rescheduling } })); }}
                                            className="text-[11px] px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                                          >
                                            Reschedule
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                  {rs.rescheduling && !rs.cancelled && !rs.rescheduled && (
                                    <tr key={`${key}-reschedule`} className="bg-primary/5 border-b border-border/30">
                                      <td colSpan={6} className="px-3 py-3">
                                        <div className="flex flex-wrap items-end gap-3">
                                          <div>
                                            <label className={labelCls}>New Date</label>
                                            <input type="date" min={TODAY} value={rs.newDate}
                                              onChange={e => setRowState(prev => ({ ...prev, [key]: { ...prev[key], newDate: e.target.value } }))}
                                              style={{ colorScheme: "dark" }}
                                              className={cn(inputCls, "w-36")} />
                                          </div>
                                          <div>
                                            <label className={labelCls}>New Time</label>
                                            <select value={rs.newTime}
                                              onChange={e => setRowState(prev => ({ ...prev, [key]: { ...prev[key], newTime: e.target.value } }))}
                                              className={cn(inputCls, "w-28")}>
                                              <option value="">Select</option>
                                              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                          </div>
                                          <Button size="sm" onClick={() => handleReschedule(appt.id)} disabled={!rs.newDate || !rs.newTime || rs.rescheduleLoading} className="gap-1.5">
                                            {rs.rescheduleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                                            Confirm
                                          </Button>
                                          <button onClick={() => setRowState(prev => ({ ...prev, [key]: { ...prev[key], rescheduling: false } }))}
                                            className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
                  <RotateCcw className="w-3 h-3" /> Search Another Patient
                </Button>
              </>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-muted/20 border border-border/50 rounded-xl p-5 text-center space-y-2">
                <UserSearch className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No patient found.</p>
                <p className="text-sm text-muted-foreground">This appears to be a new patient. Use the Book Appointment tab to create their record.</p>
                <Button variant="outline" size="sm" onClick={reset} className="mt-3 gap-2 border-primary/20 hover:text-primary text-xs">
                  <RotateCcw className="w-3 h-3" /> Search Again
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB 2 — Book Appointment
═══════════════════════════════════════ */
const BOOK_STEPS = [
  "Checking patient records...",
  "Looking up doctor availability...",
  "Creating appointment...",
  "Confirming booking...",
];
const BOOK_DELAYS = [0, 1000, 2500, 4000];

interface BookForm {
  patient_name: string; patient_phone: string; patient_email: string;
  doctor_name: string; appointment_date: string; appointment_time: string; reason: string;
}

function emptyBookForm(): BookForm {
  return { patient_name: "", patient_phone: "", patient_email: "", doctor_name: "", appointment_date: "", appointment_time: "", reason: "" };
}

function BookAppointmentTab() {
  const [form, setForm] = useState<BookForm>(emptyBookForm());
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() { timersRef.current.forEach(clearTimeout); timersRef.current = []; }

  function reset() { clearTimers(); setStep(-1); setResult(null); setError(null); setForm(emptyBookForm()); }

  const f = (k: keyof BookForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const isValid = Object.values(form).every(v => v.trim() !== "");

  async function handleBook() {
    if (!isValid) return;
    setError(null); setResult(null); setStep(0);
    BOOK_DELAYS.forEach((d, i) => { if (i === 0) return; timersRef.current.push(setTimeout(() => setStep(i), d)); });
    try {
      const data = await callHospitalAgent("book_appointment", { ...form }) as BookData;
      clearTimers(); setStep(BOOK_STEPS.length); setResult(data);
    } catch (e: unknown) {
      clearTimers(); setStep(-1); setError(e instanceof Error ? e.message : "Booking failed");
    }
  }

  if (step >= 0 && step < BOOK_STEPS.length) {
    return <Stepper steps={BOOK_STEPS} current={step} />;
  }

  if (error) return <ErrorCard message={error} onRetry={reset} />;

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase mb-2">
            <CalendarCheck className="w-4 h-4" /> Appointment Confirmed
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {result.appointment_id && <div><span className="text-muted-foreground">Appointment ID:</span> <span className="font-mono font-medium">#{result.appointment_id}</span></div>}
            <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{form.patient_name}</span></div>
            <div><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">{form.doctor_name}</span></div>
            <div><span className="text-muted-foreground">Date:</span> <span className="font-mono">{form.appointment_date}</span></div>
            <div><span className="text-muted-foreground">Time:</span> <span className="font-mono">{form.appointment_time}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">Reason:</span> <span>{form.reason}</span></div>
          </div>
          {result.message && <p className="text-xs text-muted-foreground border-t border-border/40 pt-3 mt-2">{result.message}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
          <CalendarPlus className="w-3.5 h-3.5" /> Book Another
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs font-mono text-primary uppercase tracking-widest border-b border-border/40 pb-2">Patient Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Patient Name</label><input type="text" placeholder="Full name" value={form.patient_name} onChange={f("patient_name")} className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label><input type="text" placeholder="Mobile number" value={form.patient_phone} onChange={f("patient_phone")} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Email</label><input type="email" placeholder="patient@example.com" value={form.patient_email} onChange={f("patient_email")} className={inputCls} /></div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-mono text-primary uppercase tracking-widest border-b border-border/40 pb-2">Appointment Details</p>
        <div><label className={labelCls}>Doctor Name</label><input type="text" placeholder="e.g. Dr. Prerna Ladkani" value={form.doctor_name} onChange={f("doctor_name")} className={inputCls} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" min={TODAY} value={form.appointment_date} onChange={f("appointment_date")} style={{ colorScheme: "dark" }} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <select value={form.appointment_time} onChange={f("appointment_time")} className={inputCls}>
              <option value="">Select time</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div><label className={labelCls}>Reason for Visit</label><input type="text" placeholder="e.g. Consultation, Follow-up..." value={form.reason} onChange={f("reason")} className={inputCls} /></div>
      </div>

      <Button onClick={handleBook} disabled={!isValid} className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
        <CalendarPlus className="w-4 h-4" /> Book Appointment
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB 3 — Cancel Appointment
═══════════════════════════════════════ */
const CANCEL_STEPS = ["Verifying appointment...", "Cancelling booking...", "Sending confirmation..."];
const CANCEL_DELAYS = [0, 1000, 2500];

function CancelAppointmentTab() {
  const [appointmentId, setAppointmentId] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<ActionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() { timersRef.current.forEach(clearTimeout); timersRef.current = []; }
  function reset() { clearTimers(); setStep(-1); setResult(null); setError(null); setAppointmentId(""); }

  async function handleCancel() {
    if (!appointmentId.trim()) return;
    setError(null); setResult(null); setStep(0);
    CANCEL_DELAYS.forEach((d, i) => { if (i === 0) return; timersRef.current.push(setTimeout(() => setStep(i), d)); });
    try {
      const data = await callHospitalAgent("cancel_appointment", { appointment_id: parseInt(appointmentId, 10) }) as ActionData;
      clearTimers(); setStep(CANCEL_STEPS.length); setResult(data);
    } catch (e: unknown) {
      clearTimers(); setStep(-1); setError(e instanceof Error ? e.message : "Cancellation failed");
    }
  }

  if (step >= 0 && step < CANCEL_STEPS.length) return <Stepper steps={CANCEL_STEPS} current={step} />;
  if (error) return <ErrorCard message={error} onRetry={reset} />;

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-mono text-xs uppercase mb-2">
            <CalendarX2 className="w-4 h-4" /> Appointment Cancelled
          </div>
          <p className="text-sm">Appointment <span className="font-mono font-medium">#{appointmentId}</span> has been successfully cancelled.</p>
          {result.message && <p className="text-xs text-muted-foreground mt-1">{result.message}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
          <RotateCcw className="w-3 h-3" /> Cancel Another
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Appointment ID</label>
        <input type="number" placeholder="Enter appointment ID" value={appointmentId}
          onChange={e => setAppointmentId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && step < 0 && handleCancel()}
          className={inputCls} />
      </div>
      <Button onClick={handleCancel} disabled={!appointmentId.trim()}
        className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-[0_0_12px_rgba(239,68,68,0.2)]">
        <CalendarX2 className="w-4 h-4" /> Cancel Appointment
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════
   TAB 4 — Reschedule Appointment
═══════════════════════════════════════ */
const RESCHEDULE_STEPS = ["Verifying appointment...", "Checking new slot availability...", "Rescheduling booking...", "Sending confirmation..."];
const RESCHEDULE_DELAYS = [0, 1000, 2200, 3500];

function RescheduleAppointmentTab() {
  const [appointmentId, setAppointmentId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<ActionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() { timersRef.current.forEach(clearTimeout); timersRef.current = []; }
  function reset() { clearTimers(); setStep(-1); setResult(null); setError(null); setAppointmentId(""); setNewDate(""); setNewTime(""); }

  const isValid = appointmentId.trim() && newDate && newTime;

  async function handleReschedule() {
    if (!isValid) return;
    setError(null); setResult(null); setStep(0);
    RESCHEDULE_DELAYS.forEach((d, i) => { if (i === 0) return; timersRef.current.push(setTimeout(() => setStep(i), d)); });
    try {
      const data = await callHospitalAgent("reschedule_appointment", {
        appointment_id: parseInt(appointmentId, 10), new_date: newDate, new_time: newTime,
      }) as ActionData;
      clearTimers(); setStep(RESCHEDULE_STEPS.length); setResult(data);
    } catch (e: unknown) {
      clearTimers(); setStep(-1); setError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  if (step >= 0 && step < RESCHEDULE_STEPS.length) return <Stepper steps={RESCHEDULE_STEPS} current={step} />;
  if (error) return <ErrorCard message={error} onRetry={reset} />;

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase mb-2">
            <CalendarClock className="w-4 h-4" /> Appointment Rescheduled
          </div>
          <p className="text-sm">Appointment <span className="font-mono font-medium">#{appointmentId}</span> has been rescheduled.</p>
          <div className="text-sm mt-1 space-y-0.5">
            <div><span className="text-muted-foreground">New Date:</span> <span className="font-mono font-medium">{result.new_date ?? newDate}</span></div>
            <div><span className="text-muted-foreground">New Time:</span> <span className="font-mono font-medium">{result.new_time ?? newTime}</span></div>
          </div>
          {result.message && <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 mt-2">{result.message}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2 border-primary/20 hover:text-primary text-xs">
          <RotateCcw className="w-3 h-3" /> Reschedule Another
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Appointment ID</label>
        <input type="number" placeholder="Enter appointment ID" value={appointmentId}
          onChange={e => setAppointmentId(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>New Date</label>
          <input type="date" min={TODAY} value={newDate} onChange={e => setNewDate(e.target.value)}
            style={{ colorScheme: "dark" }} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>New Time</label>
          <select value={newTime} onChange={e => setNewTime(e.target.value)} className={inputCls}>
            <option value="">Select time</option>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <Button onClick={handleReschedule} disabled={!isValid}
        className="w-full gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
        <CalendarClock className="w-4 h-4" /> Reschedule Appointment
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════
   Hero Banner
═══════════════════════════════════════ */
function HeroBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-8 md:p-10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 pointer-events-none" />
      <div className="relative flex flex-col md:flex-row md:items-center gap-8">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Welcome to MediCare Hospital</h1>
              <p className="text-sm font-mono text-primary">AI-Powered Voice Receptionist — Available 24/7</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-lg">
            Our AI receptionist handles patient lookups, appointment booking, cancellations, and rescheduling — all through a simple phone call.
          </p>
        </div>

        {/* Call card */}
        <div className="shrink-0">
          <div className="relative rounded-2xl border border-cyan-500/30 bg-background/80 p-6 text-center min-w-[200px]"
            style={{ boxShadow: "0 0 24px rgba(6,182,212,0.12), 0 0 0 1px rgba(6,182,212,0.15)" }}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-primary/5 pointer-events-none" />
            <Phone className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-2xl font-mono font-bold tracking-wider text-foreground">{VOICE_AGENT_PHONE}</p>
            <p className="text-xs text-muted-foreground mt-1.5">Call to interact with the AI receptionist</p>
            <a
              href={`tel:${VOICE_AGENT_PHONE}`}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Phone className="w-3 h-3" /> Call Now
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   Capabilities Grid
═══════════════════════════════════════ */
const CAPABILITIES = [
  { icon: UserSearch,    title: "Patient Lookup",         desc: "Look up any patient by phone number", note: null },
  { icon: CalendarPlus,  title: "Book Appointment",       desc: "Book new appointments with any doctor", note: "Auto-creates patient record if new" },
  { icon: CalendarX2,   title: "Cancel Appointment",     desc: "Cancel any scheduled appointment", note: null },
  { icon: CalendarClock, title: "Reschedule Appointment", desc: "Move appointments to a new date & time", note: null },
  { icon: BellRing,      title: "Appointment Reminders",  desc: "Automated daily reminder calls at 6 PM", note: null, badge: "Automated" },
];

function CapabilitiesGrid() {
  return (
    <section>
      <h2 className="text-xl font-display font-semibold mb-5">Capabilities</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CAPABILITIES.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * i }}
              className="bg-card/40 border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-start gap-2 mb-1">
                <p className="text-sm font-semibold leading-snug">{cap.title}</p>
                {cap.badge && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">{cap.badge}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{cap.desc}</p>
              {cap.note && <p className="text-[10px] text-primary/70 mt-1 font-mono">{cap.note}</p>}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   How It Works Pipeline
═══════════════════════════════════════ */
const PIPELINE_STEPS = [
  "Patient Calls",
  "AI Greets",
  "Identifies Intent",
  "Looks Up Records",
  "Takes Action",
  "Confirms to Patient",
];

function HowItWorksPipeline() {
  return (
    <section>
      <h2 className="text-xl font-display font-semibold mb-5">How It Works</h2>
      <div className="bg-card/40 border border-border/50 rounded-xl p-6 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {PIPELINE_STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary font-bold">
                  {i + 1}
                </div>
                <span className="text-xs text-center font-medium max-w-[72px] leading-tight">{label}</span>
              </motion.div>
              {i < PIPELINE_STEPS.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 * i + 0.05 }}
                >
                  <ChevronRight className="w-4 h-4 text-primary/40 shrink-0" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   Main Export
═══════════════════════════════════════ */
const TABS = [
  { id: "lookup",      label: "Patient Lookup" },
  { id: "book",        label: "Book Appointment" },
  { id: "cancel",      label: "Cancel" },
  { id: "reschedule",  label: "Reschedule" },
];

export function HospitalReceptionistPage() {
  const [activeTab, setActiveTab] = useState("lookup");

  return (
    <div className="space-y-12">
      <HeroBanner />
      <CapabilitiesGrid />

      {/* Try It Yourself */}
      <section>
        <h2 className="text-xl font-display font-semibold mb-5">Try It Yourself</h2>

        {/* Pill tab switcher */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-card/40 border border-primary/20 rounded-xl backdrop-blur-sm">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs text-primary uppercase tracking-widest">Live Demo Console</span>
          </div>
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "lookup"     && <PatientLookupTab />}
                {activeTab === "book"       && <BookAppointmentTab />}
                {activeTab === "cancel"     && <CancelAppointmentTab />}
                {activeTab === "reschedule" && <RescheduleAppointmentTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <HowItWorksPipeline />
    </div>
  );
}
