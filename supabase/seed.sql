-- ISOPoz — Seed : catalogue de permissions + rôles système
-- Exécuter après 0001_core.sql. Idempotent.

-- ============================================================
-- Catalogue de permissions
-- ============================================================
insert into public.permissions (key, module, label) values
  ('clients.view','clients','Voir les clients'),
  ('clients.create','clients','Créer des clients'),
  ('clients.edit','clients','Modifier des clients'),
  ('clients.delete','clients','Supprimer des clients'),

  ('requests.view','requests','Voir les demandes'),
  ('requests.create','requests','Créer des demandes'),
  ('requests.edit','requests','Modifier des demandes'),
  ('requests.delete','requests','Supprimer des demandes'),
  ('requests.assign','requests','Assigner un gestionnaire'),

  ('quotes.view','quotes','Voir les devis'),
  ('quotes.create','quotes','Créer des devis'),
  ('quotes.edit','quotes','Modifier des devis'),
  ('quotes.delete','quotes','Supprimer des devis'),
  ('quotes.send','quotes','Envoyer des devis'),
  ('quotes.validate','quotes','Valider des devis'),

  ('projects.view','projects','Voir les chantiers'),
  ('projects.create','projects','Créer des chantiers'),
  ('projects.edit','projects','Modifier des chantiers'),
  ('projects.delete','projects','Supprimer des chantiers'),

  ('planning.view','planning','Voir le planning'),
  ('planning.create','planning','Créer des créneaux'),
  ('planning.edit','planning','Modifier le planning'),
  ('planning.delete','planning','Supprimer des créneaux'),

  ('teams.view','teams','Voir les équipes'),
  ('teams.create','teams','Créer des équipes'),
  ('teams.edit','teams','Modifier des équipes'),
  ('teams.delete','teams','Supprimer des équipes'),

  ('employees.view','employees','Voir les salariés'),
  ('employees.create','employees','Créer des salariés'),
  ('employees.edit','employees','Modifier des salariés'),
  ('employees.delete','employees','Supprimer des salariés'),

  ('ephemeral.view','ephemeral','Voir les journées éphémères'),
  ('ephemeral.create','ephemeral','Planifier des journées éphémères'),
  ('ephemeral.edit','ephemeral','Modifier des journées éphémères'),
  ('ephemeral.validate','ephemeral','Valider des journées éphémères'),

  ('equipment.view','equipment','Voir le matériel'),
  ('equipment.create','equipment','Créer du matériel'),
  ('equipment.edit','equipment','Modifier du matériel'),
  ('equipment.delete','equipment','Supprimer du matériel'),

  ('invoices.view','invoices','Voir les factures'),
  ('invoices.create','invoices','Créer des factures'),
  ('invoices.edit','invoices','Modifier des factures'),
  ('invoices.delete','invoices','Supprimer des factures'),
  ('invoices.send','invoices','Envoyer des factures'),
  ('invoices.mark_paid','invoices','Marquer payé'),

  ('payments.view','payments','Voir les paiements'),
  ('payments.create','payments','Enregistrer des paiements'),
  ('payments.edit','payments','Modifier des paiements'),
  ('payments.delete','payments','Supprimer des paiements'),

  ('reminders.view','reminders','Voir les relances'),
  ('reminders.create','reminders','Créer des relances'),
  ('reminders.send','reminders','Envoyer des relances'),

  ('suppliers.view','suppliers','Voir les fournisseurs'),
  ('suppliers.create','suppliers','Créer des fournisseurs'),
  ('suppliers.edit','suppliers','Modifier des fournisseurs'),
  ('suppliers.delete','suppliers','Supprimer des fournisseurs'),

  ('orders.view','orders','Voir les commandes'),
  ('orders.create','orders','Créer des commandes'),
  ('orders.edit','orders','Modifier des commandes'),
  ('orders.delete','orders','Supprimer des commandes'),

  ('negotiations.view','negotiations','Voir les négociations'),
  ('negotiations.create','negotiations','Créer des négociations'),
  ('negotiations.edit','negotiations','Modifier des négociations'),

  ('documents.view','documents','Voir les documents'),
  ('documents.upload','documents','Téléverser des documents'),
  ('documents.edit','documents','Modifier des documents'),
  ('documents.delete','documents','Supprimer des documents'),
  ('documents.download','documents','Télécharger des documents'),

  ('templates.view','templates','Voir les modèles'),
  ('templates.create','templates','Créer des modèles'),
  ('templates.edit','templates','Modifier des modèles'),
  ('templates.delete','templates','Supprimer des modèles'),

  ('hr.view','hr','Voir les documents RH'),
  ('hr.manage','hr','Gérer les documents RH'),

  ('analytics.view','analytics','Voir les analyses'),

  ('admin.users','admin','Gérer les utilisateurs'),
  ('admin.roles','admin','Gérer les rôles'),
  ('admin.permissions','admin','Gérer les permissions'),
  ('admin.settings','admin','Gérer les paramètres'),
  ('admin.audit','admin','Consulter le journal d''activité'),

  ('portal.self','portal','Accès portail salarié')
on conflict (key) do update set module = excluded.module, label = excluded.label;

-- ============================================================
-- Rôles système
-- ============================================================
insert into public.roles (name, description, is_system) values
  ('super_admin','Accès total (bypass des permissions)', true),
  ('gestionnaire','Rôle opérationnel principal', true),
  ('salarie','Salarié CDI/CDD — portail personnel', true),
  ('ephemere','Salarié éphémère', true)
on conflict (name) do nothing;

-- Gestionnaire : tout le périmètre opérationnel (sans admin.* ni hr.manage)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'gestionnaire'
  and p.module in ('clients','requests','quotes','projects','planning','teams',
                   'employees','ephemeral','equipment','invoices','payments',
                   'reminders','suppliers','orders','negotiations','documents',
                   'templates','analytics')
on conflict do nothing;

-- Salarié : portail perso
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.name = 'salarie' and p.key = 'portal.self'
on conflict do nothing;

-- ============================================================
-- Promotion du super admin (à exécuter une fois le compte créé via Supabase Auth)
-- Remplacer l'email puis exécuter :
-- ============================================================
-- update public.users set is_super_admin = true where email = 'admin@isopoz.fr';
-- insert into public.user_roles (user_id, role_id)
--   select u.id, r.id from public.users u, public.roles r
--   where u.email = 'admin@isopoz.fr' and r.name = 'super_admin'
--   on conflict do nothing;
