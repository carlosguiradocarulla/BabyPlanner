"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, ImagePlus, LoaderCircle, LockKeyhole, Tag, Upload, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PhotoCategory = "bump" | "gifts" | "ideas" | "other";
type PhotoStage = "first_trimester" | "second_trimester" | "third_trimester";
type Album = "bump" | "other";
type Photo = { id: string; category: PhotoCategory; caption: string; createdAt: string; capturedOn: string; pregnancyWeek: number | null; stage: PhotoStage | null; tags: string[]; url: string };
type Invite = { id: string; invited_email: string; can_view_tracking: boolean; can_manage_shopping: boolean; can_view_photos: boolean; invitation_status: string };

const categories: { value: PhotoCategory; label: string }[] = [
  { value: "bump", label: "Fotos de la barriga" },
  { value: "gifts", label: "Regalos" },
  { value: "ideas", label: "Ideas" },
  { value: "other", label: "Otros recuerdos" },
];
const stageLabels: Record<PhotoStage, string> = { first_trimester: "Primer trimestre", second_trimester: "Segundo trimestre", third_trimester: "Tercer trimestre" };
const photoLabel = (category: PhotoCategory) => categories.find((item) => item.value === category)?.label ?? "Otros recuerdos";
const stageForWeek = (week: number): PhotoStage => week <= 13 ? "first_trimester" : week <= 27 ? "second_trimester" : "third_trimester";
const localDateInput = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

export function PhotoGallery({ pregnancyId, userId, ownerId = userId, demo, manageInvites = true }: { pregnancyId: string; userId: string | null; ownerId?: string | null; demo: boolean; manageInvites?: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [album, setAlbum] = useState<Album>("bump");
  const [categoryFilter, setCategoryFilter] = useState<PhotoCategory | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"captured_newest" | "captured_oldest" | "week_ascending" | "week_descending" | "uploaded_newest">("captured_newest");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputId = `photo-file-${album}`;

  const loadPhotos = useCallback(async () => {
    if (!supabase || demo) return;
    const { data, error: queryError } = await supabase.from("pregnancy_photos").select("id,category,caption,storage_path,created_at,captured_on,pregnancy_week,stage,tags").eq("pregnancy_id", pregnancyId).order("created_at", { ascending: false });
    if (queryError) { setError("No se han podido cargar las fotos. Comprueba que las migraciones locales de galería y metadatos estén revisadas y aplicadas."); return; }
    const signed = await Promise.all((data ?? []).map(async (row) => {
      const { data: urlData } = await supabase!.storage.from("pregnancy-photos").createSignedUrl(String(row.storage_path), 3600);
      return urlData?.signedUrl ? { id: String(row.id), category: row.category as PhotoCategory, caption: String(row.caption ?? ""), createdAt: String(row.created_at), capturedOn: String(row.captured_on ?? ""), pregnancyWeek: row.pregnancy_week == null ? null : Number(row.pregnancy_week), stage: (row.stage ?? null) as PhotoStage | null, tags: Array.isArray(row.tags) ? row.tags.map(String) : [], url: urlData.signedUrl } : null;
    }));
    setPhotos(signed.filter((photo): photo is Photo => photo !== null));
  }, [pregnancyId, demo]);

  const loadInvites = useCallback(async () => {
    if (!supabase || demo || !userId || !manageInvites) return;
    const { data, error: queryError } = await supabase.from("pregnancy_collaborators").select("id,invited_email,can_view_tracking,can_manage_shopping,can_view_photos,invitation_status").eq("pregnancy_id", pregnancyId).eq("owner_id", userId).order("created_at", { ascending: false });
    if (queryError) { setError("No se han podido cargar los accesos compartidos."); return; }
    setInvites((data ?? []) as Invite[]);
  }, [pregnancyId, userId, demo, manageInvites]);

  useEffect(() => { void loadPhotos(); void loadInvites(); }, [loadPhotos, loadInvites]);

  const availableTags = useMemo(() => [...new Set(photos.flatMap((photo) => photo.tags))].sort((a, b) => a.localeCompare(b, "es")), [photos]);
  const visiblePhotos = useMemo(() => {
    const matching = photos.filter((photo) => album === "bump" ? photo.category === "bump" : photo.category !== "bump")
      .filter((photo) => categoryFilter === "all" || photo.category === categoryFilter)
      .filter((photo) => tagFilter === "all" || photo.tags.includes(tagFilter));
    return matching.sort((a, b) => {
      if (sortOrder === "uploaded_newest") return b.createdAt.localeCompare(a.createdAt);
      if (sortOrder === "week_ascending") return (a.pregnancyWeek ?? 99) - (b.pregnancyWeek ?? 99);
      if (sortOrder === "week_descending") return (b.pregnancyWeek ?? -1) - (a.pregnancyWeek ?? -1);
      const dateA = a.capturedOn || a.createdAt.slice(0, 10);
      const dateB = b.capturedOn || b.createdAt.slice(0, 10);
      return sortOrder === "captured_oldest" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [photos, album, categoryFilter, tagFilter, sortOrder]);

  function changeAlbum(next: Album) { setAlbum(next); setCategoryFilter("all"); setTagFilter("all"); }

  async function uploadPhoto(form: FormData) {
    setError(""); setMessage("");
    if (!supabase || !userId || !ownerId || demo) { setError("Inicia sesión para guardar fotos en tu galería privada."); return; }
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) { setError("Elige una imagen antes de continuar."); return; }
    if (!/^image\/(jpeg|png|webp|heic)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Usa una imagen JPG, PNG, WebP o HEIC de hasta 10 MB."); return; }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${pregnancyId}/${crypto.randomUUID()}.${ext}`;
    const category = String(form.get("category") ?? "other") as PhotoCategory;
    const caption = String(form.get("caption") ?? "").trim();
    const capturedOn = String(form.get("captured_on") ?? "");
    const weekValue = String(form.get("pregnancy_week") ?? "");
    const pregnancyWeek = weekValue ? Number(weekValue) : null;
    const enteredStage = String(form.get("stage") ?? "") as PhotoStage | "";
    const stage = enteredStage || (pregnancyWeek ? stageForWeek(pregnancyWeek) : null);
    const tags = [...new Set(String(form.get("tags") ?? "").split(",").map((tag) => tag.trim().toLocaleLowerCase("es-ES")).filter(Boolean))].slice(0, 12);
    try {
      const { error: uploadError } = await supabase.storage.from("pregnancy-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: rowError } = await supabase.from("pregnancy_photos").insert({ pregnancy_id: pregnancyId, owner_id: ownerId, uploaded_by: userId, storage_path: path, category, caption: caption || null, captured_on: capturedOn || null, pregnancy_week: pregnancyWeek, stage, tags });
      if (rowError) {
        await supabase.storage.from("pregnancy-photos").remove([path]);
        throw rowError;
      }
      setMessage(category === "bump" ? "Foto guardada en tu seguimiento privado de barriga." : "Foto guardada en tu álbum privado.");
      (document.querySelector(`#photo-upload-form-${album}`) as HTMLFormElement | null)?.reset();
      await loadPhotos();
    } catch { setError("No se ha podido guardar la foto. Comprueba tu conexión y los permisos de la galería."); }
    finally { setBusy(false); }
  }

  async function inviteFamily(form: FormData) {
    setError(""); setMessage("");
    if (!supabase || !userId || demo) return;
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email || email.length > 320) { setError("Escribe un correo válido para la invitación."); return; }
    setBusy(true);
    const { error: insertError } = await supabase.from("pregnancy_collaborators").insert({ pregnancy_id: pregnancyId, owner_id: userId, invited_email: email, can_view_tracking: form.get("tracking") === "on", can_manage_shopping: form.get("shopping") === "on", can_view_photos: form.get("photos") === "on", invitation_status: "pending" });
    if (insertError) setError("No se ha podido guardar la invitación. Revisa que la migración esté aplicada y que el correo sea distinto al de tu cuenta.");
    else { setMessage("Invitación preparada. La otra persona debe crear una cuenta con ese correo e iniciar sesión para aceptarla. La app todavía no envía correos automáticamente."); (document.querySelector("#family-invite-form") as HTMLFormElement | null)?.reset(); await loadInvites(); }
    setBusy(false);
  }

  async function revokeInvite(invite: Invite) {
    if (!supabase || !userId || !window.confirm(`¿Revocar el acceso de ${invite.invited_email}?`)) return;
    setError("");
    const { error: deleteError } = await supabase.from("pregnancy_collaborators").delete().eq("id", invite.id).eq("owner_id", userId);
    if (deleteError) setError("No se ha podido revocar el acceso."); else { setMessage("Acceso revocado."); await loadInvites(); }
  }

  return <div className="content-stack">
    <section className="card list-page gallery-page">
      <div className="list-page-heading"><div><span className="section-label">RECUERDOS PRIVADOS</span><h2>{album === "bump" ? "Mi seguimiento de barriga" : "Ideas, regalos y recuerdos"}</h2><p>{album === "bump" ? "Guarda tus fotos reales con su fecha y semana para ver tu propio recorrido." : "Reúne fotos que te inspiren o que quieras compartir con tu familia."}</p></div><button type="button" className="primary-button compact-button gallery-upload-cta" onClick={() => document.getElementById(fileInputId)?.click()}><Upload size={15}/> Subir foto</button></div>
      <div className="clinical-note"><LockKeyhole size={15}/><span>Las imágenes son privadas y solo se sirven mediante enlaces temporales con sesión y permisos.</span></div>
      <div className="photo-album-tabs" role="tablist" aria-label="Álbumes de fotos"><button type="button" role="tab" aria-selected={album === "bump"} className={album === "bump" ? "active" : ""} onClick={() => changeAlbum("bump")}>Mi tripa <span>{photos.filter((photo) => photo.category === "bump").length}</span></button><button type="button" role="tab" aria-selected={album === "other"} className={album === "other" ? "active" : ""} onClick={() => changeAlbum("other")}>Ideas y regalos <span>{photos.filter((photo) => photo.category !== "bump").length}</span></button></div>
      {demo && <div className="clinical-note gallery-demo-note"><LockKeyhole size={15}/><span>La galería se muestra en modo demo. Para guardar fotos en privado, inicia sesión con Supabase; aquí no se suben ni almacenan imágenes.</span></div>}
      <form id={`photo-upload-form-${album}`} className="gallery-upload" action={uploadPhoto}>
        <div className="photo-upload-title"><ImagePlus size={17}/><strong>{album === "bump" ? "Añadir una foto de mi barriga" : "Añadir una idea o recuerdo"}</strong></div>
        <label className="photo-picker"><ImagePlus size={18}/><span>Selecciona una imagen<input id={fileInputId} name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" required /></span></label>
        {album === "bump" ? <input type="hidden" name="category" value="bump"/> : <label>Categoría<select name="category" defaultValue="ideas">{categories.filter((item) => item.value !== "bump").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
        <div className="photo-metadata-grid"><label>Fecha de la foto (opcional)<input type="date" name="captured_on" /></label><label>Semana de embarazo (opcional)<select name="pregnancy_week" defaultValue=""><option value="">No indicar semana</option>{Array.from({ length: 40 }, (_, index) => <option key={index + 1} value={index + 1}>Semana {index + 1}</option>)}</select></label><label>Etapa (opcional)<select name="stage" defaultValue=""><option value="">Derivar de la semana si la indicas</option><option value="first_trimester">Primer trimestre</option><option value="second_trimester">Segundo trimestre</option><option value="third_trimester">Tercer trimestre</option></select></label><label>Etiquetas, separadas por comas<input name="tags" maxLength={500} placeholder="familia, habitación, recuerdo…" /></label></div>
        <label>Nota opcional<input name="caption" maxLength={500} placeholder={album === "bump" ? "Cómo quieres recordar este momento" : "Por qué te gusta esta idea"} /></label>
        <p className="photo-form-hint">La fecha, semana y etapa las decides tú; no se deducen ni se confirman automáticamente.</p>
        <button className="primary-button compact-button" disabled={busy || demo}>{busy ? <LoaderCircle size={15} className="spin"/> : <Upload size={15}/>} {demo ? "Inicia sesión para guardar" : `Guardar en ${album === "bump" ? "Mi tripa" : "Ideas y regalos"}`}</button>
      </form>
      {message && <p role="status" className="form-success">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
      {photos.length > 0 && <div className="photo-filter-bar"><label><Filter size={14}/> Tipo<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as PhotoCategory | "all")}><option value="all">Todas</option>{categories.filter((item) => album === "bump" ? item.value === "bump" : item.value !== "bump").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><Tag size={14}/> Etiqueta<select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">Todas</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label><label>Ordenar<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}><option value="captured_newest">Fecha de foto: reciente primero</option><option value="captured_oldest">Fecha de foto: antigua primero</option><option value="week_ascending">Semana: ascendente</option><option value="week_descending">Semana: descendente</option><option value="uploaded_newest">Subida más reciente</option></select></label></div>}
      {visiblePhotos.length ? <div className="photo-grid">{visiblePhotos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.caption || photoLabel(photo.category)}/><figcaption><strong>{photoLabel(photo.category)}</strong><span className="photo-meta-line"><CalendarDays size={12}/>{photo.capturedOn ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${photo.capturedOn}T12:00:00Z`)) : "Fecha sin anotar"}</span>{photo.pregnancyWeek && <span className="photo-meta-line">Semana {photo.pregnancyWeek}{photo.stage ? ` · ${stageLabels[photo.stage]}` : ""}</span>}{!photo.pregnancyWeek && photo.stage && <span className="photo-meta-line">{stageLabels[photo.stage]}</span>}{photo.caption && <span>{photo.caption}</span>}{photo.tags.length > 0 && <span className="photo-tags">{photo.tags.map((tag) => <i key={tag}>#{tag}</i>)}</span>}</figcaption></figure>)}</div> : <div className="empty-state"><span><ImagePlus size={18}/></span><strong>{photos.length ? "No hay fotos con esos filtros" : album === "bump" ? "Empieza tu seguimiento de barriga" : "Tu álbum de ideas está vacío"}</strong><p>{photos.length ? "Prueba otra etiqueta, categoría u orden." : "Añade una imagen cuando quieras; la fecha y la semana son opcionales."}</p></div>}
    </section>
    {manageInvites && <section className="card list-page family-access-card">
      <div className="list-page-heading"><div><span className="section-label">COMPARTIR CON CUIDADO</span><h2>Invitar a alguien</h2><p>Cada persona usa su propia cuenta. Puedes limitar el acceso y revocarlo cuando quieras.</p></div><Users size={19}/></div>
      {!demo && <form id="family-invite-form" className="family-invite-form" action={inviteFamily}>
        <label>Correo de la persona<input name="email" type="email" required maxLength={320} placeholder="familia@ejemplo.es" /></label>
        <div className="share-permissions"><label><input type="checkbox" name="tracking" defaultChecked/> Ver seguimiento</label><label><input type="checkbox" name="shopping"/> Añadir y editar compras</label><label><input type="checkbox" name="photos"/> Ver y subir fotos</label></div>
        <button className="primary-button compact-button" disabled={busy}><Users size={15}/> Preparar invitación</button>
      </form>}
      {invites.length > 0 && <div className="invite-list">{invites.map((invite) => <div className="invite-row" key={invite.id}><div><strong>{invite.invited_email}</strong><small>{invite.invitation_status === "accepted" ? "Acceso aceptado" : invite.invitation_status === "revoked" ? "Revocada" : "Pendiente de aceptación"} · {[
        invite.can_view_tracking && "seguimiento", invite.can_manage_shopping && "compras", invite.can_view_photos && "fotos",
      ].filter(Boolean).join(", ") || "sin permisos"}</small></div><button type="button" className="outline-button" onClick={() => void revokeInvite(invite)}>Revocar</button></div>)}</div>}
      <p className="gallery-footnote">La invitación no concede acceso a citas, notas privadas ni historial de FIV. No se envía un correo desde esta versión.</p>
    </section>}
  </div>;
}
