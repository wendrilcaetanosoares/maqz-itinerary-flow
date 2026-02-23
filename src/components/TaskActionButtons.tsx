import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  taskId: string;
  currentStatus: string;
  onUpdated: () => void;
}

export default function TaskActionButtons({ taskId, currentStatus, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [adiarOpen, setAdiarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [justification, setJustification] = useState("");

  const updateStatus = async (status: string, extraData?: object) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status, ...extraData } as any)
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

  const handleConcluir = () => {
    updateStatus("concluida", { updated_at: new Date().toISOString() });
  };

  const handleAdiar = async () => {
    if (!newDate) {
      toast({ title: "Selecione uma nova data", variant: "destructive" });
      return;
    }
    if (!justification.trim()) {
      toast({ title: "Informe a justificativa para adiar", variant: "destructive" });
      return;
    }
    await updateStatus("adiada", {
      scheduled_date: newDate,
      status_justification: justification.trim(),
    });
    setAdiarOpen(false);
    setNewDate("");
    setJustification("");
  };

  const handleCancelar = async () => {
    if (!justification.trim()) {
      toast({ title: "Informe a justificativa para cancelar", variant: "destructive" });
      return;
    }
    await updateStatus("cancelada", {
      status_justification: justification.trim(),
    });
    setCancelarOpen(false);
    setJustification("");
  };

  const isDone = currentStatus === "concluida";
  const isCancelled = currentStatus === "cancelada";
  const isAdiada = currentStatus === "adiada";
  const isInactive = isDone || isCancelled;

  return (
    <>
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
        {/* Concluir */}
        <Button
          size="sm"
          variant={isDone ? "default" : "outline"}
          disabled={loading || isInactive}
          onClick={(e) => { e.stopPropagation(); handleConcluir(); }}
          className={`flex-1 gap-1.5 text-xs h-8 ${isDone ? "bg-success text-success-foreground hover:bg-success/90 border-success" : "border-success/40 text-success hover:bg-success/10 hover:border-success"}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isDone ? "Concluída" : "Concluir"}
        </Button>

        {/* Adiar */}
        <Button
          size="sm"
          variant="outline"
          disabled={loading || isInactive}
          onClick={(e) => { e.stopPropagation(); setJustification(""); setAdiarOpen(true); }}
          className="flex-1 gap-1.5 text-xs h-8 border-warning/40 text-warning hover:bg-warning/10 hover:border-warning"
        >
          <Clock className="h-3.5 w-3.5" />
          Adiar
        </Button>

        {/* Cancelar */}
        <Button
          size="sm"
          variant="outline"
          disabled={loading || isInactive}
          onClick={(e) => { e.stopPropagation(); setJustification(""); setCancelarOpen(true); }}
          className="flex-1 gap-1.5 text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      </div>

      {/* Adiar dialog */}
      <Dialog open={adiarOpen} onOpenChange={setAdiarOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Adiar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nova data agendada</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1">
              <Label>Justificativa <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Motivo do adiamento..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdiarOpen(false)}>Voltar</Button>
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

      {/* Cancelar dialog */}
      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Cancelar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Justificativa <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Motivo do cancelamento..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)}>Voltar</Button>
            <Button
              onClick={handleCancelar}
              disabled={loading}
              variant="destructive"
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
