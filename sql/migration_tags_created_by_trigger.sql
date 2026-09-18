-- Setzt created_by serverseitig auf auth.uid() beim Einfügen eines Tags.
-- Notwendig weil nachträglich hinzugefügte FK-Spalten via ALTER TABLE
-- in Supabase/PostgREST manchmal clientseitig nicht zuverlässig beschrieben werden.

CREATE OR REPLACE FUNCTION public.tags_set_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tags_set_created_by
BEFORE INSERT ON tags
FOR EACH ROW EXECUTE FUNCTION public.tags_set_created_by();
