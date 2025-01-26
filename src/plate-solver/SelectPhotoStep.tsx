import { ChangeEvent, useEffect, useState } from "react";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import samples from "@/services/samples";

enum ImageType {
  SAMPLE,
  UPLOAD,
}

export default function SelectPhotoStep() {
  const [imageType, setImageType] = useState(ImageType.SAMPLE);
  const [selectedSampleId, setSelectedSampleId] = useState(0);
  const selectedSample = samples[selectedSampleId];
  const [uploadedImage, setUploadedImage] = useState<File>();
  const [uploadedUrl, setUploadedUrl] = useState<string>();
  const setImage = useContextStore((state) => state.setImage);

  useEffect(() => {
    if (!uploadedImage) {
      return;
    }

    const objectUrl = URL.createObjectURL(uploadedImage);
    setUploadedUrl(objectUrl);

    // free memory when ever this component is unmounted
    return () => URL.revokeObjectURL(objectUrl);
  }, [uploadedImage]);

  const previewSrc =
    imageType === ImageType.SAMPLE ? selectedSample.src : uploadedUrl;

  const onBeforeNext = async () => {
    if (!previewSrc) {
      return;
    }

    const image = new Image();
    image.src = previewSrc;
    setImage(image);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const worker = window.setInterval(() => {
      try {
        if (image.width) {
          window.clearInterval(worker);
          resolve();
        }
      } catch (e) {
        console.error(e);
        window.clearInterval(worker);
        reject(e);
      }
    }, 100);

    return promise;
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col lg:flex-row">
        <div
          className="card bg-base-300 rounded-box focus:bg-primary/30 grid h-24 flex-grow place-items-center"
          onFocus={() => setImageType(ImageType.SAMPLE)}
          tabIndex={0}
        >
          <SampleSelect
            selectedSampleId={selectedSampleId}
            setSelectedSampleId={setSelectedSampleId}
          />
        </div>
        <div className="divider lg:divider-horizontal">또는</div>
        <div
          className="card bg-base-300 rounded-box focus:bg-secondary/30 grid h-24 flex-grow place-items-center"
          onFocus={() => setImageType(ImageType.UPLOAD)}
          tabIndex={0}
        >
          <ImageUpload setUploadedImage={setUploadedImage} />
        </div>
      </div>
      {previewSrc && (
        <div className="flex justify-center">
          <img src={previewSrc} className="max-h-[800px]" />
        </div>
      )}
      <StepMover
        disableNext={
          (imageType === ImageType.SAMPLE && Number.isNaN(selectedSampleId)) ||
          (imageType === ImageType.UPLOAD && !uploadedImage)
        }
        onBeforeNext={onBeforeNext}
      />
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

interface ImageUploadProps {
  setUploadedImage: (file: File) => void;
}

function ImageUpload({ setUploadedImage }: ImageUploadProps) {
  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadedImage(file);
  }

  return (
    <label className="form-control w-full max-w-xs">
      <div className="label">
        <span className="label-text font-bold">사진을 업로드하세요.</span>
      </div>
      <input
        type="file"
        className="file-input file-input-bordered file-input-secondary w-full max-w-xs"
        onChange={handleImageChange}
        accept="image/*"
      />
    </label>
  );
}
