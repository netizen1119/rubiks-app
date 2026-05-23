import { getRequestConfig } from "next-intl/server";

// SSR/SSG 기본 locale. 클라이언트에서 NextIntlClientProvider 가 우선 적용된다.
export default getRequestConfig(async () => ({
  locale: "ko",
  timeZone: "Asia/Seoul",
  messages: (await import("../../messages/ko.json")).default,
}));
