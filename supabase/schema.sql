create table if not exists public.teachers (
  id text primary key,
  name text not null,
  email text,
  phone text,
  avatar_path text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  room_id text not null unique,
  room_name text not null,
  teacher_id text references public.teachers(id) on delete set null,
  teacher_name text,
  modules text[] not null default '{}',
  room_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipments (
  id text primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  type text not null check (type in ('TSCĐ', 'CCDC')),
  name text not null,
  code text not null,
  quantity integer not null default 0,
  note text,
  specification text,
  status text not null default 'Đang sử dụng',
  original_price bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipments_room_id_idx on public.equipments(room_id);
create index if not exists rooms_teacher_id_idx on public.rooms(teacher_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists equipments_set_updated_at on public.equipments;
create trigger equipments_set_updated_at
before update on public.equipments
for each row execute function public.set_updated_at();

alter table public.teachers enable row level security;
alter table public.rooms enable row level security;
alter table public.equipments enable row level security;

drop policy if exists "Public can read teachers" on public.teachers;
create policy "Public can read teachers"
on public.teachers for select
using (true);

drop policy if exists "Authenticated users can manage teachers" on public.teachers;
create policy "Authenticated users can manage teachers"
on public.teachers for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read rooms" on public.rooms;
create policy "Public can read rooms"
on public.rooms for select
using (true);

drop policy if exists "Authenticated users can manage rooms" on public.rooms;
create policy "Authenticated users can manage rooms"
on public.rooms for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read equipments" on public.equipments;
create policy "Public can read equipments"
on public.equipments for select
using (true);

drop policy if exists "Authenticated users can manage equipments" on public.equipments;
create policy "Authenticated users can manage equipments"
on public.equipments for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values
  ('room-layouts', 'room-layouts', true),
  ('teacher-avatars', 'teacher-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read room layouts" on storage.objects;
create policy "Public can read room layouts"
on storage.objects for select
using (bucket_id = 'room-layouts');

drop policy if exists "Authenticated users can upload room layouts" on storage.objects;
create policy "Authenticated users can upload room layouts"
on storage.objects for insert
to authenticated
with check (bucket_id = 'room-layouts');

drop policy if exists "Authenticated users can update room layouts" on storage.objects;
create policy "Authenticated users can update room layouts"
on storage.objects for update
to authenticated
using (bucket_id = 'room-layouts')
with check (bucket_id = 'room-layouts');

drop policy if exists "Authenticated users can delete room layouts" on storage.objects;
create policy "Authenticated users can delete room layouts"
on storage.objects for delete
to authenticated
using (bucket_id = 'room-layouts');

drop policy if exists "Public can read teacher avatars" on storage.objects;
create policy "Public can read teacher avatars"
on storage.objects for select
using (bucket_id = 'teacher-avatars');

drop policy if exists "Authenticated users can upload teacher avatars" on storage.objects;
create policy "Authenticated users can upload teacher avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'teacher-avatars');

drop policy if exists "Authenticated users can update teacher avatars" on storage.objects;
create policy "Authenticated users can update teacher avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'teacher-avatars')
with check (bucket_id = 'teacher-avatars');

drop policy if exists "Authenticated users can delete teacher avatars" on storage.objects;
create policy "Authenticated users can delete teacher avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'teacher-avatars');
