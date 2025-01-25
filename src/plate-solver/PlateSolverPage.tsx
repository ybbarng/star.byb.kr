import PageBody from "@/plate-solver/PageBody";
import PageHeader from "@/plate-solver/PageHeader";

export default function PlateSolverPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader />
      <PageBody />
    </div>
  );
}
