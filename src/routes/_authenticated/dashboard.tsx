import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Clock, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — noted" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const recent = useQuery({
    queryKey: ["recent-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, summary, updated_at")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const stale = useQuery({
    queryKey: ["stale-notes"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, last_viewed_at")
        .eq("archived", false)
        .or(`last_viewed_at.is.null,last_viewed_at.lt.${cutoff}`)
        .order("last_viewed_at", { ascending: true, nullsFirst: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: async () => {
      const [n, t, l] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("tags").select("id", { count: "exact", head: true }),
        supabase.from("note_links").select("id", { count: "exact", head: true }),
      ]);
      return { notes: n.count ?? 0, tags: t.count ?? 0, links: l.count ?? 0 };
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Pick up where you left off.</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/notes/new"><Plus className="mr-1 h-4 w-4" />New note</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Notes" value={counts.data?.notes ?? "—"} />
        <Stat label="Tags" value={counts.data?.tags ?? "—"} />
        <Stat label="Links" value={counts.data?.links ?? "—"} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" /> Recent notes
          </h2>
          <div className="space-y-2">
            {recent.data?.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No notes yet. <Link to="/notes/new" className="text-primary underline">Create your first one</Link>.
              </Card>
            )}
            {recent.data?.map((n) => (
              <Link key={n.id} to="/notes/$noteId" params={{ noteId: n.id }}>
                <Card className="p-4 transition hover:border-primary/40 hover:shadow-sm">
                  <div className="font-serif text-base">{n.title || "Untitled"}</div>
                  {n.summary && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.summary}</div>}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Revision reminders
          </h2>
          <Card className="divide-y">
            {(stale.data ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nothing due yet.</div>
            )}
            {stale.data?.map((n) => (
              <Link
                key={n.id}
                to="/notes/$noteId"
                params={{ noteId: n.id }}
                className="block p-3 text-sm transition hover:bg-accent"
              >
                <div className="truncate font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">
                  {n.last_viewed_at
                    ? `Last seen ${formatDistanceToNow(new Date(n.last_viewed_at), { addSuffix: true })}`
                    : "Never reviewed"}
                </div>
              </Link>
            ))}
          </Card>

          <div className="mt-6">
            <Button asChild variant="outline" className="w-full">
              <Link to="/insights">
                <Sparkles className="mr-2 h-4 w-4" /> View AI insights
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-3xl">{value}</div>
    </Card>
  );
}