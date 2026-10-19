-- School Assessment Platform: school-level settings
-- Run once in Supabase SQL Editor for project wappdiduuulrrnaczaxl.
create table if not exists public.school_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.school_settings enable row level security;

drop policy if exists "School members can read settings" on public.school_settings;
create policy "School members can read settings"
on public.school_settings for select to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = school_settings.school_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists "School admins can insert settings" on public.school_settings;
create policy "School admins can insert settings"
on public.school_settings for insert to authenticated
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = school_settings.school_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner','admin')
  )
);

drop policy if exists "School admins can update settings" on public.school_settings;
create policy "School admins can update settings"
on public.school_settings for update to authenticated
using (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = school_settings.school_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.school_memberships sm
    where sm.school_id = school_settings.school_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner','admin')
  )
);

grant select, insert, update on public.school_settings to authenticated;
