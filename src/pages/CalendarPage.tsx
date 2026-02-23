import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin, Clock, AlertCircle, CalendarDays } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isPast, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const typeColors: Record<string, string> = {
  entrega: "bg-blue-500",
  retirada: "bg-purple-500",
  venda: "bg-green-500",
  manutencao: "bg-orange-500",
  garantia: "bg-yellow-500",
  administrativo: "bg-slate-500",
  suporte: "bg-cyan-500",
};

const typeLabels: Record<string, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  venda: "Venda",
  manutencao: "Manutenção",
  garantia: "Garantia",
  administrativo: "Adm.",
  suporte: "Suporte",
};

const priorityBorder: Record<string, string> = {
  alta: "border-l-destructive",
  media: "border-l-warning",
  baixa: "border-l-success",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  concluida: "bg-success/15 text-success",
  adiada: "bg-primary/15 text-primary",
  cancelada: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  concluida: "Concluída",
  adiada: "Adiada",
  cancelada: "Cancelada",
};

function mapsUrl(address: string, cep?: string | null) {
  const query = [address, cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function CalendarPage() {
  const { user, isAdmin } = useAuth();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Mon–Sat (6 days)
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const weekEnd = addDays(weekStart, 6);

    const { data } = await supabase
      .from("tasks")
      .select("*")
      .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
      .order("scheduled_time", { ascending: true, nullsFirst: false });

    if (data) setTasks(data);
    setLoading(false);
  }, [user, weekStart]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const tasksByDay = (day: Date) =>
    tasks.filter((t) => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day));

  const totalWeekTasks = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.deadline && isPast(parseISO(t.deadline)) && t.status !== "concluido" && t.status !== "cancelado"
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendário Semanal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} –{" "}
            {format(addDays(weekStart, 5), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex gap-2 mr-2">
            <span className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1 font-medium">
              {totalWeekTasks} tarefa{totalWeekTasks !== 1 ? "s" : ""}
            </span>
            {overdueCount > 0 && (
              <span className="text-xs bg-destructive/10 text-destructive rounded-full px-3 py-1 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(typeLabels).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${typeColors[key]}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {days.map((day) => {
            const dayTasks = tasksByDay(day);
            const todayDay = isToday(day);

            return (
              <div key={day.toISOString()} className="flex flex-col min-h-[200px]">
                {/* Day header */}
                <div className={`rounded-t-lg px-3 py-2 text-center ${todayDay ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${todayDay ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p className={`text-xl font-bold leading-tight ${todayDay ? "text-primary-foreground" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  {dayTasks.length > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${todayDay ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className={`flex-1 rounded-b-lg border border-t-0 p-1.5 space-y-1.5 ${todayDay ? "border-primary/30 bg-primary/5" : "border-border bg-card/50"}`}>
                  {dayTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center pt-4">—</p>
                  ) : (
                    dayTasks.map((task) => {
                      const overdue = task.deadline && isPast(parseISO(task.deadline)) && task.status !== "concluido" && task.status !== "cancelado";
                      return (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`w-full text-left rounded-md border-l-2 bg-card shadow-sm p-2 hover:shadow-md transition-shadow ${priorityBorder[task.priority]} ${task.status === "concluido" ? "opacity-60" : ""}`}
                        >
                          {/* Type dot + label */}
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${typeColors[task.type]}`} />
                            <span className="text-[10px] font-semibold text-muted-foreground truncate">
                              {typeLabels[task.type]}
                            </span>
                            {overdue && <AlertCircle className="h-3 w-3 text-destructive shrink-0 ml-auto" />}
                          </div>

                          {/* Client name */}
                          <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {task.client_name || "Sem cliente"}
                          </p>

                          {/* Time */}
                          {task.scheduled_time && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {task.scheduled_time.slice(0, 5)}
                            </p>
                          )}

                          {/* Status badge */}
                          <span className={`inline-block text-[10px] rounded-full px-1.5 py-0.5 mt-1 font-medium ${statusColors[task.status]}`}>
                            {statusLabels[task.status]}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header bar */}
            <div className={`h-1.5 w-full ${typeColors[selectedTask.type]}`} />

            <div className="p-5 space-y-4">
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${typeColors[selectedTask.type]}`} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {typeLabels[selectedTask.type]}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{selectedTask.client_name}</h2>
                </div>
                <span className={`text-xs rounded-full px-2.5 py-1 font-semibold shrink-0 ${statusColors[selectedTask.status]}`}>
                  {statusLabels[selectedTask.status]}
                </span>
              </div>

              {/* Priority + date row */}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className={`text-xs border-l-2 ${priorityBorder[selectedTask.priority]}`}>
                  Prioridade: {selectedTask.priority === "alta" ? "🔴 Alta" : selectedTask.priority === "media" ? "🟡 Média" : "🟢 Baixa"}
                </Badge>
                {selectedTask.scheduled_date && (
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    {format(parseISO(selectedTask.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                    {selectedTask.scheduled_time && ` às ${selectedTask.scheduled_time.slice(0, 5)}`}
                  </span>
                )}
              </div>

              {/* Machine */}
              {selectedTask.machine && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">🔧</span>
                  <span className="text-foreground">{selectedTask.machine}</span>
                </div>
              )}

              {/* Phone */}
              {selectedTask.client_phone && (
                <a
                  href={`tel:${selectedTask.client_phone}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <span className="text-base">📞</span>
                  {selectedTask.client_phone}
                </a>
              )}

              {/* Address → Google Maps */}
              {selectedTask.client_address && (
                <a
                  href={mapsUrl(selectedTask.client_address, selectedTask.client_cep)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 transition-colors group"
                >
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-sm font-semibold text-primary">Abrir no Google Maps</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedTask.client_address}
                      {selectedTask.client_cep && ` — ${selectedTask.client_cep}`}
                    </p>
                  </div>
                </a>
              )}

              {/* Deadline */}
              {selectedTask.deadline && (
                <p className="text-xs text-muted-foreground">
                  ⏱ Prazo:{" "}
                  <span className={isPast(parseISO(selectedTask.deadline)) && selectedTask.status !== "concluido" ? "text-destructive font-semibold" : ""}>
                    {format(parseISO(selectedTask.deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </p>
              )}

              {/* Value */}
              {selectedTask.value != null && (
                <p className="text-sm font-semibold text-foreground">
                  💰 R$ {Number(selectedTask.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}

              {/* Observations */}
              {selectedTask.observations && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  {selectedTask.observations}
                </p>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedTask(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
