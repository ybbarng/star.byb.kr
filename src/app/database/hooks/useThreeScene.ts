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
    // [ -0.5631362255583447, -0.046464995646676444, 0.8325142706465549 ]
    // 1. 주어진 벡터와 Z축 정의
    // 1. 벡터 정의
    const v1 = new THREE.Vector3(
      -0.5657188370629972,
      0.8321347812191403,
      -0.03898483875185704,
    );
    const v2 = new THREE.Vector3(
      -0.5631362255583447,
      0.8325142706465549,
      -0.046464995646676444,
    ); // 주어진 벡터 v2

    // 2. 새로운 Z축 정의 (v1)
    const zAxis = v1.clone().normalize();

    // 3. 새로운 Y축 정의 (v2 - v1)
    const temp = v2.clone().sub(v1); // v2 - v1
    let yAxis = temp.clone().normalize();

    // zAxis에 투영된 성분을 제거하여 z축과 y축을 직교하게 함
    const projectionOntoZ = zAxis.clone().multiplyScalar(yAxis.dot(zAxis));
    yAxis = yAxis.sub(projectionOntoZ).normalize();

    camera.position.set(zAxis.x * 200, zAxis.y * 200, zAxis.z * 200);
    camera.up.set(yAxis.x, yAxis.y, yAxis.z);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomSpeed = 4;

    animate();
    setScene(scene);

    const innerSphere = createInnerSphere();
    scene.add(innerSphere);

    function createInnerSphere() {
      const geometry = new THREE.SphereGeometry(97, 32, 32);
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
