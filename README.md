# BabyPlanner

MVP web en español de España para acompañar el embarazo y organizar preparativos personales. El repositorio original solo tenía `Readme` con una línea; se conserva y la documentación del proyecto vive en este archivo.

## Tecnología y estructura

- Next.js 16 con App Router, React y TypeScript.
- `src/app/`: layout y estilos responsive.
- `src/components/BabyPlannerApp.tsx`: navegación, autenticación, pantallas y formularios del MVP.
- `src/lib/models.ts`: tipos, categorías y cálculo de semana desde la FPP introducida o una estimación derivada de la transferencia.
- `src/lib/demo-data.ts`: contenido enteramente ficticio y guías generales por trimestre.
- `src/lib/supabase/`: clientes SSR de navegador/servidor y renovación de sesión de Next.js.
- `supabase/migrations/`: esquema privado con RLS y registro de cambios de tareas y citas.

## Ejecutar en local

Requiere Node.js 20.9 o posterior. Con pnpm:

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:3000`. Sin credenciales válidas la app ofrece una demo con datos de ejemplo; los cambios de demo solo se mantienen mientras la pestaña siga abierta.

Comprobaciones:

```bash
pnpm typecheck
pnpm build
```

## Conectar Supabase más adelante

1. Crea un proyecto Supabase y copia `.env.example` a `.env.local`.
2. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores de tu proyecto. La publishable key es de cliente; nunca uses una secret/service role key en variables `NEXT_PUBLIC_*`.
3. Reinicia el servidor local y configura la autenticación por correo. Añade `http://localhost:3000/` y el dominio de producción de Vercel a las URL de redirección permitidas para confirmar cuentas y restablecer contraseñas.
4. Revisa las migraciones en orden: `20261018103524_babyplanner_mvp_schema.sql` y después `20261018190000_private_activity_log.sql`. Todavía no se ha conectado a una base de datos y no se ha ejecutado SQL remoto. La app requiere las tablas y políticas de ambas para persistir los datos y mostrar el historial automático.

Cada tabla habilita RLS y tiene políticas separadas de lectura, inserción, actualización y borrado, asociadas a `auth.uid()`. Las claves foráneas compuestas impiden asociar tareas, citas, compras, eventos o notas a un embarazo de otra cuenta. Solo se concede acceso de tabla al rol `authenticated`.

La sección **Historial** guarda eventos privados estructurados (tipo, fecha, resultado opcional y detalles); no interpreta resultados ni síntomas. También muestra los cambios de tareas y citas: una función SQL registra altas, modificaciones, finalizaciones y eliminaciones en una tabla privada append-only con snapshots antes/después. **Datos privados** permite descargar una copia JSON del espacio y borrar el perfil del embarazo y sus registros asociados tras confirmación. La cuenta de autenticación permanece activa. Estas funciones requieren sesión válida y que las dos migraciones revisadas estén aplicadas.

## Fechas y contenido

La semana y el trimestre se calculan desde una FPP confirmada o provisional. Cuando se introducen fecha de transferencia y edad embrionaria, se deriva una estimación editable (transferencia + 266 días − edad embrionaria); la interfaz la etiqueta como pendiente de confirmación clínica. Los datos de clínica y datación viven en el perfil privado. El historial FIV opcional se guarda en una tabla separada y no aparece en el panel general. El número de embriones transferidos no se usa para inferir embarazo único o múltiple. La FPP de la demo es ficticia y está identificada como tal.

El calendario orientativo deriva rangos de semanas desde la FPP guardada. Las sugerencias se pueden añadir manualmente a Tareas, sin crear citas ni marcar nada como realizado. Las fechas y pruebas siempre deben contrastarse con el equipo sanitario.

Los resúmenes son generales y varían por trimestre; la ilustración es decorativa, no una imagen médica ni una medida exacta. La información de desarrollo enlaza a la guía general del [NHS](https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/) y el pie del panel enlaza a la [Guía de embarazo y puerperio del Ministerio de Sanidad](https://observatoriosaludmujeres.sanidad.gob.es/saludSexualReproductiva/saludReproductiva/guiasProtocolos/embarazoPuerperio/home.htm). Las citas, pruebas y listas son configurables y no se presentan como obligatorias para todas las personas.

BabyPlanner es una herramienta de organización e información general, no un producto médico. Las dudas personales se deben consultar con el equipo sanitario.

## Alcance del MVP

Funciona el modo demo interactivo; los cambios de la demo no persisten. Con las variables de entorno locales, una sesión válida y las migraciones revisadas aplicadas, el alta/inicio de sesión por email activa la persistencia RLS del perfil, tareas, citas, compras, notas y antecedentes. La demo bloquea la edición de información privada. Las cuentas reales y la base remota requieren configurar el proyecto y aplicar las migraciones; no se ha conectado ni modificado ningún proyecto remoto.
