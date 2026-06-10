import { useState, useEffect } from "react";
import { useGetAuthMe, useListAgents, useAdminLogout, getGetAuthMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Activity, Loader2, ChevronRight, Lock, Zap, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: authLoading, error: authError } = useGetAuthMe({
    query: { retry: false }
  });

  const { data: agents, isLoading: agentsLoading } = useListAgents({
    query: { enabled: !!user }
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
    if (authError) {
      setLocation("/admin/login");
    }
  }, [authError, setLocation]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (authError || !user) {
    return null;
  }

  const selectedAgentData = agents?.find(a => a.slug === activeAgent);

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
              onClick={() => logoutMutation.mutate({})}
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
                onClick={() => setActiveAgent(agent.slug)}
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
      <main className="flex-1 bg-background relative flex flex-col">
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
                  <p className="text-muted-foreground font-mono text-sm uppercase">Interface Module [{selectedAgentData.slug}]</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                  <Activity className="w-4 h-4" />
                  STANDBY
                </div>
              </div>

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
