import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [stats, setStats] = useState({ total: 0, pendente: 0, em_andamento: 0, concluido: 0, atrasadas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data: tasks } = await supabase.from("tasks").select("status, deadline");
      if (tasks) {
        const now = new Date();
        setStats({
          total: tasks.length,
          pendente: tasks.filter((t) => t.status === "pendente").length,
          em_andamento: tasks.filter((t) => t.status === "em_andamento").length,
          concluido: tasks.filter((t) => t.status === "concluido").length,
          atrasadas: tasks.filter(
            (t) => t.deadline && new Date(t.deadline) < now && t.status !== "concluido" && t.status !== "cancelado"
          ).length,
        });
      }
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  const cards = [
    { label: "Total de Tarefas", value: stats.total, icon: ListTodo, color: "text-primary" },
    { label: "Pendentes", value: stats.pendente, icon: Clock, color: "text-warning" },
    { label: "Em Andamento", value: stats.em_andamento, icon: ListTodo, color: "text-primary" },
    { label: "Concluídas", value: stats.concluido, icon: CheckCircle2, color: "text-success" },
    { label: "Atrasadas", value: stats.atrasadas, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.name || "Usuário"} 👋
        </h1>
        <p className="text-muted-foreground">Resumo das suas tarefas</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>
                {loading ? "—" : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
