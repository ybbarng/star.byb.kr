import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 별 찾기·풀이 Worker 클라이언트(search/detectClient·solverClient)가 Worker가 통째로 죽어도
// 기다리던 요청을 끝내고(실패로), 다음 요청 때 새 Worker를 띄우는지 확인한다.
// 브라우저 Worker 대신 보낸 메시지를 기록하고 사건을 직접 일으키는 가짜를 쓴다.

class FakeWorker {
  static created: FakeWorker[] = [];
  static failToCreate = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  sent: Record<string, unknown>[] = [];
  terminated = false;
  failToSend = false;

  constructor() {
    if (FakeWorker.failToCreate) {
      throw new Error("Worker를 지원하지 않는다");
    }

    FakeWorker.created.push(this);
  }

  postMessage(message: Record<string, unknown>) {
    if (this.failToSend) {
      throw new Error("DataCloneError");
    }

    this.sent.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }

  crash(message = "스크립트를 불러오지 못했다") {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const IMAGE = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
const lastId = (w: FakeWorker) => w.sent[w.sent.length - 1].id;

beforeEach(() => {
  FakeWorker.created = [];
  FakeWorker.failToCreate = false;
  vi.stubGlobal("Worker", FakeWorker);
  // 모듈마다 Worker를 하나씩 붙잡고 있어 시험마다 새로 불러온다
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("별 찾기 Worker (detectClient)", () => {
  const load = () => import("@/search/detectClient");

  it("답이 오면 그 요청만 끝낸다", async () => {
    const { detectStars } = await load();
    const a = detectStars(IMAGE as ImageData);
    const b = detectStars(IMAGE as ImageData);
    const [w] = FakeWorker.created;

    w.reply({ id: w.sent[1].id, stars: [{ x: 1 }] });
    await expect(b).resolves.toEqual([{ x: 1 }]);
    w.reply({ id: w.sent[0].id, error: "검출 실패" });
    await expect(a).rejects.toThrow("검출 실패");
  });

  it("Worker가 죽으면 기다리던 요청을 모두 실패로 끝내고, 다음 요청은 새 Worker로 보낸다", async () => {
    const { detectStars } = await load();
    const a = detectStars(IMAGE as ImageData);
    const b = detectStars(IMAGE as ImageData);
    const [first] = FakeWorker.created;

    first.crash();
    await expect(a).rejects.toThrow("스크립트를 불러오지 못했다");
    await expect(b).rejects.toThrow("스크립트를 불러오지 못했다");
    expect(first.terminated).toBe(true);

    const c = detectStars(IMAGE as ImageData);
    const second = FakeWorker.created[1];

    expect(FakeWorker.created).toHaveLength(2);
    second.reply({ id: lastId(second), stars: [] });
    await expect(c).resolves.toEqual([]);
  });

  it("응답을 읽지 못해도 기다리던 요청을 끝낸다", async () => {
    const { detectStars } = await load();
    const a = detectStars(IMAGE as ImageData);

    FakeWorker.created[0].onmessageerror?.({} as MessageEvent);
    await expect(a).rejects.toThrow("응답을 읽지 못했습니다");
  });

  it("버린 옛 Worker의 늦은 소식은 새 Worker의 요청을 건드리지 않는다", async () => {
    const { detectStars } = await load();
    const a = detectStars(IMAGE as ImageData);
    const [first] = FakeWorker.created;

    first.crash();
    await expect(a).rejects.toThrow();

    const b = detectStars(IMAGE as ImageData);
    const second = FakeWorker.created[1];

    first.crash("늦게 온 오류");
    expect(second.terminated).toBe(false);
    second.reply({ id: lastId(second), stars: [] });
    await expect(b).resolves.toEqual([]);
  });

  it("Worker를 띄우지 못하면 실패로 끝내고, 미리 띄우기는 조용히 넘어간다", async () => {
    FakeWorker.failToCreate = true;
    const { detectStars, preloadDetector } = await load();

    expect(() => preloadDetector()).not.toThrow();
    await expect(detectStars(IMAGE as ImageData)).rejects.toThrow(
      "Worker를 지원하지 않는다",
    );

    // 다음 요청에서 다시 띄워 본다
    FakeWorker.failToCreate = false;
    const a = detectStars(IMAGE as ImageData);
    const [w] = FakeWorker.created;

    w.reply({ id: lastId(w), stars: [] });
    await expect(a).resolves.toEqual([]);
  });

  it("보내지 못하면 그 요청을 실패로 끝내고 남겨 두지 않는다", async () => {
    const { detectStars } = await load();
    const ok = detectStars(IMAGE as ImageData);
    const [w] = FakeWorker.created;

    w.failToSend = true;
    await expect(detectStars(IMAGE as ImageData)).rejects.toThrow(
      "DataCloneError",
    );

    // 남은 요청은 하나뿐이라, Worker가 죽어도 실패는 하나만 나간다
    const onReject = vi.fn();
    ok.catch(onReject);
    w.crash();
    await vi.waitFor(() => expect(onReject).toHaveBeenCalledTimes(1));
  });
});

describe("풀이 Worker (solverClient)", () => {
  const load = () => import("@/search/solverClient");

  it("Worker가 죽으면 풀이 요청을 실패로 끝내고, 준비 상태도 지워 다음에 다시 준비한다", async () => {
    const { preloadSolver, solveInWorker } = await load();
    const ready = preloadSolver();
    const [first] = FakeWorker.created;

    first.reply({ fn: "onDone", id: lastId(first) });
    await expect(ready).resolves.toBeUndefined();

    const solving = solveInWorker([], 10, 10);
    first.crash();
    await expect(solving).rejects.toThrow("스크립트를 불러오지 못했다");

    // 새 Worker는 DB가 없으니 준비 요청을 다시 보낸다
    const again = preloadSolver();
    const second = FakeWorker.created[1];

    expect(second.sent[0]).toMatchObject({ fn: "loadDatabase" });
    second.reply({ fn: "onDone", id: lastId(second) });
    await expect(again).resolves.toBeUndefined();
  });

  it("준비 중에 Worker가 죽으면 준비가 실패로 끝나고, 다음 호출에서 다시 한다", async () => {
    const { preloadSolver } = await load();
    const ready = preloadSolver();

    FakeWorker.created[0].crash();
    await expect(ready).rejects.toThrow();

    preloadSolver().catch(() => {});
    expect(FakeWorker.created).toHaveLength(2);
  });

  it("진행 단계 소식은 요청을 끝내지 않고, 끝 소식이 와야 끝난다", async () => {
    const { solveInWorker } = await load();
    const phases: unknown[] = [];
    const solving = solveInWorker([], 10, 10, (p) => phases.push(p));
    const [w] = FakeWorker.created;
    const id = lastId(w);

    w.reply({ fn: "onPhase", id, payload: { kind: "linear" } });
    w.reply({ fn: "onDone", id, payload: { found: true } });
    await expect(solving).resolves.toEqual({ found: true });
    expect(phases).toEqual([{ kind: "linear" }]);
  });

  it("Worker를 띄우지 못하면 실패로 끝낸다", async () => {
    FakeWorker.failToCreate = true;
    const { solveInWorker } = await load();

    await expect(solveInWorker([], 10, 10)).rejects.toThrow(
      "Worker를 지원하지 않는다",
    );
  });
});
