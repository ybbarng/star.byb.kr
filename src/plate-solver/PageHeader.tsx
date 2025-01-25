import Steps from "@/plate-solver/Steps";

export default function PageHeader() {
  return (
    <div className="flex flex-row items-center justify-between">
      <div className="no-wrap text-3xl font-bold">Plate Solver</div>
      <div className="grow">
        <Steps />
      </div>
    </div>
  );
}
