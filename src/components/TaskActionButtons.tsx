import { useState } from "react";
import { CheckCircle2, Clock, XCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

interface Props {
  taskId: string;
  currentStatus: TaskStatus;
  onUpdated: () => void;
}

export default function TaskActionButtons({ taskId, currentStatus, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [adiarOpen, setAdiarOpen] = useState(false);
  const [newDate, setNewDate] = useState("");

  const updateStatus = async (status: TaskStatus, extraData?: object) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status, ...extraData })
        .eq("id", taskId);

      if (error) throw error;

      await supabase.from("task_history").insert({
        task_id: taskId,
        user_id: user.id,
        action: `Status alterado para: ${status}`,
        details: { status, ...extraData },
      });

      toast({ title: "Tarefa atualizada!" });
      onUpdated();
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdiar = async () => {
    if (!newDate) {
      toast({ title: "Selecione uma nova data", variant: "destructive" });
      return;
    }
    await supabase
      .from("tasks")
      .update({ scheduled_date: newDate, status: "pendente" })
      .eq("id", taskId);

    if (user) {
      await supabase.from("task_history").insert({
        task_id: taskId,
        user_id: user.id,
        action: "Tarefa adiada",
        details: { new_date: newDate },
      });
    }

    toast({ title: "Tarefa adiada!", description: `Nova data: ${newDate}` });
    setAdiarOpen(false);
    setNewDate("");
    onUpdated();
  };

  const isDone = currentStatus === "concluido";
  const isCancelled = currentStatus === "cancelado";

  return (
    <>
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
        {/* Concluída */}
        <Button
          size="sm"
          variant={isDone ? "default" : "outline"}
          disabled={loading || isDone}
          onClick={(e) => { e.stopPropagation(); updateStatus("concluido"); }}
          className={`flex-1 gap-1.5 text-xs h-8 ${isDone ? "bg-success text-success-foreground hover:bg-success/90 border-success" : "border-success/40 text-success hover:bg-success/10 hover:border-success"}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isDone ? "Concluída" : "Concluir"}
        </Button>

        {/* Adiar */}
        <Button
          size="sm"
          variant="outline"
          disabled={loading || isDone || isCancelled}
          onClick={(e) => { e.stopPropagation(); setAdiarOpen(true); }}
          className="flex-1 gap-1.5 text-xs h-8 border-warning/40 text-warning hover:bg-warning/10 hover:border-warning"
        >
          <Clock className="h-3.5 w-3.5" />
          Adiar
        </Button>

        {/* Não concluída / Em andamento dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || isDone}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 gap-1.5 text-xs h-8 border-muted text-muted-foreground hover:bg-muted/30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Mais
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); updateStatus("em_andamento"); }}
              className="gap-2 cursor-pointer"
            >
              <Clock className="h-4 w-4 text-primary" />
              Em andamento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); updateStatus("pendente"); }}
              className="gap-2 cursor-pointer"
            >
              <Clock className="h-4 w-4 text-warning" />
              Pendente
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); updateStatus("cancelado"); }}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Não concluída / Cancelar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Adiar dialog */}
      <Dialog open={adiarOpen} onOpenChange={setAdiarOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Adiar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nova data agendada</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdiarOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAdiar}
              disabled={loading}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Adiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
