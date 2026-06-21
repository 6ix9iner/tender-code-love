import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notes/")({
  head: () => ({ meta: [{ title: "Notes — noted" }] }),
  component: NotesIndex,
});

function NotesIndex() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("id, name, color").order("name");
      if (error) throw error;
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["notes-list", activeTag],
    queryFn: async () => {
      let query = supabase
        .from("notes")
        .select("id, title, summary, updated_at, note_tags(tag_id)")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(200);
      const { data, error } = await query;
      if (error) throw error;
      if (!activeTag) return data;
      return data.filter((n) => n.note_tags?.some((t) => t.tag_id === activeTag));
    },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return notes.data ?? [];
    const needle = q.toLowerCase();
    return (notes.data ?? []).filter(
      (n) =>
        (n.title ?? "").toLowerCase().includes(needle) ||
        (n.summary ?? "").toLowerCase().includes(needle),
    );
  }, [q, notes.data]);

  const createNew = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.user.id, title: "Untitled", content: "" })
      .select("id")
      .single();
    if (error || !data) return;
    navigate({ to: "/notes/$noteId", params: { noteId: data.id } });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <h1 className="font-serif text-2xl tracking-tight">All notes</h1>
        <Button size="sm" onClick={createNew} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes…"
            className="pl-9"
          />
        </div>
      </div>

      {(tags.data ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge
            variant={activeTag === null ? "default" : "outline"}
            onClick={() => setActiveTag(null)}
            className="cursor-pointer"
          >
            All
          </Badge>
          {tags.data?.map((t) => (
            <Badge
              key={t.id}
              variant={activeTag === t.id ? "default" : "outline"}
              onClick={() => setActiveTag(t.id)}
              className="cursor-pointer"
              style={
                activeTag === t.id
                  ? { backgroundColor: t.color, color: "white", borderColor: t.color }
                  : { borderColor: t.color, color: t.color }
              }
            >
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {notes.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!notes.isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No notes match. <button onClick={createNew} className="text-primary underline">Create one</button>.
          </Card>
        )}
        {filtered.map((n) => (
          <Link key={n.id} to="/notes/$noteId" params={{ noteId: n.id }}>
            <Card className="p-4 transition hover:border-primary/40">
              <div className="font-serif text-base">{n.title || "Untitled"}</div>
              {n.summary && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.summary}</div>}
              <div className="mt-2 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}