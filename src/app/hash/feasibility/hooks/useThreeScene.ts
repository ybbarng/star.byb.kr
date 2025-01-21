import { RefObject, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export const useThreeScene = (divRef: RefObject<HTMLDivElement | null>) => {
  const [scene, setScene] = useState<THREE.Scene | null>(null);

  useEffect(() => {
    if (!divRef.current) {
      return;
    }

    const width = divRef.current.clientWidth;
    const height = divRef.current.clientHeight;
    // 1. 씬, 카메라, 렌더러 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    divRef.current.appendChild(renderer.domElement);

    // 카메라 위치 설정
    camera.position.z = 200;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomSpeed = 4;

    window.addEventListener("resize", onWindowResize, false);

    function onWindowResize() {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render();
    }

    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // 애니메이션 함수
    const animate = () => {
      requestAnimationFrame(animate);
      render();
    };

    animate();
    setScene(scene);
    scene.rotation.set(0.3, -0.3, -0.3);

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
