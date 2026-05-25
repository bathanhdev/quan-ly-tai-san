'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
type DeleteConfirmation = {
  type: 'room' | 'teacher' | 'equipment';
  id: string;
  title: string;
  description: string;
};
type ExcelCell = string | number | boolean | Date | null;
type EquipmentImportSheet = {
  name: string;
  items: EquipmentRow[];
};

const formatFileSize = (size: number) => `${Math.max(1, Math.round(size / 1024))} KB`;
const createRecordId = () => crypto.randomUUID();
const createEquipmentCode = () => `AUTO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const normalizeColumn = (value: ExcelCell) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

const readCell = (row: ExcelCell[], index: number) =>
  index >= 0 && row[index] !== null ? String(row[index]).trim() : '';

const findColumn = (headers: string[], names: string[]) =>
  headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));

const parseEquipmentRows = (rows: ExcelCell[][], roomId: string): EquipmentImportSheet['items'] => {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeColumn);
    return findColumn(headers, ['loai']) >= 0 && findColumn(headers, ['ten thiet bi', 'ten']) >= 0;
  });
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(normalizeColumn);
  const typeIndex = findColumn(headers, ['loai']);
  const nameIndex = findColumn(headers, ['ten thiet bi', 'ten']);
  const codeIndex = findColumn(headers, ['ma so', 'ma tai san', 'ma thiet bi', 'ma']);
  const quantityIndex = findColumn(headers, ['so luong', 'sl']);
  const noteIndex = findColumn(headers, ['ghi chu']);
  const specificationIndex = findColumn(headers, ['quy cach', 'thong so']);
  const statusIndex = findColumn(headers, ['tinh trang', 'trang thai']);

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const name = readCell(row, nameIndex);
    if (!name) return [];
    const rawType = normalizeColumn(row[typeIndex]);
    const rawQuantity = Number(readCell(row, quantityIndex));
    return [{
      id: '',
      room_id: roomId,
      type: rawType.includes('tscd') ? 'TSCĐ' : 'CCDC',
      name,
      code: readCell(row, codeIndex),
      quantity: Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1,
      note: readCell(row, noteIndex) || null,
      specification: readCell(row, specificationIndex) || null,
      status: readCell(row, statusIndex) || 'Đang sử dụng',
      original_price: null,
    }];
  });
};

type ModuleEditorProps = {
  modules: string[];
  onChange: (modules: string[]) => void;
};

function ModuleEditor({ modules, onChange }: ModuleEditorProps) {
  const [moduleDraft, setModuleDraft] = useState('');

  const addModule = () => {
    const value = moduleDraft.trim();
    if (!value || modules.includes(value)) return;
    onChange([...modules, value]);
    setModuleDraft('');
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex gap-2">
        <input
          value={moduleDraft}
          placeholder="Nhập chức năng hoặc chuyên đề của phòng"
          onChange={(event) => setModuleDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addModule();
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="button"
          onClick={addModule}
          disabled={!moduleDraft.trim()}
          className="rounded-lg bg-teal-50 px-3 text-sm font-bold text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Thêm
        </button>
      </div>
      {modules.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {modules.map((module) => (
            <span key={module} className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800">
              {module}
              <button
                type="button"
                aria-label={`Xóa ${module}`}
                onClick={() => onChange(modules.filter((item) => item !== module))}
                className="text-base leading-none text-teal-600 hover:text-rose-600"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [equipmentImportOpen, setEquipmentImportOpen] = useState(false);
  const [equipmentImportFileName, setEquipmentImportFileName] = useState('');
  const [equipmentImportSheets, setEquipmentImportSheets] = useState<EquipmentImportSheet[]>([]);
  const [selectedImportSheet, setSelectedImportSheet] = useState('');
  const [isReadingExcel, setIsReadingExcel] = useState(false);
  const [isImportingEquipment, setIsImportingEquipment] = useState(false);
  const [pendingRoomImages, setPendingRoomImages] = useState<Record<string, PendingImage>>({});
  const [pendingTeacherAvatars, setPendingTeacherAvatars] = useState<Record<string, PendingImage>>({});
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const roomPickerRef = useRef<HTMLDivElement>(null);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];
  const roomEquipments = useMemo(
    () => equipments.filter((item) => item.room_id === selectedRoom?.id),
    [equipments, selectedRoom?.id]
  );
  const importSheet = equipmentImportSheets.find((sheet) => sheet.name === selectedImportSheet);

  useEffect(() => {
    if (!roomPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!roomPickerRef.current?.contains(event.target as Node)) {
        setRoomPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRoomPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [roomPickerOpen]);

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
      const roomRows = (roomsResult.data || []) as RoomRow[];
      setTeachers((teachersResult.data || []) as TeacherRow[]);
      setRooms(roomRows);
      setEquipments((equipmentsResult.data || []) as EquipmentRow[]);
      setSelectedRoomId((currentRoomId) => {
        if (currentRoomId && roomRows.some((room) => room.id === currentRoomId)) {
          return currentRoomId;
        }
        return roomRows[0]?.id || '';
      });
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
    if (!teacher.name.trim()) {
      setMessage('Giảng viên cần có tên trước khi lưu.');
      return false;
    }
    const { id, ...fields } = teacher;
    const result = id
      ? await supabase.from('teachers').update(fields).eq('id', id).select().single()
      : await supabase.from('teachers').insert({ id: createRecordId(), ...fields }).select().single();
    const { data, error } = result;
    setMessage(error ? error.message : `Đã lưu giảng viên ${teacher.name}.`);
    if (!error && data) {
      const savedTeacher = data as TeacherRow;
      setTeachers((rows) => {
        const exists = rows.some((item) => item.id === savedTeacher.id);
        return exists
          ? rows.map((item) => (item.id === savedTeacher.id ? savedTeacher : item))
          : [...rows, savedTeacher].sort((a, b) => a.name.localeCompare(b.name));
      });
    }
    return !error;
  };

  const deleteTeacher = (teacherId: string) => {
    const teacher = teachers.find((item) => item.id === teacherId);
    const hasRooms = rooms.some((room) => room.teacher_id === teacherId);
    if (hasRooms) {
      setMessage('Không thể xóa giảng viên đang được gán cho phòng. Hãy đổi giảng viên của phòng trước.');
      return;
    }
    setDeleteConfirmation({
      type: 'teacher',
      id: teacherId,
      title: 'Xóa giảng viên?',
      description: `Giảng viên "${teacher?.name || teacherId}" và avatar liên quan sẽ bị xóa vĩnh viễn.`,
    });
  };

  const saveRoom = async (room: RoomRow) => {
    if (!supabase) return false;
    const normalizedRoom = {
      ...room,
      teacher_name: teachers.find((teacher) => teacher.id === room.teacher_id)?.name || room.teacher_name || null,
    };
    if (!normalizedRoom.room_id.trim() || !normalizedRoom.room_name.trim()) {
      setMessage('Phòng cần có mã phòng và tên phòng trước khi lưu.');
      return false;
    }
    const { id, ...fields } = normalizedRoom;
    const result = id
      ? await supabase.from('rooms').update(fields).eq('id', id).select().single()
      : await supabase.from('rooms').insert({ id: createRecordId(), ...fields }).select().single();
    const { data, error } = result;
    setMessage(error ? error.message : `Đã lưu phòng ${room.room_id}.`);
    if (!error && data) {
      const savedRoom = data as RoomRow;
      setRooms((rows) => {
        const exists = rows.some((item) => item.id === savedRoom.id);
        return exists
          ? rows.map((item) => (item.id === savedRoom.id ? savedRoom : item))
          : [...rows, savedRoom].sort((a, b) => a.room_id.localeCompare(b.room_id));
      });
    }
    return !error;
  };

  const deleteRoom = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    setDeleteConfirmation({
      type: 'room',
      id: roomId,
      title: 'Xóa phòng?',
      description: `Phòng "${room?.room_id || roomId}", toàn bộ thiết bị và ảnh sơ đồ liên quan sẽ bị xóa vĩnh viễn.`,
    });
  };

  const saveEquipment = async (equipment: EquipmentRow) => {
    if (!supabase) return false;
    const normalizedEquipment = {
      ...equipment,
      code: equipment.code.trim() || createEquipmentCode(),
    };
    if (!normalizedEquipment.room_id || !normalizedEquipment.name.trim()) {
      setMessage('Thiết bị cần có tên và thuộc một phòng trước khi lưu.');
      return false;
    }
    const { id, ...fields } = normalizedEquipment;
    const result = id
      ? await supabase.from('equipments').update(fields).eq('id', id).select().single()
      : await supabase.from('equipments').insert({ id: createRecordId(), ...fields }).select().single();
    const { data, error } = result;
    setMessage(error ? error.message : `Đã lưu thiết bị ${equipment.code || equipment.name}.`);
    if (!error && data) {
      const savedEquipment = data as EquipmentRow;
      setEquipments((rows) => {
        const exists = rows.some((item) => item.id === savedEquipment.id);
        if (exists) {
          return rows.map((item) => (item.id === savedEquipment.id ? savedEquipment : item));
        }
        return [...rows, savedEquipment].sort((a, b) => a.name.localeCompare(b.name));
      });
      if (savedEquipment.room_id) {
        setSelectedRoomId(savedEquipment.room_id);
      }
    }
    return !error;
  };

  const deleteEquipment = (equipmentId: string) => {
    const equipment = equipments.find((item) => item.id === equipmentId);
    setDeleteConfirmation({
      type: 'equipment',
      id: equipmentId,
      title: 'Xóa thiết bị?',
      description: `Thiết bị "${equipment?.code || equipment?.name || equipmentId}" sẽ bị xóa vĩnh viễn.`,
    });
  };

  const openEquipmentImport = () => {
    setEquipmentImportFileName('');
    setEquipmentImportSheets([]);
    setSelectedImportSheet('');
    setEquipmentImportOpen(true);
  };

  const readEquipmentExcel = async (file: File) => {
    if (!selectedRoom) return;
    setIsReadingExcel(true);
    setEquipmentImportFileName(file.name);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const sheets = await readXlsxFile(file);
      const parsedSheets = sheets
        .map((sheet) => ({
          name: sheet.sheet,
          items: parseEquipmentRows(sheet.data as ExcelCell[][], selectedRoom.id),
        }))
        .filter((sheet) => sheet.items.length > 0);

      setEquipmentImportSheets(parsedSheets);
      const matchingSheet = parsedSheets.find(
        (sheet) => normalizeColumn(sheet.name) === normalizeColumn(selectedRoom.room_id)
      );
      setSelectedImportSheet(matchingSheet?.name || parsedSheets[0]?.name || '');
      if (parsedSheets.length === 0) {
        setMessage('Không tìm thấy sheet có các cột thiết bị hợp lệ trong file Excel.');
      }
    } catch {
      setEquipmentImportSheets([]);
      setSelectedImportSheet('');
      setMessage('Không đọc được file Excel. Hãy kiểm tra định dạng .xlsx.');
    } finally {
      setIsReadingExcel(false);
    }
  };

  const importEquipmentSheet = async () => {
    if (!supabase || !selectedRoom || !importSheet) return;
    const existingCodes = new Set(
      roomEquipments.map((item) => normalizeColumn(item.code)).filter(Boolean)
    );
    const pendingCodes = new Set<string>();
    let duplicateCount = 0;
    const newItems = importSheet.items.flatMap((item) => {
      const normalizedCode = normalizeColumn(item.code);
      if (normalizedCode && (existingCodes.has(normalizedCode) || pendingCodes.has(normalizedCode))) {
        duplicateCount += 1;
        return [];
      }
      if (normalizedCode) pendingCodes.add(normalizedCode);
      return [{
        ...item,
        id: createRecordId(),
        room_id: selectedRoom.id,
        code: item.code || createEquipmentCode(),
      }];
    });

    if (newItems.length === 0) {
      setMessage('Không có thiết bị mới để nhập. Các mã trong sheet đã tồn tại ở phòng này.');
      return;
    }

    setIsImportingEquipment(true);
    const { data, error } = await supabase.from('equipments').insert(newItems).select();
    if (error) {
      setMessage(error.message);
      setIsImportingEquipment(false);
      return;
    }
    const savedItems = (data || []) as EquipmentRow[];
    setEquipments((rows) => [...rows, ...savedItems].sort((a, b) => a.name.localeCompare(b.name)));
    setMessage(
      duplicateCount > 0
        ? `Đã nhập ${savedItems.length} thiết bị, bỏ qua ${duplicateCount} dòng trùng mã.`
        : `Đã nhập ${savedItems.length} thiết bị từ Excel.`
    );
    setEquipmentImportOpen(false);
    setIsImportingEquipment(false);
  };

  const confirmDelete = async () => {
    if (!supabase || !deleteConfirmation) return;
    setIsDeleting(true);
    const { id, type } = deleteConfirmation;

    if (type === 'teacher') {
      const teacher = teachers.find((item) => item.id === id);
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) {
        setMessage(error.message);
        setIsDeleting(false);
        return;
      }
      if (teacher?.avatar_path) {
        await supabase.storage.from('teacher-avatars').remove([teacher.avatar_path]);
      }
      setTeachers((rows) => rows.filter((item) => item.id !== id));
      setMessage('Đã xóa giảng viên và avatar liên quan.');
    }

    if (type === 'room') {
      const room = rooms.find((item) => item.id === id);
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) {
        setMessage(error.message);
        setIsDeleting(false);
        return;
      }
      if (room?.room_image_path) {
        await supabase.storage.from('room-layouts').remove([room.room_image_path]);
      }
      setRooms((rows) => rows.filter((item) => item.id !== id));
      setEquipments((rows) => rows.filter((item) => item.room_id !== id));
      setSelectedRoomId((current) => (current === id ? '' : current));
      setMessage('Đã xóa phòng, thiết bị liên quan và ảnh sơ đồ.');
    }

    if (type === 'equipment') {
      const { error } = await supabase.from('equipments').delete().eq('id', id);
      if (error) {
        setMessage(error.message);
        setIsDeleting(false);
        return;
      }
      setEquipments((rows) => rows.filter((item) => item.id !== id));
      setMessage('Đã xóa thiết bị.');
    }

    setDeleteConfirmation(null);
    setIsDeleting(false);
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
                  <span className="text-xs font-semibold uppercase text-slate-400">Chức năng / chuyên đề</span>
                  <ModuleEditor
                    modules={room.modules}
                    onChange={(modules) => setRooms((rows) => rows.map((item) => item.id === room.id ? { ...item, modules } : item))}
                  />
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
              <div ref={roomPickerRef} className="relative w-full md:max-w-[430px]">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={roomPickerOpen}
                  onClick={() => setRoomPickerOpen((open) => !open)}
                  className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left transition hover:border-teal-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {selectedRoom ? (
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-teal-700">{selectedRoom.room_id}</span>
                      <span className="block truncate text-sm font-medium text-slate-800">{selectedRoom.room_name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Chọn phòng</span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rotate-45 border-b-2 border-r-2 border-slate-400 transition-transform ${roomPickerOpen ? '-translate-y-0.5 rotate-[225deg]' : ''}`}
                  />
                </button>
                {roomPickerOpen && (
                  <div
                    role="listbox"
                    aria-label="Chọn phòng quản lý thiết bị"
                    className="absolute left-0 top-[calc(100%+8px)] z-30 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                  >
                    {rooms.map((room) => {
                      const isSelected = room.id === selectedRoom?.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            setRoomPickerOpen(false);
                          }}
                          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                            isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-[78px] shrink-0 pt-0.5 text-xs font-bold ${isSelected ? 'text-teal-700' : 'text-slate-500'}`}>
                            {room.room_id}
                          </span>
                          <span className={`min-w-0 text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {room.room_name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedRoom && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openEquipmentImport}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800"
                  >
                    Nhập Excel
                  </button>
                <button onClick={() => setEquipmentDraft(emptyEquipmentDraft(selectedRoom.id))} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950">
                  Thêm thiết bị
                </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[1080px] table-fixed text-left text-sm xl:min-w-0">
                <colgroup>
                  <col className="w-[7%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[7%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[104px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="p-2">Loại</th>
                    <th className="p-2">Tên</th>
                    <th className="p-2">Mã</th>
                    <th className="p-2">SL</th>
                    <th className="p-2">Quy cách</th>
                    <th className="p-2">Ghi chú</th>
                    <th className="p-2">Tình trạng</th>
                    <th className="sticky right-0 bg-white p-2 text-center shadow-[-8px_0_12px_-14px_rgba(15,23,42,0.7)]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomEquipments.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2">
                        <select value={item.type} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, type: e.target.value as EquipmentRow['type'] } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs">
                          <option value="TSCĐ">TSCĐ</option>
                          <option value="CCDC">CCDC</option>
                        </select>
                      </td>
                      <td className="p-2"><input value={item.name} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, name: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="p-2"><input value={item.code} placeholder="Tự sinh nếu trống" onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, code: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="p-2"><input type="number" value={item.quantity} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, quantity: Number(e.target.value) } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="p-2"><input value={item.specification || ''} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, specification: e.target.value || null } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="p-2"><input value={item.note || ''} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, note: e.target.value || null } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="p-2"><input value={item.status} onChange={(e) => setEquipments((rows) => rows.map((eq) => eq.id === item.id ? { ...eq, status: e.target.value } : eq))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></td>
                      <td className="sticky right-0 bg-white p-2 shadow-[-8px_0_12px_-14px_rgba(15,23,42,0.7)]">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEquipment(item)}
                            aria-label={`Lưu thiết bị ${item.code || item.name}`}
                            title="Lưu"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-sm font-bold text-white transition hover:bg-[#0d9488]"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEquipment(item.id)}
                            aria-label={`Xóa thiết bị ${item.code || item.name}`}
                            title="Xóa"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-lg font-bold leading-none text-rose-700 transition hover:bg-rose-100"
                          >
                            ×
                          </button>
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
              <span className="text-xs font-semibold uppercase text-slate-400">Chức năng / chuyên đề</span>
              <ModuleEditor
                modules={roomDraft.modules}
                onChange={(modules) => setRoomDraft({ ...roomDraft, modules })}
              />
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

      {equipmentImportOpen && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-import-title"
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-700">Nhập danh sách thiết bị</p>
                <h2 id="equipment-import-title" className="mt-1 text-2xl font-bold text-slate-950">
                  {selectedRoom.room_id} - {selectedRoom.room_name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  File cần có các cột Loại, Tên thiết bị, Mã số hoặc Mã, Số lượng. Mã đã có trong phòng sẽ được bỏ qua.
                </p>
              </div>
              <a
                href="/templates/mau-nhap-thiet-bi.xlsx"
                download
                className="shrink-0 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
              >
                Tải file mẫu
              </a>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <span className="text-xs font-semibold uppercase text-slate-400">File Excel</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) readEquipmentExcel(file);
                    }}
                    className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-bold file:text-teal-700"
                  />
                  {equipmentImportFileName && (
                    <p className="mt-3 truncate text-xs font-medium text-slate-500">{equipmentImportFileName}</p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-slate-400">Sheet dữ liệu</span>
                  <select
                    value={selectedImportSheet}
                    onChange={(event) => setSelectedImportSheet(event.target.value)}
                    disabled={equipmentImportSheets.length === 0}
                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                  >
                    {equipmentImportSheets.length === 0 ? (
                      <option value="">{isReadingExcel ? 'Đang đọc file...' : 'Chưa chọn file'}</option>
                    ) : (
                      equipmentImportSheets.map((sheet) => (
                        <option key={sheet.name} value={sheet.name}>
                          {sheet.name} ({sheet.items.length} dòng)
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              {importSheet && (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">Xem trước dữ liệu</p>
                    <p className="text-xs font-semibold text-slate-500">{importSheet.items.length} dòng hợp lệ</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400">
                          <th className="px-4 py-3">Loại</th>
                          <th className="px-4 py-3">Tên thiết bị</th>
                          <th className="px-4 py-3">Mã</th>
                          <th className="px-4 py-3 text-right">SL</th>
                          <th className="px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importSheet.items.slice(0, 10).map((item, index) => (
                          <tr key={`${item.code}-${index}`}>
                            <td className="px-4 py-3 font-semibold">{item.type}</td>
                            <td className="px-4 py-3">{item.name}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.code || 'Tự sinh'}</td>
                            <td className="px-4 py-3 text-right font-semibold">{item.quantity}</td>
                            <td className="px-4 py-3 text-slate-500">{item.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importSheet.items.length > 10 && (
                    <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                      Đang hiển thị 10/{importSheet.items.length} dòng đầu tiên.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <button
                type="button"
                disabled={isImportingEquipment}
                onClick={() => setEquipmentImportOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!importSheet || isReadingExcel || isImportingEquipment}
                onClick={importEquipmentSheet}
                className="rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0d9488] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImportingEquipment ? 'Đang nhập...' : 'Xác nhận nhập'}
              </button>
            </div>
          </div>
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
                <span className="text-xs font-semibold uppercase text-slate-400">Mã thiết bị (tùy chọn)</span>
                <input value={equipmentDraft.code} placeholder="Để trống để tự sinh mã" onChange={(e) => setEquipmentDraft({ ...equipmentDraft, code: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
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

      {deleteConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-xl font-bold text-rose-700">
              !
            </div>
            <p className="mt-5 text-xs font-semibold uppercase text-rose-600">Xác nhận xóa</p>
            <h2 id="delete-confirmation-title" className="mt-1 text-xl font-bold text-slate-950">
              {deleteConfirmation.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{deleteConfirmation.description}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa dữ liệu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
