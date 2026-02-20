import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, MapPin, Clock, AlertCircle, Search, Phone, X } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskFormDialog from "@/components/TaskFormDialog";
import TaskActionButtons from "@/components/TaskActionButtons";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const typeLabels: Record<string, string> = {
  entrega: "Entrega", retirada: "Retirada", venda: "Venda",
  manutencao: "Manutenção", garantia: "Garantia", administrativo: "Administrativo", suporte: "Suporte",
};

const typeColors: Record<string, string> = {
  entrega: "bg-blue-50 text-blue-700 border-blue-200",
  retirada: "bg-purple-50 text-purple-700 border-purple-200",
  venda: "bg-green-50 text-green-700 border-green-200",
  manutencao: "bg-orange-50 text-orange-700 border-orange-200",
  garantia: "bg-yellow-50 text-yellow-700 border-yellow-200",
  administrativo: "bg-gray-50 text-gray-700 border-gray-200",
  suporte: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  em_andamento: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-success/15 text-success border-success/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
};

const priorityDot: Record<string, string> = {
  alta: "bg-destructive", media: "bg-warning", baixa: "bg-success",
};

const priorityBorderLeft: Record<string, string> = {
  alta: "border-l-destructive",
  media: "border-l-warning",
  baixa: "border-l-success",
};

function mapsUrl(address: string, cep?: string | null) {
  const query = [address, cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const STATUS_FILTERS: { value: TaskStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluídos" },
  { value: "cancelado", label: "Cancelados" },
];

export default function Tasks() {
  const { canManageTasks } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "todos">("todos");

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const isOverdue = (task: Task) =>
    task.deadline && task.status !== "concluido" && task.status !== "cancelado"
    && isPast(parseISO(task.deadline));

  // Filtering
  const filtered = tasks.filter((t) => {
    const matchSearch = !search || t.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} de {tasks.length} tarefa(s)
            {overdueCount > 0 && (
              <span className="ml-2 text-destructive font-semibold">· {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        {canManageTasks && (
          <Button
            onClick={() => setFormOpen(true)}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-5 text-sm font-semibold shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        )}
      </div>

      {/* Search + Status filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {f.label}
              {f.value !== "todos" && (
                <span className="ml-1 opacity-70">
                  ({tasks.filter((t) => t.status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">
              {search || statusFilter !== "todos" ? "Nenhuma tarefa encontrada com esses filtros" : "Nenhuma tarefa encontrada"}
            </p>
            {(search || statusFilter !== "todos") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("todos"); }}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const overdue = isOverdue(task);
            return (
              <Card
                key={task.id}
                className={`shadow-sm hover:shadow-md transition-shadow border-l-4 ${priorityBorderLeft[task.priority]} border-t-0 border-b-0 border-r-0`}
              >
                <CardContent className="p-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${priorityDot[task.priority]}`} title={`Prioridade ${task.priority}`} />
                      <Badge variant="outline" className={`text-xs ${typeColors[task.type]}`}>
                        {typeLabels[task.type]}
                      </Badge>
                      {overdue && (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30 gap-1">
                          <AlertCircle className="h-3 w-3" /> Atrasada
                        </Badge>
                      )}
                    </div>
                    <Badge className={`shrink-0 text-xs border ${statusColors[task.status]}`}>
                      {statusLabels[task.status]}
                    </Badge>
                  </div>

                  {/* Client name */}
                  <h3 className="font-semibold text-foreground text-base leading-tight mb-1">
                    {task.client_name || "Sem cliente"}
                  </h3>

                  {/* Machine */}
                  {task.machine && (
                    <p className="text-sm text-muted-foreground mb-1.5">🔧 {task.machine}</p>
                  )}

                  {/* Phone */}
                  {task.client_phone && (
                    <a
                      href={`tel:${task.client_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-1.5"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {task.client_phone}
                    </a>
                  )}

                  {/* Address → Google Maps */}
                  {task.client_address && (
                    <a
                      href={mapsUrl(task.client_address, task.client_cep)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-1.5"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-xs">{task.client_address}{task.client_cep ? ` — ${task.client_cep}` : ""}</span>
                    </a>
                  )}

                  {/* Bottom row */}
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {task.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(parseISO(task.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                        {task.scheduled_time && ` às ${task.scheduled_time.slice(0, 5)}`}
                      </span>
                    )}
                    {task.deadline && (
                      <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-semibold" : ""}`}>
                        Prazo: {format(parseISO(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {task.value != null && (
                      <span className="ml-auto font-semibold text-foreground">
                        R$ {Number(task.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  {/* Observations */}
                  {task.observations && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{task.observations}</p>
                  )}

                  {/* Action buttons */}
                  <TaskActionButtons
                    taskId={task.id}
                    currentStatus={task.status}
                    onUpdated={fetchTasks}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task creation dialog */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
