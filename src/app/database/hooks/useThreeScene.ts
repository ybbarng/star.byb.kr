import { RefObject, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const useThreeScene = (divRef: RefObject<HTMLDivElement | null>) => {
  const [scene, setScene] = useState<THREE.Scene | null>(null);

  useEffect(() => {
    if (!divRef.current) {
      return;
    }

    // 1. 씬, 카메라, 렌더러 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      1000,
    );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    divRef.current.appendChild(renderer.domElement);

    // 카메라 위치 설정
    camera.position.z = 200;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomSpeed = 4;

    window.addEventListener("resize", onWindowResize, false);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      render();
    }

    // 애니메이션 함수
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    // [ -0.5657188370629972, -0.03898483875185704, 0.8321347812191403 ]
    // 1. 주어진 벡터와 Z축 정의
    const v = new THREE.Vector3(
      -0.5657188370629972,
      0.8321347812191403,
      -0.03898483875185704,
    ).normalize(); // 주어진 벡터
    const zAxis = new THREE.Vector3(0, 0, 1); // Z축 벡터

    // 2. 회전축(axis)와 회전 각도(angle) 계산
    const axis = new THREE.Vector3().crossVectors(v, zAxis).normalize(); // 회전축
    const angle = Math.acos(v.dot(zAxis)); // 회전 각도 (라디안)

    // 3. scene에 회전 적용
    if (axis.length() > 0) {
      // axis가 유효한 경우
      scene.rotateOnAxis(axis, angle);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        new THREE.Vector3(v.x * 100, v.y * 100, v.z * 100),
        3,
      ),
    );
    const material = new THREE.PointsMaterial({
      color: 0xdc2626,
      size: 1,
    });

    const center = new THREE.Points(geometry, material);
    scene.add(center);

    animate();
    setScene(scene);

    const innerSphere = createInnerSphere();
    scene.add(innerSphere);

    function createInnerSphere() {
      const geometry = new THREE.SphereGeometry(98, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide,
      });

      return new THREE.Mesh(geometry, material);
    }

    function render() {
      renderer.render(scene, camera);
    }

    // 리소스 정리
    return () => {
      renderer.dispose();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [divRef]);

  return {
    scene,
  };
};
