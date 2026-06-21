import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/graph")({
  head: () => ({ meta: [{ title: "Knowledge graph — noted" }] }),
  component: GraphPage,
});

function GraphPage() {
  const navigate = useNavigate();

  const data = useQuery({
    queryKey: ["graph"],
    queryFn: async () => {
      const [{ data: notes }, { data: links }] = await Promise.all([
        supabase.from("notes").select("id, title").eq("archived", false).limit(500),
        supabase.from("note_links").select("from_note_id, to_note_id"),
      ]);
      return { notes: notes ?? [], links: links ?? [] };
    },
  });

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const notes = data.data?.notes ?? [];
    const links = data.data?.links ?? [];
    const N = notes.length || 1;
    const radius = Math.max(180, N * 22);
    const nodes: Node[] = notes.map((n, i) => {
      const a = (i / N) * Math.PI * 2;
      return {
        id: n.id,
        position: { x: Math.cos(a) * radius, y: Math.sin(a) * radius },
        data: { label: n.title || "Untitled" },
        style: {
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          borderRadius: 6,
          padding: 6,
          fontSize: 12,
          fontFamily: "var(--font-serif)",
          minWidth: 80,
          textAlign: "center" as const,
        },
      };
    });
    const edges: Edge[] = links.map((l, i) => ({
      id: `e${i}`,
      source: l.from_note_id,
      target: l.to_note_id,
      style: { stroke: "var(--muted-foreground)", strokeOpacity: 0.4 },
    }));
    return { nodes, edges };
  }, [data.data]);

  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <div className="absolute left-4 top-16 z-10">
        <Card className="px-3 py-2 text-xs">
          <div className="font-serif text-base">Knowledge graph</div>
          <div className="text-muted-foreground">
            {data.data?.notes.length ?? 0} notes · {data.data?.links.length ?? 0} links
          </div>
        </Card>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodeClick={(_, node) => navigate({ to: "/notes/$noteId", params: { noteId: node.id } })}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="var(--border)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}