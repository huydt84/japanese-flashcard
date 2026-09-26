export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  revision: number;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
  revision: 0,
};

export type StatefulAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;
