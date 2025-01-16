"use client";
import * as THREE from "three";
import {useEffect, useRef} from "react";
import database from "@database/build/reduced-database.json";
console.log(database);

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }
    // 1. 씬, 카메라, 렌더러 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // 2. 3D 좌표 점 생성
    const geometry = new THREE.SphereGeometry(0.1, 32, 32); // 점을 작은 구로 만듦
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const point = new THREE.Mesh(geometry, material);

    // 3D 좌표 값 설정 (예: (x, y, z) = (2, 3, -5))
    point.position.set(2, 3, -5);

    // 점을 씬에 추가
    scene.add(point);

    // 카메라 위치 설정
    camera.position.z = 5;

    // 애니메이션 함수
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    animate();

    // 리소스 정리
    return () => {
      renderer.dispose();
    };
  }, [mountRef.current]);

  return <div ref={ mountRef } />
}
