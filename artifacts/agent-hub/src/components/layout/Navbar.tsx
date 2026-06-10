import { Link, useLocation } from "wouter";
import { useGetAuthMe, useAdminLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAuthMeQueryKey } from "@workspace/api-client-react";
import { Zap, LogOut } from "lucide-react";

export function Navbar() {
  const { data: user } = useGetAuthMe();
  const logout = useAdminLogout();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: getGetAuthMeQueryKey() });
        setLocation("/admin/login");
      }
    });
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Zap className="w-5 h-5 text-primary group-hover:text-primary/80 transition-colors" />
          <span className="font-display font-bold text-lg tracking-tight">AGENT<span className="text-primary">HUB</span></span>
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/admin/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2" data-testid="button-logout">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </>
          ) : (
            <Link href="/admin/login">
              <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                Admin Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
