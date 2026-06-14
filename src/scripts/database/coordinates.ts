// 천문 좌표(RA/Dec) ↔ 3D 단위 벡터 변환.
// toVector.ts에서 분리한 순수 함수 모음. 부작용이 없어 테스트에서 직접 import 가능하다.

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// 적경(RA)·적위(Dec) 문자열을 3차원 단위 벡터로 변환한다.
// 이 변환이 시스템 전체의 "천구 진실값" 규약이다 (toVector.ts가 DB를 만들 때 쓰는 것과 동일).
export function convertTo3DCoordinates(dec: string, ra: string): Vector3 {
  // 적위(Dec)를 라디안으로 변환
  const decDegrees = parseDMS(dec);
  const decRad = (decDegrees * Math.PI) / 180;

  // 적경(RA)을 라디안으로 변환
  const raDegrees = parseHMS(ra);
  const raRad = (raDegrees * Math.PI) / 180;

  // 3차원 좌표 계산
  const x = Math.cos(decRad) * Math.cos(raRad);
  const y = Math.cos(decRad) * Math.sin(raRad);
  const z = Math.sin(decRad);

  return { x, y, z };
}

// "+13° 23′ 46″" 형태의 도·분·초 문자열을 십진 도(degree)로 변환한다.
export function parseDMS(dms: string): number {
  // 도, 분, 초 형태를 정규식으로 분리
  const regex = /([+-]?\d+)°\s*(\d+)′\s*(\d+\.?\d*)″/;
  const match = dms.match(regex);

  if (!match) {
    throw new Error(`Invalid DMS format: ${dms}`);
  }

  // 부호는 문자열에서 직접 읽는다. parseInt("+00")/parseInt("-00")은 모두 0이 되어
  // 부호 정보를 잃으므로, degrees 값만으로 부호를 판단하면 "+00° 30′"이 음수가 되는 버그가 생긴다.
  const sign = match[1].trim().startsWith("-") ? -1 : 1;
  const degrees = Math.abs(parseInt(match[1], 10));
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  return sign * (degrees + minutes / 60 + seconds / 3600);
}

// "00h 05m 42.0s" 형태의 시·분·초 문자열을 십진 도(degree)로 변환한다 (1시간 = 15도).
export function parseHMS(hms: string): number {
  // 시, 분, 초 형태를 정규식으로 분리
  const regex = /(\d+)h\s*(\d+)m\s*(\d+\.?\d*)s/;
  const match = hms.match(regex);

  if (!match) {
    throw new Error(`Invalid HMS format: ${hms}`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  // 시 단위를 도 단위로 변환 (1시간 = 15도)
  return (hours + minutes / 60 + seconds / 3600) * 15;
}
