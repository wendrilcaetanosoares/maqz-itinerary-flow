import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

import type { Database } from "@/integrations/supabase/types";

type TaskType = Database["public"]["Enums"]["task_type"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type Sector = Database["public"]["Tables"]["sectors"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const typeOptions: { value: TaskType; label: string }[] = [
  { value: "entrega", label: "Entrega" },
  { value: "retirada", label: "Retirada" },
  { value: "venda", label: "Venda" },
  { value: "manutencao", label: "Manutenção" },
  { value: "garantia", label: "Garantia" },
  { value: "administrativo", label: "Administrativo" },
  { value: "suporte", label: "Suporte" },
];

const EMPTY_FORM = {
  type: "" as TaskType | "",
  sector_id: "",
  client_name: "",
  client_phone: "",
  client_address: "",
  client_cep: "",
  client_time_limit: "",
  machine: "",
  priority: "media" as TaskPriority,
  scheduled_date: undefined as Date | undefined,
  scheduled_time: "",
  deadline: undefined as Date | undefined,
  value: "",
  observations: "",
};

export default function TaskFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<Profile[]>([]);
  const [assigneePopover, setAssigneePopover] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("sectors").select("*").order("name"),
      supabase.from("profiles").select("*").order("name"),
    ]).then(([sRes, uRes]) => {
      if (sRes.data) setSectors(sRes.data);
      if (uRes.data) setUsers(uRes.data);
    });
  }, [open]);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleAssignee = (profile: Profile) => {
    setSelectedAssignees((prev) =>
      prev.some((p) => p.user_id === profile.user_id)
        ? prev.filter((p) => p.user_id !== profile.user_id)
        : [...prev, profile]
    );
  };

  const handleSubmit = async () => {
    if (!form.type) { toast({ title: "Selecione o tipo da tarefa", variant: "destructive" }); return; }
    if (!form.client_name.trim()) { toast({ title: "Informe o nome do cliente", variant: "destructive" }); return; }
    if (!user) return;

    setSaving(true);
    try {
      const { data: task, error } = await supabase.from("tasks").insert({
        type: form.type as TaskType,
        sector_id: form.sector_id || null,
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim() || null,
        client_address: form.client_address.trim() || null,
        client_cep: form.client_cep.trim() || null,
        client_time_limit: form.client_time_limit.trim() || null,
        machine: form.machine.trim() || null,
        priority: form.priority,
        scheduled_date: form.scheduled_date ? format(form.scheduled_date, "yyyy-MM-dd") : null,
        scheduled_time: form.scheduled_time || null,
        deadline: form.deadline ? form.deadline.toISOString() : null,
        value: form.value ? parseFloat(form.value) : null,
        observations: form.observations.trim() || null,
        creator_id: user.id,
        status: "pendente",
      }).select().single();

      if (error) throw error;

      // Insert assignees
      if (task && selectedAssignees.length > 0) {
        await supabase.from("task_assignees").insert(
          selectedAssignees.map((p) => ({ task_id: task.id, user_id: p.user_id }))
        );
      }

      // Insert history
      if (task) {
        await supabase.from("task_history").insert({
          task_id: task.id,
          user_id: user.id,
          action: "Tarefa criada",
          details: { type: form.type, priority: form.priority },
        });
      }

      toast({ title: "Tarefa criada com sucesso!" });
      setForm(EMPTY_FORM);
      setSelectedAssignees([]);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Erro ao criar tarefa",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setSelectedAssignees([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── Tipo & Prioridade ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as TaskType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Setor ── */}
          <div className="space-y-1">
            <Label>Setor</Label>
            <Select value={form.sector_id} onValueChange={(v) => set("sector_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem setor</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Responsáveis ── */}
          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <Popover open={assigneePopover} onOpenChange={setAssigneePopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                  Adicionar responsáveis...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar colaborador..." />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => (
                        <CommandItem
                          key={u.user_id}
                          onSelect={() => toggleAssignee(u)}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 h-4 w-4 rounded border flex items-center justify-center",
                            selectedAssignees.some((p) => p.user_id === u.user_id)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}>
                            {selectedAssignees.some((p) => p.user_id === u.user_id) && (
                              <span className="text-xs font-bold">✓</span>
                            )}
                          </div>
                          {u.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedAssignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedAssignees.map((p) => (
                  <Badge key={p.user_id} variant="secondary" className="gap-1 pr-1">
                    {p.name}
                    <button onClick={() => toggleAssignee(p)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ── Separador ── */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Dados do Cliente
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Nome do Cliente <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Nome completo"
                  value={form.client_name}
                  onChange={(e) => set("client_name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={form.client_phone}
                    onChange={(e) => set("client_phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={form.client_cep}
                    onChange={(e) => set("client_cep", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Endereço</Label>
                <Input
                  placeholder="Rua, número, bairro, cidade"
                  value={form.client_address}
                  onChange={(e) => set("client_address", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Horário limite do cliente</Label>
                <Input
                  placeholder="Ex: 18:00 ou manhã"
                  value={form.client_time_limit}
                  onChange={(e) => set("client_time_limit", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Máquina & Agendamento ── */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Detalhes da Tarefa
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Máquina</Label>
                <Input
                  placeholder="Modelo / descrição da máquina"
                  value={form.machine}
                  onChange={(e) => set("machine", e.target.value)}
                />
              </div>

              {/* Data/Hora agendada */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Data agendada</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !form.scheduled_date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.scheduled_date ? format(form.scheduled_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.scheduled_date}
                        onSelect={(d) => set("scheduled_date", d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label>Hora agendada</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      className="pl-9"
                      value={form.scheduled_time}
                      onChange={(e) => set("scheduled_time", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Prazo */}
              <div className="space-y-1">
                <Label>Prazo final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !form.deadline && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.deadline ? format(form.deadline, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar prazo"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.deadline}
                      onSelect={(d) => set("deadline", d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Valor */}
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                />
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais..."
                  className="min-h-[80px] resize-none"
                  value={form.observations}
                  onChange={(e) => set("observations", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-6"
          >
            {saving ? "Criando..." : "Criar Tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
