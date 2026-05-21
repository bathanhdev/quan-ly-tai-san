import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7f8] px-5 py-12 text-slate-900">
      <div className="absolute inset-x-0 top-0 h-72 bg-[#063f3a]" />
      <div className="absolute inset-x-0 top-0 h-72 opacity-30 bg-[linear-gradient(135deg,rgba(45,212,191,0.34),transparent_36%),linear-gradient(315deg,rgba(251,191,36,0.24),transparent_34%)]" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-teal-950/10 md:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-[#063f3a] p-8 text-white md:p-10">
          <div className="inline-flex rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-teal-50">
            Không tìm thấy
          </div>

          <div className="mt-12">
            <p className="text-8xl font-bold leading-none text-amber-300 md:text-9xl">404</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-teal-50/75">
              Đường dẫn này không khớp với phòng, khu vực hoặc trang nào trong hệ thống quản lý tài sản.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <p className="text-xs font-semibold uppercase text-teal-700">Hệ thống quản trị tài sản</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
            Trang bạn cần không tồn tại hoặc đã được thay đổi.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
            Bạn có thể quay lại trang chủ để tìm theo mã phòng, tên thiết bị, mã tài sản hoặc giảng viên quản lý.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-bold text-white transition hover:bg-[#0d9488]"
            >
              Về trang chủ
            </Link>
            <Link
              href="/room/th2-405"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
            >
              Xem phòng TH2.405
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Tìm phòng', 'Tra mã tài sản', 'Xem thiết bị'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{item}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Thực hiện tại trang chủ.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
