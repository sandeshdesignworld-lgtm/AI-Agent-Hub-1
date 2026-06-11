import { useEffect } from "react";
import { useGetAuthMe, useListAgents, useAdminLogout, getGetAuthMeQueryKey, getListAgentsQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, ChevronRight, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: authLoading, error: authError } = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), retry: false }
  });

  const { data: agents, isLoading: agentsLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey(), enabled: !!user }
  });

  const logoutMutation = useAdminLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuthMeQueryKey() });
        setLocation("/admin/login");
      },
    },
  });

  useEffect(() => {
    if (authError) setLocation("/admin/login");
  }, [authError, setLocation]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (authError || !user) return null;

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
              <Link key={agent.id} href={`/agent/${agent.slug}`}>
                <a
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 border",
                    "bg-transparent border-transparent text-muted-foreground hover:bg-card hover:text-foreground hover:border-border/30"
                  )}
                  data-testid={`select-agent-${agent.slug}`}
                >
                  <span className="font-mono text-sm truncate pr-2">{agent.name}</span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                </a>
              </Link>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background relative flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-5">
            <Terminal className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">Agent Registry</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Select an agent from the sidebar to open its detail page and run the agent console.
          </p>
        </div>
      </main>
    </div>
  );
}
