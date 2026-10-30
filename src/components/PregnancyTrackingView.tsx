"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { closestFetalStage, fetalStageSource } from "@/lib/fetal-stages";
import { getWeeklyGuide } from "@/lib/weekly-content";
import { stageGuides } from "@/lib/demo-data";

function weekReference(week: number) {
  if (week < 4) return "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/";
  const trimester = week <= 12 ? "1st-trimester" : week <= 27 ? "2nd-trimester" : "3rd-trimester";
  return `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/${trimester}/week-${week}/`;
}

export function PregnancyTrackingView({ week, provisional, onWeekChange, guide, notesAvailable = true }: { week: number; provisional: boolean; onWeekChange: (offset: number) => void; guide: (typeof stageGuides)[1 | 2 | 3]; notesAvailable?: boolean }) {
  const prevDisabled = week <= 1;
  const nextDisabled = week >= 40;
  const content = getWeeklyGuide(week);
  const illustration = closestIllustrationWeek(week);
  return <div className="content-stack"><section className="card tracking-book">
    <div className="book-heading"><div><span className="section-label">TU LIBRO DEL EMBARAZO · CAPÍTULO {String(week).padStart(2, "0")}</span><h2>Semana {week}</h2><p>{guide.title} · {guide.weeks}</p></div><div className="week-control"><button disabled={prevDisabled} onClick={() => onWeekChange(-1)} aria-label="Semana anterior"><ChevronLeft size={18}/></button><span>Semana {week}</span><button disabled={nextDisabled} onClick={() => onWeekChange(1)} aria-label="Semana siguiente"><ChevronRight size={18}/></button></div></div>
    {provisional && <div className="clinical-note book-clinical-note"><CircleHelp size={15}/><span>La semana se calcula con una fecha provisional, pendiente de confirmación clínica. La datación de tu equipo sanitario tiene prioridad.</span></div>}
    <p className="book-opening">Una guía para entender esta etapa y preparar tus preguntas. La edad gestacional es una referencia, no una predicción exacta de lo que sentirás o de cómo será una ecografía.</p>
    <DevelopmentImage week={week} illustration={illustration}/>
    <FetalWeekIllustration week={week}/>
    <section className="book-chapter"><span className="book-chapter-index">01 · DESARROLLO</span><h3>Qué puede estar ocurriendo</h3><p>{content.development}</p></section>
    <div className="book-detail-grid"><section className="book-chapter"><span className="book-chapter-index">02 · CUERPO</span><h3>Cambios posibles en tu cuerpo</h3><p>{content.body}</p></section><section className="book-chapter"><span className="book-chapter-index">03 · SENSACIONES</span><h3>Cómo podrías sentirte</h3><p>{content.feelings}</p></section></div>
    <section className="book-tip"><span className="book-chapter-index">04 · A TU RITMO</span><h3>Una idea útil para esta semana</h3><p>{content.tip}</p></section>
    <section className="book-question"><span className="book-chapter-index">PARA TU PRÓXIMA CONSULTA</span><p>«{content.question}»</p><small>{notesAvailable ? "Una pregunta orientativa; puedes adaptarla o guardarla en Notas." : "Una pregunta orientativa que puedes adaptar para comentarla con el equipo sanitario."}</small></section>
    <div className="book-sources"><span>Fuentes y contexto</span><a href={weekReference(week)} target="_blank" rel="noreferrer">Guía semanal del NHS · semana {week} <ArrowRight size={13}/></a><a href="https://www.sanidad.gob.es/organizacion/sns/planCalidadSNS/0Guiaatembarazo.htm" target="_blank" rel="noreferrer">Ministerio de Sanidad · atención al embarazo y puerperio <ArrowRight size={13}/></a><small>El NHS ofrece información general británica; las pruebas y el seguimiento se deciden con el equipo sanitario y pueden variar en España.</small></div>
  </section><div className="content-disclaimer"><CircleHelp size={15}/> BabyPlanner no diagnostica ni interpreta síntomas, imágenes o resultados. Si tienes una duda personal, consúltala con tu equipo sanitario.</div></div>;
}

function closestIllustrationWeek(week: number) {
  const stages = [0, 4, 6, 10, 14, 18, 22, 26, 30, 34, 38];
  const target = week < 4 ? 0 : stages.slice(1).reduce((best, value) => Math.abs(value - week) < Math.abs(best - week) ? value : best, 4);
  return { week: target, position: stages.indexOf(target) / (stages.length - 1) * 100 };
}

function FetalWeekIllustration({ week }: { week: number }) {
  const selectedWeek = Math.min(40, Math.max(1, week));
  const stage = closestFetalStage(selectedWeek);
  const referenceWeek = stage.week;
  return <figure className="fetal-detail-figure">
    <img src={`/images/fetal-development-week-${String(referenceWeek).padStart(2, "0")}.png`} alt={`Ilustración orientativa del desarrollo fetal alrededor de la semana ${referenceWeek}`} />
    <figcaption><span className="book-chapter-index">UNA MIRADA MÁS CERCANA · SEMANA {selectedWeek}</span><h3>El bebé dentro del útero</h3><p>{selectedWeek === referenceWeek ? `Referencia ilustrada para la semana ${referenceWeek}. ${stage.development}` : `Para la semana ${selectedWeek}, mostramos la etapa de referencia más cercana: semana ${referenceWeek}. ${stage.development}`}</p>
      <div className="fetal-stage-facts">{stage.length ? <span><strong>Tamaño orientativo</strong>{stage.length} · {stage.measure}</span> : <span><strong>Etapa muy inicial</strong>Sin medida comparativa en esta guía</span>}<span><strong>Desarrollo variable</strong>La imagen no representa este embarazo ni sirve para valorar su evolución.</span></div>
      <small>Ilustración editorial generada por IA a partir de hitos generales; puede simplificar detalles anatómicos. Las longitudes son referencias medias del NHS y el modo de medir cambia alrededor de la semana 20 (de cabeza a nalgas a cabeza-talón). <a href={fetalStageSource(referenceWeek)} target="_blank" rel="noreferrer">Fuente NHS · semana {referenceWeek}</a>. Las imágenes del NHS no se han reutilizado.</small></figcaption>
  </figure>;
}

function DevelopmentImage({ week, illustration }: { week: number; illustration: { week: number; position: number } }) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    element.scrollTo({ left: Math.max(0, element.scrollWidth * illustration.position / 100 - element.clientWidth / 2), behavior: "smooth" });
  }, [illustration.position]);
  return <figure className="development-figure"><div ref={viewport} className="development-image-wrap"><img src="/images/pregnancy-development-wellcome.jpg" alt="Secuencia ilustrada del embarazo desde las primeras semanas hasta la semana 38"/><span className="development-marker" style={{ left: `${illustration.position}%` }}><i/><b>Semana {week} · referencia ilustrada más cercana: {illustration.week === 0 ? "inicio" : illustration.week}</b></span></div><figcaption><span>Imagen orientativa: la secuencia contiene referencias de semanas 4, 6, 10, 14, 18, 22, 26, 30, 34 y 38; se resalta la más cercana a la semana elegida. No es una imagen médica ni una representación exacta.</span><small>Imagen: “Pregnancy &amp; human development”, Bill McConkey, Wellcome Collection · <a href="https://wellcomecollection.org/works/a7z2fhrh" target="_blank" rel="noreferrer">fuente</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Marcador añadido.</small></figcaption></figure>;
}
