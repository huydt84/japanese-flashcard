"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import {
  initialActionState,
  type StatefulAction,
} from "@/lib/action-state";

type ActionFormProps = {
  action: StatefulAction;
  children?: React.ReactNode;
  className?: string;
  submitClassName?: string;
  submitLabel: string;
  pendingLabel: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  feedbackClassName?: string;
};

export function ActionForm({
  action,
  children,
  className,
  submitClassName = "button-primary",
  submitLabel,
  pendingLabel,
  resetOnSuccess = false,
  confirmMessage,
  icon,
  disabled = false,
  feedbackClassName = "",
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && resetOnSuccess) {
      formRef.current?.reset();
    }
  }, [resetOnSuccess, state.revision, state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      aria-busy={pending}
    >
      {children}
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`text-sm font-semibold ${feedbackClassName} ${
            state.status === "error" ? "text-wrong" : "text-correct"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        className={submitClassName}
      >
        {pending ? <CircleNotch size={18} className="animate-spin" aria-hidden="true" /> : icon}
        <span>{pending ? pendingLabel : submitLabel}</span>
      </button>
    </form>
  );
}
