export type Point2D = [number, number];

export interface Photo {
  width: number;
  height: number;
  stars: Point2D[];
}

export type CandidateInput = [number, number, number, number];

export interface CandidateOutputItem {
  hr: string;
  label: string;
}

export type CandidateOutput = [
  CandidateOutputItem,
  CandidateOutputItem,
  CandidateOutputItem,
  CandidateOutputItem,
];

export interface Candidate {
  input: CandidateInput;
  output: CandidateOutput;
  distance: number;
}

export interface NearestStar2D {
  hr: string;
  label: string;
  vector: Point2D;
}

export interface NearestConstellation2D {
  label: string;
  stars: Point2D[];
}
