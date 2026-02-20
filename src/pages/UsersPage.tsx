import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, UserCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];
type Sector = Database["public"]["Tables"]["sectors"]["Row"];

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  task_applier: "Aplicador de Tarefas",
  employee: "Funcionário",
};

const roleColors: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  task_applier: "bg-accent/10 text-accent-foreground border-accent/20",
  employee: "bg-muted text-muted-foreground border-border",
};

type UserWithRole = Profile & { role: AppRole | null; role_id: string | null };

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "employee" as AppRole,
  sector_id: "",
};

export default function UsersPage() {
  const { isAdmin, session } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editRole, setEditRole] = useState<AppRole>("employee");
  const [editSector, setEditSector] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [profilesRes, rolesRes, sectorsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("user_roles").select("*"),
      supabase.from("sectors").select("*").order("name"),
    ]);

    if (sectorsRes.data) setSectors(sectorsRes.data);

    if (profilesRes.data && rolesRes.data) {
      const merged = profilesRes.data.map((p) => {
        const roleRow = rolesRes.data.find((r) => r.user_id === p.user_id);
        return {
          ...p,
          role: (roleRow?.role ?? null) as AppRole | null,
          role_id: roleRow?.id ?? null,
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  // ── Create user ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            name: form.name.trim(),
            role: form.role,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erro ao criar usuário");
      }

      // Associate sector if selected
      if (form.sector_id && form.sector_id !== "none" && data.user_id) {
        await supabase
          .from("profiles")
          .update({ sector_id: form.sector_id })
          .eq("user_id", data.user_id);
      }

      toast({ title: "Usuário criado com sucesso!" });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Edit user ────────────────────────────────────────────────────────────────
  const openEdit = (user: UserWithRole) => {
    setEditUser(user);
    setEditRole(user.role ?? "employee");
    setEditSector(user.sector_id ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Update sector ("none" sentinel → null)
      await supabase
        .from("profiles")
        .update({ sector_id: editSector && editSector !== "none" ? editSector : null })
        .eq("user_id", editUser.user_id);

      // Update role
      if (editUser.role_id) {
        await supabase
          .from("user_roles")
          .update({ role: editRole })
          .eq("id", editUser.role_id);
      } else {
        await supabase
          .from("user_roles")
          .insert({ user_id: editUser.user_id, role: editRole });
      }
      toast({ title: "Usuário atualizado!" });
      setEditOpen(false);
      setEditUser(null);
      fetchData();
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sectorName = (id: string | null) =>
    sectors.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os colaboradores do sistema</p>
        </div>
        <Button
          onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}
          className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-5"
        >
          <Plus className="h-5 w-5" />
          Novo Usuário
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground leading-tight">{user.name}</h3>
                    <p className="text-xs text-muted-foreground">{sectorName(user.sector_id)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {user.role ? (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border-border">
                      Sem permissão
                    </span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-10">Nenhum usuário cadastrado.</p>
          )}
        </div>
      )}

      {/* ── Create Dialog ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="c-name">Nome completo</Label>
              <Input
                id="c-name"
                placeholder="João da Silva"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-email">E-mail (login)</Label>
              <Input
                id="c-email"
                type="email"
                placeholder="joao@maqz.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-password">Senha inicial</Label>
              <Input
                id="c-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-role">Permissão</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as AppRole }))}
              >
                <SelectTrigger id="c-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="task_applier">Aplicador de Tarefas</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-sector">Setor</Label>
              <Select
                value={form.sector_id}
                onValueChange={(v) => setForm((f) => ({ ...f, sector_id: v }))}
              >
                <SelectTrigger id="c-sector">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="e-role">Permissão</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger id="e-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="task_applier">Aplicador de Tarefas</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-sector">Setor</Label>
              <Select value={editSector} onValueChange={setEditSector}>
                <SelectTrigger id="e-sector">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleEdit}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
