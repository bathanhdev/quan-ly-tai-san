begin;

create extension if not exists pgcrypto;

alter table public.teachers alter column id set default gen_random_uuid()::text;
alter table public.rooms alter column id set default gen_random_uuid()::text;
alter table public.equipments alter column id set default gen_random_uuid()::text;

with teacher_seed(name, department) as (
  values
    ('Trần Thanh Tú', 'Khoa Công nghệ Nhiệt lạnh'),
    ('Nguyễn Văn Phảnh', 'Khoa Công nghệ Nhiệt lạnh'),
    ('Nguyễn Lan Phương', 'Khoa Công nghệ Nhiệt lạnh'),
    ('Trần Minh Khoa', 'Khoa Công nghệ Nhiệt lạnh'),
    ('Trần Thanh Tùng', 'Khoa Công nghệ Nhiệt lạnh'),
    ('Nguyền Xuân Phương', 'Khoa Công nghệ Nhiệt lạnh')
)
insert into public.teachers (name, department)
select seed.name, seed.department
from teacher_seed seed
where not exists (
  select 1
  from public.teachers current_teacher
  where lower(trim(current_teacher.name)) = lower(trim(seed.name))
);

with room_seed(room_id, room_name, teacher_name, modules) as (
  values
    (
      'TH2.108',
      'Phòng Thực hành hệ thống Máy lạnh Công nghiệp 1',
      'Trần Thanh Tú',
      array['Hệ thống máy lạnh công nghiệp 1']::text[]
    ),
    (
      'TH2.201',
      'Phòng Thực hành lạnh cơ bản',
      'Nguyễn Văn Phảnh',
      array['Lạnh cơ bản', 'Máy điện']::text[]
    ),
    (
      'TH2.202',
      'Phòng Thực hành Điều hòa Không khí cục bộ 3',
      'Nguyễn Văn Phảnh',
      array['Hệ thống điều hòa không khí cục bộ']::text[]
    ),
    (
      'TH2.203',
      'Phòng Thực hành Điều hòa Không khí cục bộ 2',
      'Nguyễn Lan Phương',
      array['Hệ thống điều hòa không khí cục bộ']::text[]
    ),
    (
      'TH2.204',
      'Văn phòng khoa Công nghệ Nhiệt lạnh',
      null,
      array[]::text[]
    ),
    (
      'TH2.205',
      'Phòng Thực hành Điều hòa Không khí cục bộ 1',
      'Trần Thanh Tú',
      array['Hệ thống điều hòa không khí cục bộ']::text[]
    ),
    (
      'TH2.208',
      'Phòng Thực hành Điều hòa Không khí trung tâm 1',
      'Nguyễn Lan Phương',
      array['Hệ thống điều hòa Không khí trung tâm']::text[]
    ),
    (
      'TH2.209',
      'Phòng Thực hành Điều hòa Không khí trung tâm 2',
      'Trần Minh Khoa',
      array['Hệ thống điều hòa Không khí trung tâm']::text[]
    ),
    (
      'TH2.210',
      'Phòng Thực hành Điều hòa Không khí trung tâm 3',
      'Trần Thanh Tùng',
      array['Hệ thống điều hòa Không khí trung tâm', 'Hệ thống máy lạnh dân dụng và thương nghiệp']::text[]
    ),
    (
      'TH2.211',
      'Phòng Kỹ thuật cơ sở',
      'Trần Thanh Tùng',
      array['Tự động hóa hệ thống lạnh', 'Điện cơ bản']::text[]
    ),
    (
      'TH2.401',
      'Phòng Thực hành Hệ thống Điều hòa Không khí Trung tâm 4',
      'Trần Minh Khoa',
      array['Hệ thống điều hòa Không khí trung tâm']::text[]
    ),
    (
      'TH2.402',
      'Phòng Thực hành Hệ thống Điều hòa Không khí Trung tâm 5',
      'Nguyễn Văn Phảnh',
      array['Hệ thống điều hòa Không khí trung tâm']::text[]
    ),
    (
      'TH2.403',
      'Phòng thực hành máy lạnh dân dụng và thương nghiệp 1',
      'Trần Thanh Tùng',
      array['Hệ thống máy lạnh dân dụng và thương nghiệp 1']::text[]
    ),
    (
      'TH2.404',
      'Kho',
      'Trần Thanh Tùng',
      array[]::text[]
    ),
    (
      'TH2.405',
      'Phòng thực hành điện - điện tử',
      'Nguyền Xuân Phương',
      array['Trang bị điện', 'PLC']::text[]
    ),
    (
      'Hội trường mới',
      'Hệ thống máy lạnh dân dụng và thương nghiệp 2',
      'Trần Minh Khoa',
      array['Hệ thống máy lạnh dân dụng và thương nghiệp']::text[]
    )
)
insert into public.rooms (room_id, room_name, teacher_id, teacher_name, modules)
select
  seed.room_id,
  seed.room_name,
  (
    select teacher.id
    from public.teachers teacher
    where lower(trim(teacher.name)) = lower(trim(seed.teacher_name))
    order by teacher.created_at
    limit 1
  ),
  seed.teacher_name,
  seed.modules
from room_seed seed
on conflict (room_id) do update
set
  room_name = excluded.room_name,
  teacher_id = excluded.teacher_id,
  teacher_name = excluded.teacher_name,
  modules = excluded.modules;

commit;
