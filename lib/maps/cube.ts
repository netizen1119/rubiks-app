import { ICubeSide } from "@/types/types";
import * as THREE from "three";

export const cube_sides: ICubeSide[] = ["U", "R", "F", "D", "L", "B"];
export const cubeSidesFull: Record<ICubeSide, string> = {
  U: "윗면",
  R: "오른면",
  F: "앞면",
  D: "아랫면",
  L: "왼면",
  B: "뒷면",
  X: "null",
};
export const cubeSidesNamedColors: Record<ICubeSide, string> = {
  U: "노랑",
  R: "초록",
  F: "빨강",
  D: "흰색",
  L: "파랑",
  B: "주황",
  X: "null",
};

export const cube_sides_scan: ICubeSide[] = ["F", "U", "R", "D", "L", "B"];
export const colorMapThree: Record<ICubeSide, THREE.Color> = {
  D: new THREE.Color("white"),
  U: new THREE.Color("yellow"),
  R: new THREE.Color("green"),
  L: new THREE.Color("blue"),
  F: new THREE.Color("red"),
  B: new THREE.Color("#f96706"),
  X: new THREE.Color("black"),
};
