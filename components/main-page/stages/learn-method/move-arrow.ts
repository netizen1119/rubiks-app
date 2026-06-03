import * as THREE from "three";

// 다음 무브 힌트용 3D 곡선 화살표. 돌려야 할 면 위에 회전 방향을 호(arc)+화살촉으로 표시.
// 좌표계(orientation-labels 와 동일): U=+y, D=-y, R=+x, L=-x, F=+z, B=-z. 큐브 반경 ~1.5.
//
// 표기 규약: 면 무브(U/D/F/B/L/R)는 그 면을 바깥에서 봤을 때 시계방향. ' 는 반시계.
// 오른손 좌표에서 면 법선 n 기준 각도 증가 = 바깥에서 볼 때 반시계(CCW).
// 따라서 비프라임=각도 감소, 프라임=각도 증가로 호를 그린다.

const FACE_NORMAL: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

const ARC_PLANE_DIST = 1.62; // 면 바깥(반경 1.5)으로 살짝 띄움
const ARC_RADIUS = 0.82;
const ARC_SPAN = Math.PI * 1.4; // 호 길이 (~252°)
const SAMPLES = 40;
const COLOR = 0x00e5ff; // 밝은 시안 (큐브 색과 대비)

// 무브 → 힌트 화살표 Object3D. 면 무브가 아니면 null (LBL 출력은 면 무브만).
export const buildMoveArrow = (move: string): THREE.Group | null => {
  const face = move[0];
  const n = FACE_NORMAL[face];
  if (!n) return null;

  const prime = move.includes("'");

  // 면 평면의 두 직교 기저 u,v. (u,v,n) 우수 → 각도 증가 = +n 쪽에서 볼 때 CCW.
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const u = ref.clone().sub(n.clone().multiplyScalar(ref.dot(n))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const center = n.clone().multiplyScalar(ARC_PLANE_DIST);

  const at = (a: number) =>
    center
      .clone()
      .add(u.clone().multiplyScalar(Math.cos(a) * ARC_RADIUS))
      .add(v.clone().multiplyScalar(Math.sin(a) * ARC_RADIUS));

  // 진행 각도 목록(이동 순서대로). 비프라임=감소, 프라임=증가.
  const a0 = -ARC_SPAN / 2;
  const a1 = ARC_SPAN / 2;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const tt = i / SAMPLES;
    const a = prime ? a0 + (a1 - a0) * tt : a1 + (a0 - a1) * tt;
    pts.push(at(a));
  }

  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: COLOR });
  mat.depthTest = false; // 큐브에 가려지지 않게 항상 보이도록
  mat.transparent = true;

  // 호 = 튜브
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, SAMPLES, 0.075, 10, false);
  const tubeMesh = new THREE.Mesh(tube, mat);
  tubeMesh.renderOrder = 999;
  group.add(tubeMesh);

  // 화살촉 = 콘 (마지막 점, 진행 접선 방향)
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dir = tip.clone().sub(prev).normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 14), mat);
  cone.renderOrder = 999;
  cone.position.copy(tip);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.add(cone);

  group.renderOrder = 999;
  return group;
};

// 그룹과 자식 geometry 정리.
export const disposeArrow = (group: THREE.Group | null) => {
  if (!group) return;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  (group.children[0] as THREE.Mesh)?.material &&
    ((group.children[0] as THREE.Mesh).material as THREE.Material).dispose();
};
