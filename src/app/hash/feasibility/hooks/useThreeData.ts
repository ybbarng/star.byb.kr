import {useEffect, useState} from "react";
import * as THREE from "three";
import database from "@hash/build/hashed-database.json";
import photo from "@hash/build/hashed-photo.json";


interface Datum {
  hash: number[];
};
type Data = Datum[];

export const useThreeData = () => {
  const [databaseData, setDatabaseData] = useState<THREE.Points | null>(null);
  const [photoData, setPhotoData] = useState<THREE.Points | null>(null);

  useEffect(() => {
    function createThreeData(data: Data, colorHex: number) {

    const color = new THREE.Color().setHex( colorHex );
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    // 2. 3D 좌표 점 생성
    data.forEach((row) => {
      positions.push(row.hash[0] * 100);
      positions.push(row.hash[1] * 100);
      positions.push(row.hash[2] * 100);
      const size = 2;
      colors.push(color.r, color.g, color.b, size);
      sizes.push(size);
    })
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShader(),
      fragmentShader: fragmentShader(),
      transparent: true,
    })

    return new THREE.Points(geometry, material);
    }
    const databaseData = createThreeData(database, 0xc2410c);
    setDatabaseData(databaseData);
    const photoData = createThreeData(photo, 0x65a30d);
    setPhotoData(photoData);
  }, []);

  return {
    databaseData,
    photoData,
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
