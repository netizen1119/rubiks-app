import { useEffect, useRef } from "react";
import { useAppStore } from "./store/store";
import { solved_cube } from "@/lib/helpers/helper";

const useInitApp = () => {
  const { toggleCubeRotating, updateCube, updateStore } = useAppStore();

  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    // updateStore({ cubeScale: 200 / window.innerWidth });

    updateCube(solved_cube);
    setTimeout(() => {
      // 타이머 발화 시점에 사용자가 이미 진행 단계로 이동했다면 자동 회전을 시작하지
      // 않는다. 그렇지 않으면 solve 도중 rubiksGroup 회전과 레이어 회전이 겹쳐
      // 큐비가 어긋남.
      const stage = useAppStore.getState().currentAppStage;
      if (stage === "homepage" || stage === "deviceselect") {
        toggleCubeRotating();
      }
    }, 2200);
  }, []);
};

export default useInitApp;
