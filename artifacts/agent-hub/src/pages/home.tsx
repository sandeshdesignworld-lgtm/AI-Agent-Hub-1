import { useListAgents } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, ArrowRight, Zap, Shield, Cpu } from "lucide-react";

export default function Home() {
  const { data: agents, isLoading, error } = useListAgents();
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 w-full pb-20">
      <section className="relative pt-32 pb-24 flex items-center justify-center flex-col text-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium tracking-wide">
            <Zap className="w-4 h-4 mr-2" />
            SYSTEM ONLINE
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6">
            Intelligent <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Precision</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Welcome to the command center. Deploy and interface with cutting-edge AI agents designed for specific high-performance tasks.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-primary" /> CLI Ready</div>
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Secure</div>
            <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> High Compute</div>
          </div>
        </motion.div>
      </section>

      <section className="container mx-auto px-4 max-w-6xl">
        <div className="mb-10 flex items-center gap-4">
          <div className="h-px bg-border flex-1"></div>
          <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground/90 uppercase">Active Agents</h2>
          <div className="h-px bg-border flex-1"></div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50 bg-card/40 backdrop-blur-sm">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2 bg-primary/10" />
                  <Skeleton className="h-4 w-full bg-primary/5" />
                </CardHeader>
                <CardFooter>
                  <Skeleton className="h-10 w-full bg-primary/10" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center p-12 border border-destructive/20 bg-destructive/5 rounded-lg">
            <p className="text-destructive font-mono">Error establishing connection to agent registry.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents?.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card
                  className="h-full flex flex-col border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/50 transition-colors group relative overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/agent/${agent.slug}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex-1">
                    <CardTitle className="font-display text-xl mb-2 group-hover:text-primary transition-colors flex justify-between items-center">
                      {agent.name}
                      <span className="text-xs font-mono text-muted-foreground">ID:{agent.id.toString().padStart(3, '0')}</span>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground leading-relaxed">
                      {agent.shortDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button
                      className="w-full group/btn variant-outline border-primary/20 hover:bg-primary/10 hover:text-primary"
                      data-testid={`button-explore-${agent.slug}`}
                      onClick={(e) => { e.stopPropagation(); navigate(`/agent/${agent.slug}`); }}
                    >
                      Explore Capabilities <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
