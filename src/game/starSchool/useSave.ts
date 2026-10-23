"use client";

import { useSyncExternalStore } from "react";
import {
  loadSave,
  serverSave,
  subscribeSave,
} from "@/game/starSchool/progress";

// 별자리 익히기 기록을 화면에서 쓰기 (바뀌면 다시 그린다). 서버에서 그릴 때는 빈 기록
export const useSave = () =>
  useSyncExternalStore(subscribeSave, loadSave, serverSave);
