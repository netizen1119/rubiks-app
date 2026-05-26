import { create } from "zustand";
import { ICubeSide, IScanResult } from "../../types/types";
import { genEmptyThreeCube } from "@/components/cube-visualization/gen-empty-cube";
import { createRef } from "react";
import * as THREE from "three";
import { ICubeMoves } from "../moves/moves";
import { LBLStage } from "../solver/lbl-solver";
import { updateCube } from "./update-cube";
import { toggleCubeRotating } from "./toggle-rotate";
import { updateCameraPos } from "./update-camera";
import { hideCubeStickers } from "./hide-stickers";
import initSolveCube from "./init-solve-cube";
import nextCubeSolveStep from "./next-solve-step";
import prevCubeSolveStep from "./prev-solve-step";
import switchSolveMode from "./switch-solve-mode";
import updateCubeScan from "./update-cube-scan";
import { rotateCube, rotateCube2Part } from "./rotate-cube";
import updateCubeSide from "./update-cube-side";

const getObjectsDefault = () => {
  const objects = createRef() as React.MutableRefObject<ReturnType<typeof genEmptyThreeCube> & { scene: THREE.Scene }>;
  objects.current = { ...genEmptyThreeCube(), scene: new THREE.Scene() };
  return objects;
};
const getCameraDefault = () => {
  const camera = createRef() as React.MutableRefObject<THREE.PerspectiveCamera>;
  camera.current = new THREE.PerspectiveCamera(40, 500 / 500);
  return camera;
};
const getOutlinedDefault = () => {
  const highlighted = createRef() as React.MutableRefObject<any[]>;
  highlighted.current = [];
  return highlighted;
};
const getMainCanvasDefault = () => {
  const c = createRef() as React.MutableRefObject<HTMLCanvasElement | null>;
  c.current = null;
  return c;
};
type OrbitLike = {
  enabled: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};
const getOrbitControlsDefault = () => {
  const c = createRef() as React.MutableRefObject<OrbitLike | null>;
  c.current = null;
  return c;
};

const appStages = ["homepage", "deviceselect", "scan", "manual-input", "solve", "tracked-solve"] as const;
export type IAppStages = (typeof appStages)[number];

export type Language = "ko" | "en";

const defaultStore = {
  // 화면 표시 언어. 초기값은 ko (provider 가 마운트 시 navigator/localStorage 로 갱신).
  language: "ko" as Language,
  scanSize: 170,
  isScanRefreshing: false,
  isScanRefreshGlow: false,
  scanRefreshInterval: 550,
  highlight: undefined as ICubeSide | undefined,
  cube: Array(54).fill("X").join(""),
  currentScanFace: -1 as number | null,
  // 웹캠을 거울(셀카)처럼 좌우 반전 표시. 미리보기 flip + 스캔 샘플링 X좌표 재매핑(reverseCord)을
  // 함께 적용해 거울로 보이면서도 면 인식은 정확하게 유지된다.
  scanReversed: true,
  deviceId: "",
  previewReversed: false,
  devScanPreviewShow: true,
  objects: getObjectsDefault(),
  ghostStickersTimeline: createRef() as React.MutableRefObject<gsap.core.Timeline>,
  cubeSpinningTimeline: createRef() as React.MutableRefObject<gsap.core.Timeline | null>,
  camera: getCameraDefault(),
  lastScanResult: [] as Array<IScanResult[number] & { id: number }>,
  nextCubeRotation: null as null | THREE.Euler,
  cubeSolution: [] as string[],
  cubeSolutionStep: null as number | null,
  solveStages: [] as LBLStage[],
  currentStageIndex: 0,
  // 풀이 모드: "learn" = 단계별 LBL(이해 학습), "fast" = Thistlethwaite 최단 풀이.
  // 홈에서 선택, init-solve-cube 가 분기. updateStore 로 변경 가능.
  solveMode: "learn" as "learn" | "fast",
  // 카메라로 큐브를 실시간 추적하며 풀이하는 모드. true 면 scan/manual-input 완료 시
  // "solve" 대신 "tracked-solve" 로 라우팅. 알고리즘은 solveMode("learn") 그대로 사용.
  trackedSolve: false,
  // solve 연습 모드: true 면 사용자가 직접 드래그로 다음 무브를 맞춰야 진행(능동 학습).
  solvePractice: false,
  isDuringRotation: false,
  currentAppStage: "homepage" as IAppStages,
  cubeTop: 0,
  // cubeRight: 0,
  cubeScale: 0.5,
  cubeLeft: 0,
  outlinedSelection: getOutlinedDefault(),
  mainCanvas: getMainCanvasDefault(),
  orbitControls: getOrbitControlsDefault(),
  // 스캔 단계의 카메라 스트림 — 단계를 떠날 때 트랙을 정지해 카메라를 끄기 위해 보관.
  scanStream: null as MediaStream | null,
  // 스캔된 각 면의 9칸(캡처 방향 그대로, 센터=면 색). 풀기 시 auto-orient 가 회전을 맞춰
  // 풀 수 있는 배치를 자동 산출 → 사용자는 면 방향을 신경 쓸 필요 없음.
  scannedFaces: {} as Partial<Record<ICubeSide, ICubeSide[]>>,
};

type IDefaultData = typeof defaultStore;

export interface IStore extends IDefaultData {
  updateStore: (payload: Partial<IStore>) => void;
  updateCube: (cube: string, setVisible?: boolean) => void;
  updateCubeSide: (side: ICubeSide, colors: ICubeSide[], glow?: boolean) => void;
  updateCubeScan: (scan: IScanResult) => void;
  rotateCube: (move: ICubeMoves) => void;
  rotateCube2Part: (move: ICubeMoves) => void;
  initSolveCube: () => void;
  nextCubeSolveStep: () => void;
  prevCubeSolveStep: () => void;
  switchSolveMode: (mode: "learn" | "fast") => void;
  toggleCubeRotating: () => void;
  updateCameraPos: (pos: [number, number, number]) => void;
  hideCubeStickers: () => void;
}

export type IStoreFn = { get: () => IStore; set: (payload: Partial<IStore>) => void };

export const useAppStore = create<IStore>()((set, get) => ({
  ...defaultStore,
  updateStore: (payload) => set(payload),
  initSolveCube: () => initSolveCube({ get, set }),
  hideCubeStickers: () => hideCubeStickers({ get, set }),
  updateCameraPos: (pos) => updateCameraPos({ get, set, cameraPos: pos }),
  nextCubeSolveStep: () => nextCubeSolveStep({ get, set }),
  prevCubeSolveStep: () => prevCubeSolveStep({ get, set }),
  switchSolveMode: (mode) => switchSolveMode({ get, set }, mode),
  toggleCubeRotating: () => toggleCubeRotating({ get, set }),
  updateCubeScan: (scan) => updateCubeScan({ get, set, scan }),
  rotateCube: (move) => rotateCube({ get, set, move }),
  rotateCube2Part: (move) => rotateCube2Part({ get, set, move }),
  updateCubeSide: (side, colors) => updateCubeSide({ get, set, side, colors }),
  updateCube: (cube, setVisible) => updateCube({ get, set, cube, setVisible }),
}));
