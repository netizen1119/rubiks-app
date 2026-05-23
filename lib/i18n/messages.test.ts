// i18n 메시지 키 일관성 가드.
// ko/en 메시지가 같은 키 트리를 유지하고, 같은 키의 placeholder({foo})까지 일치하는지 검증.
// 키 누락은 t() 시 화면에 키 이름이 그대로 노출되어 즉시 UX 깨짐 → 빌드 게이트로 막는다.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ko from "../../messages/ko.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

type Messages = Record<string, unknown>;

const flatten = (obj: Messages, prefix = ""): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [kk, vv] of flatten(v as Messages, path)) out.set(kk, vv);
    } else if (typeof v === "string") {
      out.set(path, v);
    } else {
      throw new Error(`Unexpected value type at ${path}: ${typeof v}`);
    }
  }
  return out;
};

// "{name}" 형태의 placeholder만 추출 (next-intl 단순 변수 치환).
const extractPlaceholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n messages", () => {
  const koMap = flatten(ko as Messages);
  const enMap = flatten(en as Messages);

  it("ko/en have identical key sets", () => {
    const koOnly = [...koMap.keys()].filter((k) => !enMap.has(k));
    const enOnly = [...enMap.keys()].filter((k) => !koMap.has(k));
    assert.deepEqual(koOnly, [], `Keys present only in ko: ${koOnly.join(", ")}`);
    assert.deepEqual(enOnly, [], `Keys present only in en: ${enOnly.join(", ")}`);
  });

  it("ko/en placeholders match per key", () => {
    const mismatches: string[] = [];
    for (const [key, koVal] of koMap) {
      const enVal = enMap.get(key)!;
      const koPh = extractPlaceholders(koVal);
      const enPh = extractPlaceholders(enVal);
      if (koPh.join(",") !== enPh.join(",")) {
        mismatches.push(`${key}: ko[${koPh.join(",")}] vs en[${enPh.join(",")}]`);
      }
    }
    assert.deepEqual(mismatches, [], `Placeholder mismatches:\n  ${mismatches.join("\n  ")}`);
  });

  it("no unexpected empty values (allow split-string prefix/suffix and headingLine3)", () => {
    // 어순 차이 흡수용 prefix/suffix/before/after 키는 한쪽 언어에서 비어 있을 수 있음 (의도).
    // home.headingLine3 은 ko 가 2줄 헤딩이라 의도적으로 빈 칸.
    const isAllowedEmpty = (key: string) =>
      key === "home.headingLine3" || /(Prefix|Suffix|Before|After)$/.test(key);
    const empties: string[] = [];
    for (const [key, val] of koMap) if (!val && !isAllowedEmpty(key)) empties.push(`ko:${key}`);
    for (const [key, val] of enMap) if (!val && !isAllowedEmpty(key)) empties.push(`en:${key}`);
    assert.deepEqual(empties, [], `Empty message values: ${empties.join(", ")}`);
  });
});
