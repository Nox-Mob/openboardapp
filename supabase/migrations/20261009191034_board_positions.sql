CREATE TABLE public.board_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  term_years integer CHECK (term_years IS NULL OR term_years BETWEEN 1 AND 10),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, title)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_positions TO authenticated;
GRANT ALL ON public.board_positions TO service_role;
ALTER TABLE public.board_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.board_positions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "editors insert" ON public.board_positions FOR INSERT TO authenticated WITH CHECK (public.can_edit_records(organization_id));
CREATE POLICY "editors update" ON public.board_positions FOR UPDATE TO authenticated USING (public.can_edit_records(organization_id)) WITH CHECK (public.can_edit_records(organization_id));
CREATE POLICY "editors delete" ON public.board_positions FOR DELETE TO authenticated USING (public.can_edit_records(organization_id));
CREATE TRIGGER t_audit AFTER INSERT OR UPDATE OR DELETE ON public.board_positions FOR EACH ROW EXECUTE FUNCTION public.audit_row();

ALTER TABLE public.board_terms ADD COLUMN position_id uuid REFERENCES public.board_positions(id) ON DELETE SET NULL;
CREATE INDEX board_terms_position_idx ON public.board_terms(position_id);

CREATE OR REPLACE FUNCTION public.check_term_position_org() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.board_positions p WHERE p.id = new.position_id AND p.organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Board role belongs to another organization';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER t_org_term_pos BEFORE INSERT OR UPDATE ON public.board_terms FOR EACH ROW EXECUTE FUNCTION public.check_term_position_org();

-- Backfill: one role per distinct existing position title, linked to its terms.
INSERT INTO public.board_positions (organization_id, title)
SELECT DISTINCT organization_id, position FROM public.board_terms
ON CONFLICT (organization_id, title) DO NOTHING;
UPDATE public.board_terms t SET position_id = p.id
FROM public.board_positions p WHERE p.organization_id = t.organization_id AND p.title = t.position AND t.position_id IS NULL;