'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

interface RoomQrCodeProps {
  roomId: string;
}

export default function RoomQrCode({ roomId }: RoomQrCodeProps) {
  const [qrCode, setQrCode] = useState({ roomUrl: '', dataUrl: '' });
  const fileName = `qr-${roomId.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'room'}.png`;

  useEffect(() => {
    let isMounted = true;
    const currentUrl = `${window.location.origin}${window.location.pathname}`;

    QRCode.toDataURL(currentUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 128,
      color: {
        dark: '#063f3a',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      if (isMounted) {
        setQrCode({ roomUrl: currentUrl, dataUrl });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="rounded-2xl bg-white p-4 text-slate-900">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Mã QR phòng</p>
            <span className="rounded-md bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase text-teal-700">
              Scan
            </span>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900">{roomId}</p>
          <p className="mt-3 truncate text-[11px] leading-5 text-slate-500">
            {qrCode.roomUrl || 'Đang tạo liên kết...'}
          </p>
          <a
            href={qrCode.dataUrl || undefined}
            download={fileName}
            aria-disabled={!qrCode.dataUrl}
            className={`mt-3 inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition ${
              qrCode.dataUrl
                ? 'bg-[#0f766e] text-white hover:bg-[#0d9488]'
                : 'pointer-events-none bg-slate-100 text-slate-400'
            }`}
          >
            Tải QR
          </a>
        </div>

        <div className="flex justify-center rounded-xl border border-slate-100 bg-slate-50 p-2">
          {qrCode.dataUrl ? (
            <Image
              src={qrCode.dataUrl}
              alt={`QR mở trang ${roomId}`}
              width={112}
              height={112}
              unoptimized
            />
          ) : (
            <div className="h-28 w-28 animate-pulse rounded-lg bg-slate-200" />
          )}
        </div>
      </div>
    </div>
  );
}
