"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { sendInquiry } from "@/app/actions/send-inquiry";
import {
  inquirySchema,
  COMPANY_TYPES,
  companyTypeLabel,
  type InquiryInput,
  type Inquiry,
} from "@/lib/inquiry-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type FormValues = InquiryInput;

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, Inquiry>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      company: "",
      name: "",
      title: "",
      email: "",
      phone: "",
      companyType: "broker",
      message: "",
      consent: false,
    },
  });

  const companyType = watch("companyType");
  const consent = watch("consent");

  function onSubmit(values: Inquiry) {
    startTransition(async () => {
      const payload: InquiryInput = {
        company: values.company,
        name: values.name,
        title: values.title ?? "",
        email: values.email,
        phone: values.phone ?? "",
        companyType: values.companyType,
        message: values.message,
        consent: values.consent,
      };
      const result = await sendInquiry(payload);
      if (result.ok) {
        toast.success("문의가 정상 접수되었습니다.", {
          description: "담당자가 1영업일 내 이메일로 회신 드립니다.",
        });
        setSubmitted(true);
        reset();
      } else {
        if (result.fieldErrors) {
          for (const [key, msg] of Object.entries(result.fieldErrors)) {
            setError(key as keyof FormValues, { message: msg });
          }
        }
        toast.error("문의 접수 실패", { description: result.error });
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-navy">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy/10 ring-1 ring-navy/25">
          <CheckCircle2 className="h-7 w-7 text-navy" aria-hidden />
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-tight text-navy-deep">
          문의가 정상 접수되었습니다
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          담당자가 영업일 기준 1일 이내로 회신 드릴 예정입니다. <br />
          긴급한 문의는{" "}
          <a className="text-navy hover:underline" href="mailto:henry@treasurer.co.kr">
            henry@treasurer.co.kr
          </a>
          으로 직접 연락 주세요.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setSubmitted(false)}
        >
          다른 문의 작성하기
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-2xl border border-border bg-card p-6 shadow-navy sm:p-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="회사명" required error={errors.company?.message}>
          <Input
            placeholder="(주)트레져러"
            autoComplete="organization"
            aria-invalid={!!errors.company}
            {...register("company")}
          />
        </Field>

        <Field label="회사 유형" required error={errors.companyType?.message}>
          <Select
            value={companyType}
            onValueChange={(v) =>
              setValue("companyType", v as InquiryInput["companyType"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.companyType}>
              <span
                className={
                  companyType ? "flex-1 text-left" : "flex-1 text-left text-muted-foreground"
                }
              >
                {companyType ? companyTypeLabel(companyType) : "선택해 주세요"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="담당자 이름" required error={errors.name?.message}>
          <Input
            placeholder="홍길동"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>

        <Field label="직책" error={errors.title?.message}>
          <Input
            placeholder="이사 / 팀장 등"
            autoComplete="organization-title"
            {...register("title")}
          />
        </Field>

        <Field label="이메일" required error={errors.email?.message}>
          <Input
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field label="연락처" error={errors.phone?.message}>
          <Input
            type="tel"
            placeholder="010-0000-0000"
            autoComplete="tel"
            {...register("phone")}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="문의 내용" required error={errors.message?.message}>
          <Textarea
            rows={6}
            placeholder="도입 검토 배경, 관심 기능, 예상 사용자 규모, 일정 등 간단히 적어 주세요."
            aria-invalid={!!errors.message}
            {...register("message")}
          />
        </Field>
      </div>

      <div className="mt-6 flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(v) => setValue("consent", v === true, { shouldValidate: true })}
          aria-invalid={!!errors.consent}
        />
        <div className="grid gap-1">
          <Label htmlFor="consent" className="text-sm leading-relaxed text-muted-foreground">
            개인정보(회사명·이름·이메일·연락처·문의 내용) 수집 및 이용에 동의합니다. <br />
            <span className="text-[12px] text-muted-foreground/80">
              수집 목적: 문의 응답 및 서비스 안내 · 보관 기간: 문의 처리 완료 후 1년
            </span>
          </Label>
          {errors.consent?.message && (
            <p className="text-xs text-destructive">{errors.consent.message}</p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          제출하시면 영업일 기준 1일 이내 회신 드립니다.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="h-11 px-6 bg-navy text-white hover:bg-navy-deep shadow-navy"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> 전송 중...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> 도입 문의 보내기
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-navy-deep">
        {label}
        {required && <span className="ml-1 text-navy">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
