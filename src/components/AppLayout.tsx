import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LayoutDashboard, ListTodo, Calendar, Users, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { label: "Painel", icon: LayoutDashboard, path: "/" },
  { label: "Tarefas", icon: ListTodo, path: "/tarefas" },
  { label: "Calendário", icon: Calendar, path: "/calendario" },
  { label: "Usuários", icon: Users, path: "/usuarios", adminOnly: true },
  { label: "Setores", icon: Building2, path: "/setores", adminOnly: true },
];

export default function AppLayout() {
  const { session, loading, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const active = location.pathname === item.path;
    return (
      <button
        onClick={() => navigate(item.path)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors w-full text-left",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </button>
    );
  };

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">M</div>
            <span className="font-semibold text-foreground">Maqz</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 pb-20">
          <Outlet />
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t bg-card py-2 safe-area-bottom">
          {filteredNav.slice(0, 4).map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-30 h-screen w-64 bg-sidebar">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-extrabold text-lg">M</div>
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground">Maqz Itinerário</h2>
              <p className="text-xs text-sidebar-foreground/60">{profile?.name || "Usuário"}</p>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {filteredNav.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
