import SchoolShell from "@/game/starSchool/SchoolShell";

// 별자리 익히기 공용 틀: 다섯 갈래 길과 내 별빛·등급
export default function StarSchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SchoolShell>{children}</SchoolShell>;
}
