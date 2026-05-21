'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import classroomsData from '@/data/classrooms.json';
import teachersData from '@/data/teachers.json';
import type { Classroom, Teacher } from '@/types';
import RoomQrCode from './RoomQrCode';

const classrooms = classroomsData as Classroom[];
const teachers = teachersData as Teacher[];

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

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

const shortValueFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

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

  const currentClassroom = useMemo(() => {
    const rawId = params?.id ?? '';
    const targetId = compactId(rawId);

    return classrooms.find((room) => {
      const roomId = compactId(room.roomId);
      const slug = compactId(room.id);
      return roomId === targetId || slug === targetId || roomId.includes(targetId);
    });
  }, [params?.id]);

  const associatedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === currentClassroom?.teacherId),
    [currentClassroom?.teacherId]
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
  const totalValue = currentClassroom.stats.totalValue ?? 0;
  const totalItems = currentClassroom.stats.totalEquipments || 1;
  const tscdRatio = Math.round(((currentClassroom.stats.totalTSCD || 0) / totalItems) * 100);
  const missingPriceCount = currentClassroom.equipments.filter((item) => item.originalPrice === null).length;

  const stats = [
    { label: 'Tổng thiết bị', value: currentClassroom.stats.totalEquipments, detail: 'số lượng kiểm kê', tone: 'border-teal-500' },
    { label: 'TSCĐ', value: currentClassroom.stats.totalTSCD, detail: 'tài sản cố định', tone: 'border-emerald-500' },
    { label: 'CCDC', value: currentClassroom.stats.totalCCDC, detail: 'công cụ dụng cụ', tone: 'border-cyan-500' },
    { label: 'Giá trị', value: `${shortValueFormatter.format(totalValue / 1_000_000_000)} tỷ`, detail: 'VNĐ ghi nhận', tone: 'border-amber-500' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="relative overflow-hidden bg-[#063f3a] text-white">
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(135deg,rgba(45,212,191,0.34),transparent_36%),linear-gradient(315deg,rgba(251,191,36,0.2),transparent_34%)]" />

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-300 px-3 py-1.5 text-sm font-bold text-slate-950">
                  {currentClassroom.roomId}
                </span>
                {currentClassroom.modules.map((module) => (
                  <span key={module} className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50">
                    {module}
                  </span>
                ))}
              </div>

              <h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
                {currentClassroom.roomName}
              </h1>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase text-teal-100/70">Giảng viên quản lý</p>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-base font-bold text-[#063f3a]">
                      {getInitials(teacherName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{teacherName}</p>
                      <p className="truncate text-xs text-teal-50/65">{teacherDepartment}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-teal-50/75">
                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="font-semibold uppercase text-teal-100/60">Email</span>
                      <span className="truncate text-right font-medium">{teacherEmail}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold uppercase text-teal-100/60">Điện thoại</span>
                      <span className="truncate text-right font-medium">{teacherPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase text-teal-100/70">Cơ cấu tài sản</p>
                  <div className="mt-4 flex items-center justify-between text-sm font-semibold">
                    <span>{tscdRatio}% TSCĐ</span>
                    <span>{100 - tscdRatio}% CCDC</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${tscdRatio}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-100/70">Tổng giá trị ghi nhận</p>
                <p className="mt-3 text-4xl font-bold">{currencyFormatter.format(totalValue)}đ</p>
                <p className="mt-3 text-sm leading-6 text-teal-50/70">
                  Tổng hợp từ nguyên giá theo mã tài sản trong file kiểm kê. Các dòng thiếu nguyên giá không được cộng vào chỉ số này.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-4 text-slate-900">
                  <p className="text-xs font-semibold uppercase text-slate-400">Dòng dữ liệu</p>
                  <p className="mt-2 text-2xl font-bold">{currentClassroom.equipments.length}</p>
                </div>
                <div className="rounded-xl bg-white p-4 text-slate-900">
                  <p className="text-xs font-semibold uppercase text-slate-400">Thiếu giá</p>
                  <p className="mt-2 text-2xl font-bold">{missingPriceCount}</p>
                </div>
              </div>
              <div className="mt-3">
                <RoomQrCode roomId={currentClassroom.roomId} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`rounded-xl border-l-4 ${stat.tone} bg-white p-4 shadow-sm`}>
              <p className="text-xs font-semibold uppercase text-slate-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-400">
                  <th className="w-24 px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Tên thiết bị</th>
                  <th className="w-48 px-4 py-3">Mã tài sản</th>
                  <th className="w-24 px-4 py-3 text-right">Số lượng</th>
                  <th className="w-40 px-4 py-3 text-right">Nguyên giá</th>
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
                    <td className="px-4 py-4 text-right font-semibold text-slate-700">
                      {item.originalPrice === null ? 'Chưa có' : `${currencyFormatter.format(item.originalPrice)}đ`}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredEquipments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
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
