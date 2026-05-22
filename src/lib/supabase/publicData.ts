import type { EquipmentItem } from '@/types';
import { getPublicStorageUrl, isSupabaseConfigured, supabase } from './client';
import type { EquipmentRow, RoomRow, TeacherRow } from './adminData';

const toEquipmentItem = (row: EquipmentRow): EquipmentItem => ({
  id: row.id,
  type: row.type,
  name: row.name,
  code: row.code,
  quantity: row.quantity,
  note: row.note || '',
  specification: row.specification,
  status: row.status,
  originalPrice: row.original_price,
});

export async function fetchTeachersFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.from('teachers').select('*').order('name');
  if (error || !data?.length) return [];

  return (data as TeacherRow[]).map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    avatar: getPublicStorageUrl('teacher-avatars', teacher.avatar_path) || null,
    department: teacher.department,
  }));
}

export async function fetchClassroomsFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return [];

  const [roomsResult, teachersResult, equipmentsResult] = await Promise.all([
    supabase.from('rooms').select('*').order('room_id'),
    supabase.from('teachers').select('*'),
    supabase.from('equipments').select('*').order('name'),
  ]);

  if (roomsResult.error || equipmentsResult.error || !roomsResult.data?.length) {
    return [];
  }

  const teachers = ((teachersResult.data || []) as TeacherRow[]).reduce<Record<string, TeacherRow>>((acc, teacher) => {
    acc[teacher.id] = teacher;
    return acc;
  }, {});

  const equipmentsByRoom = ((equipmentsResult.data || []) as EquipmentRow[]).reduce<Record<string, EquipmentRow[]>>(
    (acc, equipment) => {
      acc[equipment.room_id] ||= [];
      acc[equipment.room_id].push(equipment);
      return acc;
    },
    {}
  );

  return (roomsResult.data as RoomRow[]).map((room) => {
    const roomEquipments = equipmentsByRoom[room.id] || [];
    const equipments = roomEquipments.map(toEquipmentItem);
    const teacher = room.teacher_id ? teachers[room.teacher_id] : undefined;
    const totalTSCD = equipments.filter((item) => item.type === 'TSCĐ').reduce((sum, item) => sum + item.quantity, 0);
    const totalCCDC = equipments.filter((item) => item.type === 'CCDC').reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = equipments.reduce((sum, item) => sum + (item.originalPrice || 0) * item.quantity, 0);

    return {
      id: room.id,
      roomId: room.room_id,
      roomName: room.room_name,
      teacherId: room.teacher_id || '',
      teacherName: teacher?.name || room.teacher_name || '',
      modules: room.modules || [],
      roomImage: getPublicStorageUrl('room-layouts', room.room_image_path) || '',
      stats: {
        totalEquipments: totalTSCD + totalCCDC,
        totalTSCD,
        totalCCDC,
        totalValue,
      },
      equipments,
    };
  });
}
