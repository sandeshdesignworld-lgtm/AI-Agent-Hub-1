import { useGetAgent, getGetAgentQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TerminalSquare, Settings, Play, Database } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: agent, isLoading, error } = useGetAgent(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetAgentQueryKey(slug)
    }
  });

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
          <Link href="/">
            <Button variant="outline">Return to Hub</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Link href="/">
        <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Registry
        </Button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
                <TerminalSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold text-foreground">{agent.name}</h1>
                <p className="text-sm font-mono text-primary">ID_REF: {agent.slug.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl">{agent.shortDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
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
                  <p className="text-foreground leading-relaxed">{agent.howItWorks}</p>
                </div>
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Expected Output</h3>
                  <p className="text-foreground leading-relaxed">{agent.expectedOutput}</p>
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

          <div className="space-y-6">
            <div className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-sm sticky top-24">
              <h3 className="font-display font-semibold text-lg mb-4">System Requirements</h3>
              <ul className="space-y-3 mb-8">
                {agent.requirements.split(',').map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{req.trim()}</span>
                  </li>
                ))}
              </ul>
              
              <div className="pt-6 border-t border-border/50">
                <Link href="/admin/login">
                  <Button className="w-full shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-shadow">
                    Initialize Agent
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground mt-3 font-mono">Requires admin clearance</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
