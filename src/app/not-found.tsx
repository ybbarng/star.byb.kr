import Link from "next/link";
import SiteShell from "@/ui/SiteShell";

export const metadata = { title: "길을 잃은 별" };

export default function NotFound() {
  return (
    <SiteShell>
      <div className="fx-rise flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-7xl">🌠</div>
        <h1 className="text-3xl font-black">길을 잃은 별이에요</h1>
        <p className="opacity-70">
          찾는 페이지가 없어요. 주소를 확인해 주세요.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primary">
            첫 화면으로
          </Link>
          <Link href="/games" className="btn btn-ghost">
            별 놀이터
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
