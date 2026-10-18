import type { Workspace } from "@/lib/models";

export const demoWorkspace: Workspace = {
  pregnancy: { id: "demo-pregnancy", dueDate: "2027-03-03", dueDateConfirmed: true, conceptionMethod: "unspecified", transferDate: "", embryoAgeDays: "", embryosTransferred: "", embryoQuality: "", clinicName: "", sacStatus: "unknown" },
  tasks: [
    { id: "demo-task-1", title: "Preparar preguntas para la próxima visita", category: "appointments_tests", dueDate: "2026-10-22", priority: "normal", done: false, notes: "Ejemplo editable." },
    { id: "demo-task-2", title: "Mirar opciones de clases prenatales", category: "admin", dueDate: "", priority: "low", done: false, notes: "Ejemplo editable." },
    { id: "demo-task-3", title: "Empezar una lista para la bolsa", category: "arrival", dueDate: "", priority: "normal", done: true, notes: "Ejemplo editable." },
    { id: "demo-task-4", title: "Anotar ideas para la habitación", category: "shopping", dueDate: "", priority: "low", done: false, notes: "Ejemplo editable." },
  ],
  appointments: [
    { id: "demo-appointment-1", title: "Visita de seguimiento", type: "visit", startsAt: "2026-10-22T10:30", place: "", professional: "", notes: "Cita ficticia de demostración.", certainty: "confirmed" },
    { id: "demo-appointment-2", title: "Ecografía", type: "ultrasound", startsAt: "2026-11-04T12:00", place: "", professional: "", notes: "Ejemplo editable, no es una pauta recomendada.", certainty: "orientative" },
  ],
  shopping: [
    { id: "demo-shopping-1", title: "Ideas para la bolsa", category: "parent", quantity: "", purchased: false, notes: "Lista de demostración, editable y no universal." },
    { id: "demo-shopping-2", title: "Organizador para casa", category: "home", quantity: "1", purchased: false, notes: "" },
  ],
  note: "Este espacio es privado en tu cuenta. En la demo, las notas no se guardan al cerrar la página.",
  ivfHistory: "",
  events: [],
  activity: [],
};

export const stageGuides = {
  1: { title: "Primer trimestre", weeks: "Semanas 1–13", development: "En esta etapa inicial se forman progresivamente estructuras importantes. El ritmo y la evolución varían entre embarazos.", changes: "Algunas personas notan cansancio o cambios en cómo se sienten; otras apenas perciben cambios. Cada experiencia es distinta.", idea: "Si te ayuda, apunta las preguntas que quieras comentar con tu equipo sanitario.", reference: "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/" },
  2: { title: "Segundo trimestre", weeks: "Semanas 14–27", development: "El desarrollo continúa y el cuerpo y el embarazo siguen cambiando. Las medidas y la evolución individuales pueden variar.", changes: "Pueden aparecer sensaciones nuevas o cambiar las anteriores. No existe una única experiencia que sirva para todas las personas.", idea: "Puedes anotar citas, ideas o dudas para revisarlas cuando te venga bien.", reference: "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/" },
  3: { title: "Tercer trimestre", weeks: "Semanas 28–40", development: "El desarrollo prosigue hasta el nacimiento. La fecha estimada orienta la planificación y no fija por sí sola cuándo ocurrirá.", changes: "El descanso, la comodidad y las emociones pueden cambiar a medida que avanza el embarazo; la vivencia es personal.", idea: "Si lo deseas, organiza tus preparativos en pasos pequeños y ajustados a tus preferencias.", reference: "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/" },
} as const;
