'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { getPublicStorageUrl, isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import {
  createSlug,
  type EquipmentRow,
  type RoomRow,
  type TeacherRow,
} from '@/lib/supabase/adminData';

type AdminTab = 'rooms' | 'teachers' | 'equipments';
type PendingImage = {
  file: File;
  previewUrl: string;
};

const formatFileSize = (size: number) => `${Math.max(1, Math.round(size / 1024))} KB`;

const createStoragePath = (ownerId: string, file: File, fallbackExtension: string) => {
  const rawExtension = file.name.split('.').pop() || fallbackExtension;
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '') || fallbackExtension;
  const safeOwnerId = createSlug(ownerId) || 'asset';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${safeOwnerId}/${suffix}.${extension}`;
};

const emptyRoomDraft: RoomRow = {
  id: '',
  room_id: '',
  room_name: '',
  teacher_id: null,
  teacher_name: null,
  modules: [],
  room_image_path: null,
};

const emptyTeacherDraft: TeacherRow = {
  id: '',
  name: '',
  email: null,
  phone: null,
  avatar_path: null,
  department: 'Khoa Công nghệ Nhiệt lạnh',
};

const emptyEquipmentDraft = (roomId: string): EquipmentRow => ({
  id: '',
  room_id: roomId,
  type: 'CCDC',
  name: '',
  code: '',
  quantity: 1,
  note: null,
  specification: null,
  status: 'Đang sử dụng',
  original_price: null,
});

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('rooms');
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roomDraft, setRoomDraft] = useState<RoomRow | null>(null);
  const [teacherDraft, setTeacherDraft] = useState<TeacherRow | null>(null);
  const [equipmentDraft, setEquipmentDraft] = useState<EquipmentRow | null>(null);
  const [pendingRoomImages, setPendingRoomImages] = useState<Record<string, PendingImage>>({});
  const [pendingTeacherAvatars, setPendingTeacherAvatars] = useState<Record<string, PendingImage>>({});

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];
  const roomEquipments = useMemo(
    () => equipments.filter((item) => item.room_id === selectedRoom?.id),
    [equipments, selectedRoom?.id]
  );

  const clearPendingImage = (
    setter: React.Dispatch<React.SetStateAction<Record<string, PendingImage>>>,
    key: string
  ) => {
    setter((current) => {
      if (current[key]) {
        URL.revokeObjectURL(current[key].previewUrl);
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const setPendingImage = (
    setter: React.Dispatch<React.SetStateAction<Record<string, PendingImage>>>,
    key: string,
    file: File
  ) => {
    setter((current) => {
      if (current[key]) {
        URL.revokeObjectURL(current[key].previewUrl);
      }
      return {
        ...current,
        [key]: {
          file,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
  };

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    setMessage('');

    const [teachersResult, roomsResult, equipmentsResult] = await Promise.all([
      supabase.from('teachers').select('*').order('name'),
      supabase.from('rooms').select('*').order('room_id'),
      supabase.from('equipments').select('*').order('name'),
    ]);

    if (teachersResult.error || roomsResult.error || equipmentsResult.error) {
      setMessage('Chưa đọc được dữ liệu Supabase. Hãy chạy supabase/schema.sql trong SQL Editor trước.');
    } else {
      setTeachers((teachersResult.data || []) as TeacherRow[]);
      setRooms((roomsResult.data || []) as RoomRow[]);
      setEquipments((equipmentsResult.data || []) as EquipmentRow[]);
      setSelectedRoomId((roomsResult.data?.[0] as RoomRow | undefined)?.id || '');
      setMessage('Đã tải dữ liệu từ Supabase.');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      if (data.session?.user) {
        loadData();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadData();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : 'Đăng nhập thành công.');
    setIsLoading(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setRooms([]);
    setTeachers([]);
    setEquipments([]);
  };

  const saveTeacher = async (teacher: TeacherRow) => {
    if (!supabase) return false;
    const normalizedTeacher = {
      ...teacher,
      id: teacher.id || createSlug(teacher.name),
    };
    if (!normalizedTeacher.id) {
      setMessage('Giảng viên cần có tên trước khi lưu.');
      return false;
    }
    const { error } = await supabase.from('teachers').upsert(normalizedTeacher, { onConflict: 'id' });
    setMessage(error ? error.message : `Đã lưu giảng viên ${teacher.name}.`);
    if (!error) await loadData();
    return !error;
  };

  const deleteTeacher = async (teacherId: string) => {
    if (!supabase) return;
    const teacher = teachers.find((item) => item.id === teacherId);
    const hasRooms = rooms.some((room) => room.teacher_id === teacherId);
    if (hasRooms) {
      setMessage('Không thể xóa giảng viên đang được gán cho phòng. Hãy đổi giảng viên của phòng trước.');
      return;
    }
    const { error } = await supabase.from('teachers').delete().eq('id', teacherId);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (teacher?.avatar_path) {
      await supabase.storage.from('teacher-avatars').remove([teacher.avatar_path]);
    }
    setMessage('Đã xóa giảng viên và avatar liên quan.');
    await loadData();
  };

  const saveRoom = async (room: RoomRow) => {
    if (!supabase) return false;
    const normalizedRoom = {
      ...room,
      id: room.id || createSlug(room.room_id || room.room_name),
      teacher_name: teachers.find((teacher) => teacher.id === room.teacher_id)?.name || room.teacher_name || null,
    };
    if (!normalizedRoom.id) {
      setMessage('Phòng cần có mã phòng hoặc tên phòng trước khi lưu.');
      return false;
    }
    const { error } = await supabase.from('rooms').upsert(normalizedRoom, { onConflict: 'id' });
    setMessage(error ? error.message : `Đã lưu phòng ${room.room_id}.`);
    if (!error) await loadData();
    return !error;
  };

  const deleteRoom = async (roomId: string) => {
    if (!supabase) return;
    const room = rooms.find((item) => item.id === roomId);
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (room?.room_image_path) {
      await supabase.storage.from('room-layouts').remove([room.room_image_path]);
    }
    setMessage('Đã xóa phòng, thiết bị liên quan và ảnh sơ đồ.');
    await loadData();
  };

  const saveEquipment = async (equipment: EquipmentRow) => {
    if (!supabase) return false;
    const normalizedEquipment = {
      ...equipment,
      id: equipment.id || `${equipment.room_id}:${equipment.code}`,
    };
    if (!normalizedEquipment.id || !normalizedEquipment.code) {
      setMessage('Thiết bị cần có mã trước khi lưu.');
      return false;
    }
    const { error } = await supabase.from('equipments').upsert(normalizedEquipment, { onConflict: 'id' });
    setMessage(error ? error.message : `Đã lưu thiết bị ${equipment.code || equipment.name}.`);
    if (!error) await loadData();
    return !error;
  };

  const deleteEquipment = async (equipmentId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('equipments').delete().eq('id', equipmentId);
    setMessage(error ? error.message : 'Đã xóa thiết bị.');
    if (!error) await loadData();
  };

  const uploadFile = async (bucket: string, path: string, file: File) => {
    if (!supabase) return null;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      setMessage(error.message);
      return null;
    }
    return path;
  };

  const uploadRoomImage = async (room: RoomRow, file: File) => {
    const path = createStoragePath(room.id, file, 'png');
    const previousPath = room.room_image_path;
    const uploadedPath = await uploadFile('room-layouts', path, file);
    if (!uploadedPath) return false;
    const saved = await saveRoom({ ...room, room_image_path: uploadedPath });
    if (!saved) {
      await supabase?.storage.from('room-layouts').remove([uploadedPath]);
      return false;
    }
    if (previousPath && previousPath !== uploadedPath) {
      await supabase?.storage.from('room-layouts').remove([previousPath]);
    }
    return true;
  };

  const uploadTeacherAvatar = async (teacher: TeacherRow, file: File) => {
    const path = createStoragePath(teacher.id, file, 'jpg');
    const previousPath = teacher.avatar_path;
    const uploadedPath = await uploadFile('teacher-avatars', path, file);
    if (!uploadedPath) return false;
    const saved = await saveTeacher({ ...teacher, avatar_path: uploadedPath });
    if (!saved) {
      await supabase?.storage.from('teacher-avatars').remove([uploadedPath]);
      return false;
    }
    if (previousPath && previousPath !== uploadedPath) {
      await supabase?.storage.from('teacher-avatars').remove([previousPath]);
    }
    return true;
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f8] px-5">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Chưa cấu hình Supabase</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Hãy thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY vào .env.local.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#063f3a] px-5">
        <form onSubmit={signIn} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-teal-600 hover:text-teal-700"
          >
            ← Trang chủ
          </Link>
          <p className="text-xs font-semibold uppercase text-teal-700">Quản trị dữ liệu</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Đăng nhập admin</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Dùng tài khoản Supabase Auth đã được tạo trong dashboard.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-400">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 h-11 w-full rounded-xl bg-[#0f766e] text-sm font-bold text-white transition hover:bg-[#0d9488] disabled:opacity-60"
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
          {message && <p className="mt-4 text-sm font-medium text-rose-600">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="bg-[#063f3a] text-white">
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-100/70">Supabase Admin</p>
              <h1 className="mt-1 text-3xl font-bold">Quản lý dữ liệu tài sản</h1>
              <p className="mt-2 text-sm text-teal-50/70">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                Trang chủ
              </Link>
              <button onClick={loadData} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                Tải lại
              </button>
              <button onClick={signOut} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        {message && (
          <div className="mb-4 rounded-xl border border-teal-100 bg-white p-4 text-sm font-semibold text-teal-800">
            {message}
          </div>
        )}

        <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:w-fit">
          {(['rooms', 'teachers', 'equipments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-11 px-5 text-sm font-bold transition ${
                activeTab === tab ? 'bg-[#0f766e] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab === 'rooms' ? 'Phòng' : tab === 'teachers' ? 'Giảng viên' : 'Thiết bị'}
            </button>
          ))}
        </div>

        {activeTab === 'rooms' && (
          <section>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setRoomDraft(emptyRoomDraft)}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Thêm phòng
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            {rooms.map((room) => {
              const pendingImage = pendingRoomImages[room.id];
              const currentImageUrl = getPublicStorageUrl('room-layouts', room.room_image_path);

              return (
              <div key={room.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-400">Mã phòng</span>
                    <input value={room.room_id} onChange={(e) => setRooms((rows) => rows.map((r) => r.id === room.id ? { ...r, room_id: e.target.value } : r))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-400">Giảng viên</span>
                    <select value={room.teacher_id || ''} onChange={(e) => setRooms((rows) => rows.map((r) => r.id === room.id ? { ...r, teacher_id: e.target.value || null } : r))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
                      <option value="">Chưa phân công</option>
                      {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold uppercase text-slate-400">Tên phòng</span>
                  <input value={room.room_name} onChange={(e) => setRooms((rows) => rows.map((r) => r.id === room.id ? { ...r, room_name: e.target.value } : r))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                </label>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold uppercase text-slate-400">Modules, cách nhau bằng dấu phẩy</span>
                  <input value={room.modules.join(', ')} onChange={(e) => setRooms((rows) => rows.map((r) => r.id === room.id ? { ...r, modules: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) } : r))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                </label>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div>
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-500 hover:text-teal-700">
                    Upload sơ đồ
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingImage(setPendingRoomImages, room.id, file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {pendingImage ? (
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <div
                        className="h-20 w-24 shrink-0 rounded-xl border border-slate-200 bg-white bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${pendingImage.previewUrl})` }}
                      />
                      <div className="min-w-0 text-xs text-slate-500">
                        <p className="max-w-[220px] truncate font-bold text-slate-800">{pendingImage.file.name}</p>
                        <p>{formatFileSize(pendingImage.file.size)}</p>
                        <p className="mt-1 text-teal-700">Chưa upload. Bấm Lưu ảnh để cập nhật.</p>
                      </div>
                    </div>
                  ) : currentImageUrl ? (
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <div
                        className="h-20 w-24 shrink-0 rounded-xl border border-slate-200 bg-white bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${currentImageUrl})` }}
                      />
                      <div className="min-w-0 text-xs text-slate-500">
                        <p className="max-w-[220px] truncate font-bold text-slate-800">Ảnh sơ đồ hiện tại</p>
                        <p className="truncate">{room.room_image_path}</p>
                        <p className="mt-1 text-slate-500">Chọn ảnh mới nếu cần thay thế.</p>
                      </div>
                    </div>
                  ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {pendingImage && (
                      <>
                        <button onClick={() => clearPendingImage(setPendingRoomImages, room.id)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                          Hủy ảnh
                        </button>
                        <button
                          onClick={async () => {
                            const saved = await uploadRoomImage(room, pendingImage.file);
                            if (saved) clearPendingImage(setPendingRoomImages, room.id);
                          }}
                          className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
                        >
                          Lưu ảnh
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteRoom(room.id)} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
                      Xóa
                    </button>
                    <button onClick={() => saveRoom(room)} className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">
                      Lưu phòng
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
            </div>
          </section>
        )}

        {activeTab === 'teachers' && (
          <section>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setTeacherDraft(emptyTeacherDraft)}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Thêm giảng viên
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            {teachers.map((teacher) => {
              const pendingAvatar = pendingTeacherAvatars[teacher.id];
              const currentAvatarUrl = getPublicStorageUrl('teacher-avatars', teacher.avatar_path);

              return (
              <div key={teacher.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold uppercase text-slate-400">Tên</span>
                    <input value={teacher.name} onChange={(e) => setTeachers((rows) => rows.map((t) => t.id === teacher.id ? { ...t, name: e.target.value } : t))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </label>
                  <label>
                    <span className="text-xs font-semibold uppercase text-slate-400">Khoa</span>
                    <input value={teacher.department || ''} onChange={(e) => setTeachers((rows) => rows.map((t) => t.id === teacher.id ? { ...t, department: e.target.value || null } : t))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </label>
                  <label>
                    <span className="text-xs font-semibold uppercase text-slate-400">Email</span>
                    <input value={teacher.email || ''} onChange={(e) => setTeachers((rows) => rows.map((t) => t.id === teacher.id ? { ...t, email: e.target.value || null } : t))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </label>
                  <label>
                    <span className="text-xs font-semibold uppercase text-slate-400">Điện thoại</span>
                    <input value={teacher.phone || ''} onChange={(e) => setTeachers((rows) => rows.map((t) => t.id === teacher.id ? { ...t, phone: e.target.value || null } : t))} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                  </label>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div>
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-500 hover:text-teal-700">
                    Upload avatar
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingImage(setPendingTeacherAvatars, teacher.id, file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {pendingAvatar ? (
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <div
                        className="h-16 w-16 shrink-0 rounded-full border border-slate-200 bg-white bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${pendingAvatar.previewUrl})` }}
                      />
                      <div className="min-w-0 text-xs text-slate-500">
                        <p className="max-w-[220px] truncate font-bold text-slate-800">{pendingAvatar.file.name}</p>
                        <p>{formatFileSize(pendingAvatar.file.size)}</p>
                        <p className="mt-1 text-teal-700">Chưa upload. Bấm Lưu avatar để cập nhật.</p>
                      </div>
                    </div>
                  ) : currentAvatarUrl ? (
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <div
                        className="h-16 w-16 shrink-0 rounded-full border border-slate-200 bg-white bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${currentAvatarUrl})` }}
                      />
                      <div className="min-w-0 text-xs text-slate-500">
                        <p className="max-w-[220px] truncate font-bold text-slate-800">Avatar hiện tại</p>
                        <p className="truncate">{teacher.avatar_path}</p>
                        <p className="mt-1 text-slate-500">Chọn ảnh mới nếu cần thay thế.</p>
                      </div>
                    </div>
                  ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {pendingAvatar && (
                      <>
                        <button onClick={() => clearPendingImage(setPendingTeacherAvatars, teacher.id)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                          Hủy ảnh
                        </button>
                        <button
                          onClick={async () => {
                            const saved = await uploadTeacherAvatar(teacher, pendingAvatar.file);
                            if (saved) clearPendingImage(setPendingTeacherAvatars, teacher.id);
                          }}
                          className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950"
                        >
                          Lưu avatar
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteTeacher(teacher.id)} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
                      Xóa
                    </button>
                    <button onClick={() => saveTeacher(teacher)} className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">
                      Lưu giảng viên
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
            </div>
          </section>
        )}

        {activeTab === 'equipments' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <select value={selectedRoom?.id || ''} onChange={(e) => setSelectedRoomId(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.room_id} - {room.room_name}</option>)}
              </select>
              {selectedRoom && (
                <button onClick={() => setEquipmentDraft(emptyEquipmentDraft(selectedRoom.id))} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950">
                  Thêm thiết bị
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="p-2">Loại</th>
                    <th className="p-2">Tên</th>
                    <th className="p-2">Mã</th>
                    <th className="p-2">SL</th>
                    <th className="p-2">Quy cách</th>
                    <th className="p-2">Ghi chú</th>
                    <th className="p-2">Nguyên giá</th>
                    <th className="p-2">Tình trạng</th>
                    <th className="p-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomEquipments.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2">
                        <select value={item.type} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, type: e.target.value as EquipmentRow['type'] } : eq))} className="h-9 rounded-lg border border-slate-200 px-2">
                          <option value="TSCĐ">TSCĐ</option>
                          <option value="CCDC">CCDC</option>
                        </select>
                      </td>
                      <td className="p-2"><input value={item.name} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, name: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input value={item.code} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, code: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input type="number" value={item.quantity} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, quantity: Number(e.target.value) } : eq))} className="h-9 w-20 rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input value={item.specification || ''} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, specification: e.target.value || null } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input value={item.note || ''} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, note: e.target.value || null } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input type="number" value={item.original_price ?? ''} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, original_price: e.target.value ? Number(e.target.value) : null } : eq))} className="h-9 w-32 rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2"><input value={item.status} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, status: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2" /></td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button onClick={() => saveEquipment(item)} className="rounded-lg bg-[#0f766e] px-3 py-2 text-xs font-bold text-white">Lưu</button>
                          <button onClick={() => deleteEquipment(item.id)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {roomDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await saveRoom(roomDraft);
              if (saved) setRoomDraft(null);
            }}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase text-teal-700">Tạo phòng mới</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Nhập thông tin phòng</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Mã phòng</span>
                <input required value={roomDraft.room_id} onChange={(e) => setRoomDraft({ ...roomDraft, room_id: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Giảng viên</span>
                <select value={roomDraft.teacher_id || ''} onChange={(e) => setRoomDraft({ ...roomDraft, teacher_id: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">Chưa phân công</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase text-slate-400">Tên phòng</span>
              <input required value={roomDraft.room_name} onChange={(e) => setRoomDraft({ ...roomDraft, room_name: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase text-slate-400">Modules, cách nhau bằng dấu phẩy</span>
              <input value={roomDraft.modules.join(', ')} onChange={(e) => setRoomDraft({ ...roomDraft, modules: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setRoomDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
              <button type="submit" className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">Tạo phòng</button>
            </div>
          </form>
        </div>
      )}

      {teacherDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await saveTeacher(teacherDraft);
              if (saved) setTeacherDraft(null);
            }}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase text-teal-700">Tạo giảng viên</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Nhập thông tin giảng viên</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Tên</span>
                <input required value={teacherDraft.name} onChange={(e) => setTeacherDraft({ ...teacherDraft, name: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Khoa</span>
                <input value={teacherDraft.department || ''} onChange={(e) => setTeacherDraft({ ...teacherDraft, department: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Email</span>
                <input type="email" value={teacherDraft.email || ''} onChange={(e) => setTeacherDraft({ ...teacherDraft, email: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Điện thoại</span>
                <input value={teacherDraft.phone || ''} onChange={(e) => setTeacherDraft({ ...teacherDraft, phone: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setTeacherDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
              <button type="submit" className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">Tạo giảng viên</button>
            </div>
          </form>
        </div>
      )}

      {equipmentDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await saveEquipment(equipmentDraft);
              if (saved) setEquipmentDraft(null);
            }}
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase text-teal-700">Tạo thiết bị</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Nhập thông tin thiết bị</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Loại</span>
                <select value={equipmentDraft.type} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, type: e.target.value as EquipmentRow['type'] })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="TSCĐ">TSCĐ</option>
                  <option value="CCDC">CCDC</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Mã thiết bị</span>
                <input required value={equipmentDraft.code} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, code: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">Tên thiết bị</span>
                <input required value={equipmentDraft.name} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, name: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Số lượng</span>
                <input required min={1} type="number" value={equipmentDraft.quantity} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, quantity: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Nguyên giá</span>
                <input type="number" value={equipmentDraft.original_price ?? ''} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, original_price: e.target.value ? Number(e.target.value) : null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Quy cách</span>
                <input value={equipmentDraft.specification || ''} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, specification: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase text-slate-400">Ghi chú</span>
                <input value={equipmentDraft.note || ''} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, note: e.target.value || null })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">Tình trạng</span>
                <input required value={equipmentDraft.status} onChange={(e) => setEquipmentDraft({ ...equipmentDraft, status: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEquipmentDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
              <button type="submit" className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">Tạo thiết bị</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
