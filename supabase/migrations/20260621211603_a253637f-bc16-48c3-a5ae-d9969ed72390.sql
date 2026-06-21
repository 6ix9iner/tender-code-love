ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(content,'')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS notes_search_tsv_idx ON public.notes USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON public.notes (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS note_links_from_idx ON public.note_links (from_note_id);
CREATE INDEX IF NOT EXISTS note_links_to_idx ON public.note_links (to_note_id);