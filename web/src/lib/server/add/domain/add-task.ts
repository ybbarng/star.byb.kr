export type AddTask = {
  id: string;
  parameter1: number;
  parameter2: number;
  createdAt: Date;
  resultAt?: Date;
  result: number | null;
}