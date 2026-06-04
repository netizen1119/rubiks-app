"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useAppStore } from "@/lib/store/store";
import { solved_cube } from "@/lib/helpers/helper";
import { ICubeMoves } from "@/lib/moves/moves";
import { resetCubiesToSolved } from "../learn-method/reset-cubies";

// 무브 간 간격 (회전 ~0.4s + 버퍼). learn-demo 와 동일 박자.
const TICK_MS = 480;

// 수학 학습 페이지의 인터랙티브 데모: 버튼을 누르면 공유 메인 큐브를 solved 로 되돌린 뒤
// 주어진 무브 시퀀스를 한 무브씩 애니메이션. 시각 시연 전용이라 cube 문자열은 건드리지 않는다.
export const useCubeDemo = () => {
  const timers = useRef<number[]>([]);
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  }, []);

  // 공유 큐브를 정지·정렬·풀린 상태로 초기화 (회전 가드/스핀 해제 포함).
  const resetCube = useCallback(() => {
    const st = useAppStore.getState();
    if (st.cubeSpinningTimeline.current) {
      st.cubeSpinningTimeline.current.kill();
      st.cubeSpinningTimeline.current = null;
    }
    gsap.killTweensOf(st.objects.current.rubiksGroup.rotation);
    st.objects.current.rubiksGroup.rotation.set(0, 0, 0);
    resetCubiesToSolved();
    st.updateCube(solved_cube, true);
    useAppStore.setState({ isDuringRotation: false });
  }, []);

  const play = useCallback(
    (label: string, moves: ICubeMoves[]) => {
      clearTimers();
      resetCube();
      setPlayingLabel(label);

      let at = 250; // 초기 상태를 잠깐 보여준 뒤 시작.
      moves.forEach((m) => {
        timers.current.push(window.setTimeout(() => useAppStore.getState().rotateCube(m), at));
        at += TICK_MS;
      });
      // 마지막 무브 종료 후 라벨 해제.
      timers.current.push(window.setTimeout(() => setPlayingLabel(null), at + 200));
    },
    [clearTimers, resetCube]
  );

  // 언마운트: 타이머 정리 + 풀린 상태 복원 (홈 복귀 시 잔여 시연 차단).
  useEffect(() => {
    return () => {
      clearTimers();
      resetCube();
    };
  }, [clearTimers, resetCube]);

  return { play, playingLabel };
};
