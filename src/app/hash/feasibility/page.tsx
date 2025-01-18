"use client";

import Graph from "@/app/hash/feasibility/components/Graph";

/**
 * What we're going to render is:
 *
 * 1. A video component so the user can see what's on the camera.
 *
 * 2. A button to generate an image of the video, load OpenCV and
 * process the image.
 *
 * 3. A canvas to allow us to capture the image of the video and
 * show it to the user.
 */
export default function Page() {

  return (
    <div className="flex flex-col items-start p-4 gap-5">
      <div className="columns-2">
        <Graph />
      </div>
    </div>
  )
}
