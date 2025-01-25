import { ChangeEvent, useState } from "react";
import samples from "@/services/samples";

export default function SelectPhotoStep() {
  const [selectedSampleId, setSelectedSampleId] = useState(0);

  return (
    <div className="flex w-full flex-col lg:flex-row">
      <div className="card bg-base-300 rounded-box grid h-32 flex-grow place-items-center">
        <SampleSelect
          selectedSampleId={selectedSampleId}
          setSelectedSampleId={setSelectedSampleId}
        />
      </div>
      <div className="divider lg:divider-horizontal">또는</div>
      <div className="card bg-base-300 rounded-box grid h-32 flex-grow place-items-center">
        파일 업로드
      </div>
    </div>
  );
}

interface SampleSelectProps {
  selectedSampleId: number;
  setSelectedSampleId: (sampleId: number) => void;
}

function SampleSelect({
  selectedSampleId,
  setSelectedSampleId,
}: SampleSelectProps) {
  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedSampleId(Number(event.target.value));
  }

  return (
    <label className="form-control w-full max-w-xs">
      <div className="label">
        <span className="label-text font-bold">샘플 사진을 선택하세요.</span>
      </div>
      <select
        className="select select-bordered select-primary"
        onChange={handleSelectChange}
        value={selectedSampleId}
      >
        {samples.map((sample, i) => (
          <option key={i} value={i}>
            {sample.src.split("/").pop()}
          </option>
        ))}
      </select>
    </label>
  );
}
