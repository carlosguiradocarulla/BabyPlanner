export type FetalStage = {
  week: number;
  length: string | null;
  measure: string | null;
  development: string;
};

// Broad educational milestones, paraphrased from the NHS week-by-week guide.
// Lengths are population references, not estimates for an individual pregnancy.
export const fetalStages: FetalStage[] = [
  { week: 4, length: null, measure: null, development: "Etapa inicial: agrupación celular e implantación; todavía no tiene la silueta reconocible de un bebé." },
  { week: 6, length: "6 mm", measure: "longitud aproximada del embrión", development: "Aparecen esbozos diminutos de brazos y piernas. La cabeza destaca y la piel es muy fina; aún no hay dedos formados." },
  { week: 8, length: "16 mm", measure: "cabeza a nalgas", development: "El embrión sigue curvado. Los brazos empiezan a alargarse; las piernas y las articulaciones todavía son pequeñas y están en desarrollo." },
  { week: 10, length: "30 mm", measure: "cabeza a nalgas", development: "La forma se va haciendo más reconocible, con cabeza grande respecto al cuerpo. Rasgos de la cara y extremidades continúan desarrollándose." },
  { week: 12, length: "5,4 cm", measure: "cabeza a nalgas", development: "La silueta es más reconocible, aunque la cabeza sigue siendo proporcionalmente grande. Continúan desarrollándose músculos, órganos y esqueleto." },
  { week: 14, length: "8,5 cm", measure: "cabeza a nalgas", development: "La cabeza empieza a verse más redondeada y el cuerpo gana longitud. Las proporciones continúan cambiando." },
  { week: 16, length: "11,6 cm", measure: "cabeza a nalgas", development: "Las extremidades se alargan y las manos pueden cerrar los dedos. La piel sigue siendo fina y el cuerpo todavía es delgado." },
  { week: 18, length: "14,2 cm", measure: "cabeza a nalgas", development: "El crecimiento y la coordinación siguen avanzando; puede aparecer lanugo, un vello fino y temporal." },
  { week: 20, length: "25,6 cm", measure: "cabeza a talón", development: "La referencia pasa a medirse de cabeza a talón. El bebé se mueve y puede llevarse la mano a la boca; aún queda mucho crecimiento." },
  { week: 22, length: "27,8 cm", measure: "cabeza a talón", development: "Continúan la maduración pulmonar y el desarrollo del reflejo de succión. La piel aún es fina y puede verse arrugada." },
  { week: 24, length: "30 cm", measure: "cabeza a talón", development: "Prosiguen el crecimiento y la formación de grasa bajo la piel. Los movimientos pueden sentirse de forma distinta en cada embarazo." },
  { week: 26, length: "35,6 cm", measure: "cabeza a talón", development: "Los párpados pueden empezar a abrirse y cerrarse; continúan la maduración del sistema nervioso y los pulmones." },
  { week: 28, length: "37,6 cm", measure: "cabeza a talón", development: "Comienza el tercer trimestre en la organización usada aquí. Continúan la maduración de órganos y el aumento de peso." },
  { week: 30, length: "39,9 cm", measure: "cabeza a talón", development: "Puede estirarse y hacer movimientos de agarre; el cerebro y otros sistemas siguen madurando." },
  { week: 32, length: "42,4 cm", measure: "cabeza a talón", development: "El cuerpo gana peso y puede empezar a perder parte del lanugo. La postura dentro del útero puede variar." },
  { week: 34, length: "45 cm", measure: "cabeza a talón", development: "Las extremidades pueden verse más llenitas; los huesos maduran y los del cráneo mantienen flexibilidad." },
  { week: 36, length: "47,4 cm", measure: "cabeza a talón", development: "Prosiguen la maduración y el aumento de reservas corporales. La posición fetal solo puede confirmarse clínicamente." },
  { week: 38, length: "49,8 cm", measure: "cabeza a talón", development: "Suele quedar menos lanugo y continúa la maduración hasta el nacimiento; hay variación individual." },
  { week: 40, length: "51,2 cm", measure: "cabeza a talón", development: "La fecha probable es una referencia, no el día exacto del nacimiento. La evolución y el seguimiento corresponden al equipo sanitario." },
];

export function closestFetalStage(week: number): FetalStage {
  return fetalStages.reduce((closest, stage) =>
    Math.abs(stage.week - week) < Math.abs(closest.week - week) ? stage : closest,
  fetalStages[0]);
}

export function fetalStageSource(week: number): string {
  const trimester = week <= 12 ? "1st-trimester" : week <= 27 ? "2nd-trimester" : "3rd-trimester";
  return `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/${trimester}/week-${week}/`;
}
