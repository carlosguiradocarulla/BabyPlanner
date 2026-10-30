"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Baby, Check, ChevronRight, Image, LoaderCircle, LockKeyhole, ShoppingBag } from "lucide-react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { dateLabel, pregnancyProgress } from "@/lib/models";
import { supabase } from "@/lib/supabase";

type Share = { id: string; pregnancy_id: string; owner_id: string; invited_email: string; can_view_tracking: boolean; can_manage_shopping: boolean; can_view_photos: boolean; invitation_status: string };
type SharedPregnancy = { id: string; due_date: string | null; due_date_confirmed: boolean };
type ShoppingItem = { id: string; title: string; is_purchased: boolean; category: string; notes: string | null };
type Tab = "Seguimiento" | "Compras" | "Fotos";

export function FamilyAccessScreen({ userId, fallback }: { userId: string; fallback?: ReactNode }) {
  const [email, setEmail] = useState("");
  const [shares, setShares] = useState<Share[]>([]);
  const [active, setActive] = useState<Share | null>(null);
  const [pregnancy, setPregnancy] = useState<SharedPregnancy | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
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
      ownEmail ? supabase.from("pregnancy_collaborators").select("id,pregnancy_id,owner_id,invited_email,can_view_tracking,can_manage_shopping,can_view_photos,invitation_status").eq("invited_email", ownEmail.toLowerCase()).eq("invitation_status", "pending") : Promise.resolve({ data: [], error: null }),
      supabase.from("pregnancy_collaborators").select("id,pregnancy_id,owner_id,invited_email,can_view_tracking,can_manage_shopping,can_view_photos,invitation_status").eq("member_user_id", userId).eq("invitation_status", "accepted"),
    ]);
    if (pending.error || accepted.error) setError("No se han podido cargar tus invitaciones. Comprueba que la migración de acceso familiar esté aplicada.");
    const loaded = [...(pending.data ?? []), ...(accepted.data ?? [])] as Share[];
    setShares(loaded);
    if (active) {
      const current = loaded.find((share) => share.id === active.id && share.invitation_status === "accepted");
      if (current) await openShare(current); else { setActive(null); setPregnancy(null); }
    }
    setLoading(false);
  }, [userId]);

  const openShare = useCallback(async (share: Share) => {
    if (!supabase) return;
    setBusy(true); setError("");
    const { data, error: shareError } = await supabase.rpc("get_shared_pregnancy", { target_pregnancy_id: share.pregnancy_id });
    const selected = Array.isArray(data) ? data[0] : data;
    if (shareError || !selected) { setError("Este acceso no permite ver el seguimiento o ya no está disponible."); setBusy(false); return; }
    setPregnancy(selected as SharedPregnancy); setActive(share); setTab(share.can_view_tracking ? "Seguimiento" : share.can_manage_shopping ? "Compras" : "Fotos");
    if (share.can_manage_shopping) {
      const { data: items, error: shoppingError } = await supabase.from("shopping_items").select("id,title,is_purchased,category,notes").eq("pregnancy_id", share.pregnancy_id).order("created_at", { ascending: false });
      if (!shoppingError) setShopping((items ?? []) as ShoppingItem[]);
      else setError("No se ha podido cargar la lista compartida de compras.");
    }
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

  if (loading) return <div className="loading-screen"><span className="brand-mark"><Baby size={19}/></span><p>Buscando invitaciones…</p></div>;
  if (!shares.length) return fallback ? <>{fallback}</> : <main className="family-page"><div className="family-card"><div className="family-brand"><span className="brand-mark"><LockKeyhole size={17}/></span><span>BabyPlanner <small>· acceso invitado</small></span></div><h1>Sin invitaciones</h1><p className="family-intro">Cuando alguien comparta su espacio contigo, la invitación aparecerá aquí. Cada acceso se limita a las secciones que esa persona elija.</p>{error && <p role="alert" className="form-error">{error}</p>}</div></main>;
  const progress = pregnancy?.due_date ? pregnancyProgress(pregnancy.due_date, pregnancy.due_date_confirmed) : null;
  const tabs: { label: Tab; allowed: boolean; icon: typeof Baby }[] = [
    { label: "Seguimiento", allowed: Boolean(active?.can_view_tracking), icon: Baby },
    { label: "Compras", allowed: Boolean(active?.can_manage_shopping), icon: ShoppingBag },
    { label: "Fotos", allowed: Boolean(active?.can_view_photos), icon: Image },
  ];

  return <main className="family-page">
    <div className="family-card">
      <div className="family-brand"><span className="brand-mark"><LockKeyhole size={17}/></span><span>BabyPlanner <small>· acceso invitado</small></span></div>
      <h1>Espacio compartido</h1><p className="family-intro">Sesión iniciada como {email}. Solo verás las secciones que te han compartido.</p>
      {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
      {!active && <div className="invite-list">{shares.map((share) => <article className="guest-invite" key={share.id}><div><strong>{share.invitation_status === "accepted" ? "Embarazo compartido contigo" : "Tienes una invitación"}</strong><small>Permisos: {[share.can_view_tracking && "seguimiento", share.can_manage_shopping && "compras", share.can_view_photos && "fotos"].filter(Boolean).join(", ") || "ninguno"}</small></div>{share.invitation_status === "pending" ? <button className="primary-button compact-button" disabled={busy} onClick={() => void accept(share)}><Check size={15}/> Aceptar</button> : <button className="outline-button" disabled={busy} onClick={() => void openShare(share)}>Abrir <ChevronRight size={14}/></button>}</article>)}</div>}
      {active && pregnancy && <>
        <div className="family-switch"><span>Espacio al que tienes acceso</span><button className="outline-button" onClick={() => { setActive(null); setPregnancy(null); }}>Cambiar</button></div>
        <nav className="family-tabs" aria-label="Secciones compartidas">{tabs.filter((item) => item.allowed).map(({ label, icon: Icon }) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={16}/>{label}</button>)}</nav>
        {tab === "Seguimiento" && <section className="guest-tracking"><span className="section-label">SEGUIMIENTO GENERAL</span><h2>{progress ? `Semana ${progress.week} + ${progress.day} días` : "Fecha pendiente de configurar"}</h2><p>{pregnancy.due_date_confirmed ? "La fecha probable de parto aparece como confirmada por la persona propietaria." : "La fecha probable de parto es provisional y puede cambiar tras la valoración clínica."}</p>{pregnancy.due_date && <small>FPP: {dateLabel(pregnancy.due_date)}</small>}<div className="clinical-note"><LockKeyhole size={15}/><span>Esta vista comparte solo la semana y la FPP; no muestra historial privado, citas, notas clínicas ni información de FIV.</span></div></section>}
        {tab === "Compras" && <section className="guest-shopping"><h2>Lista de compras compartida</h2><form id="shared-shopping-form" className="guest-add-form" action={addShopping}><input name="title" maxLength={180} placeholder="Añadir un artículo…" required/><button className="primary-button compact-button" disabled={busy}><ShoppingBag size={15}/> Añadir</button></form>{shopping.length ? <div className="records-list">{shopping.map((item) => <div className={`record-row ${item.is_purchased ? "record-complete" : ""}`} key={item.id}><button className={`task-check ${item.is_purchased ? "checked" : ""}`} aria-label={item.is_purchased ? "Marcar como pendiente" : "Marcar como comprado"} onClick={() => void toggleShopping(item)}>{item.is_purchased && <Check size={12}/>}</button><div className="record-main"><strong className="record-title">{item.title}</strong>{item.notes && <p>{item.notes}</p>}</div></div>)}</div> : <div className="empty-state"><span><ShoppingBag size={18}/></span><strong>La lista está vacía</strong><p>Puedes añadir una idea o artículo para compartirlo.</p></div>}</section>}
        {tab === "Fotos" && <PhotoGallery pregnancyId={active.pregnancy_id} userId={userId} ownerId={active.owner_id} demo={false} manageInvites={false}/>}
      </>}
      {busy && <span className="family-busy"><LoaderCircle size={15}/> Guardando…</span>}
      <p className="gallery-footnote">La persona propietaria puede revocar este acceso en cualquier momento. BabyPlanner no sustituye la atención sanitaria.</p>
    </div>
  </main>;
}
