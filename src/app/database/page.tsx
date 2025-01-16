"use client";
import * as THREE from "three";
import {useEffect, useRef } from "react";
import database from "@database/build/vectors-database.json";
import {useThreeScene} from "@/app/database/hooks/useThreeScene";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);

  useEffect(() => {
    if (!scene) {
      return;
    }
    const color = new THREE.Color().setHex( 0xFFFFFF );
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    // 2. 3D 좌표 점 생성
    database.forEach((star) => {
      positions.push(star.x * 100);
      positions.push(star.y * 100);
      positions.push(star.z * 100);
      const size = (star.V * 26) / 255 + 0.18;
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

    // 점을 씬에 추가
    scene.add(point);

  }, [scene]);

  return <div ref={ mountRef } />
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
