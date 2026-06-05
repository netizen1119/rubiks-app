"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useAppStore } from "@/lib/store/store";
import { solved_cube, getPosByIdx } from "@/lib/helpers/helper";
import { ICubeMoves } from "@/lib/moves/moves";
import { resetCubiesToSolved } from "../learn-method/reset-cubies";

// 무브를 고정 타이머가 아니라 "이전 무브 완료 후"에 디스패치한다(self-paced).
// 고정 간격은 환경이 느리면(예: 저사양·백그라운드 탭) 애니가 늦게 끝나 다음 무브가 회전
// 가드에 드롭되거나, 종료 검출이 애니 도중 실행돼 카운트가 틀린다. isDuringRotation 으로
// 실제 완료를 기다리면 속도와 무관하게 정확하다.
const GAP_MS = 90; // 무브 사이 시각적 박자
const POLL_MS = 40; // 완료 폴링 간격
const START_MS = 250; // 초기 solved 상태를 잠깐 보여준 뒤 시작

// 움직이는(센터·코어 제외) 조각 수 = 코너 8 + 모서리 12. 캡션 "나머지 M개" 계산용.
export const MOVABLE_PIECES = 20;

// 데모 종료 후 화면 큐브에서 위치·방향이 바뀐 조각만 골라낸다(교환자 마법 시각화용).
//
// 큐브 문자열(화면-슬롯 색)은 물리 회전과 어긋나므로 쓸 수 없다 — 3D 큐비를 직접 본다:
//  - cubes[slot] 은 회전 후 물리 슬롯 인덱스로 재배열됨(rotation-utils 가 cubes[newIdx]=c).
//  - 조각이 제집(orgIdx)을 떠났거나(slot≠home), 제집에 돌아왔어도 그룹 quaternion 이
//    비-identity(제자리 비틀림/뒤집힘, superflip 처럼)면 "바뀜".
// 센터·코어(extreme<2)는 색 변화가 없으니 제외.
const collectDisplacedCubies = () => {
  const { cubes } = useAppStore.getState().objects.current;
  const displaced: THREE.Object3D[] = [];
  cubes.forEach((g, slot) => {
    const home = g.userData.orgIdx as number;
    const p = getPosByIdx(home); // {0,1,2}³, 중심 = 1
    const extreme = (p.x !== 1 ? 1 : 0) + (p.y !== 1 ? 1 : 0) + (p.z !== 1 ? 1 : 0);
    if (extreme < 2) return; // 센터(1)·코어(0) 제외 — 모서리(2)·코너(3)만
    const moved = slot !== home; // 다른 슬롯으로 이동
    const turned = Math.abs(g.quaternion.w) <= 0.999; // 제자리 비틀림/뒤집힘 (≈ >2.5°)
    if (moved || turned) displaced.push(g);
  });
  return displaced;
};

export type DemoHighlight = { label: string; changed: number };

// 수학 학습 페이지의 인터랙티브 데모: 버튼을 누르면 공유 메인 큐브를 solved 로 되돌린 뒤
// 주어진 무브 시퀀스를 한 무브씩 애니메이션. 끝나면 실제로 바뀐 조각만 외곽선으로 강조.
// 시각 시연 전용이라 cube 문자열은 건드리지 않는다.
export const useCubeDemo = () => {
  const timers = useRef<number[]>([]);
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<DemoHighlight | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  }, []);

  // 외곽선 비우기 — selectedObjects 는 init 때 이 배열로 1회 바인딩되므로 반드시 in-place 변이.
  const clearOutline = useCallback(() => {
    useAppStore.getState().outlinedSelection.current.length = 0;
  }, []);

  // 공유 큐브를 정지·정렬·풀린 상태로 초기화 (회전 가드/스핀/강조 해제 포함).
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
    st.outlinedSelection.current.length = 0;
    useAppStore.setState({ isDuringRotation: false });
  }, []);

  const play = useCallback(
    (label: string, moves: ICubeMoves[]) => {
      clearTimers();
      resetCube();
      setHighlight(null);
      setPlayingLabel(label);

      const push = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

      // 한 무브가 정착(isDuringRotation=false)할 때까지 폴링 후 다음으로. 속도 무관·드롭 불가.
      const step = (i: number) => {
        if (i >= moves.length) {
          // 마지막 무브까지 정착 — 바뀐 조각 강조 + 라벨 해제.
          setPlayingLabel(null);
          const displaced = collectDisplacedCubies();
          const sel = useAppStore.getState().outlinedSelection.current;
          sel.length = 0;
          displaced.forEach((g) => sel.push(g));
          setHighlight({ label, changed: displaced.length });
          return;
        }
        useAppStore.getState().rotateCube(moves[i]); // isDuringRotation 동기적으로 true
        const waitDone = () => {
          if (useAppStore.getState().isDuringRotation) push(waitDone, POLL_MS);
          else push(() => step(i + 1), GAP_MS);
        };
        push(waitDone, POLL_MS);
      };

      push(() => step(0), START_MS);
    },
    [clearTimers, resetCube]
  );

  // 언마운트: 타이머 정리 + 강조 해제 + 풀린 상태 복원 (홈 복귀 시 잔여 시연/외곽선 차단).
  useEffect(() => {
    return () => {
      clearTimers();
      clearOutline();
      resetCube();
    };
  }, [clearTimers, clearOutline, resetCube]);

  return { play, playingLabel, highlight };
};
