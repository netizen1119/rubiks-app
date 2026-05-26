// 카메라 프레임에서 6면 중심을 식별해 큐브 좌표계(3축)를 결정한다.
// 면 무브는 중심을 평면 위에서 회전만 시키므로, 6개 중심 색은 영구적 anchor 역할을 한다.
// 3개 이상의 중심이 보이면 큐브 축이 유일하게 결정된다.
// PoC-1 에서 실제 검출/추정을 구현. 현 시점은 타입 스텁.

export type CubeAxis = [number, number, number];

export type CubePose = {
  axisX: CubeAxis;
  axisY: CubeAxis;
  axisZ: CubeAxis;
  centerCount: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  confidence: number;
};

/**
 * 단일 프레임에서 큐브 pose 를 추정한다.
 * @returns 중심을 3개 이상 못 찾았거나 신뢰도가 낮으면 null.
 */
export const detectCubePose = (_frame: ImageData): CubePose | null => {
  return null;
};
