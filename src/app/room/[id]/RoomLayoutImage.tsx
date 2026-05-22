'use client';

import Image from 'next/image';
import { useState } from 'react';

interface RoomLayoutImageProps {
  roomId: string;
  roomImage: string;
  compact?: boolean;
}

export default function RoomLayoutImage({ roomId, roomImage, compact = false }: RoomLayoutImageProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(roomImage));

  if (compact) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
        <p className="text-xs font-semibold uppercase text-teal-100/70">Sơ đồ phòng học</p>
        <p className="mt-1 text-sm font-bold">{roomId}</p>
        <div className="mt-3 h-px bg-white/10" />

        <div className="relative mt-3 min-h-[285px] overflow-hidden rounded-xl border border-white/10 bg-white">
          {imageAvailable ? (
            <Image
              src={roomImage}
              alt={`Sơ đồ phòng ${roomId}`}
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-contain p-2"
              loading="eager"
              preload
              unoptimized
              onError={() => setImageAvailable(false)}
            />
          ) : (
            <div className="flex h-full min-h-[285px] flex-col items-center justify-center p-6 text-center text-slate-900">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-xl font-bold text-teal-700">
                {roomId.slice(0, 2)}
              </div>
              <p className="text-sm font-bold">Chưa có ảnh sơ đồ</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Sơ đồ sẽ hiển thị khi có ảnh trong hệ thống.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase text-teal-700">Sơ đồ phòng học</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{roomId}</h2>
      </div>

      <div className="p-4">
        <div className="relative min-h-[280px] overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {imageAvailable ? (
            <Image
              src={roomImage}
              alt={`Sơ đồ phòng ${roomId}`}
              fill
              sizes="(min-width: 1024px) 860px, 100vw"
              className="object-contain p-4"
              loading="eager"
              preload
              unoptimized
              onError={() => setImageAvailable(false)}
            />
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-2xl font-bold text-teal-700">
                {roomId.slice(0, 2)}
              </div>
              <p className="text-base font-bold text-slate-900">Chưa có ảnh sơ đồ</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Khi có file ảnh, đặt đúng đường dẫn bên dưới để hệ thống tự hiển thị sơ đồ phòng học.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
