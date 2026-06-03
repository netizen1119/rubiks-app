import * as THREE from "three";
import gsap from "gsap";
import { useAppStore } from "@/lib/store/store";

// 큐비를 원본 격자 위치/방향(solved 배치)으로 복원. scramble-cube 의 resetCubeToInitial 과
// 동일한 orgIdx 기반 복원. 색 페인트는 호출부가 담당.
export const resetCubiesToSolved = () => {
  const state = useAppStore.getState();
  gsap.killTweensOf(state.objects.current.rubiksGroup.rotation);
  state.objects.current.rubiksGroup.rotation.set(0, 0, 0);

  const rubiksGroup = state.objects.current.rubiksGroup;
  const allCubies: THREE.Group[] = [];
  state.objects.current.scene.traverse((obj) => {
    if (obj instanceof THREE.Group && (obj.userData as { orgIdx?: number }).orgIdx !== undefined) {
      allCubies.push(obj);
    }
  });
  rubiksGroup.traverse((obj) => {
    if (
      obj instanceof THREE.Group &&
      (obj.userData as { orgIdx?: number }).orgIdx !== undefined &&
      !allCubies.includes(obj)
    ) {
      allCubies.push(obj);
    }
  });
  const newCubesArray: THREE.Group[] = new Array(27);
  for (const g of allCubies) {
    const idx = (g.userData as { orgIdx: number }).orgIdx;
    gsap.killTweensOf(g.position);
    gsap.killTweensOf(g.rotation);
    gsap.killTweensOf(g.quaternion);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.quaternion.set(0, 0, 0, 1);
    g.scale.set(1, 1, 1);
    rubiksGroup.add(g);
    newCubesArray[idx] = g;
  }
  state.objects.current.cubes = newCubesArray;
};
