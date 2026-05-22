'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Classroom, Teacher } from '@/types';
import { fetchClassroomsFromSupabase, fetchTeachersFromSupabase } from '@/lib/supabase/publicData';
import RoomLayoutImage from './RoomLayoutImage';
import RoomQrCode from './RoomQrCode';

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const compactId = (value: string | number | null | undefined) =>
  normalizeText(value).replace(/[\s._-]/g, '');

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export default function RoomDetailPage() {
  const params = useParams<{ id?: string }>();
  const [filterType, setFilterType] = useState<'ALL' | 'TSCĐ' | 'CCDC'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchClassroomsFromSupabase(), fetchTeachersFromSupabase()]).then(([rooms, teacherRows]) => {
      setClassrooms(rooms);
      setTeachers(teacherRows);
      setIsLoading(false);
    });
  }, []);

  const currentClassroom = useMemo(() => {
    const rawId = params?.id ?? '';
    const targetId = compactId(rawId);

    return classrooms.find((room) => {
      const roomId = compactId(room.roomId);
      const slug = compactId(room.id);
      return roomId === targetId || slug === targetId || roomId.includes(targetId);
    });
  }, [classrooms, params?.id]);

  const associatedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === currentClassroom?.teacherId),
    [currentClassroom?.teacherId, teachers]
  );

  const filteredEquipments = useMemo(() => {
    if (!currentClassroom) return [];

    const query = normalizeText(searchQuery);
    return currentClassroom.equipments.filter((item) => {
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const searchableText = [
        item.name,
        item.code,
        item.type,
        item.note,
        item.specification,
        item.status,
      ].map(normalizeText).join(' ');

      return matchesType && (!query || searchableText.includes(query));
    });
  }, [currentClassroom, filterType, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f8] px-5 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Đang tải dữ liệu phòng từ Supabase...</p>
        </div>
      </div>
    );
  }

  if (!currentClassroom) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f8] px-5 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-2xl font-bold text-rose-600">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Không tìm thấy khu vực</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Mã định danh trên đường dẫn không khớp với phòng hoặc khu vực nào trong dữ liệu kiểm kê.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white transition hover:bg-[#0d9488]"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const teacherName = associatedTeacher?.name || currentClassroom.teacherName || 'Chưa phân công';
  const teacherDepartment = associatedTeacher?.department || 'Khoa Công nghệ Nhiệt lạnh';
  const teacherEmail = associatedTeacher?.email || 'Chưa cập nhật';
  const teacherPhone = associatedTeacher?.phone || 'Chưa cập nhật';
  const teacherAvatar = associatedTeacher?.avatar;
  const totalItems = currentClassroom.stats.totalEquipments || 1;
  const tscdRatio = Math.round(((currentClassroom.stats.totalTSCD || 0) / totalItems) * 100);

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="relative overflow-hidden bg-[#063f3a] text-white">
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(135deg,rgba(45,212,191,0.34),transparent_36%),linear-gradient(315deg,rgba(251,191,36,0.2),transparent_34%)]" />

        <div className="relative mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-teal-50 backdrop-blur transition hover:bg-white/15"
            >
              <span>←</span>
              Trang chủ
            </Link>
            <div className="w-fit rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold uppercase text-teal-50 backdrop-blur">
              Dữ liệu kiểm kê 31/12/2024
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="rounded-[28px] border border-white/15 bg-white/[0.07] p-5 backdrop-blur md:p-6">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-bold text-slate-950">
                  {currentClassroom.roomId}
                </span>
                {currentClassroom.modules.map((module) => (
                  <span
                    key={module}
                    className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50"
                  >
                    {module}
                  </span>
                ))}
              </div>

              <h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
                {currentClassroom.roomName}
              </h1>

              <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {teacherAvatar ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white">
                      <Image
                        src={teacherAvatar}
                        alt={`Avatar ${teacherName}`}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-base font-bold text-[#063f3a]">
                      {getInitials(teacherName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-teal-100/60">Giảng viên quản lý</p>
                    <p className="mt-1 truncate text-base font-bold">{teacherName}</p>
                    <p className="truncate text-xs text-teal-50/65">{teacherDepartment}</p>
                  </div>
                </div>

                <div className="grid min-w-0 gap-2 text-xs text-teal-50/75 sm:grid-cols-2 md:w-72 md:grid-cols-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold uppercase text-teal-100/60">Email</span>
                    <span className="truncate text-right font-medium">{teacherEmail}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold uppercase text-teal-100/60">Điện thoại</span>
                    <span className="truncate text-right font-medium">{teacherPhone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/15 bg-[#042f2c]/45 p-4">
                <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
                  <div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-teal-100/55">Tổng thiết bị</p>
                        <p className="mt-2 text-3xl font-bold">{currentClassroom.stats.totalEquipments}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-teal-100/55">TSCĐ</p>
                        <p className="mt-2 text-3xl font-bold">{currentClassroom.stats.totalTSCD}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-teal-100/55">CCDC</p>
                        <p className="mt-2 text-3xl font-bold">{currentClassroom.stats.totalCCDC}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-teal-50/75">
                      <span>{tscdRatio}% tài sản cố định</span>
                      <span>{100 - tscdRatio}% công cụ dụng cụ</span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-cyan-300">
                      <div className="h-full bg-amber-300" style={{ width: `${tscdRatio}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 text-right">
                    <p className="text-[10px] font-semibold uppercase text-teal-100/55">Dòng dữ liệu</p>
                    <p className="mt-2 text-4xl font-bold">{currentClassroom.equipments.length}</p>
                    <p className="mt-1 text-xs font-medium text-teal-50/65">bản ghi kiểm kê</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid content-start gap-4">
              <RoomLayoutImage roomId={currentClassroom.roomId} roomImage={currentClassroom.roomImage} compact />
              <RoomQrCode roomId={currentClassroom.roomId} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-700">Danh mục thiết bị</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {filteredEquipments.length} dòng phù hợp
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {(['ALL', 'TSCĐ', 'CCDC'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`h-10 px-4 text-xs font-bold transition ${
                        filterType === type
                          ? 'bg-[#0f766e] text-white'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {type === 'ALL' ? 'Tất cả' : type}
                    </button>
                  ))}
                </div>

                <div className="flex h-10 min-w-0 rounded-xl border border-slate-200 bg-white sm:w-80">
                  <span className="flex w-10 items-center justify-center border-r border-slate-200 text-slate-400">
                    ⌕
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm tên, mã, tình trạng..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-400">
                  <th className="w-24 px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Tên thiết bị</th>
                  <th className="w-48 px-4 py-3">Mã tài sản</th>
                  <th className="w-24 px-4 py-3 text-right">Số lượng</th>
                  <th className="w-40 px-4 py-3">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEquipments.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                        item.type === 'TSCĐ'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-cyan-50 text-cyan-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold leading-5 text-slate-900">{item.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        {item.specification && <span>Quy cách: {item.specification}</span>}
                        {item.note && <span>Ghi chú: {item.note}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-500">{item.code}</td>
                    <td className="px-4 py-4 text-right font-bold">{item.quantity}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredEquipments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <p className="text-base font-bold text-slate-800">Không có thiết bị phù hợp</p>
                      <p className="mt-2 text-sm text-slate-500">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
