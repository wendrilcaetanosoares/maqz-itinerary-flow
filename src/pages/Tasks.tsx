import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const typeLabels: Record<string, string> = {
  entrega: "Entrega", retirada: "Retirada", venda: "Venda",
  manutencao: "Manutenção", garantia: "Garantia", administrativo: "Administrativo", suporte: "Suporte",
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

const priorityColors: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive", media: "bg-warning/15 text-warning", baixa: "bg-muted text-muted-foreground",
};

export default function Tasks() {
  const { canManageTasks } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTasks(data);
      setLoading(false);
    };
    fetchTasks();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">{tasks.length} tarefa(s)</p>
        </div>
        {canManageTasks && (
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-6 text-base font-semibold">
            <Plus className="h-5 w-5" />
            Nova Tarefa
          </Button>
        )}
      </div>

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
          {tasks.map((task) => (
            <Card key={task.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={priorityColors[task.priority]}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                      <Badge variant="outline">{typeLabels[task.type]}</Badge>
                    </div>
                    <h3 className="font-semibold text-foreground">{task.client_name || "Sem cliente"}</h3>
                    <p className="text-sm text-muted-foreground truncate">{task.observations || task.machine || "Sem observações"}</p>
                  </div>
                  <Badge className={`${statusColors[task.status]} border`}>
                    {statusLabels[task.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
