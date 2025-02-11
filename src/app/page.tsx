export default function Page() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center py-40">
      <div className="flex h-full w-[500px] flex-col items-start justify-start gap-4">
        <h1 className="text-5xl font-bold">star.byb.kr</h1>
        <div className="text-neutral-300">
          나만의 작고 소중한 Plate Solver by{" "}
          <Link href="https://github.com/ybbarng">ybbarng</Link>
        </div>
        <h2 className="text-3xl font-bold">주요 링크</h2>
        <ul className="ml-8 list-disc">
          <li className="text-xl">
            <Link href="/plate-solver">Plate Solver</Link>
          </li>
          <li className="text-xl">
            <Link href="/presentation/index.html">
              2025-XX-XX Dev Seminar 발표자료
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
