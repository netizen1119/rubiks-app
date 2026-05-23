export type MoveDescriptionKey = {
  faceKey: "R" | "L" | "U" | "D" | "F" | "B" | "M" | "E" | "S";
  dirKey: "cw" | "ccw" | "double" | "M_cw" | "M_ccw" | "E_cw" | "E_ccw" | "S_cw" | "S_ccw";
};

const FACE_MOVES: MoveDescriptionKey["faceKey"][] = ["R", "L", "U", "D", "F", "B"];

export const moveDescriptionKey = (move: string): MoveDescriptionKey | null => {
  const face = move[0] as MoveDescriptionKey["faceKey"];
  const isDouble = move.endsWith("2");
  const isPrime = move.endsWith("'");
  if (FACE_MOVES.includes(face)) {
    if (isDouble) return { faceKey: face, dirKey: "double" };
    return { faceKey: face, dirKey: isPrime ? "ccw" : "cw" };
  }
  if (face === "M" || face === "E" || face === "S") {
    if (isDouble) return { faceKey: face, dirKey: "double" };
    return { faceKey: face, dirKey: isPrime ? `${face}_ccw` as MoveDescriptionKey["dirKey"] : `${face}_cw` as MoveDescriptionKey["dirKey"] };
  }
  return null;
};
