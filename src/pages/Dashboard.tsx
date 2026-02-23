import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Clock, CheckCircle2, AlertTriangle, TrendingUp, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { subDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Geral", days: 0 },
];

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<{ task_id: string; user_id: string; completed: boolean }[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const [tasksRes, assigneesRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("*"),
        supabase.from("task_assignees").select("task_id, user_id, completed"),
        isAdmin ? supabase.from("profiles").select("*").order("name") : Promise.resolve({ data: [] }),
      ]);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (assigneesRes.data) setAssignees(assigneesRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
      setLoading(false);
    };
    fetch();
  }, [user, isAdmin]);

  const filteredTasks = useMemo(() => {
    if (period === 0) return tasks;
    const cutoff = subDays(new Date(), period).toISOString();
    return tasks.filter((t) => t.created_at >= cutoff);
  }, [tasks, period]);

  const now = new Date();
  const stats = useMemo(() => ({
    total: filteredTasks.length,
    pendente: filteredTasks.filter((t) => t.status === "pendente").length,
    concluida: filteredTasks.filter((t) => t.status === "concluida").length,
    adiada: filteredTasks.filter((t) => t.status === "adiada").length,
    cancelada: filteredTasks.filter((t) => t.status === "cancelada").length,
    atrasadas: filteredTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status === "pendente"
    ).length,
  }), [filteredTasks]);

  const cards = [
    { label: "Total de Tarefas", value: stats.total, icon: ListTodo, color: "text-primary" },
    { label: "Pendentes", value: stats.pendente, icon: Clock, color: "text-warning" },
    { label: "Concluídas", value: stats.concluida, icon: CheckCircle2, color: "text-success" },
    { label: "Adiadas", value: stats.adiada, icon: Clock, color: "text-primary" },
    { label: "Atrasadas", value: stats.atrasadas, icon: AlertTriangle, color: "text-destructive" },
  ];

  // Per-employee stats
  const employeeStats = useMemo(() => {
    if (!isAdmin || profiles.length === 0) return [];

    const taskIds = new Set(filteredTasks.map((t) => t.id));

    return profiles.map((p) => {
      const userAssignments = assignees.filter((a) => a.user_id === p.user_id && taskIds.has(a.task_id));
      const total = userAssignments.length;
      const completed = userAssignments.filter((a) => a.completed).length;
      const pending = total - completed;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { name: p.name || "Sem nome", total, completed, pending, rate };
    })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.rate - a.rate || b.completed - a.completed);
  }, [isAdmin, profiles, assignees, filteredTasks]);

  const chartColors = ["hsl(217, 91%, 50%)", "hsl(142, 76%, 36%)", "hsl(27, 96%, 54%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.name || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground">Resumo das suas tarefas</p>
        </div>

        {/* Period filter */}
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                period === p.days
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
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

      {/* Admin: Employee performance */}
      {isAdmin && !loading && employeeStats.length > 0 && (
        <>
          {/* Chart */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Desempenho por Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeStats.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        [value, name === "completed" ? "Concluídas" : "Pendentes"]
                      }
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="completed" name="Concluídas" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="pending" name="Pendentes" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ranking table */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Ranking de Produtividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">#</th>
                      <th className="pb-2 font-medium text-muted-foreground">Colaborador</th>
                      <th className="pb-2 font-medium text-muted-foreground text-center">Recebidas</th>
                      <th className="pb-2 font-medium text-muted-foreground text-center">Concluídas</th>
                      <th className="pb-2 font-medium text-muted-foreground text-center">Pendentes</th>
                      <th className="pb-2 font-medium text-muted-foreground text-center">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map((e, i) => (
                      <tr key={e.name} className="border-b border-border/50 last:border-0">
                        <td className="py-3 font-bold text-muted-foreground">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </td>
                        <td className="py-3 font-semibold text-foreground">{e.name}</td>
                        <td className="py-3 text-center">{e.total}</td>
                        <td className="py-3 text-center text-success font-semibold">{e.completed}</td>
                        <td className="py-3 text-center text-warning font-semibold">{e.pending}</td>
                        <td className="py-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            e.rate >= 80 ? "bg-success/15 text-success" :
                            e.rate >= 50 ? "bg-warning/15 text-warning" :
                            "bg-destructive/15 text-destructive"
                          }`}>
                            {e.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
