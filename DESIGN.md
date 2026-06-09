---
name: LaVaca
description: Sistema de diseño para la plataforma de crowdfunding verificado de Venezuela.
colors:
  verde-confianza: "oklch(0.26 0.11 183)"
  verde-confianza-dark: "oklch(0.46 0.12 183)"
  terracota: "oklch(0.62 0.14 46)"
  terracota-dark: "oklch(0.72 0.16 46)"
  ink: "oklch(0.145 0 0)"
  surface-white: "oklch(1 0 0)"
  surface-card: "oklch(0.98 0 0)"
  surface-muted: "oklch(0.94 0 0)"
  secondary-gray: "oklch(0.88 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.verde-confianza}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.verde-confianza}"
    textColor: "{colors.surface-white}"
  button-outline:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.terracota}"
    textColor: "{colors.surface-white}"
  badge-verified:
    backgroundColor: "{colors.verde-confianza}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  badge-guaranteed:
    backgroundColor: "{colors.terracota}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
---

# Design System: LaVaca

## 1. Overview

**Creative North Star: "El Puente entre Vecinos"**

LaVaca no es un banco ni una ONG de lástima: es la infraestructura de confianza que deja que un desconocido done a otro desconocido sin que la fe se rompa. El sistema visual trata la verificación como la estructura firme del puente (el Verde Confianza, las insignias, el progreso medible) y el calor humano como quien lo cruza (la Terracota Cálida, la fotografía de gente real, el copy directo en español venezolano). La estructura nunca grita; sostiene en silencio mientras el calor se mueve por encima.

El registro es **producto**: el diseño sirve a la tarea de mover dinero, no se exhibe a sí mismo. Los controles son los que el usuario ya conoce (Radix + shadcn "new-york"), las tablas son densas donde el admin las necesita densas, y el checkout es espacioso donde el donante duda. La personalidad cálida vive en el color de acento, la tipografía y la imagen, jamás en reinventar un botón. Cada pantalla se evalúa contra una sola pregunta: ¿esto hace que un desconocido confíe lo suficiente para donar?

Este sistema rechaza explícitamente cuatro estéticas: el **cripto/Web3 ostentoso** (gradientes neón, glow, dark-mode agresivo, lenguaje de hype), el **SaaS genérico de v0/shadcn** (cards clon en grid infinito, eyebrows en mayúsculas, el template hero-stats), la **ONG anticuada** (stock photos tristes, paleta apagada, jerarquía plana) y el **banco corporativo frío** (azul sin alma, legalismo, cero calidez). Es teal-y-terracota porque la confianza puede ser cálida.

**Key Characteristics:**
- Verificación visible como material de diseño, no como eslogan.
- Móvil lento como caso base, no como degradado.
- Familiaridad de componente, calidez de marca: cada cosa en su capa.
- Plano en reposo, profundidad solo como respuesta a la interacción.
- Español venezolano neutro, claro, sin jerga financiera.

## 2. Colors

Paleta de dos voces sobre neutros limpios: un teal profundo que ancla la confianza y una terracota cálida que dispara la acción, ambos sobre blancos y grises de cromaticidad cero.

### Primary
- **Verde Confianza** (`oklch(0.26 0.11 183)`): el color del aval. Acciones primarias ("Donar Ahora", "Ver campañas"), insignias de "Verificado", barras de progreso, anillos de foco, montos recaudados, la sección CTA drenada al fondo de cada página. Es el color que dice "esto fue revisado". En dark mode sube a `oklch(0.46 0.12 183)` para mantener contraste sobre fondo oscuro.

### Secondary
- **Terracota Cálida** (`oklch(0.62 0.14 46)`): la voz del calor y la urgencia humana. Insignias de "Avalado", iconos de transparencia, hover de botones outline, segundo color de gráficos. Tierra venezolana, no neón. En dark mode sube a `oklch(0.72 0.16 46)`. Es deliberadamente escasa: si la terracota está en todos lados, deja de significar "acción".

### Neutral
- **Tinta** (`oklch(0.145 0 0)`): texto principal sobre fondos claros. Casi negro, cromaticidad cero.
- **Blanco Superficie** (`oklch(1 0 0)`): fondo base del documento en light mode.
- **Superficie Card** (`oklch(0.98 0 0)`): fondo de tarjetas, un punto por debajo del blanco para separarlas sin sombra.
- **Gris Apagado** (`oklch(0.94 0 0)`): fondos de secciones alternas (`bg-muted/50`), campos de input en reposo.
- **Gris Secundario** (`oklch(0.88 0 0)`): botones secundarios, chips neutros.
- **Gris Texto Apagado** (`oklch(0.556 0 0)`): texto de soporte, descripciones, metadatos. **Cuidado:** alcanza ~4.6:1 sobre blanco puro (AA de cuerpo, justo), pero cae por debajo de AA sobre `surface-muted` o `surface-card`. Sobre fondos tintados, súbelo hacia la tinta.
- **Borde** (`oklch(0.922 0 0)`): bordes de tarjeta, divisores, inputs en reposo.

### Tertiary
- **Destructivo** (`oklch(0.577 0.245 27.325)`): un rojo reservado para destruir, rechazar o advertir error. Nunca decorativo.

### Named Rules
**La Regla del Aval Verde.** El Verde Confianza marca lo que fue verificado y las acciones que comprometen dinero, nada más. No se usa como relleno de fondo ni como decoración. Su autoridad viene de que siempre significa lo mismo: "esto es seguro".

**La Regla de la Terracota Escasa.** La Terracota Cálida nunca cubre más del ~15% de una pantalla. Marca acción y aval secundario; su calidez funciona porque es rara. Una pantalla terracota de borde a borde es una pantalla sin jerarquía.

## 3. Typography

**Display / Body Font:** Geist (con `ui-sans-serif, system-ui, sans-serif`)
**Mono Font:** Geist Mono (con `ui-monospace, monospace`)

**Character:** Una sola familia geométrica-neutra cargando todo: títulos, cuerpo, labels, datos. Geist es limpia y contemporánea sin ser fría; su neutralidad deja que el color y el contenido lleven la personalidad. El mono se reserva para cifras tabulares (montos, tasas BCV, IDs) donde la alineación importa. No hay fuente display separada: la jerarquía se construye con peso y escala, no con un segundo tipo.

### Hierarchy
- **Display** (700, `clamp(1.875rem, 4vw, 3rem)`, lh 1.1, tracking -0.02em): el h1 del hero y titulares de página. Techo deliberado en 3rem; este es un producto, no un cartel. `text-wrap: balance`.
- **Headline** (700, `1.5rem`, lh 1.2): encabezados de sección ("Por qué confiar en LaVaca", "Campañas destacadas").
- **Title** (600, `1.125rem`, lh 1.3): títulos de tarjeta, encabezados de subsección, nombres de campaña.
- **Body** (400, `1rem`, lh 1.6): prosa, historias de campaña, descripciones. Largo de línea máximo 65–75ch; las historias largas usan `text-wrap: pretty`.
- **Label** (500, `0.875rem`, lh 1.4): texto de botón, labels de formulario, badges, metadatos. Nunca en mayúsculas completas a tamaño de cuerpo.
- **Mono** (500, `0.875rem`): montos en USD/Bs, tasa de cambio, IDs de transacción. Cifras tabulares donde alinear columnas importa.

### Named Rules
**La Regla de la Escala Fija.** Las tipografías de producto usan rem fijos, no `clamp()` fluido, salvo el h1 del hero. Un título que encoge dentro de un sidebar se ve peor, no mejor. La densidad se ajusta por breakpoint estructural, no estirando la fuente.

**La Regla de Cero Mayúsculas de Cuerpo.** Prohibido el eyebrow en mayúsculas con tracking ancho sobre cada sección. Si una sección necesita etiqueta, es un Title en peso normal o un Badge, no un kicker de 2023.

## 4. Elevation

El sistema es **plano en reposo, elevado por interacción**. Las superficies se separan por tono (card a `oklch(0.98)` sobre fondo blanco) y por borde de 1px (`oklch(0.922)`), no por sombra. La sombra es una respuesta a estado, no una decoración ambiente: una tarjeta de campaña sube a `shadow-lg` solo al hover, señalando "esto es clickeable". Inputs y botones outline llevan un `shadow-xs` casi imperceptible que da peso físico sin profundidad.

### Shadow Vocabulary
- **Reposo de input/outline** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): el `shadow-xs` de inputs y botones outline. Apenas un asiento, no una elevación.
- **Reposo de tarjeta** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): el `shadow-sm` base de las tarjetas. Las separa del fondo sin levantarlas.
- **Hover de tarjeta interactiva** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): el `shadow-lg` que aparece en `transition-shadow` cuando el cursor entra a una `CampaignCard`. La única sombra "alta" del sistema, y solo existe en respuesta a la intención de clic.

### Named Rules
**La Regla de la Sombra como Respuesta.** Las superficies son planas en reposo. La sombra alta aparece solo como reacción a estado (hover, foco, elevación de un menú o diálogo). Una sombra ambiente "para que se vea premium" es la marca de una app de 2014: si está oscura y difusa sin que el usuario haya hecho nada, es decoración y está prohibida.

## 5. Components

Los componentes vienen de shadcn/ui "new-york" sobre Radix. La doctrina es **familiar y sin fricción**: afordancias estándar que el usuario ya sabe operar; la confianza nace de la predecibilidad, no de la sorpresa.

### Buttons
- **Shape:** esquinas suaves (`rounded-md`, 0.5rem). Altura por defecto 36px (`h-9`), `lg` 40px (`h-10`), `sm` 32px (`h-8`).
- **Primary:** fondo Verde Confianza, texto blanco, `px-4 py-2`. La acción que compromete dinero ("Donar Ahora", "Crear mi campaña").
- **Hover / Focus:** primary atenúa a `bg-primary/90`; foco visible con anillo de 3px en `ring/50`. Transición `transition-all`.
- **Outline:** borde de 1px sobre fondo blanco con `shadow-xs`; **al hover invierte a fondo Terracota Cálida con texto blanco** (vía `hover:bg-accent`). Es la firma del sistema: el botón secundario "se calienta" al tocarlo.
- **Secondary / Ghost / Link:** secondary en gris (`bg-secondary`); ghost transparente que toma fondo terracota suave al hover; link en Verde Confianza con subrayado al hover.

### Badges (insignias de confianza)
- **Style:** `rounded-md` (0.5rem) por defecto; las insignias de confianza sobre imagen usan `rounded-full` (píldora). Texto `text-xs font-medium`.
- **Verificado:** Verde Confianza, texto blanco, con icono `CheckCircle2`. Posición superior-derecha sobre la imagen de campaña. Es la pieza de confianza más importante del sistema.
- **Avalado:** Terracota Cálida, texto blanco. Indica que un garante respaldó la campaña. Inferior-derecha sobre la imagen.
- **Categoría:** variante `secondary` en gris, dentro del cuerpo de la tarjeta.

### Cards / Containers
- **Corner Style:** `rounded-xl` (0.875rem), más redondeado que botones para un perfil acogedor.
- **Background:** Superficie Card (`oklch(0.98)`) sobre fondo blanco o gris apagado.
- **Shadow Strategy:** `shadow-sm` en reposo; las tarjetas interactivas (CampaignCard) suben a `shadow-lg` al hover con `transition-shadow`. Ver Elevation.
- **Border:** 1px en Borde (`oklch(0.922)`).
- **Internal Padding:** 24px (`p-6`), `gap-6` entre bloques internos.

### Inputs / Fields
- **Style:** borde de 1px (`border-input`), fondo transparente/blanco, `rounded-md`, `h-9`, `shadow-xs`, texto 16px en móvil (evita el zoom de iOS) y 14px en desktop.
- **Focus:** el borde toma color `ring` (Verde Confianza) y aparece un anillo de 3px en `ring/50`. Sin glow decorativo.
- **Error / Disabled:** `aria-invalid` pinta borde y anillo en Destructivo; disabled baja a `opacity-50` con cursor bloqueado.

### CampaignCard (componente firma)
La unidad atómica de la plataforma. Imagen con `overflow-hidden` y zoom suave al hover (`scale-105`, 300ms), insignias de Verificado/Avalado flotando sobre ella, título a 2 líneas (`line-clamp-2`), barra de progreso Verde Confianza con monto recaudado en peso semibold, atribución al creador, y un par de botones (Donar primary + compartir outline) al pie. Toda la tarjeta es un enlace; la sombra alta al hover confirma que es clickeable. Es donde el sistema entero (confianza visible + calor + acción) se concentra en un solo objeto.

### Navigation
- **Style:** barra superior (Navbar) y footer globales en el layout raíz. Tipografía Label, estados default/hover/active estándar de Radix navigation-menu. En móvil colapsa a Sheet (drawer lateral). Sidebar disponible para los paneles de admin/creator/guarantor.

## 6. Do's and Don'ts

### Do:
- **Do** usar Verde Confianza para acciones de dinero e insignias de verificación, y nada más (La Regla del Aval Verde).
- **Do** mantener la Terracota Cálida por debajo del ~15% de cualquier pantalla (La Regla de la Terracota Escasa).
- **Do** diseñar primero para móvil lento: imágenes optimizadas, targets táctiles ≥44px, texto de input a 16px para no disparar el zoom de iOS.
- **Do** mostrar la confianza con elementos reales (insignia Verificado, barra de progreso, identidad del creador, aval del garante), no afirmarla con adjetivos.
- **Do** mantener cuerpo de texto en Tinta (`oklch(0.145)`) y subir el Gris Texto Apagado hacia la tinta cuando vaya sobre `surface-muted` o `surface-card`; verificar ≥4.5:1 siempre.
- **Do** dejar las superficies planas en reposo; reservar `shadow-lg` para el hover de elementos clickeables (La Regla de la Sombra como Respuesta).
- **Do** acompañar toda animación con su alternativa `@media (prefers-reduced-motion: reduce)`.

### Don't:
- **Don't** caer en el cripto/Web3 ostentoso: nada de gradientes neón, glow, dark-mode agresivo por defecto, ni copy de hype ("revoluciona", "imparable").
- **Don't** dejar el look de SaaS genérico de v0/shadcn: prohibido el grid de cards idénticas icono+título+texto repetido sin fin, los eyebrows en mayúsculas con tracking sobre cada sección, y el template hero-stats (número gigante + gradiente).
- **Don't** parecer ONG anticuada: sin stock photos tristes, paleta apagada ni jerarquía plana de plantilla 2010.
- **Don't** parecer banco corporativo frío: sin azul sin alma, legalismo ni cero calidez; el calor humano es parte del producto.
- **Don't** usar `border-left`/`border-right` mayor a 1px como franja de color en cards, alerts o list items; usar borde completo, tinte de fondo o icono.
- **Don't** usar texto con gradiente (`background-clip: text`); el énfasis va por peso y tamaño, en color sólido.
- **Don't** usar glassmorphism decorativo ni sombras ambiente "premium" en reposo.
- **Don't** poner Gris Texto Apagado (`oklch(0.556)`) sobre fondos tintados o como placeholder sin verificar contraste; es el error de legibilidad más fácil de cometer aquí.
- **Don't** usar Geist Mono para prosa; es solo para cifras tabulares (montos, tasas, IDs).
