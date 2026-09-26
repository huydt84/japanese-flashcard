"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";

export function PendingButton({
  children,
  pendingLabel,
  className,
  disabled = false,
  pressed,
  ariaLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  pressed?: boolean;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={className}
    >
      {pending ? (
        <>
          <CircleNotch size={18} className="animate-spin" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
