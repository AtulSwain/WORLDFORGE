"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginSchema, signupSchema, passwordSchema, emailSchema } from "@/domain/schemas";
import { loginAction, requestResetAction, resetPasswordAction, signupAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const r = await loginAction({ ...values, next });
      if (!r.ok) return setError(r.error);
      router.push(r.data.next);
      router.refresh();
    }),
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-xs text-text-2 hover:text-gold">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof signupSchema>>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", password: "" } });
  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setError(null);
      const r = await signupAction(values);
      if (!r.ok) return setError(r.error);
      router.push(r.data.next);
      router.refresh();
    }),
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 10 characters.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-xs text-muted">
        By creating an account you agree to the draft <Link href="/terms" className="underline hover:text-text">Terms</Link> and{" "}
        <Link href="/privacy" className="underline hover:text-text">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailSchema })), defaultValues: { email: "" } });
  const onSubmit = form.handleSubmit(({ email }) =>
    start(async () => {
      setError(null);
      const r = await requestResetAction(email);
      if (!r.ok) return setError(r.error);
      setDone(true);
      setDevLink(r.data.devLink);
    }),
  );
  if (done) {
    return (
      <div className="flex flex-col gap-3 text-sm text-text-2">
        <p>If an account exists for that address, a reset link is on its way. It expires in one hour.</p>
        {devLink ? (
          <div className="rounded-md border border-violet/40 bg-violet/10 p-3 text-xs">
            <p className="mb-1 font-medium text-text">Development mode — no email provider configured</p>
            <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="break-all text-gold underline">
              Open the reset link
            </Link>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
  const form = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const onSubmit = form.handleSubmit(({ password }) =>
    start(async () => {
      setError(null);
      const r = await resetPasswordAction(token, password);
      if (!r.ok) return setError(r.error);
      router.push("/login?reset=1");
    }),
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="New password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
