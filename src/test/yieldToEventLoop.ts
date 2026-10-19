// 무거운 동기 계산 사이에 이벤트 루프 차례를 넘긴다.
// vitest 워커는 테스트 진행 상황을 RPC로 보고하는데, 동기 계산이 60초 넘게
// 이벤트 루프를 막으면 "Timeout calling onTaskUpdate" 오류로 실행이 실패한다.
export const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setImmediate(resolve));
