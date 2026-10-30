"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Activity, ArrowDown, ArrowLeft, ArrowRight, Baby, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, Heart, Home, Images, Leaf, ListTodo, LockKeyhole, LogOut, Menu, Pencil, Plus, ShoppingBag, Sparkles, StickyNote, Trash2, Users, X } from "lucide-react";
import { FamilyAccessScreen } from "@/components/FamilyAccessScreen";
import { PregnancyTrackingView } from "@/components/PregnancyTrackingView";
import { PhotoGallery } from "@/components/PhotoGallery";
import { demoWorkspace, stageGuides } from "@/lib/demo-data";
import { ActivityEntry, Appointment, categoryLabel, ClinicalEvent, ClinicalEventType, ConceptionMethod, dateLabel, estimatedDueDate, Priority, Pregnancy, pregnancyProgress, Section, ShoppingItem, Task, TaskCategory, taskCategories, Workspace } from "@/lib/models";
import { supabase } from "@/lib/supabase";

type EditorKind = "task" | "appointment" | "shopping" | "event";
type EditableItem = Task | Appointment | ShoppingItem | ClinicalEvent;
type EditorState = { kind: EditorKind; item?: EditableItem } | null;
type Row = Record<string, unknown>;
type SuggestedMilestone = { title: string; detail: string; startDate: string; endDate: string; startWeek?: number; startDay?: number; endWeek?: number; endDay?: number };
const navItems: { label: Section; icon: typeof Home }[] = [
  { label: "Inicio", icon: Home }, { label: "Seguimiento", icon: Activity }, { label: "Tareas", icon: ListTodo },
  { label: "Citas", icon: CalendarDays }, { label: "Compras", icon: ShoppingBag }, { label: "Fotos", icon: Images }, { label: "Familia", icon: Users }, { label: "Notas", icon: StickyNote }, { label: "Historial", icon: ClipboardList }, { label: "Datos privados", icon: LockKeyhole },
];
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const labelForAppointment = (type: Appointment["type"]) => ({ visit: "Visita", ultrasound: "Ecografía", test: "Prueba", class: "Clase", other: "Otro" })[type];
const appointmentTypes: { value: Appointment["type"]; label: string }[] = [
  { value: "visit", label: "Visita" }, { value: "ultrasound", label: "Ecografía" }, { value: "test", label: "Prueba" }, { value: "class", label: "Clase" }, { value: "other", label: "Otro" },
];

function fromRows(pregnancy: Row | null, tasks: Row[], appointments: Row[], shopping: Row[], notes: Row[], events: Row[] = [], activity: Row[] = []): Workspace {
  return {
    pregnancy: pregnancy ? { id: String(pregnancy.id), dueDate: String(pregnancy.due_date ?? ""), dueDateConfirmed: Boolean(pregnancy.due_date_confirmed), conceptionMethod: (pregnancy.conception_method ?? "unspecified") as ConceptionMethod, transferDate: String(pregnancy.transfer_date ?? ""), embryoAgeDays: pregnancy.embryo_age_days == null ? "" : String(pregnancy.embryo_age_days), embryosTransferred: pregnancy.embryos_transferred == null ? "" : String(pregnancy.embryos_transferred), embryoQuality: String(pregnancy.embryo_quality ?? ""), clinicName: String(pregnancy.clinic_name ?? ""), sacStatus: (pregnancy.sac_status ?? "unknown") as Pregnancy["sacStatus"] } : null,
    tasks: tasks.map((row) => ({ id: String(row.id), title: String(row.title), category: row.category as TaskCategory, dueDate: String(row.due_on ?? ""), priority: row.priority as Priority, done: Boolean(row.is_done), notes: String(row.notes ?? "") })),
    appointments: appointments.map((row) => ({ id: String(row.id), title: String(row.title), type: row.appointment_type as Appointment["type"], startsAt: String(row.starts_at ?? ""), place: String(row.place ?? ""), professional: String(row.professional ?? ""), notes: String(row.notes ?? ""), certainty: (row.certainty ?? "confirmed") as Appointment["certainty"] })),
    shopping: shopping.map((row) => ({ id: String(row.id), title: String(row.title), category: row.category as ShoppingItem["category"], quantity: String(row.quantity ?? ""), purchased: Boolean(row.is_purchased), notes: String(row.notes ?? "") })),
    note: String(notes[0]?.content ?? ""), ivfHistory: "",
    events: events.map((row) => ({ id: String(row.id), title: String(row.title), type: row.event_type as ClinicalEventType, occurredOn: String(row.occurred_on ?? ""), resultValue: String(row.result_value ?? ""), resultUnit: String(row.result_unit ?? ""), details: String(row.details ?? "") })),
    activity: activity.map((row) => ({ id: String(row.id), entityType: row.entity_type === "appointments" ? "appointment" : "task", action: row.action as ActivityEntry["action"], entityTitle: String(row.entity_title ?? "Elemento sin título"), changedAt: String(row.changed_at ?? "") })),
  };
}

function usePlannerData(userId: string | null, demo: boolean) {
  const [workspace, setWorkspace] = useState<Workspace>(() => structuredClone(demoWorkspace));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const showError = (message: string) => { setError(message); window.setTimeout(() => setError(""), 5500); };

  const reload = useCallback(async () => {
    if (!supabase || !userId || demo) return;
    setLoading(true);
    const pregnancyResult = await supabase.from("pregnancies").select("*").eq("user_id", userId).eq("status", "active").maybeSingle();
    if (pregnancyResult.error) { showError("No se han podido cargar tus datos. Comprueba la conexión y vuelve a intentarlo."); setLoading(false); return; }
    if (!pregnancyResult.data) { setWorkspace({ pregnancy: null, tasks: [], appointments: [], shopping: [], note: "", ivfHistory: "", events: [], activity: [] }); setLoading(false); return; }
    const pregnancy = pregnancyResult.data as Row;
    const [taskResult, appointmentResult, shoppingResult, noteResult, historyResult, eventsResult, activityResult] = await Promise.all([
      supabase.from("tasks").select("*").eq("pregnancy_id", pregnancy.id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("pregnancy_id", pregnancy.id).order("starts_at"),
      supabase.from("shopping_items").select("*").eq("pregnancy_id", pregnancy.id).order("created_at", { ascending: false }),
      supabase.from("personal_notes").select("*").eq("pregnancy_id", pregnancy.id).maybeSingle(),
      supabase.from("ivf_history").select("history_note").eq("pregnancy_id", pregnancy.id).maybeSingle(),
      supabase.from("pregnancy_events").select("*").eq("pregnancy_id", pregnancy.id).order("occurred_on", { ascending: false }),
      supabase.from("activity_log").select("id,entity_type,action,entity_title,changed_at").eq("pregnancy_id", pregnancy.id).order("changed_at", { ascending: false }).limit(100),
    ]);
    const failed = [taskResult, appointmentResult, shoppingResult, noteResult, historyResult, eventsResult, activityResult].some((result) => result.error);
    if (failed) showError("Parte de la información no se ha podido cargar. Recarga la página para volver a intentarlo.");
    setWorkspace({ ...fromRows(pregnancy, taskResult.data ?? [], appointmentResult.data ?? [], shoppingResult.data ?? [], noteResult.data ? [noteResult.data] : [], eventsResult.data ?? [], activityResult.data ?? []), ivfHistory: historyResult.data?.history_note ?? "" });
    setLoading(false);
  }, [userId, demo]);

  async function reloadActivity(pregnancyId?: string) {
    const targetPregnancyId = pregnancyId ?? workspace.pregnancy?.id;
    if (demo || !supabase || !userId || !targetPregnancyId) return;
    const { data: rows, error: activityError } = await supabase.from("activity_log").select("id,entity_type,action,entity_title,changed_at").eq("pregnancy_id", targetPregnancyId).order("changed_at", { ascending: false }).limit(100);
    if (activityError) { showError("El cambio se guardó, pero no se ha podido actualizar el historial."); return; }
    setWorkspace((current) => ({ ...current, activity: (rows ?? []).map((row) => ({ id: String(row.id), entityType: row.entity_type === "appointments" ? "appointment" as const : "task" as const, action: row.action as ActivityEntry["action"], entityTitle: String(row.entity_title ?? "Elemento sin título"), changedAt: String(row.changed_at ?? "") })) }));
  }

  useEffect(() => { void reload(); }, [reload]);

  async function save(table: "tasks" | "appointments" | "shopping_items" | "pregnancy_events", row: Row) {
    if (demo) return;
    if (!supabase || !userId || !workspace.pregnancy) throw new Error("Inicia sesión y configura tu embarazo antes de guardar.");
    const { error: saveError } = await supabase.from(table).upsert({ ...row, user_id: userId, pregnancy_id: workspace.pregnancy.id });
    if (saveError) throw saveError;
  }
  async function remove(table: "tasks" | "appointments" | "shopping_items" | "pregnancy_events", id: string) {
    if (demo) return;
    if (!supabase || !userId) throw new Error("No hay una sesión activa.");
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
    if (deleteError) throw deleteError;
  }
  return { workspace, setWorkspace, loading, error, setError: showError, reload, reloadActivity, save, remove };
}

export default function BabyPlannerApp() {
  const [demo, setDemo] = useState(!supabase);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [section, setSection] = useState<Section>("Inicio");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up" | "reset" | "recovery">("sign-in");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [editingPregnancy, setEditingPregnancy] = useState(false);
  const [showPersonalSetup, setShowPersonalSetup] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [taskFilter, setTaskFilter] = useState<TaskCategory | "all">("all");
  const [notesDraft, setNotesDraft] = useState("");
  const data = usePlannerData(userId, demo);
  const { workspace } = data;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data: sessionData }) => { if (active) { setUserId(sessionData.session?.user.id ?? null); setDemo(false); setAuthReady(true); } });
    const { data: authData } = supabase.auth.onAuthStateChange((event, session) => { if (event === "PASSWORD_RECOVERY") setAuthMode("recovery"); setUserId(session?.user.id ?? null); setDemo(false); setAuthReady(true); });
    return () => { active = false; authData.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { setNotesDraft(workspace.note); }, [workspace.note]);

  const pregnancy = workspace.pregnancy;
  const effectiveDueDate = pregnancy?.dueDate || (pregnancy ? estimatedDueDate(pregnancy.transferDate, pregnancy.embryoAgeDays) : "");
  const progress = useMemo(() => pregnancy ? pregnancyProgress(effectiveDueDate, pregnancy.dueDateConfirmed) : null, [pregnancy, effectiveDueDate]);
  const selectedWeek = Math.max(1, Math.min(40, (progress?.week || 1) + weekOffset));
  const trimester = selectedWeek <= 13 ? 1 : selectedWeek <= 27 ? 2 : 3;
  const guide = stageGuides[trimester as 1 | 2 | 3];
  const openTasks = workspace.tasks.filter((task) => !task.done).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const nextAppointment = workspace.appointments.find((item) => new Date(item.startsAt).getTime() >= Date.now());
  const today = useMemo(() => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(""); setAuthMessage(""); setSaving(true);
    const fields = new FormData(event.currentTarget); const email = String(fields.get("email") ?? ""); const password = String(fields.get("password") ?? "");
    if (!supabase) { setSaving(false); return; }
    try {
      if (authMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
        if (error) setAuthError(authMessageFor(error.message));
        else setAuthMessage("Si existe una cuenta asociada a ese correo, recibirás un enlace para cambiar la contraseña.");
      } else {
        const result = authMode === "sign-in" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
        if (result.error) setAuthError(authMessageFor(result.error.message));
        else if (authMode === "sign-up" && !result.data.session) setAuthMessage("Revisa tu correo para confirmar la cuenta y después inicia sesión.");
      }
    } catch { setAuthError("No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo."); }
    finally { setSaving(false); }
  }
  async function updateRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(""); setSaving(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (!supabase) { setSaving(false); return; }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setAuthError(authMessageFor(updateError.message));
      else { setAuthMessage("Contraseña actualizada."); setAuthMode("sign-in"); }
    } catch { setAuthError("No se ha podido conectar. Inténtalo de nuevo."); }
    finally { setSaving(false); }
  }
  async function savePregnancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const dueDate = String(fields.get("dueDate") ?? ""); const confirmed = fields.get("confirmed") === "on";
    const method = String(fields.get("conceptionMethod") ?? "unspecified") as ConceptionMethod;
    const transferDate = String(fields.get("transferDate") ?? ""); const embryoAgeDays = String(fields.get("embryoAgeDays") ?? "");
    const next: Pregnancy = { id: pregnancy?.id ?? uid(), dueDate, dueDateConfirmed: Boolean(dueDate && confirmed), conceptionMethod: method, transferDate, embryoAgeDays, embryosTransferred: String(fields.get("embryosTransferred") ?? ""), embryoQuality: String(fields.get("embryoQuality") ?? ""), clinicName: String(fields.get("clinicName") ?? ""), sacStatus: String(fields.get("sacStatus") ?? "unknown") as Pregnancy["sacStatus"] };
    setSaving(true);
    try {
      if (!demo && supabase && userId) {
        const { error: profileError } = await supabase.from("profiles").upsert({ id: userId });
        if (profileError) throw profileError;
        const { error: pregnancyError } = await supabase.from("pregnancies").upsert({ id: next.id, user_id: userId, due_date: next.dueDate || null, due_date_confirmed: next.dueDateConfirmed, conception_method: next.conceptionMethod, transfer_date: next.transferDate || null, embryo_age_days: next.embryoAgeDays === "" ? null : Number(next.embryoAgeDays), embryos_transferred: next.embryosTransferred === "" ? null : Number(next.embryosTransferred), embryo_quality: next.embryoQuality || null, clinic_name: next.clinicName || null, sac_status: next.sacStatus, status: "active" });
        if (pregnancyError) throw pregnancyError;
        const historyWrite = workspace.ivfHistory.trim()
          ? await supabase.from("ivf_history").upsert({ user_id: userId, pregnancy_id: next.id, history_note: workspace.ivfHistory.trim() }, { onConflict: "pregnancy_id" })
          : await supabase.from("ivf_history").delete().eq("user_id", userId).eq("pregnancy_id", next.id);
        if (historyWrite.error) throw historyWrite.error;
        if (!pregnancy) {
          const examples = starterTasks(next.dueDate);
          const rows = examples.map((task) => ({ id: task.id, user_id: userId, pregnancy_id: next.id, title: task.title, category: task.category, priority: task.priority, is_done: false, notes: "Ejemplo editable; adapta o elimina lo que no te sirva." }));
          const { error: taskError } = await supabase.from("tasks").insert(rows);
          if (taskError) throw taskError;
        }
      }
      data.setWorkspace((current) => ({ ...current, pregnancy: next, ...(pregnancy ? {} : { tasks: starterTasks(next.dueDate) }) })); setEditingPregnancy(false); setShowPersonalSetup(false); setSection("Inicio");
      await data.reloadActivity(next.id);
    } catch (error) { data.setError(error instanceof Error ? error.message : "No se ha podido guardar la configuración."); }
    finally { setSaving(false); }
  }
  async function saveItem(formData: FormData, kind: EditorKind, existing?: EditableItem) {
    const id = existing?.id ?? uid(); const title = String(formData.get("title") ?? "").trim();
    if (!title) { data.setError("Escribe un título antes de guardar."); return; }
    setSaving(true);
    try {
      if (kind === "task") {
        const task: Task = { id, title, category: String(formData.get("category")) as TaskCategory, dueDate: String(formData.get("dueDate") ?? ""), priority: String(formData.get("priority")) as Priority, done: existing && "done" in existing ? existing.done : false, notes: String(formData.get("notes") ?? "") };
        await data.save("tasks", { id, title, category: task.category, due_on: task.dueDate || null, priority: task.priority, is_done: task.done, notes: task.notes });
        data.setWorkspace((current) => ({ ...current, tasks: existing ? current.tasks.map((item) => item.id === id ? task : item) : [task, ...current.tasks] }));
        await data.reloadActivity();
      } else if (kind === "appointment") {
        const item: Appointment = { id, title, type: String(formData.get("type")) as Appointment["type"], startsAt: String(formData.get("startsAt") ?? ""), place: String(formData.get("place") ?? ""), professional: String(formData.get("professional") ?? ""), notes: String(formData.get("notes") ?? ""), certainty: String(formData.get("certainty") ?? "confirmed") as Appointment["certainty"] };
        if (!item.startsAt) { data.setError("Añade la fecha y la hora de la cita."); return; }
        await data.save("appointments", { id, title, appointment_type: item.type, starts_at: new Date(item.startsAt).toISOString(), certainty: item.certainty, place: item.place || null, professional: item.professional || null, notes: item.notes || null });
        data.setWorkspace((current) => ({ ...current, appointments: [...current.appointments.filter((entry) => entry.id !== id), item].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
        await data.reloadActivity();
      } else if (kind === "shopping") {
        const item: ShoppingItem = { id, title, category: String(formData.get("category")) as ShoppingItem["category"], quantity: String(formData.get("quantity") ?? ""), purchased: existing && "purchased" in existing ? existing.purchased : false, notes: String(formData.get("notes") ?? "") };
        await data.save("shopping_items", { id, title, category: item.category, quantity: item.quantity || null, is_purchased: item.purchased, notes: item.notes || null });
        data.setWorkspace((current) => ({ ...current, shopping: existing ? current.shopping.map((entry) => entry.id === id ? item : entry) : [item, ...current.shopping] }));
      } else {
        const event: ClinicalEvent = { id, title, type: String(formData.get("eventType") ?? "other") as ClinicalEventType, occurredOn: String(formData.get("occurredOn") ?? ""), resultValue: String(formData.get("resultValue") ?? "").trim(), resultUnit: String(formData.get("resultUnit") ?? "").trim(), details: String(formData.get("details") ?? "").trim() };
        if (!event.occurredOn) { data.setError("Añade la fecha de este antecedente."); return; }
        await data.save("pregnancy_events", { id, title, event_type: event.type, occurred_on: event.occurredOn, result_value: event.resultValue || null, result_unit: event.resultUnit || null, details: event.details || null });
        data.setWorkspace((current) => ({ ...current, events: [event, ...current.events.filter((entry) => entry.id !== id)].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)) }));
      }
      setEditor(null);
    } catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido guardar. Inténtalo de nuevo."); }
    finally { setSaving(false); }
  }
  async function toggleTask(task: Task) {
    const updated = { ...task, done: !task.done };
    try { await data.save("tasks", { id: updated.id, title: updated.title, category: updated.category, due_on: updated.dueDate || null, priority: updated.priority, is_done: updated.done, notes: updated.notes }); data.setWorkspace((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === updated.id ? updated : item) })); await data.reloadActivity(); }
    catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido actualizar la tarea."); }
  }
  async function toggleShopping(item: ShoppingItem) {
    const updated = { ...item, purchased: !item.purchased };
    try { await data.save("shopping_items", { id: updated.id, title: updated.title, category: updated.category, quantity: updated.quantity || null, is_purchased: updated.purchased, notes: updated.notes || null }); data.setWorkspace((current) => ({ ...current, shopping: current.shopping.map((entry) => entry.id === updated.id ? updated : entry) })); }
    catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido actualizar la lista."); }
  }
  async function deleteItem(kind: EditorKind, item: EditableItem) {
    if (!window.confirm(`¿Quieres eliminar «${item.title}»? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      const table = kind === "task" ? "tasks" : kind === "appointment" ? "appointments" : kind === "shopping" ? "shopping_items" : "pregnancy_events";
      await data.remove(table, item.id);
      data.setWorkspace((current) => kind === "task" ? { ...current, tasks: current.tasks.filter((row) => row.id !== item.id) } : kind === "appointment" ? { ...current, appointments: current.appointments.filter((row) => row.id !== item.id) } : kind === "shopping" ? { ...current, shopping: current.shopping.filter((row) => row.id !== item.id) } : { ...current, events: current.events.filter((row) => row.id !== item.id) });
      if (kind === "task" || kind === "appointment") await data.reloadActivity();
    } catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido eliminar. Inténtalo de nuevo."); }
    finally { setSaving(false); }
  }
  async function saveNote() {
    if (!demo && (!supabase || !userId || !pregnancy)) return;
    setSaving(true);
    try {
      if (!demo && supabase && userId && pregnancy) {
        const { error: noteError } = await supabase.from("personal_notes").upsert({ user_id: userId, pregnancy_id: pregnancy.id, content: notesDraft }, { onConflict: "user_id,pregnancy_id" });
        if (noteError) throw noteError;
      }
      data.setWorkspace((current) => ({ ...current, note: notesDraft })); data.setError("Nota guardada.");
    } catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido guardar la nota."); }
    finally { setSaving(false); }
  }
  async function addSuggestedTask(item: SuggestedMilestone) {
    if (workspace.tasks.some((task) => task.title === item.title && task.dueDate === item.startDate && task.notes.includes("Sugerencia de calendario"))) { data.setError("Esta sugerencia ya está en tus tareas."); return; }
    const rangeNote = item.startDate && item.endDate ? `Sugerencia de calendario. Ventana orientativa: ${dateLabel(item.startDate)}–${dateLabel(item.endDate)}. Confirma con tu equipo sanitario qué corresponde.` : "Sugerencia de calendario. Confirma con tu equipo sanitario qué corresponde.";
    const task: Task = { id: uid(), title: item.title, category: "appointments_tests", dueDate: item.startDate, priority: "normal", done: false, notes: `${rangeNote} ${item.detail}` };
    setSaving(true);
    try { await data.save("tasks", { id: task.id, title: task.title, category: task.category, due_on: task.dueDate || null, priority: task.priority, is_done: false, notes: task.notes }); data.setWorkspace((current) => ({ ...current, tasks: [task, ...current.tasks] })); data.setError("Sugerencia añadida a tus tareas."); }
    catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido añadir la sugerencia."); }
    finally { setSaving(false); }
  }
  function exportWorkspace() {
    if (demo || !userId) return;
    const payload = { exportedAt: new Date().toISOString(), pregnancy: workspace.pregnancy, tasks: workspace.tasks, appointments: workspace.appointments, shopping: workspace.shopping, personalNotes: workspace.note, optionalPrivateHistory: workspace.ivfHistory, events: workspace.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `babyplanner-datos-${new Date().toISOString().slice(0, 10)}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function deletePregnancyData() {
    if (demo || !supabase || !userId || !pregnancy) return;
    const confirmed = window.confirm("Se eliminará el perfil de embarazo y, por relación, sus tareas, citas, compras, notas e historial. La cuenta seguirá activa. ¿Quieres continuar?");
    if (!confirmed) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from("pregnancies").delete().eq("id", pregnancy.id).eq("user_id", userId);
      if (deleteError) throw deleteError;
      data.setWorkspace({ pregnancy: null, tasks: [], appointments: [], shopping: [], note: "", ivfHistory: "", events: [], activity: [] });
      setSection("Inicio"); data.setError("Se ha eliminado el perfil de embarazo y sus datos asociados.");
    } catch (error) { data.setError(error instanceof Error ? authMessageFor(error.message) : "No se ha podido eliminar el perfil."); }
    finally { setSaving(false); }
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setUserId(null); setDemo(false); setShowPersonalSetup(false); setSection("Inicio"); }

  if (supabase && !authReady) return <div className="loading-screen"><span className="brand-mark"><Heart size={19} fill="currentColor" /></span><p>Preparando tu espacio…</p></div>;
  if (supabase && !demo && !userId) return <AuthScreen mode={authMode === "recovery" ? "sign-in" : authMode} setMode={setAuthMode} onSubmit={handleAuth} busy={saving} error={authError} message={authMessage} onDemo={() => { setDemo(true); setAuthError(""); }} />;
  if (supabase && authMode === "recovery" && userId) return <RecoveryPasswordScreen onSubmit={updateRecoveredPassword} busy={saving} error={authError} />;
  if (data.loading) return <div className="loading-screen"><span className="brand-mark"><Heart size={19} fill="currentColor" /></span><p>Cargando tu espacio…</p></div>;
  if (!pregnancy && !demo && userId) {
    if (showPersonalSetup) return <SetupScreen pregnancy={null} history={workspace.ivfHistory} onHistoryChange={(value) => data.setWorkspace((current) => ({ ...current, ivfHistory: value }))} onSave={savePregnancy} onCancel={() => setShowPersonalSetup(false)} cancelText="Volver a las invitaciones" busy={saving} demo={demo} />;
    return <FamilyAccessScreen userId={userId} onSignOut={() => void signOut()} onCreatePersonalPanel={() => setShowPersonalSetup(true)} fallback={<SetupScreen pregnancy={pregnancy} history={workspace.ivfHistory} onHistoryChange={(value) => data.setWorkspace((current) => ({ ...current, ivfHistory: value }))} onSave={savePregnancy} busy={saving} demo={demo} />} />;
  }
  if (!pregnancy || editingPregnancy) return <SetupScreen pregnancy={pregnancy} history={workspace.ivfHistory} onHistoryChange={(value) => data.setWorkspace((current) => ({ ...current, ivfHistory: value }))} onSave={savePregnancy} onCancel={pregnancy ? () => setEditingPregnancy(false) : undefined} busy={saving} demo={demo} />;

  return <main className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); setSection("Inicio"); }}><span className="brand-mark"><Heart size={18} fill="currentColor" /></span><span>BabyPlanner<span className="brand-dot">.</span></span></a>
      <div className="side-caption">TU ESPACIO</div>
      <nav className="side-nav" aria-label="Navegación principal">{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileMenu(false); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Tareas" && openTasks.length > 0 && <span className="nav-count">{openTasks.length}</span>}</button>)}</nav>
      <div className="sidebar-note"><div className="note-flower"><Sparkles size={16} /></div><p>Un día a la vez</p><span>Tu camino es solo tuyo. Aquí te acompañamos.</span><div className="note-line" /></div>
      <div className="profile"><div className="avatar">{demo ? "D" : "♥"}</div><div className="profile-copy"><strong>{demo ? "Modo demo" : "Mi espacio"}</strong><span>{demo ? "Datos ficticios" : "Cuenta privada"}</span></div>{!demo && <button className="logout-button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void signOut()}><LogOut size={15}/></button>}</div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
    <section className="main-column">
      <header className="topbar"><button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><div className="breadcrumb">Mi espacio <span>/</span> <strong>{section}</strong></div><div className="top-actions"><span className={`mode-chip ${demo ? "" : "private-chip"}`}>{demo ? <><Sparkles size={13}/> Demo ficticia</> : <><LockKeyhole size={13}/> Privado</>}</span><button className="icon-button" aria-label="Configurar fecha probable de parto" onClick={() => setEditingPregnancy(true)}><Pencil size={16}/></button><div className="top-avatar">{demo ? "D" : "♥"}</div></div></header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {today}</div><h1>{section === "Inicio" ? <>Tu embarazo,<br className="mobile-break"/> a tu ritmo<span className="title-period">.</span></> : <>{section}<span className="title-period">.</span></>}</h1><p className="welcome-subtitle">Un lugar para seguir esta etapa y organizarte con calma.</p></div>{progress && <div className="week-pill"><span className="week-sparkle"><Baby size={15}/></span> Semana {progress.week} <span className="pill-divider"/> {progress.day} {progress.day === 1 ? "día" : "días"}</div>}</div>
        {demo && <div className="demo-banner"><Sparkles size={15}/><span>{supabase ? "Estás viendo datos de ejemplo ficticios. Los cambios solo duran mientras esta pestaña esté abierta." : "Demo ficticia: todavía no se guardan datos. Para iniciar sesión y guardar tu perfil, configura las variables locales de Supabase y aplica las migraciones revisadas."}</span>{supabase && <button onClick={() => { setDemo(false); setSection("Inicio"); }}>Cerrar demo</button>}</div>}
        {data.error && <div role="status" className="status-banner"><span>{data.error}</span><button aria-label="Cerrar mensaje" onClick={() => data.setError("")}><X size={15}/></button></div>}
        {section === "Inicio" && <Dashboard workspace={workspace} progress={progress} dueDate={effectiveDueDate} onNavigate={setSection} onEditPregnancy={() => setEditingPregnancy(true)} onEditTask={(item) => setEditor({ kind: "task", item })} onToggleTask={toggleTask} onAddAppointment={() => setEditor({ kind: "appointment" })} onAddSuggestion={(item) => void addSuggestedTask(item)} />}
        {section === "Seguimiento" && <PregnancyTrackingView week={selectedWeek} provisional={Boolean(effectiveDueDate && !pregnancy?.dueDateConfirmed)} onWeekChange={(offset) => setWeekOffset((current) => Math.max(1 - (progress?.week || 1), Math.min(40 - (progress?.week || 1), current + offset)))} guide={guide} />}
        {section === "Tareas" && <TasksView tasks={workspace.tasks} filter={taskFilter} onFilter={setTaskFilter} onAdd={() => setEditor({ kind: "task" })} onEdit={(item) => setEditor({ kind: "task", item })} onDelete={(item) => void deleteItem("task", item)} onToggle={toggleTask} />}
        {section === "Citas" && <AppointmentsView items={workspace.appointments} onAdd={() => setEditor({ kind: "appointment" })} onEdit={(item) => setEditor({ kind: "appointment", item })} onDelete={(item) => void deleteItem("appointment", item)} />}
        {section === "Compras" && <ShoppingView items={workspace.shopping} onAdd={() => setEditor({ kind: "shopping" })} onEdit={(item) => setEditor({ kind: "shopping", item })} onDelete={(item) => void deleteItem("shopping", item)} onToggle={toggleShopping} />}
        {section === "Fotos" && <PhotoGallery pregnancyId={pregnancy.id} userId={userId} demo={demo} />}
        {section === "Familia" && userId && <FamilyAccessScreen userId={userId} onSignOut={() => void signOut()} onReturnToPersonal={() => setSection("Inicio")} />}
        {section === "Notas" && <NotesView value={notesDraft} onChange={setNotesDraft} onSave={() => void saveNote()} busy={saving} demo={demo} />}
        {section === "Historial" && <ClinicalHistoryView events={workspace.events} activity={workspace.activity} demo={demo} onAdd={() => setEditor({ kind: "event" })} onEdit={(item) => setEditor({ kind: "event", item })} onDelete={(item) => void deleteItem("event", item)} />}
        {section === "Datos privados" && <PrivateDetails pregnancy={pregnancy} history={workspace.ivfHistory} demo={demo} busy={saving} onEdit={() => setEditingPregnancy(true)} onExport={exportWorkspace} onDeleteData={() => void deletePregnancyData()} />}
        <div className="health-note"><CircleHelp size={15}/><p>BabyPlanner es una herramienta de organización e información general, no un producto médico. La evolución varía; consulta las dudas personales con tu equipo sanitario.</p></div>
        <footer className="page-footer"><span>Tu espacio, a tu ritmo <Heart size={12} fill="currentColor"/></span><a href="https://observatoriosaludmujeres.sanidad.gob.es/saludSexualReproductiva/saludReproductiva/guiasProtocolos/embarazoPuerperio/home.htm" target="_blank" rel="noreferrer">Fuente sanitaria</a><span>·</span><span>Información general</span></footer>
      </div>
    </section>
    {editor && <ItemDialog key={`${editor.kind}-${editor.item?.id ?? "new"}`} kind={editor.kind} item={editor.item} busy={saving} onClose={() => setEditor(null)} onSave={(formData) => void saveItem(formData, editor.kind, editor.item)} />}
  </main>;
}

function authMessageFor(message: string) {
  if (/invalid login|invalid.*credentials/i.test(message)) return "El correo o la contraseña no coinciden. Comprueba los datos e inténtalo de nuevo.";
  if (/already registered|user already/i.test(message)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo desde el enlace que te hemos enviado.";
  if (/failed to fetch|network|fetch failed/i.test(message)) return "No se ha podido conectar con Supabase. Comprueba la conexión y las variables locales.";
  if (/relation .* does not exist|could not find the table|schema cache/i.test(message)) return "No se encuentra el esquema. Revisa que el proyecto use la migración aprobada.";
  if (/row-level security|permission denied|not allowed/i.test(message)) return "Supabase ha rechazado el acceso. Revisa la sesión, los permisos y las políticas RLS.";
  return "No se ha podido completar la operación. Comprueba la configuración de Supabase y vuelve a intentarlo.";
}
function starterTasks(dueDate: string): Task[] {
  const stage = pregnancyProgress(dueDate, true)?.trimester ?? 1;
  const examples = stage === 1
    ? ["Anotar preguntas para una próxima cita", "Guardar los datos de contacto de mi equipo", "Crear una lista de ideas que quiero explorar"]
    : stage === 2
      ? ["Añadir fechas que me hayan indicado", "Anotar ideas para mis preparativos", "Revisar gestiones que quiero organizar"]
      : ["Organizar los preparativos que quiero tener listos", "Anotar dudas para próximas citas", "Revisar mi lista personal de compras"];
  return [
    { id: uid(), title: examples[0], category: "appointments_tests", dueDate: "", priority: "normal", done: false, notes: "Ejemplo editable y opcional." },
    { id: uid(), title: examples[1], category: "admin", dueDate: "", priority: "low", done: false, notes: "Ejemplo editable y opcional." },
    { id: uid(), title: examples[2], category: "arrival", dueDate: "", priority: "low", done: false, notes: "Ejemplo editable y opcional." },
  ];
}

function PrivateDetails({ pregnancy, history, demo, busy, onEdit, onExport, onDeleteData }: { pregnancy: Pregnancy; history: string; demo: boolean; busy: boolean; onEdit: () => void; onExport: () => void; onDeleteData: () => void }) {
  return <section className="card list-page private-details"><div className="list-page-heading"><div><span className="section-label">SOLO PARA TU CUENTA</span><h2>Datos privados</h2><p>Información personal del embarazo, protegida por las políticas RLS de tu usuario.</p></div><button className="primary-button compact-button" onClick={onEdit}><Pencil size={15}/> Editar</button></div><div className="private-detail-grid"><div><span>Datación</span><strong>{pregnancy.dueDateConfirmed ? "FPP confirmada por clínica" : pregnancy.dueDate || pregnancy.transferDate ? "Estimación provisional, pendiente de confirmación clínica" : "Pendiente de configurar"}</strong></div><div><span>Fecha probable de parto</span><strong>{pregnancy.dueDate ? dateLabel(pregnancy.dueDate) : pregnancy.transferDate && pregnancy.embryoAgeDays ? dateLabel(estimatedDueDate(pregnancy.transferDate, pregnancy.embryoAgeDays)) : "Sin datos suficientes"}</strong></div><div><span>Fecha de transferencia</span><strong>{pregnancy.transferDate ? dateLabel(pregnancy.transferDate) : "No indicada"}</strong></div><div><span>Equipo o clínica</span><strong>{pregnancy.clinicName || "No indicado"}</strong></div><div><span>Embriones transferidos</span><strong>{pregnancy.embryosTransferred || "No indicado"}</strong></div><div><span>Estado tras ecografía</span><strong>{pregnancy.sacStatus === "single" ? "Único confirmado" : pregnancy.sacStatus === "multiple" ? "Múltiple confirmado" : "Pendiente / todavía no se sabe"}</strong></div></div><div className="clinical-note"><CircleHelp size={15}/><span>La cantidad transferida no confirma cuántos sacos evolucionan. La app no presenta el número de embriones como embarazo único o múltiple.</span></div><div className="private-history-block"><h3>Historial FIV opcional</h3><p>{history || "Aún no has guardado notas de historial. Puedes añadirlas o editarlas en la configuración privada."}</p></div><div className="privacy-actions"><button className="outline-button" onClick={onExport} disabled={demo}>Descargar copia de mis datos</button><button className="danger-button" onClick={onDeleteData} disabled={demo || busy}>Eliminar perfil de embarazo y datos</button></div>{demo && <small className="setup-field-note">Exportación y borrado disponibles al iniciar sesión.</small>}</section>;
}

const eventLabels: Record<ClinicalEventType, string> = { transfer: "Transferencia", home_test: "Test en casa", lab_result: "Resultado de laboratorio", ultrasound: "Ecografía", symptom_note: "Nota sobre cómo me encontraba", clinic_instruction: "Indicación recibida de la clínica", other: "Otro antecedente" };
function ClinicalHistoryView({ events, activity, demo, onAdd, onEdit, onDelete }: { events: ClinicalEvent[]; activity: ActivityEntry[]; demo: boolean; onAdd: () => void; onEdit: (item: ClinicalEvent) => void; onDelete: (item: ClinicalEvent) => void }) {
  const sorted = [...events].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const actionLabel = (action: ActivityEntry["action"]) => action === "created" ? "Añadido" : action === "updated" ? "Modificado" : "Eliminado";
  return <section className="card list-page private-details"><div className="list-page-heading"><div><span className="section-label">HISTORIAL PRIVADO</span><h2>Mi cronología</h2><p>Antecedentes que añadas y registro de cambios en tareas y citas.</p></div><button className="primary-button compact-button" onClick={onAdd} disabled={demo}><Plus size={15}/> Añadir antecedente</button></div><div className="clinical-note"><LockKeyhole size={15}/><span>{demo ? "La demo no permite introducir antecedentes personales. Inicia sesión para guardarlos en privado." : "Las altas, modificaciones, finalizaciones y eliminaciones de tareas y citas quedan registradas automáticamente. Solo tu cuenta puede consultar este historial."}</span></div><h3 className="activity-heading">Cambios en tareas y citas</h3>{activity.length ? <div className="records-list">{activity.map((entry) => <article className="record-row" key={entry.id}><div className="date-tile"><strong>{new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(new Date(entry.changedAt))}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(entry.changedAt)).replace(".", "").toUpperCase()}</span></div><div className="record-main"><strong className="record-title-static">{entry.entityTitle}</strong><div className="record-meta"><span>{entry.entityType === "task" ? "Tarea" : "Cita"}</span><i/><span>{actionLabel(entry.action)}</span><i/><span>{dateLabel(entry.changedAt, { hour: "2-digit", minute: "2-digit" })}</span></div></div></article>)}</div> : <p className="empty-inline">Aún no hay cambios registrados en tareas o citas.</p>}<h3 className="activity-heading">Antecedentes personales</h3>{sorted.length ? <div className="records-list">{sorted.map((event) => <article className="record-row" key={event.id}><div className="date-tile"><strong>{new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(new Date(`${event.occurredOn}T12:00:00`))}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(`${event.occurredOn}T12:00:00`)).replace(".", "").toUpperCase()}</span></div><div className="record-main"><button className="record-title" onClick={() => onEdit(event)}>{event.title}</button><div className="record-meta"><span>{eventLabels[event.type]}</span>{event.resultValue && <><i/><span>{event.resultValue}{event.resultUnit ? ` ${event.resultUnit}` : ""}</span></>}</div>{event.details && <p>{event.details}</p>}</div><RecordActions onEdit={() => onEdit(event)} onDelete={() => onDelete(event)}/></article>)}</div> : <EmptyState icon={<ClipboardList size={21}/>} title="Todavía no hay antecedentes" text="Añade solo la información que quieras conservar en privado." action={demo ? "Disponible con sesión" : "Añadir antecedente"} onAction={demo ? () => undefined : onAdd}/>}</section>;
}

const certaintyLabel = (certainty: Appointment["certainty"]) => certainty === "confirmed" ? "Confirmado" : certainty === "orientative" ? "Orientativo" : "Pendiente de confirmar";

function AuthScreen({ mode, setMode, onSubmit, busy, error, message, onDemo }: { mode: "sign-in" | "sign-up" | "reset"; setMode: (mode: "sign-in" | "sign-up" | "reset" | "recovery") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string; message: string; onDemo: () => void }) {
  const reset = mode === "reset";
  return <main className="auth-page"><div className="auth-card"><a className="brand auth-brand" href="#"><span className="brand-mark"><Heart size={18} fill="currentColor"/></span><span>BabyPlanner<span className="brand-dot">.</span></span></a><span className="section-label">TU ESPACIO PERSONAL</span><h1>{reset ? "Recupera el acceso." : mode === "sign-in" ? "Qué bien tenerte aquí." : "Empieza a tu ritmo."}</h1><p>{reset ? "Te enviaremos un enlace si hay una cuenta asociada a ese correo." : "Accede para guardar tus datos de forma privada en tu cuenta."}</p><form onSubmit={onSubmit}><label>Correo electrónico<input name="email" type="email" autoComplete="email" required placeholder="tu@correo.es"/></label>{!reset && <label>Contraseña<input name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required placeholder="Al menos 8 caracteres"/></label>}{error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="form-success">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Un momento…" : reset ? "Enviar enlace" : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}<ArrowRight size={16}/></button></form>{mode === "sign-in" && <button className="auth-text-button" onClick={() => { setMode("reset"); }}>He olvidado mi contraseña</button>}<div className="auth-switch">{reset ? <button onClick={() => setMode("sign-in")}>Volver a iniciar sesión</button> : <>{mode === "sign-in" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}<button onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Crear una cuenta" : "Iniciar sesión"}</button></>}</div><button className="demo-button" onClick={onDemo}><Sparkles size={15}/> Ver una demo con datos ficticios</button><div className="auth-privacy"><LockKeyhole size={14}/> Tus datos quedan asociados a tu cuenta. El acceso se limita mediante políticas RLS.</div></div><p className="auth-footer">Información general y organización. Para dudas personales, consulta a tu equipo sanitario.</p></main>;
}
function RecoveryPasswordScreen({ onSubmit, busy, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  return <main className="auth-page"><div className="auth-card"><a className="brand auth-brand" href="#"><span className="brand-mark"><Heart size={18} fill="currentColor"/></span><span>BabyPlanner<span className="brand-dot">.</span></span></a><span className="section-label">RECUPERAR ACCESO</span><h1>Elige una contraseña nueva.</h1><p>Usa al menos 8 caracteres y guárdala en un lugar seguro.</p><form onSubmit={onSubmit}><label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Al menos 8 caracteres"/></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Actualizar contraseña"}<ArrowRight size={16}/></button></form></div></main>;
}

function SetupScreen({ pregnancy, history, onHistoryChange, onSave, onCancel, cancelText = "Volver al panel", busy, demo }: { pregnancy: Pregnancy | null; history: string; onHistoryChange: (value: string) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void; cancelText?: string; busy: boolean; demo: boolean }) {
  return <main className="setup-page"><section className="setup-card setup-card-wide"><a className="brand" href="#"><span className="brand-mark"><Heart size={18} fill="currentColor"/></span><span>BabyPlanner<span className="brand-dot">.</span></span></a><div className="setup-illustration"><Leaf size={29}/><Sparkles size={16}/></div><span className="section-label">CONFIGURACIÓN PRIVADA</span><h1>Tu embarazo,<br/>a tu manera.</h1><p className="setup-intro">Añade solo lo que quieras guardar. Las fechas estimadas son orientativas y puedes cambiarlas cuando tu equipo clínico confirme la datación.</p>{demo && <div className="clinical-note"><LockKeyhole size={15}/><span>Estás en una demo sin sesión. No introduzcas datos reales aquí; conecta Supabase e inicia sesión para guardar información privada.</span></div>}<form onSubmit={onSave}><fieldset disabled={demo} className="setup-fields">
    <label>Fecha probable de parto (FPP)<span className="optional-label">Opcional</span><input name="dueDate" type="date" defaultValue={pregnancy?.dueDate ?? ""}/><small className="setup-field-note">Puedes introducir una estimación provisional. Marca la casilla solo cuando la clínica la confirme.</small></label>
    <label className="check-label"><input name="confirmed" type="checkbox" defaultChecked={pregnancy?.dueDateConfirmed ?? false}/><span>La FPP está confirmada por mi equipo sanitario.</span></label>
    <label>¿Embarazo por FIV?<select name="conceptionMethod" defaultValue={pregnancy?.conceptionMethod ?? "unspecified"}><option value="unspecified">Prefiero no indicarlo</option><option value="spontaneous">No</option><option value="ivf">Sí, por FIV</option></select></label>
    <div className="private-form-section"><span className="section-label">DATACIÓN Y DATOS DE CLÍNICA · PRIVADOS</span><div className="form-row"><label>Fecha de transferencia<input name="transferDate" type="date" defaultValue={pregnancy?.transferDate ?? ""}/></label><label>Edad embrionaria en días<input name="embryoAgeDays" type="number" min="0" max="10" defaultValue={pregnancy?.embryoAgeDays ?? ""} placeholder="Opcional"/></label></div><small className="setup-field-note">Si introduces ambos datos, BabyPlanner calcula una estimación editable de FPP. No es una confirmación clínica.</small><div className="form-row"><label>Embriones transferidos<input name="embryosTransferred" type="number" min="1" max="10" defaultValue={pregnancy?.embryosTransferred ?? ""} placeholder="Opcional"/></label><label>Calidad o descripción<input name="embryoQuality" maxLength={40} defaultValue={pregnancy?.embryoQuality ?? ""} placeholder="Opcional"/></label></div><label>Clínica o equipo sanitario<input name="clinicName" maxLength={180} defaultValue={pregnancy?.clinicName ?? ""} placeholder="Opcional"/></label><label>Estado confirmado tras ecografía<select name="sacStatus" defaultValue={pregnancy?.sacStatus ?? "unknown"}><option value="unknown">Pendiente / todavía no se sabe</option><option value="single">Embarazo único confirmado por clínica</option><option value="multiple">Embarazo múltiple confirmado por clínica</option></select></label><small className="setup-field-note">El número de embriones transferidos no determina el número de sacos ni confirma un embarazo múltiple.</small></div>
    <div className="private-form-section"><span className="section-label">HISTORIAL FIV OPCIONAL · PRIVADO</span><label>Notas clínicas o del ciclo<textarea rows={4} maxLength={10000} value={history} onChange={(event) => onHistoryChange(event.target.value)} placeholder="Guarda aquí, si lo deseas, antecedentes o información histórica que quieras conservar."/></label><small className="setup-field-note">Este historial se guarda separado de las notas generales y no aparece en el inicio.</small></div>
    <div className="clinical-note"><CircleHelp size={15}/><span>BabyPlanner no es un producto médico. La datación y los resultados deben confirmarse con tu equipo sanitario.</span></div><button className="primary-button" disabled={busy || demo}>{busy ? "Guardando…" : pregnancy ? "Guardar cambios" : "Continuar"}<ArrowRight size={16}/></button></fieldset></form>{onCancel && <button className="cancel-link" onClick={onCancel}><ArrowLeft size={15}/> {cancelText}</button>}</section></main>;
}

function suggestedMilestones(dueDate: string): SuggestedMilestone[] {
  if (!dueDate) return [];
  const entries = [
    { startWeek: 6, startDay: 0, endWeek: 10, endDay: 6, title: "Organizar primera consulta obstétrica y analíticas", detail: "Sugerencia general · consulta disponibilidad con tu equipo" },
    { startWeek: 10, startDay: 0, title: "Consultar opciones de cribado prenatal", detail: "Desde 10+0 · incluido NIPT si procede" },
    { startWeek: 11, startDay: 0, endWeek: 13, endDay: 6, title: "Ventana orientativa de cribado del primer trimestre", detail: "No es una cita confirmada" },
    { startWeek: 20, startDay: 0, endWeek: 22, endDay: 6, title: "Ventana orientativa para ecografía morfológica", detail: "Confirmar con el equipo" },
    { startWeek: 24, startDay: 0, endWeek: 28, endDay: 6, title: "Consultar cribado de diabetes gestacional", detail: "Ventana orientativa · pregunta qué corresponde" },
    { startWeek: 28, startDay: 0, title: "Revisar seguimiento del tercer trimestre", detail: "Consultar vacunas y preparación del nacimiento" },
    { startWeek: 35, startDay: 0, endWeek: 37, endDay: 6, title: "Consultar pruebas del final del embarazo", detail: "Estreptococo B si corresponde" },
    { title: "Preparativos para el nacimiento", detail: "Checklist editable · organiza compras a tu ritmo" },
  ];
  const due = new Date(`${dueDate.slice(0, 10)}T12:00:00`);
  const dateAt = (week: number, day: number) => { const date = new Date(due); date.setDate(date.getDate() - (280 - (week * 7 + day))); return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); };
  const today = new Date().toLocaleDateString("sv-SE");
  return entries.map((entry) => ({ ...entry, startDate: entry.startWeek ? dateAt(entry.startWeek, entry.startDay ?? 0) : "", endDate: entry.endWeek ? dateAt(entry.endWeek, entry.endDay ?? 6) : "" })).filter((entry) => entry.endDate ? entry.endDate >= today : entry.startDate ? entry.startDate >= today : true).sort((a, b) => (a.startDate || "9999-12-31").localeCompare(b.startDate || "9999-12-31"));
}

function Dashboard({ workspace, progress, dueDate, onNavigate, onEditPregnancy, onEditTask, onToggleTask, onAddAppointment, onAddSuggestion }: { workspace: Workspace; progress: ReturnType<typeof pregnancyProgress>; dueDate: string; onNavigate: (section: Section) => void; onEditPregnancy: () => void; onEditTask: (item: Task) => void; onToggleTask: (task: Task) => void; onAddAppointment: () => void; onAddSuggestion: (item: SuggestedMilestone) => void }) {
  const tasks = workspace.tasks.filter((item) => !item.done).slice(0, 4);
  const next = workspace.appointments.filter((item) => new Date(item.startsAt).getTime() >= Date.now()).sort((a,b) => a.startsAt.localeCompare(b.startsAt))[0];
  return <>
    <section className="hero-card"><div className="hero-copy"><span className="hero-kicker"><span/> UN DÍA A LA VEZ</span><h2>Estás creando<br/>tu propio camino.</h2><p>Cada embarazo es diferente.<br/>Organízate como mejor te venga.</p><button className="text-link" onClick={() => onNavigate("Seguimiento")}>Ver esta etapa <ArrowRight size={15}/></button></div><div className="hero-art" aria-hidden="true"><div className="sun-orbit orbit-one"/><div className="sun-orbit orbit-two"/><div className="hero-sun"/><div className="hero-hill hill-back"/><div className="hero-hill hill-front"/><div className="hero-plant plant-one"><span/><span/><span/></div><div className="hero-plant plant-two"><span/><span/><span/></div><div className="hero-star star-one">✳</div><div className="baby-shape"><span className="baby-head"/><span className="baby-body"/><span className="baby-foot"/></div></div>{progress && <div className="hero-counter"><span className="counter-icon"><Baby size={17}/></span><div><strong>Semana {progress.week}</strong><span>{progress.day} {progress.day === 1 ? "día" : "días"}</span></div></div>}</section>
    <section className="photo-home-callout"><span className="photo-home-icon"><Images size={19}/></span><div><strong>Tu álbum, a tu manera</strong><p>Guarda fotos de tu tripa con fecha y semana, o reúne ideas y regalos con etiquetas.</p></div><button className="outline-button" onClick={() => onNavigate("Fotos")}>Abrir mis fotos <ArrowRight size={14}/></button></section>
    <div className="dashboard-grid"><div className="left-stack"><section className="card progress-card"><div className="card-heading"><div><span className="section-label">TU EMBARAZO</span><h3>{progress ? "Un camino, semana a semana" : "Tu fecha de referencia"}</h3></div><button className="icon-soft" aria-label="Editar fecha" onClick={onEditPregnancy}><Pencil size={15}/></button></div>{progress ? <div className="progress-body"><div className="progress-ring" style={{ "--progress": `${progress.percent}%` } as CSSProperties}><div className="ring-inner"><Baby size={18}/><strong>{progress.week}</strong><span>semanas</span></div></div><div className="progress-info"><div className="progress-week">Semana {progress.week}<span> · {progress.day} {progress.day === 1 ? "día" : "días"}</span></div><span className="trimester-tag">Trimestre {progress.trimester}</span><p>Tu bebé se desarrolla a su ritmo.<br/>La evolución puede variar.</p><div className="progress-track"><span style={{ width: `${progress.percent}%` }}/></div><div className="progress-foot"><span>Inicio</span><span>Semana 40</span></div></div></div> : <div className="unconfirmed-date"><p>Aún no hay una FPP o datos suficientes para estimarla. Puedes organizar tus tareas y citas.</p><button className="text-link" onClick={onEditPregnancy}>Revisar fecha <ArrowRight size={14}/></button></div>}<div className="progress-footer"><span className="footer-dot"/> {workspace.pregnancy?.dueDateConfirmed ? <>FPP confirmada <strong>{dateLabel(dueDate)}</strong></> : dueDate ? <>Estimación provisional, pendiente de confirmación clínica <strong>{dateLabel(dueDate)}</strong></> : <>FPP pendiente</>}</div></section>
      <section className="card appointments-card"><div className="card-heading"><div><span className="section-label">EN TU AGENDA</span><h3>Próximo hito</h3></div><button className="small-link" onClick={() => onNavigate("Citas")}>Ver todas <ArrowRight size={14}/></button></div>{next ? <div className="next-appointment"><div className="date-tile"><strong>{new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(new Date(next.startsAt))}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(next.startsAt)).replace(".", "").toUpperCase()}</span></div><div className="appointment-copy"><strong>{next.title}</strong><span><Clock3 size={13}/>{dateLabel(next.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span><span>{labelForAppointment(next.type)}{next.place ? ` · ${next.place}` : ""}</span></div><ChevronRight size={17} className="quiet-icon"/></div> : <EmptyState icon={<CalendarDays size={20}/>} title="Aún no hay citas" text="Añade un recordatorio cuando quieras." action="Añadir cita" onAction={onAddAppointment}/>}<p className="optional-hint">Las citas y pruebas dependen de cada embarazo y de tu equipo sanitario.</p></section></div>
      <div className="right-stack"><section className="card checklist-card"><div className="card-heading"><div><span className="section-label">A TU MANERA</span><h3>Tareas pendientes</h3></div><span className="task-count">{workspace.tasks.filter((item) => item.done).length}/{workspace.tasks.length}</span></div><p className="checklist-intro">Ejemplos editables, no una lista médica universal.</p>{tasks.length ? <div className="task-list">{tasks.map((task) => <div className="task-row" key={task.id}><button className={`task-check ${task.done ? "checked" : ""}`} aria-label={task.done ? "Marcar pendiente" : "Completar tarea"} onClick={() => onToggleTask(task)}>{task.done && <Check size={12}/>}</button><button className="task-title" onClick={() => onEditTask(task)}>{task.title}</button></div>)}</div> : <EmptyState icon={<CheckCircle2 size={20}/>} title="Todo al día" text="Puedes añadir otra tarea cuando quieras." action="Añadir tarea" onAction={() => onNavigate("Tareas")}/>}<button className="small-link checklist-link" onClick={() => onNavigate("Tareas")}>Ver mi lista completa <ArrowRight size={14}/></button></section>
      <section className="reminder-card"><div className="reminder-decoration"><span className="reminder-leaf leaf-a"/><span className="reminder-leaf leaf-b"/><span className="reminder-leaf leaf-c"/></div><div className="reminder-top"><span className="reminder-icon"><Leaf size={17}/></span><span className="section-label">UN MOMENTO PARA TI</span></div><h3>¿Cómo te sientes<br/>hoy?</h3><p>Dedicarte un minuto también<br/>puede formar parte del camino.</p><button onClick={() => onNavigate("Notas")}>Escribir una nota <ArrowRight size={15}/></button></section></div></div>
    <section className="stage-strip"><div><span className="section-label">PRÓXIMOS HITOS</span><h3>Planifica lo que te venga bien.</h3><p>Guarda visitas, pruebas o cualquier fecha importante para ti.</p></div><button className="outline-button" onClick={() => onNavigate("Citas")}>Organizar citas <ArrowRight size={15}/></button></section>{dueDate && <section className="card milestones-card"><div className="card-heading"><div><span className="section-label">CALENDARIO ORIENTATIVO</span><h3>Sugerencias según tu FPP</h3></div></div><p className="optional-hint">No son citas ni recomendaciones obligatorias. Confirma con tu equipo sanitario qué corresponde en tu caso.</p><div className="milestone-list">{suggestedMilestones(dueDate).map((item) => <div className="milestone-row" key={item.title}><span className="milestone-date">{item.startDate && item.endDate ? `${dateLabel(item.startDate, { day: "numeric", month: "short" })}–${dateLabel(item.endDate, { day: "numeric", month: "short" })}` : item.startDate ? `Desde ${dateLabel(item.startDate, { day: "numeric", month: "short" })}` : "Cuando te venga bien"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><div className="milestone-actions"><span className="certainty-badge certainty-orientative">Orientativo</span><button className="milestone-add" disabled={workspace.tasks.some((task) => task.title === item.title && task.dueDate === item.startDate && task.notes.includes("Sugerencia de calendario"))} onClick={() => onAddSuggestion(item)}>{workspace.tasks.some((task) => task.title === item.title && task.dueDate === item.startDate && task.notes.includes("Sugerencia de calendario")) ? "Añadido" : "+ Añadir tarea"}</button></div></div>)}</div></section>}
    <div className="bottom-quote"><span>✳</span><p>Confía en tu tiempo. Estás exactamente donde necesitas estar.</p><span>✳</span></div>
  </>;
}

function GuideBlock({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <article className="guide-block"><span className="guide-icon">{icon}</span><h3>{title}</h3><p>{text}</p></article>; }

function TasksView({ tasks, filter, onFilter, onAdd, onEdit, onDelete, onToggle }: { tasks: Task[]; filter: TaskCategory | "all"; onFilter: (value: TaskCategory | "all") => void; onAdd: () => void; onEdit: (item: Task) => void; onDelete: (item: Task) => void; onToggle: (item: Task) => void }) {
  const visible = tasks.filter((task) => filter === "all" || task.category === filter);
  return <section className="card list-page"><div className="list-page-heading"><div><span className="section-label">ORGANIZACIÓN PERSONALIZADA</span><h2>Mis tareas</h2><p>Las listas de ejemplo son opcionales: edítalas o elimínalas a tu gusto.</p></div><button className="primary-button compact-button" onClick={onAdd}><Plus size={16}/> Nueva tarea</button></div><div className="list-toolbar"><label className="filter-control">Categoría<select value={filter} onChange={(event) => onFilter(event.target.value as TaskCategory | "all")}><option value="all">Todas</option>{taskCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><span className="subtle-count">{tasks.filter((item) => !item.done).length} pendientes de {tasks.length}</span></div>{visible.length ? <div className="records-list">{visible.map((task) => <article className={`record-row ${task.done ? "record-complete" : ""}`} key={task.id}><button className={`task-check ${task.done ? "checked" : ""}`} aria-label={task.done ? "Marcar pendiente" : "Completar tarea"} onClick={() => onToggle(task)}>{task.done && <Check size={12}/>}</button><div className="record-main"><button className="record-title" onClick={() => onEdit(task)}>{task.title}</button><div className="record-meta"><span>{categoryLabel(task.category)}</span>{task.dueDate && <><i/> <span>{dateLabel(task.dueDate)}</span></>}<i/><span className={`priority priority-${task.priority}`}>{task.priority === "high" ? "Prioridad alta" : task.priority === "low" ? "Prioridad baja" : "Prioridad normal"}</span></div>{task.notes && <p>{task.notes}</p>}</div><RecordActions onEdit={() => onEdit(task)} onDelete={() => onDelete(task)}/></article>)}</div> : <EmptyState icon={<ClipboardList size={21}/>} title={filter === "all" ? "Tu lista está vacía" : "No hay tareas en esta categoría"} text="Añade una tarea que quieras tener a mano." action="Crear tarea" onAction={onAdd}/>}</section>;
}
function AppointmentsView({ items, onAdd, onEdit, onDelete }: { items: Appointment[]; onAdd: () => void; onEdit: (item: Appointment) => void; onDelete: (item: Appointment) => void }) {
  const sorted = [...items].sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  return <section className="card list-page"><div className="list-page-heading"><div><span className="section-label">FECHAS IMPORTANTES</span><h2>Mi calendario</h2><p>Organiza visitas, pruebas, clases y otros recordatorios a tu manera.</p></div><button className="primary-button compact-button" onClick={onAdd}><Plus size={16}/> Añadir cita</button></div>{sorted.length ? <div className="records-list">{sorted.map((item) => <article className="record-row appointment-record" key={item.id}><div className="date-tile"><strong>{new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(new Date(item.startsAt))}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(item.startsAt)).replace(".", "").toUpperCase()}</span></div><div className="record-main"><button className="record-title" onClick={() => onEdit(item)}>{item.title}</button><div className="record-meta"><span>{labelForAppointment(item.type)}</span><span className={`certainty-badge certainty-${item.certainty}`}>{certaintyLabel(item.certainty)}</span><i/><span>{dateLabel(item.startsAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>{item.place && <><i/><span>{item.place}</span></>}</div>{item.professional && <p>{item.professional}</p>}{item.notes && <p>{item.notes}</p>}</div><RecordActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)}/></article>)}</div> : <EmptyState icon={<CalendarDays size={21}/>} title="Todavía no has añadido citas" text="Guarda las fechas que quieras recordar. Ninguna prueba es obligatoria para todo el mundo." action="Añadir cita" onAction={onAdd}/>}<p className="optional-hint page-hint">La aplicación no determina qué citas o pruebas necesitas; sigue las indicaciones de tu equipo sanitario.</p></section>;
}
function ShoppingView({ items, onAdd, onEdit, onDelete, onToggle }: { items: ShoppingItem[]; onAdd: () => void; onEdit: (item: ShoppingItem) => void; onDelete: (item: ShoppingItem) => void; onToggle: (item: ShoppingItem) => void }) {
  return <section className="card list-page"><div className="list-page-heading"><div><span className="section-label">PREPARATIVOS A TU GUSTO</span><h2>Lista de compras</h2><p>Una lista personal, sin artículos imprescindibles ni pautas universales.</p></div><button className="primary-button compact-button" onClick={onAdd}><Plus size={16}/> Añadir artículo</button></div>{items.length ? <div className="records-list">{items.map((item) => <article className={`record-row ${item.purchased ? "record-complete" : ""}`} key={item.id}><button className={`task-check ${item.purchased ? "checked" : ""}`} aria-label={item.purchased ? "Marcar sin comprar" : "Marcar como comprado"} onClick={() => onToggle(item)}>{item.purchased && <Check size={12}/>}</button><div className="record-main"><button className="record-title" onClick={() => onEdit(item)}>{item.title}</button><div className="record-meta"><span>{({ baby: "Bebé", parent: "Para mí", home: "Hogar", other: "Otros" })[item.category]}</span>{item.quantity && <><i/><span>Cantidad: {item.quantity}</span></>}</div>{item.notes && <p>{item.notes}</p>}</div><RecordActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)}/></article>)}</div> : <EmptyState icon={<ShoppingBag size={21}/>} title="Tu lista está por estrenar" text="Añade las cosas que quieras buscar o comprar." action="Añadir artículo" onAction={onAdd}/>}</section>;
}
function NotesView({ value, onChange, onSave, busy, demo }: { value: string; onChange: (value: string) => void; onSave: () => void; busy: boolean; demo: boolean }) {
  return <section className="card notes-page"><span className="section-label">UN ESPACIO PRIVADO</span><h2>Mis notas</h2><p>Apunta ideas, preguntas o recuerdos. No escribas información que no quieras guardar en tu cuenta.</p><textarea value={value} maxLength={10000} onChange={(event) => onChange(event.target.value)} placeholder="Escribe aquí lo que quieras recordar…"/><div className="notes-footer"><span>{demo ? "En la demo, la nota solo vive en esta pestaña." : "Solo tú puedes ver esta nota con tu sesión."}</span><button className="primary-button compact-button" onClick={onSave} disabled={busy}>{busy ? "Guardando…" : "Guardar nota"}<Check size={15}/></button></div></section>;
}
function RecordActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="record-actions"><button aria-label="Editar" title="Editar" onClick={onEdit}><Pencil size={15}/></button><button aria-label="Eliminar" title="Eliminar" onClick={onDelete}><Trash2 size={15}/></button></div>; }
function EmptyState({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{text}</p><button className="small-link" onClick={onAction}>{action} <ArrowRight size={14}/></button></div>; }

function ItemDialog({ kind, item, busy, onClose, onSave }: { kind: EditorKind; item?: EditableItem; busy: boolean; onClose: () => void; onSave: (data: FormData) => void }) {
  const title = kind === "task" ? "tarea" : kind === "appointment" ? "cita" : kind === "shopping" ? "artículo" : "antecedente";
  const appointment = item && "startsAt" in item ? item : undefined;
  const task = item && "done" in item ? item : undefined;
  const shopping = item && "purchased" in item ? item : undefined;
  const clinicalEvent = item && "occurredOn" in item ? item : undefined;
  const initialDate = appointment?.startsAt ? appointment.startsAt.slice(0,16) : "";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18}/></button><span className="section-label">{kind === "task" ? "ORGANIZACIÓN" : kind === "appointment" ? "MI CALENDARIO" : kind === "event" ? "HISTORIAL PRIVADO" : "LISTA PERSONAL"}</span><h2 id="editor-title">{item ? "Editar" : "Añadir"} {title}</h2><p>{kind === "event" ? "Guarda un antecedente personal; la app no interpreta el resultado." : "Todos los campos se pueden modificar más adelante."}</p><form action={(formData) => onSave(formData)}><label>{kind === "event" ? "Título" : "Nombre"}<input name="title" required maxLength={180} defaultValue={item && "title" in item ? item.title : ""} placeholder={kind === "appointment" ? "Ej. Visita de seguimiento" : kind === "shopping" ? "Ej. Idea para la lista" : kind === "event" ? "Ej. Resultado o antecedente" : "Ej. Preparar preguntas"}/></label>
    {kind === "task" && <><label>Categoría<select name="category" defaultValue={task?.category ?? "arrival"}>{taskCategories.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label><div className="form-row"><label>Fecha opcional<input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""}/></label><label>Prioridad<select name="priority" defaultValue={task?.priority ?? "normal"}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></label></div></>}
    {kind === "appointment" && <><div className="form-row"><label>Tipo<select name="type" defaultValue={appointment?.type ?? "visit"}>{appointmentTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label><label>Fecha y hora<input name="startsAt" type="datetime-local" required defaultValue={initialDate}/></label></div><label>Estado<select name="certainty" defaultValue={appointment?.certainty ?? "confirmed"}><option value="confirmed">Confirmada</option><option value="orientative">Orientativa</option><option value="pending_confirmation">Pendiente de confirmar</option></select></label><div className="form-row"><label>Lugar opcional<input name="place" maxLength={180} defaultValue={appointment?.place ?? ""}/></label><label>Profesional opcional<input name="professional" maxLength={180} defaultValue={appointment?.professional ?? ""}/></label></div></>}
    {kind === "shopping" && <><div className="form-row"><label>Categoría<select name="category" defaultValue={shopping?.category ?? "baby"}><option value="baby">Bebé</option><option value="parent">Para mí</option><option value="home">Hogar</option><option value="other">Otros</option></select></label><label>Cantidad opcional<input name="quantity" maxLength={60} defaultValue={shopping?.quantity ?? ""} placeholder="Ej. 2 unidades"/></label></div></>}
    {kind === "event" && <><div className="form-row"><label>Tipo de antecedente<select name="eventType" defaultValue={clinicalEvent?.type ?? "other"}>{Object.entries(eventLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Fecha<input name="occurredOn" type="date" required defaultValue={clinicalEvent?.occurredOn ?? ""}/></label></div><div className="form-row"><label>Resultado o valor opcional<input name="resultValue" maxLength={120} defaultValue={clinicalEvent?.resultValue ?? ""}/></label><label>Unidad opcional<input name="resultUnit" maxLength={40} defaultValue={clinicalEvent?.resultUnit ?? ""}/></label></div><label>Detalles opcionales<textarea name="details" rows={4} maxLength={5000} defaultValue={clinicalEvent?.details ?? ""} placeholder="Anota lo que quieras recordar, sin interpretar resultados."/></label></>}
    {kind !== "event" && <label>Notas opcionales<textarea name="notes" rows={3} maxLength={2000} defaultValue={item && "notes" in item ? item.notes : ""} placeholder="Añade un detalle si te resulta útil…"/></label>}<button className="primary-button modal-submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}<ArrowRight size={16}/></button></form></section></div>;
}
