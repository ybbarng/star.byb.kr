"use client";

import SelectPhotoStepForDemo from "@/app/demo/upload-photo/SelectPhotoStepForDemo";

export default function Page() {
  return (
    <div className="size-full p-8">
      <div className="flex size-full flex-col gap-6">
        <div className="flex-1 overflow-hidden">
          <SelectPhotoStepForDemo />
        </div>
      </div>
    </div>
  );
}
