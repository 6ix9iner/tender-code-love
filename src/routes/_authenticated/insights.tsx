import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { api, ApiClientError, isApiConfigured } from "@/lib/api-client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — noted" }] }),
  component: Insights,
});

function Insights() {
  const qc = useQueryClient();
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights")
        .select("id, kind, payload, generated_at")
        .order("generated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const regen = async () => {
    try {
      toast.loading("Generating insights…", { id: "ins" });
      await api.generateInsights();
      toast.success("Insights refreshed", { id: "ins" });
      qc.invalidateQueries({ queryKey: ["insights"] });
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed", { id: "ins" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated study patterns, focus areas, and revision suggestions.
          </p>
        </div>
        <Button size="sm" onClick={regen} className="shrink-0">
          <Sparkles className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>

      {!isApiConfigured() && (
        <Card className="mt-6 border-dashed p-6 text-sm">
          <div className="font-medium">AI backend not connected yet</div>
          <p className="mt-1 text-muted-foreground">
            Deploy the <code className="rounded bg-muted px-1">php-api/</code> folder to Railway,
            then set <code className="rounded bg-muted px-1">VITE_RAILWAY_API_BASE_URL</code> in your
            project settings to enable summaries and insights.
          </p>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {(insights.data ?? []).length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No insights yet. Click Refresh once your PHP API is live.
          </Card>
        )}
        {insights.data?.map((i) => (
          <Card key={i.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {i.kind.replaceAll("_", " ")}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(i.generated_at), { addSuffix: true })}
              </div>
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-sans text-sm">
              {JSON.stringify(i.payload, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}