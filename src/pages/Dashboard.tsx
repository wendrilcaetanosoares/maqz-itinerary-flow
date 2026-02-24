import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, History, CalendarDays, User, MapPin, Phone } from "lucide-react";
import { format, isToday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Geral", days: 0 },
];

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; badgeClass: string }> = {
  concluida: { label: "Concluída", icon: CheckCircle2, badgeClass: "bg-success/15 text-success border-success/30" },
  cancelada: { label: "Cancelada", icon: XCircle, badgeClass: "bg-destructive/15 text-destructive border-destructive/30" },
  adiada: { label: "Adiada", icon: Clock, badgeClass: "bg-warning/15 text-warning border-warning/30" },
};

const TYPE_LABELS: Record<string, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  venda: "Venda",
  manutencao: "Manutenção",
  garantia: "Garantia",
  administrativo: "Administrativo",
  suporte: "Suporte",
};

function TaskCard({ task, profiles }: { task: Task; profiles: Profile[] }) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.concluida;
  const StatusIcon = config.icon;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors">
      <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-foreground truncate">{task.client_name || "Sem cliente"}</span>
          <Badge variant="outline" className={config.badgeClass}>
            {config.label}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(new Date(task.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          <span>{TYPE_LABELS[task.type] || task.type}</span>
          {task.client_phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {task.client_phone}
            </span>
          )}
          {task.client_address && (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {task.client_address}
            </span>
          )}
        </div>

        {task.status_justification && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
            {task.status_justification}
          </p>
        )}
      </div>
    </div>
  );
}

function TaskSection({
  title,
  icon: Icon,
  tasks,
  profiles,
  emptyMessage,
  accentClass,
}: {
  title: string;
  icon: typeof CheckCircle2;
  tasks: Task[];
  profiles: Profile[];
  emptyMessage: string;
  accentClass: string;
}) {
  if (tasks.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Icon className={`h-5 w-5 ${accentClass}`} />
            {title}
            <span className="text-xs font-normal text-muted-foreground">(0)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className={`h-5 w-5 ${accentClass}`} />
          {title}
          <span className="text-xs font-normal text-muted-foreground">({tasks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} profiles={profiles} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [tasksRes, profilesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .in("status", ["concluida", "cancelada", "adiada"])
          .order("updated_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const filteredTasks = useMemo(() => {
    if (period === 0) return tasks;
    const cutoff = subDays(new Date(), period).toISOString();
    return tasks.filter((t) => t.updated_at >= cutoff);
  }, [tasks, period]);

  const completedToday = useMemo(
    () => filteredTasks.filter((t) => t.status === "concluida" && isToday(new Date(t.updated_at))),
    [filteredTasks]
  );

  const canceled = useMemo(
    () => filteredTasks.filter((t) => t.status === "cancelada"),
    [filteredTasks]
  );

  const postponed = useMemo(
    () => filteredTasks.filter((t) => t.status === "adiada"),
    [filteredTasks]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Histórico de Tarefas
          </h1>
          <p className="text-muted-foreground text-sm">
            Olá, {profile?.name || "Usuário"} — visualização do histórico
          </p>
        </div>

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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando histórico…</div>
      ) : (
        <>
          {/* Summary counters */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Concluídas hoje", value: completedToday.length, color: "text-success" },
              { label: "Canceladas", value: canceled.length, color: "text-destructive" },
              { label: "Adiadas", value: postponed.length, color: "text-warning" },
            ].map((s) => (
              <Card key={s.label} className="border-0 shadow-md">
                <CardContent className="flex items-center justify-between p-5">
                  <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                  <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sections */}
          <TaskSection
            title="Concluídas hoje"
            icon={CheckCircle2}
            tasks={completedToday}
            profiles={profiles}
            emptyMessage="Nenhuma tarefa concluída hoje."
            accentClass="text-success"
          />

          <TaskSection
            title="Tarefas canceladas"
            icon={XCircle}
            tasks={canceled}
            profiles={profiles}
            emptyMessage="Nenhuma tarefa cancelada no período."
            accentClass="text-destructive"
          />

          <TaskSection
            title="Tarefas adiadas"
            icon={Clock}
            tasks={postponed}
            profiles={profiles}
            emptyMessage="Nenhuma tarefa adiada no período."
            accentClass="text-warning"
          />

          {/* Full history */}
          <TaskSection
            title="Histórico geral"
            icon={History}
            tasks={filteredTasks}
            profiles={profiles}
            emptyMessage="Nenhuma tarefa no período selecionado."
            accentClass="text-primary"
          />
        </>
      )}
    </div>
  );
}
