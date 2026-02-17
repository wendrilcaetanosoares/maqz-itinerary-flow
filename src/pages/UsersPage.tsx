import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  task_applier: "Aplicador de Tarefas",
  employee: "Funcionário",
};

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<(Profile & { roles: string[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      if (profilesRes.data && rolesRes.data) {
        const usersWithRoles = profilesRes.data.map((p) => ({
          ...p,
          roles: rolesRes.data.filter((r) => r.user_id === p.user_id).map((r) => r.role),
        }));
        setUsers(usersWithRoles);
      }
      setLoading(false);
    };
    fetchUsers();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold text-foreground">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.user_id}</p>
                </div>
                <div className="flex gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {roleLabels[role] || role}
                    </Badge>
                  ))}
                  {user.roles.length === 0 && (
                    <Badge variant="outline" className="text-muted-foreground">Sem permissão</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
