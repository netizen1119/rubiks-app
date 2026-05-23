"use client";

import { colorMapThree } from "@/lib/maps/cube";
import { ICubeSide } from "@/types/types";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const ScanInstructionsInfo = () => {
  const t = useTranslations("deviceSelect");
  return (
    <motion.div
      initial={{ x: -200, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -200, opacity: 0 }}
      transition={{ ease: "easeInOut" }}
    >
      <h1 className="font-extrabold tracking-tight text-[2.5rem] leading-[3rem]">{t("instructionsHeading")}</h1>
      <span className="block text-xs text-muted-foreground max-w-[12rem] tracking-tight leading-[18px] mt-3 -mb-5">
        <ol className="list-decimal ml-[2ch] flex flex-col gap-[0.12rem]">
          <li>
            {t("instr1Before")}
            <TextColor color="F">{t("instr1Red")}</TextColor>
            {t("instr1After")}
          </li>
          <li>
            <span>{t("instr2Heading")}</span>
            <ul className="list-disc ml-[1ch]">
              <li>
                <TextColor color="L">{t("instr2LeftLabel")}</TextColor>
                {t("instr2LeftBefore")}
                <TextColor color="L">{t("instr2LeftColor")}</TextColor>
                {t("instr2LeftAfter")}
              </li>
              <li>
                <TextColor color="R">{t("instr2RightLabel")}</TextColor>
                {t("instr2RightBefore")}
                <TextColor color="R">{t("instr2RightColor")}</TextColor>
                {t("instr2RightAfter")}
              </li>
              <li>
                <TextColor color="U">{t("instr2TopLabel")}</TextColor>
                {t("instr2TopBefore")}
                <TextColor color="U">{t("instr2TopColor")}</TextColor>
                {t("instr2TopAfter")}
              </li>
              <li>
                <TextColor color="D">{t("instr2BottomLabel")}</TextColor>
                {t("instr2BottomBefore")}
                <TextColor color="D">{t("instr2BottomColor")}</TextColor>
                {t("instr2BottomAfter")}
              </li>
            </ul>
          </li>
          <li>{t("instr3")}</li>
        </ol>
      </span>
    </motion.div>
  );
};

const TextColor = ({ color, children }: { color: ICubeSide; children: React.ReactNode }) => (
  <span style={{ color: `#${colorMapThree[color].getHexString()}` }}>{children}</span>
);

export default ScanInstructionsInfo;
