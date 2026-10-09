CREATE TABLE public.organization_letterheads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
 storage_path text NOT NULL,
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','application/pdf')),
 header_points integer NOT NULL DEFAULT 120 CHECK (header_points BETWEEN 72 AND 216),
 footer_points integer NOT NULL DEFAULT 54 CHECK (footer_points BETWEEN 36 AND 108),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (split_part(storage_path, '/', 1) = organization_id::text AND split_part(storage_path, '/', 2) = 'letterhead')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_letterheads TO authenticated;
GRANT ALL ON public.organization_letterheads TO service_role;
ALTER TABLE public.organization_letterheads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read letterhead" ON public.organization_letterheads FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "managers insert letterhead" ON public.organization_letterheads FOR INSERT TO authenticated WITH CHECK (public.can_manage_org(organization_id));
CREATE POLICY "managers update letterhead" ON public.organization_letterheads FOR UPDATE TO authenticated USING (public.can_manage_org(organization_id)) WITH CHECK (public.can_manage_org(organization_id));
CREATE POLICY "managers remove letterhead" ON public.organization_letterheads FOR DELETE TO authenticated USING (public.can_manage_org(organization_id));
CREATE TRIGGER t_audit AFTER INSERT OR UPDATE OR DELETE ON public.organization_letterheads FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE POLICY "letterhead uploads require managers" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'org-files' OR split_part(name, '/', 2) <> 'letterhead' OR public.can_manage_org(split_part(name, '/', 1)::uuid));