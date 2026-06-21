import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notes/new")({
  component: NotesNew,
});

function NotesNew() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("notes")
        .insert({ user_id: u.user.id, title: "Untitled", content: "" })
        .select("id")
        .single();
      if (data) navigate({ to: "/notes/$noteId", params: { noteId: data.id }, replace: true });
    })();
  }, [navigate]);
  return <div className="p-8 text-sm text-muted-foreground">Creating note…</div>;
}