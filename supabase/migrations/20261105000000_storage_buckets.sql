-- Phase 0: storage bucket that Lovable Cloud created outside the migrations.
-- org-files is private: documents, packets and letterheads are read through
-- 60-second signed URLs or authenticated downloads, never public URLs.
-- Access is governed by the storage.objects policies in the earlier migrations.
insert into storage.buckets (id, name, public)
values ('org-files', 'org-files', false)
on conflict (id) do nothing;
