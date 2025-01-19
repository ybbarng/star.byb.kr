import {useEffect, useState} from "react";
import * as THREE from "three";
import * as healpix from '@hscmap/healpix';

export const useThreeHealpix = () => {
  const nstep = 8; // 경계선의 한 선분을 구성할 점의 갯수
  const nside = 8; // healpix의 order. astrometry에서는 12 썼는데, 라이브러리의 버그인지 여기서는 2의 배수여야 각 영역이 깔끔하게 분리됨
  const npix = healpix.nside2npix(nside);
  const R = 100;

  const [centers, setCenters] = useState<THREE.Points | null>(null);
  const [borders, setBorders] = useState<THREE.Line[]>([]);
  const [circles, setCircles] = useState<THREE.Line[]>([]);

  useEffect(() => {
    function initCenters() {
      const positions: number[] = [];
      for (let ipix = 0; ipix < npix; ipix++) {
        const vector = healpix.pix2vec_nest(nside, ipix); // 픽셀 중심 벡터 계산
        positions.push(vector[0] * R);
        positions.push(vector[2] * R);
        positions.push(vector[1] * R);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xdc2626,
        size: 1,
      });

      const centers = new THREE.Points(geometry, material);
      setCenters(centers);
    }

    function initBorders() {
      const borders: THREE.Line[] = [];
      for (let ipix = 0; ipix < npix; ++ipix) {
        const path: number[] = [];
        for (let i = 0; i < nstep; i++) {
          const ne = i / nstep;
          const v = healpix.pixcoord2vec_nest(nside, ipix, ne, 0);
          path.push(v[0] * R);
          path.push(v[2] * R);
          path.push(v[1] * R);
        }
        for (let i = 0; i <= nstep; i++) {
          const nw = i / nstep;
          const v = healpix.pixcoord2vec_nest(nside, ipix, 1, nw);
          path.push(v[0] * R);
          path.push(v[2] * R);
          path.push(v[1] * R);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(path, 3)
        );
        const material = new THREE.LineBasicMaterial({color: 0x1e40af});
        const border = new THREE.Line(geometry, material);
        borders.push(border);
      }
      setBorders(borders);
    }

    function initCircles() {
      const circles: THREE.LineLoop[] = [];
      for (let ipix = 0; ipix < npix; ipix++) {
        const vector = healpix.pix2vec_nest(nside, ipix); // 픽셀 중심 벡터 계산
        const circlePoints = generateCirclePoints([vector[0], vector[2], vector[1]], R, 320, 20);
        // 원을 라인으로 그리기
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x15803d });
        const line = new THREE.LineLoop(lineGeometry, lineMaterial);
        circles.push(line);
      }
      setCircles(circles);
    }

    function generateCirclePoints(center: number[], radius: number, arcmin: number, numPoints: number) {
      const points = [];
      const centerVec = new THREE.Vector3(...center).normalize();

      // 각도를 라디안으로 변환
      const arcRadius = (arcmin * Math.PI) / (180 * 60);


      // 기준 축 생성 (중심점에 수직인 벡터)
      const arbitraryVec = Math.abs(centerVec.x) < 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangentVec = new THREE.Vector3().crossVectors(centerVec, arbitraryVec).normalize(); // 수직 벡터 1
      const bitangentVec = new THREE.Vector3().crossVectors(centerVec, tangentVec).normalize(); // 수직 벡터 2

      // 원 위의 점들 계산
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; // 원 주변 각도
        const offset = tangentVec.clone().multiplyScalar(Math.cos(angle) * arcRadius)
          .add(bitangentVec.clone().multiplyScalar(Math.sin(angle) * arcRadius));

        // 점을 구 표면 위로 투영
        const point = centerVec.clone().multiplyScalar(Math.cos(arcRadius)) // 중심점 방향
          .add(offset.clone()).normalize().multiplyScalar(radius); // 원의 점
        points.push(point);
      }

      return points;
    }

    initCenters();
    initBorders();
    initCircles();
  }, []);
  return {
    centers,
    borders,
    circles,
  };
}
