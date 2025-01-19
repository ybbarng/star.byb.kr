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

    initCenters();
    initBorders();
  }, []);
  return {
    centers,
    borders
  };
}
