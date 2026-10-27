// 찾는 원리·블로그 데모가 쓰는 자료(미리 계산한 JSON·샘플 사진) 불러오기.
// 받지 못하면 실패로 끝내, 데모가 "불러오는 중"에 머물지 않고 실패를 알리게 한다.
// 주소는 부르는 쪽에 그대로 적는다 (블로그 묶음이 "/learn/…"·"/samples/…" 주소를 HTML 옆 상대 주소로 바꾼다, src/blog/build.ts)

export const LOAD_FAILED = "자료를 불러오지 못했어요. 새로고침해 보세요.";

export const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }

  return (await response.json()) as T;
};

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${src}: 사진을 불러오지 못했다`));
    image.src = src;
  });
