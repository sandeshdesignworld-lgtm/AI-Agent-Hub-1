import { useState } from "react";
import { useListAgents } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Shield, ArrowRight, BookOpen, Users, Calendar,
  MessageSquare, GraduationCap, Mic, Network, DollarSign,
  Clock, LayoutDashboard, ChevronRight, Lock, ExternalLink
} from "lucide-react";
import { Link } from "wouter";

const AGENT_META: Record<string, {
  category: string;
  status: string;
  tags: string[];
  icon: React.ReactNode;
}> = {
  "expense-tracker": {
    category: "Finance",
    status: "Details Available",
    tags: ["Expense Analytics", "Financial Reporting", "Spending Insights"],
    icon: <DollarSign className="w-5 h-5" />,
  },
  "deadline-tracker": {
    category: "Productivity",
    status: "Details Available",
    tags: ["Deadline Management", "Task Monitoring", "Productivity Automation"],
    icon: <Clock className="w-5 h-5" />,
  },
  "hr-agent": {
    category: "HR",
    status: "Details Available",
    tags: ["Resume Screening", "ATS Automation", "AI Recruitment"],
    icon: <Users className="w-5 h-5" />,
  },
  "appointment-booking": {
    category: "Scheduling",
    status: "Details Available",
    tags: ["Scheduling", "Availability", "Booking"],
    icon: <Calendar className="w-5 h-5" />,
  },
  "customer-support": {
    category: "Support",
    status: "Details Available",
    tags: ["Customer Support", "Email Automation", "Help Desk"],
    icon: <MessageSquare className="w-5 h-5" />,
  },
  "campus-concierge": {
    category: "Education",
    status: "Details Available",
    tags: ["Campus Info", "Student Help", "Navigation"],
    icon: <GraduationCap className="w-5 h-5" />,
  },
  "hospital-receptionist": {
    category: "Healthcare / Voice",
    status: "Details Available",
    tags: ["Healthcare", "Appointment Booking", "Voice Assistant"],
    icon: <Mic className="w-5 h-5" />,
  },
  "linkedin-management": {
    category: "Multi-Agent / Social",
    status: "Details Available",
    tags: ["LinkedIn Automation", "Content Creation", "Thought Leadership"],
    icon: <Network className="w-5 h-5" />,
  },
};

const FILTER_CATEGORIES = [
  "All", "Finance", "Productivity", "HR", "Scheduling",
  "Support", "Education", "Healthcare", "Voice", "Multi-Agent",
];

const PURPOSE_CARDS = [
  {
    icon: <BookOpen className="w-5 h-5 text-primary" />,
    title: "Showcase Agents",
    description: "Display developed and upcoming AI agents in a structured, browsable interface.",
  },
  {
    icon: <Shield className="w-5 h-5 text-primary" />,
    title: "Document Capabilities",
    description: "Each agent includes purpose, workflow, required inputs, outputs, and examples.",
  },
  {
    icon: <LayoutDashboard className="w-5 h-5 text-primary" />,
    title: "Admin Playareas",
    description: "Admins can access a secure dashboard where each agent will eventually have its own workspace.",
  },
];

const SIDEBAR_PREVIEW = [
  "Dashboard", "Expense Tracker", "Deadline Tracker",
  "HR Agent", "Appointment Booking", "Help Desk Agent",
];

export default function Home() {
  const { data: agents, isLoading, error } = useListAgents();
  const [, navigate] = useLocation();
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredAgents = agents?.filter((agent) => {
    if (activeFilter === "All") return true;
    const meta = AGENT_META[agent.slug];
    if (!meta) return false;
    return meta.category.toLowerCase().includes(activeFilter.toLowerCase());
  });

  return (
    <div className="flex-1 w-full flex flex-col">

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-16 flex items-center justify-center flex-col text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center justify-center px-3 py-1 mb-5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono tracking-widest uppercase">
            <Zap className="w-3.5 h-3.5 mr-2" />
            Agent Hub Online
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-5 leading-tight">
            AI Agent Hub for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Intelligent Workflow
            </span>{" "}
            Showcases
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            A centralized showcase of AI agents developed for finance, HR, support, scheduling,
            healthcare, education, productivity, and automation workflows.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground font-mono">
            {[
              { icon: <BookOpen className="w-3.5 h-3.5 text-primary" />, label: "Agent Library" },
              { icon: <Shield className="w-3.5 h-3.5 text-primary" />, label: "Secure Admin Access" },
              { icon: <LayoutDashboard className="w-3.5 h-3.5 text-primary" />, label: "Workflow Playareas" },
              { icon: <Zap className="w-3.5 h-3.5 text-primary" />, label: "Project Showcase" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 bg-card/40 border border-border/50 px-3 py-1.5 rounded-full">
                {icon} {label}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── What is AgentHub? ── */}
      <section className="container mx-auto px-4 max-w-5xl pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="bg-card/30 border border-border/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-display font-semibold mb-3">What is AgentHub?</h2>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
              AgentHub is a centralized platform for showcasing AI agents developed across different
              domains. Each agent has a dedicated detail page containing its overview, workflow,
              requirements, expected outputs, and sample examples. Admin users can access a private
              dashboard where agent playareas will be available.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PURPOSE_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="bg-background/50 border border-border/40 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
                    {card.icon}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{card.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Agent Library ── */}
      <section className="container mx-auto px-4 max-w-5xl pb-20">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-px bg-border flex-1" />
            <h2 className="text-2xl font-display font-semibold tracking-tight uppercase">Agent Library</h2>
            <div className="h-px bg-border flex-1" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            A structured list of AI agents developed so far, organized by use case and domain.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${
                activeFilter === cat
                  ? "bg-primary text-background border-primary"
                  : "bg-card/30 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Agent Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50 bg-card/40">
                <CardHeader>
                  <Skeleton className="h-5 w-3/4 mb-2 bg-primary/10" />
                  <Skeleton className="h-4 w-full bg-primary/5" />
                </CardHeader>
                <CardContent><Skeleton className="h-12 w-full bg-primary/5" /></CardContent>
                <CardFooter><Skeleton className="h-9 w-full bg-primary/10" /></CardFooter>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center p-12 border border-destructive/20 bg-destructive/5 rounded-lg">
            <p className="text-destructive font-mono text-sm">Error loading agent registry.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredAgents?.map((agent, index) => {
              const meta = AGENT_META[agent.slug] ?? {
                category: "General",
                status: "Details Available",
                tags: [],
                icon: <Zap className="w-5 h-5" />,
              };
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                >
                  <Card
                    className="h-full flex flex-col border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all duration-200 group relative overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/agent/${agent.slug}`)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                          {meta.icon}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-[10px] font-mono text-muted-foreground bg-background/50 border border-border/50 px-2 py-0.5 rounded">
                            ID:{agent.id.toString().padStart(3, "0")}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5 font-mono py-0">
                            {meta.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <CardTitle className="font-display text-lg group-hover:text-primary transition-colors">
                          {agent.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-mono py-0">
                          {meta.category}
                        </Badge>
                      </div>

                      <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                        {agent.shortDescription}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 pt-0 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {meta.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-background/60 border border-border/40 text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="pt-0">
                      <Button
                        variant="outline"
                        className="w-full border-primary/20 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all group/btn text-sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/agent/${agent.slug}`); }}
                        data-testid={`button-explore-${agent.slug}`}
                      >
                        View Details
                        <ArrowRight className="ml-2 w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Admin Command Center Preview ── */}
      <section className="container mx-auto px-4 max-w-5xl pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card/30 border border-border/50 rounded-2xl p-8 backdrop-blur-sm"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-display font-semibold mb-2">Admin Command Center</h2>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Admin users can access a secure dashboard with a sidebar list of agents. Each agent opens
              a dedicated playarea. Current playareas show a Coming Soon state until the modules are implemented.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 rounded-xl overflow-hidden border border-border/50 bg-background/30">
            {/* Sidebar preview */}
            <div className="w-full md:w-48 bg-card/50 border-b md:border-b-0 md:border-r border-border/50 p-4 flex-shrink-0">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Agents</div>
              <div className="space-y-1">
                {SIDEBAR_PREVIEW.map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
                      i === 0
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground"
                    }`}
                  >
                    {i === 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main panel preview */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center min-h-[180px] relative">
              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 text-[10px] font-mono text-primary/70 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 mb-3">
                  <Lock className="w-3 h-3" /> COMING SOON
                </div>
                <p className="text-sm font-display font-medium mb-1">Agent Playarea</p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  This workspace will support agent testing, configuration, logs, and output preview in future versions.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Link href="/admin/login">
              <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 text-xs font-mono gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Access Admin Dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 bg-card/20 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 max-w-5xl py-10">
          <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-display font-bold text-base tracking-tight">
                  AGENT<span className="text-primary">HUB</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                A centralized showcase of AI agents and workflow experiments.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Links</p>
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Agent Library
              </Link>
              <Link href="/admin/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Admin Login
              </Link>
            </div>
          </div>
          <div className="border-t border-border/30 pt-6 text-center">
            <p className="text-xs text-muted-foreground font-mono">© 2026 AgentHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
