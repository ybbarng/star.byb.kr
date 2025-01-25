export default function SelectPhotoStep() {
  return (
    <div className="flex w-full flex-col lg:flex-row">
      <div className="card bg-base-300 rounded-box grid h-32 flex-grow place-items-center">
        <SampleSelect />
      </div>
      <div className="divider lg:divider-horizontal">또는</div>
      <div className="card bg-base-300 rounded-box grid h-32 flex-grow place-items-center">
        파일 업로드
      </div>
    </div>
  );
}

function SampleSelect() {
  return (
    <label className="form-control w-full max-w-xs">
      <div className="label">
        <span className="label-text font-bold">샘플 사진을 선택하세요.</span>
      </div>
      <select className="select select-bordered select-primary">
        <option disabled selected>
          Pick one
        </option>
        <option>Star Wars</option>
        <option>Harry Potter</option>
        <option>Lord of the Rings</option>
        <option>Planet of the Apes</option>
        <option>Star Trek</option>
      </select>
    </label>
  );
}
