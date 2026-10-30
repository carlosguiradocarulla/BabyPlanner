export type Section = "Inicio" | "Seguimiento" | "Tareas" | "Citas" | "Compras" | "Fotos" | "Familia" | "Notas" | "Historial" | "Datos privados";
export type ConceptionMethod = "unspecified" | "spontaneous" | "ivf";
export type AppointmentCertainty = "confirmed" | "orientative" | "pending_confirmation";
export type ClinicalEventType = "transfer" | "home_test" | "lab_result" | "ultrasound" | "symptom_note" | "clinic_instruction" | "other";
export type TaskCategory = "appointments_tests" | "admin" | "arrival" | "shopping";
export type Priority = "low" | "normal" | "high";

export type Pregnancy = { id: string; dueDate: string; dueDateConfirmed: boolean; conceptionMethod: ConceptionMethod; transferDate: string; embryoAgeDays: string; embryosTransferred: string; embryoQuality: string; clinicName: string; sacStatus: "unknown" | "single" | "multiple" };
export type Task = { id: string; title: string; category: TaskCategory; dueDate: string; priority: Priority; done: boolean; notes: string };
export type Appointment = { id: string; title: string; type: "visit" | "ultrasound" | "test" | "class" | "other"; startsAt: string; place: string; professional: string; notes: string; certainty: AppointmentCertainty };
export type ShoppingItem = { id: string; title: string; category: "baby" | "parent" | "home" | "other"; quantity: string; purchased: boolean; notes: string };
export type ClinicalEvent = { id: string; title: string; type: ClinicalEventType; occurredOn: string; resultValue: string; resultUnit: string; details: string };
export type ActivityEntry = { id: string; entityType: "task" | "appointment"; action: "created" | "updated" | "deleted"; entityTitle: string; changedAt: string };
export type Workspace = { pregnancy: Pregnancy | null; tasks: Task[]; appointments: Appointment[]; shopping: ShoppingItem[]; note: string; ivfHistory: string; events: ClinicalEvent[]; activity: ActivityEntry[] };

export const taskCategories: { value: TaskCategory; label: string }[] = [
  { value: "appointments_tests", label: "Citas y pruebas" }, { value: "admin", label: "Gestiones" },
  { value: "arrival", label: "Preparar la llegada" }, { value: "shopping", label: "Compras" },
];
export const categoryLabel = (category: TaskCategory) => taskCategories.find((item) => item.value === category)?.label ?? "Preparativos";
export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  if (!value) return "Sin fecha";
  const date = value.length > 10 ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-ES", options).format(date);
};
export function estimatedDueDate(transferDate: string, embryoAgeDays: string | number) {
  if (!transferDate || embryoAgeDays === "" || Number.isNaN(Number(embryoAgeDays))) return "";
  const transfer = new Date(`${transferDate.slice(0, 10)}T12:00:00`);
  const age = Number(embryoAgeDays);
  if (Number.isNaN(transfer.getTime()) || age < 0 || age > 10) return "";
  transfer.setDate(transfer.getDate() + 266 - age);
  return `${transfer.getFullYear()}-${String(transfer.getMonth() + 1).padStart(2, "0")}-${String(transfer.getDate()).padStart(2, "0")}`;
}
export function pregnancyProgress(dueDate: string, _confirmed: boolean, now = new Date()) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const elapsedDays = Math.floor((now.getTime() - due.getTime()) / 86400000) + 280;
  const safeDays = Math.max(0, Math.min(280, elapsedDays));
  return { week: Math.max(1, Math.floor(safeDays / 7)), day: safeDays % 7, trimester: safeDays < 98 ? 1 : safeDays < 196 ? 2 : 3, daysUntilDue: Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000)), percent: Math.round((safeDays / 280) * 100) };
}
