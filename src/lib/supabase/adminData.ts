export type RoomRow = {
  id: string;
  room_id: string;
  room_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  modules: string[];
  room_image_path: string | null;
};

export type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
  department: string | null;
};

export type EquipmentRow = {
  id: string;
  room_id: string;
  type: 'TSCĐ' | 'CCDC';
  name: string;
  code: string;
  quantity: number;
  note: string | null;
  specification: string | null;
  status: string;
  original_price: number | null;
};

export const createSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const createEmptyTeacher = (): TeacherRow => {
  const id = `teacher-${Date.now()}`;
  return {
    id,
    name: '',
    email: null,
    phone: null,
    avatar_path: null,
    department: 'Khoa Công nghệ Nhiệt lạnh',
  };
};

export const createEmptyRoom = (): RoomRow => {
  const id = `room-${Date.now()}`;
  return {
    id,
    room_id: '',
    room_name: '',
    teacher_id: null,
    teacher_name: null,
    modules: [],
    room_image_path: null,
  };
};
