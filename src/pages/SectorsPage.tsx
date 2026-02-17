import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Sector = Database["public"]["Tables"]["sectors"]["Row"];

export default function SectorsPage() {
  const { isAdmin } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSectors = async () => {
    const { data } = await supabase.from("sectors").select("*").order("name");
    if (data) setSectors(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchSectors();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("sectors").insert({ name: newName.trim() });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      fetchSectors();
      toast({ title: "Setor criado!" });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchSectors();
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Setores</h1>
        <p className="text-muted-foreground">Gerencie os setores da empresa</p>
      </div>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Nome do novo setor..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="h-12 max-w-sm"
        />
        <Button onClick={handleAdd} className="h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-5 w-5" />
          Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {sectors.map((sector) => (
            <Card key={sector.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{sector.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(sector.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
