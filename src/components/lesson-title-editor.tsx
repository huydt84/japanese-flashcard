"use client";

import { useActionState, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { initialActionState, type ActionState, type StatefulAction } from "@/lib/action-state";

type LessonTitleEditorProps = {
  title: string;
  action: StatefulAction;
};

export function LessonTitleEditor({ title: initialTitle, action }: LessonTitleEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.status === "success") {
      setTitle(String(formData.get("title")).trim());
      setEditing(false);
    }
    return next;
  }, initialActionState);

  if (!editing) {
    return (
      <h1 className="min-w-0 break-words text-4xl font-bold tracking-[-.035em] sm:text-5xl">
        <button
          type="button"
          className="group inline-flex min-h-11 max-w-full cursor-text items-center gap-2 text-left hover:text-brand focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => setEditing(true)}
          aria-label={`Đổi tên buổi học: ${title}`}
          title="Nhấn để đổi tên buổi học"
        >
          <span className="min-w-0 break-words">{title}</span>
          <PencilSimple size={20} className="shrink-0 text-muted group-hover:text-brand" aria-hidden="true" />
        </button>
      </h1>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="sr-only">{title}</h1>
      <form action={formAction} className="flex flex-wrap items-center gap-2" aria-busy={pending}>
        <label className="sr-only" htmlFor="lesson-title">Tên buổi học</label>
        <input
          autoFocus
          className="field min-w-0 flex-1 text-2xl font-bold sm:text-4xl"
          id="lesson-title"
          name="title"
          required
          minLength={2}
          maxLength={100}
          defaultValue={title}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
        />
        <button type="submit" className="button-primary" disabled={pending}>{pending ? "Đang lưu" : "Lưu"}</button>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => setEditing(false)}>Hủy</button>
      </form>
      {state.status === "error" ? <p role="alert" className="mt-2 text-sm font-semibold text-wrong">{state.message}</p> : null}
    </div>
  );
}
