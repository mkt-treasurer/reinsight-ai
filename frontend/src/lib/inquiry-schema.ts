import { z } from "zod";

export const COMPANY_TYPES = [
  { value: "broker", label: "보험중개사" },
  { value: "agency", label: "법인보험대리점" },
  { value: "insurer", label: "보험사 / 재보험사" },
  { value: "finance", label: "금융기관" },
  { value: "other", label: "기타" },
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number]["value"];

export const inquirySchema = z.object({
  company: z
    .string()
    .min(1, "회사명을 입력해 주세요.")
    .max(120, "회사명이 너무 깁니다."),
  name: z
    .string()
    .min(1, "담당자 이름을 입력해 주세요.")
    .max(60, "이름이 너무 깁니다."),
  title: z.string().max(80, "직책이 너무 깁니다.").optional().or(z.literal("")),
  email: z.string().min(1, "이메일을 입력해 주세요.").email("올바른 이메일 주소가 아닙니다."),
  phone: z.string().max(40, "연락처가 너무 깁니다.").optional().or(z.literal("")),
  companyType: z.enum(COMPANY_TYPES.map((c) => c.value) as [CompanyType, ...CompanyType[]], {
    message: "회사 유형을 선택해 주세요.",
  }),
  message: z
    .string()
    .min(10, "문의 내용을 10자 이상 작성해 주세요.")
    .max(3000, "문의 내용이 너무 깁니다. 3,000자 이내로 작성해 주세요."),
  consent: z
    .boolean()
    .refine((v) => v === true, "개인정보 수집·이용에 동의해 주세요."),
});

export type InquiryInput = z.input<typeof inquirySchema>;
export type Inquiry = z.output<typeof inquirySchema>;

export function companyTypeLabel(value: string): string {
  return COMPANY_TYPES.find((c) => c.value === value)?.label ?? value;
}
