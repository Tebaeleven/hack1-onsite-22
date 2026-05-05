"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { AuthFormState } from "../actions";

type Props = {
  action: (
    state: AuthFormState | undefined,
    formData: FormData
  ) => Promise<AuthFormState>;
  submitLabel: string;
};

export function AuthForm({ action, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState<
    AuthFormState | undefined,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
          <Input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">パスワード</FieldLabel>
          <Input
            id="password"
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="current-password"
          />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        {isPending ? "送信中..." : submitLabel}
      </Button>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.message ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
