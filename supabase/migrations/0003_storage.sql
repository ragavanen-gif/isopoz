-- ISOPoz — Migration 0003 : buckets Storage (documents clients & RH)
-- Exécuter après 0002. Les buckets sont PRIVÉS : aucun accès anon/authenticated.
-- Tout accès passe par des URL signées générées côté serveur (service_role)
-- APRÈS contrôle de permission applicatif. Voir docs/05.

insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('hr-docs', 'hr-docs', false)
on conflict (id) do nothing;

-- Aucune policy permissive sur storage.objects pour ces buckets :
-- RLS étant activée par défaut, seuls les appels service_role (serveur) y accèdent.
-- Les téléchargements se font via createSignedUrl (route /api/documents/[id]/download).
