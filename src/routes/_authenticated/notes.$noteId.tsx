import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Trash2, Tag as TagIcon, Link2, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  component: NoteEditor,
});

function NoteEditor() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const noteQ = useQuery({
    queryKey: ["note", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content, summary, updated_at, archived")
        .eq("id", noteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const tagsQ = useQuery({
    queryKey: ["all-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("id, name, color").order("name");
      if (error) throw error;
      return data;
    },
  });

  const noteTagsQ = useQuery({
    queryKey: ["note-tags", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_tags")
        .select("tag_id, tags(id, name, color)")
        .eq("note_id", noteId);
      if (error) throw error;
      return data;
    },
  });

  const linksQ = useQuery({
    queryKey: ["note-links", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_links")
        .select("to_note_id, notes!note_links_to_note_id_fkey(id, title)")
        .eq("from_note_id", noteId);
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (noteQ.data && !initialized.current) {
      setTitle(noteQ.data.title ?? "");
      setContent(noteQ.data.content ?? "");
      initialized.current = true;
      // log a view
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from("note_views").insert({ user_id: data.user.id, note_id: noteId });
          supabase.from("notes").update({ last_viewed_at: new Date().toISOString() }).eq("id", noteId);
        }
      });
    }
  }, [noteQ.data, noteId]);

  // debounced save
  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(async () => {
      await supabase
        .from("notes")
        .update({ title: title || "Untitled", content })
        .eq("id", noteId);
      qc.invalidateQueries({ queryKey: ["recent-notes"] });
    }, 700);
    return () => clearTimeout(t);
  }, [title, content, noteId, qc]);

  const summarize = async () => {
    try {
      toast.loading("Summarizing…", { id: "sum" });
      const r = await api.summarize(noteId);
      toast.success("Summary updated", { id: "sum" });
      qc.invalidateQueries({ queryKey: ["note", noteId] });
      return r;
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Failed";
      toast.error(msg, { id: "sum" });
    }
  };

  const deleteNote = async () => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("notes").delete().eq("id", noteId);
    navigate({ to: "/notes" });
  };

  const toggleTag = async (tagId: string, on: boolean) => {
    if (on) {
      await supabase.from("note_tags").insert({ note_id: noteId, tag_id: tagId });
    } else {
      await supabase.from("note_tags").delete().eq("note_id", noteId).eq("tag_id", tagId);
    }
    qc.invalidateQueries({ queryKey: ["note-tags", noteId] });
  };

  const [newTag, setNewTag] = useState("");
  const createTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("tags")
      .insert({ user_id: u.user.id, name })
      .select("id")
      .single();
    if (data) {
      await supabase.from("note_tags").insert({ note_id: noteId, tag_id: data.id });
      setNewTag("");
      qc.invalidateQueries({ queryKey: ["all-tags"] });
      qc.invalidateQueries({ queryKey: ["note-tags", noteId] });
    }
  };

  const noteTagIds = new Set((noteTagsQ.data ?? []).map((nt) => nt.tag_id));

  if (noteQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!noteQ.data) {
    return <div className="p-8 text-sm text-muted-foreground">Note not found.</div>;
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="h-auto border-0 bg-transparent px-0 font-serif !text-2xl tracking-tight focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={summarize}>
              <Sparkles className="mr-1 h-4 w-4" /> Summarize
            </Button>
            <Button size="icon" variant="ghost" onClick={deleteNote}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {noteQ.data.summary && (
          <Card className="mt-3 border-l-4 border-l-primary p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">AI summary</div>
            <div>{noteQ.data.summary}</div>
          </Card>
        )}

        <Tabs defaultValue="write" className="mt-4">
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="mr-1 h-3.5 w-3.5" /> Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing… (markdown supported)"
              className="min-h-[60vh] resize-none border-0 bg-transparent px-0 font-serif text-base leading-relaxed focus-visible:ring-0"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="prose prose-stone max-w-none font-serif dark:prose-invert">
              <ReactMarkdown>{content || "*Nothing to preview*"}</ReactMarkdown>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="space-y-4">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <TagIcon className="h-3.5 w-3.5" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(tagsQ.data ?? []).map((t) => {
              const on = noteTagIds.has(t.id);
              return (
                <Badge
                  key={t.id}
                  variant={on ? "default" : "outline"}
                  onClick={() => toggleTag(t.id, !on)}
                  className="cursor-pointer"
                  style={
                    on
                      ? { backgroundColor: t.color, color: "white", borderColor: t.color }
                      : { borderColor: t.color, color: t.color }
                  }
                >
                  {t.name}
                </Badge>
              );
            })}
          </div>
          <div className="mt-3 flex gap-1.5">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTag()}
              placeholder="New tag"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={createTag}>Add</Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" /> Linked notes
          </div>
          {(linksQ.data ?? []).length === 0 && (
            <div className="text-xs text-muted-foreground">No links yet.</div>
          )}
          <div className="space-y-1">
            {linksQ.data?.map((l) => {
              const target = (l as { notes: { id: string; title: string } | null }).notes;
              if (!target) return null;
              return (
                <Link
                  key={l.to_note_id}
                  to="/notes/$noteId"
                  params={{ noteId: target.id }}
                  className="block truncate rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  {target.title}
                </Link>
              );
            })}
          </div>
        </Card>
      </aside>
    </div>
  );
}