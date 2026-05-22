'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Classroom } from '@/types';
import { fetchClassroomsFromSupabase } from '@/lib/supabase/publicData';

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const numberFormatter = new Intl.NumberFormat('vi-VN');

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  useEffect(() => {
    fetchClassroomsFromSupabase().then((data) => {
      setClassrooms(data);
    });
  }, []);

  const globalStats = useMemo(() => {
    const totalTSCD = classrooms.reduce((acc, room) => acc + (room.stats?.totalTSCD || 0), 0);
    const totalCCDC = classrooms.reduce((acc, room) => acc + (room.stats?.totalCCDC || 0), 0);

    return {
      totalRooms: classrooms.length,
      totalItems: classrooms.reduce((acc, room) => acc + (room.stats?.totalEquipments || 0), 0),
      totalTSCD,
      totalCCDC,
    };
  }, [classrooms]);

  const filteredRooms = useMemo(() => {
    const targetSearch = normalizeText(searchQuery);
    if (!targetSearch) return classrooms;

    return classrooms.filter((room) => {
      const searchableText = [
        room.roomId,
        room.roomName,
        room.teacherName,
        ...room.modules,
        ...room.equipments.flatMap((item) => [item.name, item.code, item.type]),
      ].map(normalizeText).join(' ');

      return searchableText.includes(targetSearch);
    });
  }, [classrooms, searchQuery]);

  const spotlightRooms = useMemo(
    () => [...classrooms].sort((a, b) => b.stats.totalEquipments - a.stats.totalEquipments).slice(0, 3),
    [classrooms]
  );

  const statCards = [
    { label: 'Khu vực', value: globalStats.totalRooms, detail: 'phòng, kho, hội trường', tone: 'border-teal-500' },
    { label: 'Thiết bị', value: numberFormatter.format(globalStats.totalItems), detail: 'đang kiểm kê', tone: 'border-cyan-500' },
    { label: 'TSCĐ', value: numberFormatter.format(globalStats.totalTSCD), detail: 'tài sản cố định', tone: 'border-emerald-500' },
    { label: 'CCDC', value: numberFormatter.format(globalStats.totalCCDC), detail: 'công cụ dụng cụ', tone: 'border-amber-500' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="relative overflow-hidden bg-[#063f3a] text-white">
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(135deg,rgba(45,212,191,0.32),transparent_35%),linear-gradient(315deg,rgba(251,191,36,0.22),transparent_30%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-10">
          <div className="flex min-h-[280px] flex-col justify-between">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  Khoa Công nghệ Nhiệt lạnh
                </div>
                <Link
                  href="/admin"
                  className="inline-flex rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-50 backdrop-blur transition hover:bg-white/15"
                >
                  Quản trị
                </Link>
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
                Hệ thống quản trị tài sản
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-teal-50/80 md:text-lg">
                Theo dõi phòng, thiết bị, TSCĐ và CCDC trong một giao diện kiểm kê trực quan.
              </p>
            </div>

            <div className="mt-8 max-w-2xl">
              <label htmlFor="asset-search" className="mb-2 block text-xs font-semibold uppercase text-teal-100/70">
                Tìm kiếm nhanh
              </label>
              <div className="flex rounded-2xl border border-white/20 bg-white text-slate-900 shadow-2xl shadow-teal-950/20">
                <span className="flex w-12 items-center justify-center border-r border-slate-200 text-slate-400">
                  ⌕
                </span>
                <input
                  id="asset-search"
                  type="text"
                  placeholder="Nhập phòng, mã tài sản, thiết bị hoặc giảng viên"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm font-medium outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-100/70">Nổi bật</p>
                <h2 className="mt-1 text-xl font-bold">Khu vực nhiều thiết bị</h2>
              </div>
              <span className="rounded-md border border-white/15 px-2 py-1 text-xs font-semibold text-teal-50">
                Top 3
              </span>
            </div>

            <div className="space-y-3">
              {spotlightRooms.map((room, index) => (
                <Link
                  key={room.id}
                  href={`/room/${room.id}`}
                  className="block rounded-xl border border-white/10 bg-white p-4 text-slate-900 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-teal-700">0{index + 1} · {room.roomId}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-bold leading-5">{room.roomName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold">{room.stats.totalEquipments}</p>
                      <p className="text-[11px] font-semibold uppercase text-slate-400">thiết bị</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className={`rounded-xl border-l-4 ${stat.tone} bg-white p-4 shadow-sm`}>
              <p className="text-xs font-semibold uppercase text-slate-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-700">Danh mục</p>
              <h2 className="text-2xl font-bold text-slate-900">Phòng và khu vực quản lý</h2>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Hiển thị {filteredRooms.length}/{classrooms.length} khu vực
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRooms.map((room, index) => {
              const tscd = room.stats.totalTSCD || 0;
              const ccdc = room.stats.totalCCDC || 0;
              const total = room.stats.totalEquipments || 1;
              const tscdRatio = Math.round((tscd / total) * 100);
              const accentClass = [
                'bg-teal-500',
                'bg-cyan-500',
                'bg-amber-400',
                'bg-rose-500',
              ][index % 4];

              return (
                <Link
                  key={room.id}
                  href={`/room/${room.id}`}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-teal-500 hover:shadow-xl"
                >
                  <div className={`h-1.5 ${accentClass}`} />
                  <div className="p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase text-teal-700">{room.roomId}</p>
                        <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">
                          {room.roomName}
                        </h3>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 transition group-hover:border-teal-500 group-hover:bg-teal-50 group-hover:text-teal-700">
                        →
                      </span>
                    </div>

                    <p className="truncate text-xs font-medium text-slate-500">
                      Quản lý: <span className="text-slate-700">{room.teacherName || 'Chưa phân công'}</span>
                    </p>

                    <div className="mt-4 grid grid-cols-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="p-3">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">TSCĐ</p>
                        <p className="mt-1 text-base font-bold">{tscd}</p>
                      </div>
                      <div className="border-x border-slate-100 p-3">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">CCDC</p>
                        <p className="mt-1 text-base font-bold">{ccdc}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Tổng</p>
                        <p className="mt-1 text-base font-bold">{room.stats.totalEquipments}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400">
                        <span>Cơ cấu tài sản</span>
                        <span>{tscdRatio}% TSCĐ</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${tscdRatio}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredRooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <p className="text-lg font-bold text-slate-800">Không tìm thấy kết quả</p>
              <p className="mt-2 text-sm text-slate-500">Thử tìm theo mã phòng, tên thiết bị hoặc giảng viên.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
