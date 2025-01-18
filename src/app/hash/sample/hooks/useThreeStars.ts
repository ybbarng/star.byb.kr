import {useEffect, useState} from "react";
import * as THREE from "three";
import database from "@hash/data/sample-database.json";

export const useThreeStars = () => {
  const [stars, setStars] = useState<THREE.Points | null>(null);

  useEffect(() => {
    const color = new THREE.Color().setHex( 0xFFFFFF );
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    // 2. 3D 좌표 점 생성
    database.forEach((star) => {
      // 천문학 좌표계를 three.js 좌표계로 사용하려면 이렇게 변환해야 함
      positions.push(star.x * 100);
      positions.push(star.z * 100);
      positions.push(star.y * 100);
      const size = 5;
      colors.push(color.r, color.g, color.b, size);
      sizes.push(size);
    })
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const starsMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader(),
      fragmentShader: fragmentShader(),
      transparent: true,
    })

    const point = new THREE.Points(starsGeometry, starsMaterial);
    setStars(point);
  }, []);
  return {
    stars,
  }
}

function vertexShader() {
  return `
    attribute float size;
    attribute vec4 color;
    varying vec4 vColor;
    void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = size * ( 250.0 / -mvPosition.z );
        gl_Position = projectionMatrix * mvPosition;
    }
  `;
}


function fragmentShader() {
  return `
    varying vec4 vColor;
        void main() {
            gl_FragColor = vec4( vColor );
        }
  `;
}
