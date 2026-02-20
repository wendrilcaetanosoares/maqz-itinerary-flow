import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Clock, AlertCircle } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskFormDialog from "@/components/TaskFormDialog";
import TaskActionButtons from "@/components/TaskActionButtons";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

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

function mapsUrl(address: string, cep?: string | null) {
  const query = [address, cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function Tasks() {
  const { canManageTasks } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">{tasks.length} tarefa(s)</p>
        </div>
        {canManageTasks && (
          <Button
            onClick={() => setFormOpen(true)}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-6 text-base font-semibold"
          >
            <Plus className="h-5 w-5" />
            Nova Tarefa
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">Nenhuma tarefa encontrada</p>
            <p className="text-sm text-muted-foreground">Crie a primeira tarefa para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <Card
                key={task.id}
                className={`border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${overdue ? "border-l-4 border-l-destructive" : ""}`}
              >
                <CardContent className="p-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority dot */}
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${priorityDot[task.priority]}`} title={task.priority} />
                      {/* Type */}
                      <Badge variant="outline" className={`text-xs ${typeColors[task.type]}`}>
                        {typeLabels[task.type]}
                      </Badge>
                      {/* Overdue */}
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
                    <p className="text-sm text-muted-foreground mb-2">🔧 {task.machine}</p>
                  )}

                  {/* Address → Google Maps */}
                  {task.client_address && (
                    <a
                      href={mapsUrl(task.client_address, task.client_cep)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-2"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-xs">{task.client_address}{task.client_cep ? ` — ${task.client_cep}` : ""}</span>
                    </a>
                  )}

                  {/* Bottom row: scheduled date + deadline */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
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
