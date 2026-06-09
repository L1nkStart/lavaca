# Product

## Register

product

## Users

Tres perfiles principales, todos en Venezuela y muchos en móvil con conexiones lentas:

- **Donantes**: personas que quieren apoyar una causa y necesitan confiar en que su dinero llega a donde dice. Llegan desde un enlace compartido (WhatsApp, redes), miran la campaña, deciden en minutos y pagan con el método que tengan a mano (tarjeta, PayPal, PagoMóvil, Zelle, cripto, manual). Su pregunta de fondo es "¿esto es real?".
- **Creadores**: quienes levantan una campaña. Pasan por KYC obligatorio, redactan su historia, suben evidencia, gestionan retiros. Necesitan que el flujo de creación y verificación sea claro y no los expulse.
- **Garantes**: validan la veracidad de una campaña con su propio aval. Su panel debe dejar claro qué están firmando y qué responsabilidad asumen.
- **Administradores**: revisan KYC, aprueban pagos manuales, verifican campañas, gestionan retiros y tasas de cambio. Operan en un panel denso, orientado a tareas repetidas con bajo margen de error.

El job-to-be-done central que une a todos: **mover dinero entre desconocidos sin que la confianza se rompa.**

## Product Purpose

LaVaca es una plataforma de crowdfunding diseñada para el ecosistema venezolano. Resuelve lo que GoFundMe no cubre localmente: metas y progreso en USD con conversión automática a bolívares (tasa BCV auto-reparable), KYC obligatorio para creadores, un sistema de garantes que avalan la veracidad de cada campaña, y soporte para múltiples métodos de pago (internacional, local, cripto y manuales).

El éxito se mide en confianza convertida en donación: que un donante que llega frío desde un enlace complete el pago, y que un creador verificado reciba sus fondos sin fricción. Cada decisión de diseño se evalúa contra "¿esto hace que un desconocido confíe lo suficiente para donar?".

## Brand Personality

**Cálida, humana, confiable.** No es un banco y no es una ONG de lástima: es un puente entre vecinos. La voz es directa y solidaria, en español venezolano neutro, sin tecnicismos financieros innecesarios ni lenguaje de hype. Transmite seguridad por transparencia (verificación visible, progreso claro, sin letra chica), no por frialdad corporativa.

Emociones objetivo: **confianza** (lo primero, siempre), **calor humano** (esto es gente ayudando a gente), **momentum esperanzador** (tu donación mueve algo ahora). El calor se carga en copy, fotografía real e iconografía humana, no en colorinches.

## Anti-references

Evitar las cuatro a la vez:

- **Cripto/Web3 ostentoso**: gradientes neón, glow, dark-mode agresivo por defecto, lenguaje de hype ("revoluciona", "imparable"). Resta credibilidad ante donantes reales que manejan dinero limitado.
- **SaaS genérico de v0/shadcn**: el look por defecto del scaffold (cards idénticas en grid infinito, eyebrows en mayúsculas sobre cada sección, el template hero-stats con número gigante y gradiente). Indistinguible de mil apps; no proyecta una marca propia.
- **ONG anticuada**: plantilla de caridad de 2010, stock photos tristes, paleta apagada, jerarquía plana, Bootstrap genérico.
- **Banco corporativo frío**: azul corporativo sin alma, legalismo, cero calidez humana. Aleja al donante individual que dona por empatía, no por contrato.

## Design Principles

1. **La confianza se muestra, no se afirma.** Insignias de verificación, progreso real, identidad del creador, aval de garantes: hacer visible lo que respalda cada campaña en lugar de prometer "seguro" con palabras. La transparencia es la feature, no un eslogan.
2. **El móvil lento es el caso base, no el degradado.** Diseñar primero para una pantalla pequeña y una conexión floja: imágenes optimizadas, payloads ligeros, estados de carga que no dejan la pantalla en blanco. Lo que funciona ahí funciona en todo lo demás.
3. **No expulses a nadie del flujo de dinero.** Donar, completar KYC, aprobar un pago: cada paso con friccón mínima, errores en lenguaje humano, y nunca un callejón sin salida. Si algo falla (sin credenciales, sin tasa), degradar con gracia hacia el camino manual, no romper.
4. **Familiaridad sobre invención en el producto, calor sobre frialdad en la marca.** Los controles, formularios y tablas se comportan como el usuario espera (afordancias estándar de Radix/shadcn); la personalidad cálida vive en copy, color de acento, fotografía e iconografía, no en reinventar componentes.
5. **Densidad para quien la necesita, claridad para quien no.** El panel admin puede ser denso porque su usuario hace la misma tarea cien veces; la página de campaña y el checkout son espaciosos y guiados porque su usuario decide una vez y con dudas.

## Accessibility & Inclusion

- **WCAG AA mínimo** en toda la plataforma: contraste ≥4.5:1 en texto de cuerpo (cuidado con el `muted-foreground` gris sobre fondos tintados), foco visible en teclado, navegación operable sin mouse, labels en todos los controles de formulario.
- **Optimización para móvil y datos limitados** como requisito de inclusión real en Venezuela: targets táctiles ≥44px, imágenes responsivas y comprimidas, primero el contenido, JS no bloqueante.
- **Reduced motion respetado**: toda animación necesita su alternativa `@media (prefers-reduced-motion: reduce)` (crossfade o transición instantánea).
- **Español venezolano neutro** y claro como accesibilidad lingüística: evitar jerga financiera; los mensajes de error explican qué pasó y qué hacer.
