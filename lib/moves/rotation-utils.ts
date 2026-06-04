import * as THREE from "three";
import { ICubeMoves } from "./moves";
import { IStore } from "../store/store";
import { getIdxByPos } from "@/lib/helpers/helper";
import { getCubePosBySide } from "@/lib/helpers/cube-pos-by-side";
import { ICubeSide } from "@/types/types";
import gsap from "gsap";
import { CUBE_GAP, CUBE_SIZE } from "@/components/cube-visualization/gen-empty-cube";

export const getRotation = (move: ICubeMoves, base: THREE.Euler) => {
  const target = base.clone();
  const preTarget = base.clone();
  const halfStepRatio = 0.25;

  const firstLetMove = move[0];
  const reverse = move[1] === "'" ? -1 : 1;
  const double = move[1] === "2" ? 2 : 1;

  switch (firstLetMove) {
    case "U":
      target.y = (-Math.PI / 2) * reverse * double;
      preTarget.y = (target.y * halfStepRatio) / double;
      break;
    case "D":
      target.y = (Math.PI / 2) * reverse * double;
      preTarget.y = (target.y * halfStepRatio) / double;
      break;
    case "F":
      target.z = (-Math.PI / 2) * reverse * double;
      preTarget.z = (target.z * halfStepRatio) / double;
      break;
    case "B":
      target.z = (Math.PI / 2) * reverse * double;
      preTarget.z = (target.z * halfStepRatio) / double;
      break;
    case "L":
      target.x = (Math.PI / 2) * reverse * double;
      preTarget.x = (target.x * halfStepRatio) / double;
      break;
    case "R":
      target.x = (-Math.PI / 2) * reverse * double;
      preTarget.x = (target.x * halfStepRatio) / double;
      break;
    case "M":
      target.x = (Math.PI / 2) * reverse * double;
      preTarget.x = (target.x * halfStepRatio) / double;
      break;
    case "E":
      target.y = (Math.PI / 2) * reverse * double;
      preTarget.y = (target.y * halfStepRatio) / double;
      break;
    case "S":
      target.z = (-Math.PI / 2) * reverse * double;
      preTarget.z = (target.z * halfStepRatio) / double;
      break;
  }

  return { target, preTarget };
};

export const rotateCubeAction = (
  get: () => IStore,
  rotateTo: THREE.Euler,
  move: ICubeMoves,
  cb: () => void,
  updateCubeArray?: boolean,
  cbElement?: (c: THREE.Group<THREE.Object3DEventMap>) => void
) => {
  const { objects } = get();
  const scene = objects.current.scene;
  const cubes = objects.current.cubes;

  const rotationGroup = new THREE.Object3D();
  scene.attach(rotationGroup);
  rotationGroup.quaternion.set(0, 0, 0, 1);

  const toRotateObjects: THREE.Group<THREE.Object3DEventMap>[] = [];

  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      // M/E/S 슬라이스 큐비 위치 매핑. 면 무브는 getCubePosBySide 위임.
      let pos: THREE.Vector3;
      if (move[0] === "M") {
        // 가운데 X 슬라이스: x=1, (y,z) 는 면 좌표에서 매핑.
        pos = new THREE.Vector3(1, y, x);
      } else if (move[0] === "E") {
        // 가운데 Y 슬라이스: y=1.
        pos = new THREE.Vector3(x, 1, y);
      } else if (move[0] === "S") {
        // 가운데 Z 슬라이스: z=1.
        pos = new THREE.Vector3(x, y, 1);
      } else {
        pos = getCubePosBySide(move[0] as ICubeSide, { x, y });
      }
      const idx = getIdxByPos(pos);
      const cube = cubes[idx];
      rotationGroup.attach(cube);
      toRotateObjects.push(cube);
      if (cbElement) cbElement(cube);
    }
  }

  // const { target, preTarget } = getRotation(move, rotationGroup.rotation);

  // const rotateTo = toPreRotate ? preTarget : target;

  gsap.to(rotationGroup.rotation, {
    x: rotateTo.x,
    y: rotateTo.y,
    z: rotateTo.z,
    duration: 0.4 * (move[1] === "2" ? 2 : 1),
    ease: "power1.inOut",
    onComplete: () => {
      toRotateObjects.forEach((c) => {
        scene.attach(c);

        if (updateCubeArray) {
          // Get the position in world coordinates
          const newPosition = new THREE.Vector3();
          const coreCube = c.children[0];
          coreCube.getWorldPosition(newPosition);

          const pos = new THREE.Vector3();
          pos.x = newPosition.x + CUBE_SIZE - CUBE_GAP;
          pos.y = newPosition.y + CUBE_SIZE - CUBE_GAP;
          pos.z = newPosition.z + CUBE_SIZE - CUBE_GAP;

          const idx = getIdxByPos(pos);
          const newIdx = Math.round(idx);

          cubes[newIdx] = c;
        }
      });
      scene.remove(rotationGroup);
      cb();
    },
  });
};
