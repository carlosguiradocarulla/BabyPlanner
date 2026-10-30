"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Baby, CalendarDays, Check, ChevronRight, Image, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { dateLabel, pregnancyProgress } from "@/lib/models";
import { supabase } from "@/lib/supabase";

type Share = { id: string; pregnancy_id: string; owner_id: string; invited_email: string; can_view_tracking: boolean; can_manage_appointments: boolean; can_manage_shopping: boolean; can_view_photos: boolean; invitation_status: string };
type SharedPregnancy = { id: string; due_date: string | null; due_date_confirmed: boolean };
type ShoppingItem = { id: string; title: string; is_purchased: boolean; category: string; notes: string | null };
type SharedAppointment = { id: string; title: string; appointment_type: "visit" | "ultrasound" | "test" | "class" | "other"; starts_at: string; certainty: "confirmed" | "orientative" | "pending_confirmation"; place: string | null; professional: string | null; notes: string | null };
type Tab = "Seguimiento" | "Citas" | "Compras" | "Fotos";
const appointmentKinds: SharedAppointment["appointment_type"][] = ["visit", "ultrasound", "test", "class", "other"];
const appointmentKindLabel = (kind: SharedAppointment["appointment_type"]) => ({ visit: "Visita", ultrasound: "Ecografía", test: "Prueba", class: "Clase", other: "Otro" })[kind];
const certaintyLabel = (certainty: SharedAppointment["certainty"]) => ({ confirmed: "Confirmada", orientative: "Orientativa", pending_confirmation: "Pendiente de confirmar" })[certainty];

export function FamilyAccessScreen({ userId, fallback, onSignOut, onReturnToPersonal, onCreatePersonalPanel }: { userId: string; fallback?: ReactNode; onSignOut?: () => void; onReturnToPersonal?: () => void; onCreatePersonalPanel?: () => void }) {
  const [email, setEmail] = useState("");
  const [shares, setShares] = useState<Share[]>([]);
  const [active, setActive] = useState<Share | null>(null);
  const [pregnancy, setPregnancy] = useState<SharedPregnancy | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [appointments, setAppointments] = useState<SharedAppointment[]>([]);
  const [appointmentDraft, setAppointmentDraft] = useState<SharedAppointment | null>(null);
  const [tab, setTab] = useState<Tab>("Seguimiento");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError("");
    const { data: userResult } = await supabase.auth.getUser();
    const ownEmail = userResult.user?.email ?? "";
    setEmail(ownEmail);
    const [pending, accepted] = await Promise.all([
      ownEmail ? supabase.from("pregnancy_collaborators").select("id,pregnancy_id,owner_id,invited_email,can_view_tracking,can_manage_appointments,can_manage_shopping,can_view_photos,invitation_status").eq("invited_email", ownEmail.toLowerCase()).eq("invitation_status", "pending") : Promise.resolve({ data: [], error: null }),
      supabase.from("pregnancy_collaborators").select("id,pregnancy_id,owner_id,invited_email,can_view_tracking,can_manage_appointments,can_manage_shopping,can_view_photos,invitation_status").eq("member_user_id", userId).eq("invitation_status", "accepted"),
    ]);
    if (pending.error || accepted.error) setError("No se han podido cargar tus invitaciones. Comprueba que la migración de acceso familiar esté aplicada.");
    const loaded = [...(pending.data ?? []), ...(accepted.data ?? [])] as Share[];
    setShares(loaded);
    setLoading(false);
  }, [userId]);

  const openShare = useCallback(async (share: Share) => {
    if (!supabase) return;
    setBusy(true); setError("");
    const { data, error: shareError } = await supabase.rpc("get_shared_pregnancy", { target_pregnancy_id: share.pregnancy_id });
    const selected = Array.isArray(data) ? data[0] : data;
    if (shareError || !selected) { setError("Este acceso no permite ver el seguimiento o ya no está disponible."); setBusy(false); return; }
    setPregnancy(selected as SharedPregnancy); setActive(share); setTab(share.can_view_tracking ? "Seguimiento" : share.can_manage_appointments ? "Citas" : share.can_manage_shopping ? "Compras" : "Fotos");
    const [shoppingResult, appointmentsResult] = await Promise.all([
      share.can_manage_shopping
        ? supabase.from("shopping_items").select("id,title,is_purchased,category,notes").eq("pregnancy_id", share.pregnancy_id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      share.can_manage_appointments
        ? supabase.from("appointments").select("id,title,appointment_type,starts_at,certainty,place,professional,notes").eq("pregnancy_id", share.pregnancy_id).order("starts_at")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!shoppingResult.error) setShopping((shoppingResult.data ?? []) as ShoppingItem[]);
    else setError("No se ha podido cargar la lista compartida de compras.");
    if (!appointmentsResult.error) setAppointments((appointmentsResult.data ?? []) as SharedAppointment[]);
    else setError("No se han podido cargar las citas compartidas.");
    setBusy(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function accept(share: Share) {
    if (!supabase) return;
    setBusy(true); setError("");
    const { data, error: acceptError } = await supabase.rpc("accept_pregnancy_invitation", { invitation_id: share.id });
    if (acceptError || !data) setError("No se ha podido aceptar la invitación. Comprueba que has iniciado sesión con el correo invitado.");
    else { setNotice("Invitación aceptada. Ya puedes abrir el espacio compartido."); await load(); }
    setBusy(false);
  }

  async function addShopping(form: FormData) {
    if (!supabase || !active || !pregnancy) return;
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    setBusy(true); setError("");
    const { data, error: insertError } = await supabase.from("shopping_items").insert({ user_id: active.owner_id, pregnancy_id: pregnancy.id, title, category: "other", is_purchased: false }).select("id,title,is_purchased,category,notes").single();
    if (insertError) setError("No se ha podido añadir el artículo. Puede que el propietario no haya activado el permiso de compras.");
    else { setShopping((current) => [data as ShoppingItem, ...current]); (document.querySelector("#shared-shopping-form") as HTMLFormElement | null)?.reset(); }
    setBusy(false);
  }

  async function toggleShopping(item: ShoppingItem) {
    if (!supabase || !active) return;
    const next = !item.is_purchased; setError("");
    const { error: updateError } = await supabase.from("shopping_items").update({ is_purchased: next }).eq("id", item.id).eq("pregnancy_id", active.pregnancy_id);
    if (updateError) setError("No se ha podido actualizar el artículo compartido.");
    else setShopping((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_purchased: next } : entry));
  }

  function newAppointment() {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    setAppointmentDraft({ id: crypto.randomUUID(), title: "", appointment_type: "visit", starts_at: start.toISOString(), certainty: "confirmed", place: "", professional: "", notes: "" });
  }

  async function saveAppointment(form: FormData) {
    if (!supabase || !active || !appointmentDraft) return;
    const title = String(form.get("title") ?? "").trim();
    const localStart = String(form.get("starts_at") ?? "");
    if (!title || !localStart) { setError("Indica el título y la fecha de la cita."); return; }
    setBusy(true); setError("");
    const payload = { id: appointmentDraft.id, user_id: active.owner_id, pregnancy_id: active.pregnancy_id, title, appointment_type: String(form.get("appointment_type") ?? "other"), starts_at: new Date(localStart).toISOString(), certainty: String(form.get("certainty") ?? "confirmed"), place: String(form.get("place") ?? "").trim() || null, professional: String(form.get("professional") ?? "").trim() || null, notes: String(form.get("notes") ?? "").trim() || null };
    const { data, error: saveError } = await supabase.from("appointments").upsert(payload).select("id,title,appointment_type,starts_at,certainty,place,professional,notes").single();
    if (saveError) setError("No se ha podido guardar la cita. Revisa que el propietario haya activado este permiso.");
    else { setAppointments((current) => [...current.filter((item) => item.id !== appointmentDraft.id), data as SharedAppointment].sort((a, b) => a.starts_at.localeCompare(b.starts_at))); setAppointmentDraft(null); }
    setBusy(false);
  }

  async function deleteAppointment(item: SharedAppointment) {
    if (!supabase || !active || !window.confirm(`¿Eliminar la cita «${item.title}» del espacio compartido?`)) return;
    setBusy(true); setError("");
    const { error: deleteError } = await supabase.from("appointments").delete().eq("id", item.id).eq("pregnancy_id", active.pregnancy_id);
    if (deleteError) setError("No se ha podido eliminar la cita compartida.");
    else setAppointments((current) => current.filter((entry) => entry.id !== item.id));
    setBusy(false);
  }

  if (loading) return <div className="loading-screen"><span className="brand-mark"><Baby size={19}/></span><p>Buscando invitaciones…</p></div>;
  if (!shares.length) {
    if (fallback) return <>{error && <div role="alert" className="status-banner">{error}</div>}{fallback}</>;
    return <main className="family-page"><div className="family-card"><div className="family-header"><div className="family-brand"><span className="brand-mark"><LockKeyhole size={17}/></span><span>BabyPlanner <small>· acceso invitado</small></span></div><div className="family-header-actions">{onReturnToPersonal && <button className="outline-button" onClick={onReturnToPersonal}>Mi panel personal</button>}{onSignOut && <button className="outline-button" onClick={onSignOut}><LogOut size={14}/> Cerrar sesión</button>}</div></div><h1>Sin invitaciones</h1><p className="family-intro">Cuando alguien comparta su espacio contigo, la invitación aparecerá aquí. Cada acceso se limita a las secciones que esa persona elija.</p>{error && <p role="alert" className="form-error">{error}</p>}</div></main>;
  }
  const progress = pregnancy?.due_date ? pregnancyProgress(pregnancy.due_date, pregnancy.due_date_confirmed) : null;
  const tabs: { label: Tab; allowed: boolean; icon: typeof Baby }[] = [
    { label: "Seguimiento", allowed: Boolean(active?.can_view_tracking), icon: Baby },
    { label: "Citas", allowed: Boolean(active?.can_manage_appointments), icon: CalendarDays },
    { label: "Compras", allowed: Boolean(active?.can_manage_shopping), icon: ShoppingBag },
    { label: "Fotos", allowed: Boolean(active?.can_view_photos), icon: Image },
  ];

  return <main className="family-page">
    <div className="family-card">
      <div className="family-header"><div className="family-brand"><span className="brand-mark"><LockKeyhole size={17}/></span><span>BabyPlanner <small>· acceso compartido</small></span></div><div className="family-header-actions">{onReturnToPersonal && <button className="outline-button" onClick={onReturnToPersonal}>Mi panel personal</button>}{onCreatePersonalPanel && <button className="outline-button" onClick={onCreatePersonalPanel}>Crear mi panel</button>}{onSignOut && <button className="outline-button" onClick={onSignOut}><LogOut size={14}/> Cerrar sesión</button>}</div></div>
      <h1>Espacio compartido</h1><p className="family-intro">Sesión iniciada como {email}. Solo verás las secciones que te han compartido.</p>
      {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
      {!active && <div className="invite-list">{shares.map((share) => <article className="guest-invite" key={share.id}><div><strong>{share.invitation_status === "accepted" ? "Embarazo compartido contigo" : "Tienes una invitación"}</strong><small>Permisos: {[share.can_view_tracking && "seguimiento", share.can_manage_appointments && "citas", share.can_manage_shopping && "compras", share.can_view_photos && "fotos"].filter(Boolean).join(", ") || "ninguno"}</small></div>{share.invitation_status === "pending" ? <button className="primary-button compact-button" disabled={busy} onClick={() => void accept(share)}><Check size={15}/> Aceptar</button> : <button className="outline-button" disabled={busy} onClick={() => void openShare(share)}>Abrir <ChevronRight size={14}/></button>}</article>)}</div>}
      {active && pregnancy && <>
        <div className="family-switch"><span>Espacio al que tienes acceso</span><button className="outline-button" onClick={() => { setActive(null); setPregnancy(null); setAppointmentDraft(null); }}>Cambiar</button></div>
        <nav className="family-tabs" aria-label="Secciones compartidas">{tabs.filter((item) => item.allowed).map(({ label, icon: Icon }) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={16}/>{label}</button>)}</nav>
        {tab === "Seguimiento" && <section className="guest-tracking"><span className="section-label">SEGUIMIENTO GENERAL</span><h2>{progress ? `Semana ${progress.week} + ${progress.day} días` : "Fecha pendiente de configurar"}</h2><p>{pregnancy.due_date_confirmed ? "La fecha probable de parto aparece como confirmada por la persona propietaria." : "La fecha probable de parto es provisional y puede cambiar tras la valoración clínica."}</p>{pregnancy.due_date && <small>FPP: {dateLabel(pregnancy.due_date)}</small>}<div className="clinical-note"><LockKeyhole size={15}/><span>Esta vista comparte solo la semana y la FPP. Las citas, si se han autorizado, aparecen en su propia sección. No se comparte el historial privado ni la información de FIV.</span></div></section>}
        {tab === "Citas" && <section className="guest-appointments"><div className="guest-section-heading"><div><span className="section-label">AGENDA COMPARTIDA</span><h2>Citas</h2><p>Puedes consultar, añadir, editar y eliminar citas según el permiso concedido.</p></div><button className="primary-button compact-button" onClick={newAppointment} disabled={busy}><Plus size={15}/> Añadir cita</button></div>{appointments.length ? <div className="records-list">{appointments.map((item) => <article className="record-row" key={item.id}><div className="date-tile"><strong>{new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(new Date(item.starts_at))}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(item.starts_at)).replace(".", "").toUpperCase()}</span></div><div className="record-main"><strong className="record-title-static">{item.title}</strong><div className="record-meta"><span>{appointmentKindLabel(item.appointment_type)}</span><i/><span>{new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.starts_at))}</span><i/><span>{certaintyLabel(item.certainty)}</span></div>{(item.place || item.professional) && <p>{[item.place, item.professional].filter(Boolean).join(" · ")}</p>}{item.notes && <p>{item.notes}</p>}</div><div className="record-actions"><button aria-label={`Editar ${item.title}`} onClick={() => setAppointmentDraft(item)}><Pencil size={14}/></button><button aria-label={`Eliminar ${item.title}`} onClick={() => void deleteAppointment(item)}><Trash2 size={14}/></button></div></article>)}</div> : <div className="empty-state"><span><CalendarDays size={18}/></span><strong>Aún no hay citas compartidas</strong><p>Puedes añadir una cita o esperar a que la otra persona la añada.</p></div>}{appointmentDraft && <form key={appointmentDraft.id} className="shared-appointment-form" action={saveAppointment}><div className="guest-section-heading"><strong>{appointments.some((item) => item.id === appointmentDraft.id) ? "Editar cita" : "Nueva cita"}</strong><button type="button" className="icon-soft" aria-label="Cerrar formulario" onClick={() => setAppointmentDraft(null)}><X size={15}/></button></div><label>Título<input name="title" required maxLength={180} defaultValue={appointmentDraft.title}/></label><div className="form-row"><label>Fecha y hora<input name="starts_at" type="datetime-local" required defaultValue={(() => { const date = new Date(appointmentDraft.starts_at); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); })()}/></label><label>Tipo<select name="appointment_type" defaultValue={appointmentDraft.appointment_type}>{appointmentKinds.map((kind) => <option value={kind} key={kind}>{appointmentKindLabel(kind)}</option>)}</select></label></div><label>Lugar<input name="place" maxLength={180} defaultValue={appointmentDraft.place ?? ""}/></label><label>Profesional<input name="professional" maxLength={180} defaultValue={appointmentDraft.professional ?? ""}/></label><label>Estado<select name="certainty" defaultValue={appointmentDraft.certainty}><option value="confirmed">Confirmada</option><option value="orientative">Orientativa</option><option value="pending_confirmation">Pendiente de confirmar</option></select></label><label>Notas<textarea name="notes" maxLength={2000} defaultValue={appointmentDraft.notes ?? ""}/></label><div className="shared-appointment-actions"><button type="button" className="outline-button" onClick={() => setAppointmentDraft(null)}>Cancelar</button><button className="primary-button compact-button" disabled={busy}>{busy ? "Guardando…" : "Guardar cita"}</button></div></form>}</section>}
        {tab === "Compras" && <section className="guest-shopping"><h2>Lista de compras compartida</h2><form id="shared-shopping-form" className="guest-add-form" action={addShopping}><input name="title" maxLength={180} placeholder="Añadir un artículo…" required/><button className="primary-button compact-button" disabled={busy}><ShoppingBag size={15}/> Añadir</button></form>{shopping.length ? <div className="records-list">{shopping.map((item) => <div className={`record-row ${item.is_purchased ? "record-complete" : ""}`} key={item.id}><button className={`task-check ${item.is_purchased ? "checked" : ""}`} aria-label={item.is_purchased ? "Marcar como pendiente" : "Marcar como comprado"} onClick={() => void toggleShopping(item)}>{item.is_purchased && <Check size={12}/>}</button><div className="record-main"><strong className="record-title">{item.title}</strong>{item.notes && <p>{item.notes}</p>}</div></div>)}</div> : <div className="empty-state"><span><ShoppingBag size={18}/></span><strong>La lista está vacía</strong><p>Puedes añadir una idea o artículo para compartirlo.</p></div>}</section>}
        {tab === "Fotos" && <PhotoGallery pregnancyId={active.pregnancy_id} userId={userId} ownerId={active.owner_id} demo={false} manageInvites={false}/>}
      </>}
      {busy && <span className="family-busy"><LoaderCircle size={15}/> Guardando…</span>}
      <p className="gallery-footnote">La persona propietaria puede revocar este acceso en cualquier momento. BabyPlanner no sustituye la atención sanitaria.</p>
    </div>
  </main>;
}
