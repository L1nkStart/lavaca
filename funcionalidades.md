Documento de Funcionalidades de la Aplicación "LaVaca"
Versión: 1.0
Fecha: 15 de noviembre de 2025
Proyecto: Plataforma de Crowdfunding para Venezuela ("LaVaca")
1. Visión del Producto
"LaVaca" es una plataforma de crowdfunding diseñada para el mercado venezolano, enfocada en la transparencia total y la facilidad de pago. Permite a individuos y organizaciones recaudar fondos para causas verificadas, aceptando donaciones tanto en Bolívares como en divisas (USD, Cripto), mientras resuelve el problema de la confianza a través de un sistema de verificación de identidad y de "Garantes".
2. Roles de Usuario
Donante: Cualquier visitante (anónimo o registrado) que aporta fondos.
Creador de Campaña: Usuario verificado que necesita recaudar fondos.
Garante (Veedor): Un tercero verificado (ONG, médico, etc.) que avala la veracidad de una campaña.
Administrador: El equipo de "LaVaca" que gestiona la plataforma.
3. Funcionalidades de la Plataforma (Generales)
Estas son las características disponibles para cualquier visitante del sitio web.
3.1. Navegación y Descubrimiento
Página de Inicio: Muestra una selección de campañas (destacadas, urgentes, nuevas, exitosas).
Catálogo de Campañas: Permite explorar todas las campañas activas.
Filtrado y Categorías: Filtrar campañas por categoría (Salud, Educación, Emprendimiento, Comunitaria, etc.), ubicación o estado.
Buscador: Una barra de búsqueda para encontrar campañas por título o palabras clave.
3.2. Página de Detalles de la Campaña
Es la página pública de cada recaudación.
Información Principal: Título, foto/video principal, nombre del Creador.
Meta Financiera (En USD):
Muestra la meta total en Dólares (Ej. $1,500).
Muestra el progreso recaudado en Dólares (Ej. $450).
Una barra de progreso visual.
Contenido de la Campaña:
La "Historia" o descripción completa.
Galería de imágenes y videos.
Sección de "Documentos de Soporte" (Ej. informes médicos, presupuestos) visibles para el público.
Sello de Confianza (Crítico):
Un indicador visual claro si la campaña ha sido "Verificada por el Creador" (KYC Básico).
Un sello de "Confianza Superior" si la campaña está avalada por un "Garante" (ONG, médico, etc.).
Sección de Donantes: Muestra una lista de donaciones recientes, con la opción del donante de aparecer como "Anónimo".
Botones de Acción:
Botón claro de "Donar Ahora".
Botones para "Compartir" en redes sociales (WhatsApp, X, Instagram, Facebook).
Pestaña de "Actualizaciones": Un blog donde el Creador publica novedades sobre el progreso de la causa.
4. Funcionalidades del Donante
4.1. Proceso de Donación
Monto en USD: El donante siempre introduce el monto que desea donar en Dólares (Ej. $10).
Selección de Método de Pago:
Pagos en Divisas (Automatizados):
Tarjeta de Crédito Internacional (vía Stripe).
PayPal.
Pagos en Bolívares (Automatizados):
El sistema muestra el monto exacto en Bs. (calculado con la tasa BCV del día).
PagoMóvil (idealmente C2P, donde el usuario solo introduce su teléfono y cédula y acepta el pago en su banco).
Pagos Manuales (Reporte):
Opción para "Reportar Zelle" o "Reportar Transferencia en Bs.".
El sistema muestra los datos bancarios (o email de Zelle) de "LaVaca".
El donante realiza el pago por su cuenta y luego llena un formulario en la app (monto, referencia, capture) para que el Administrador lo apruebe.
Pagos con Criptomonedas (Reporte):
Opción para pagar con USDT (BEP20/TRC20).
Muestra la dirección de la Wallet (QR y texto).
El donante envía y luego reporta el "Hash" de la transacción.
Datos del Donante:
Opción de donar como anónimo.
Opción de registrarse o donar como invitado.
Recibo: Envío automático de un correo de confirmación de donación (y de aprobación, en caso de pagos manuales).
4.2. Perfil del Donante (Usuario Registrado)
Registro Básico: Registrarse con Email/Contraseña o Google.
Historial de Donaciones: Un panel simple para ver todas las donaciones que ha realizado.
5. Funcionalidades del Creador de Campaña
5.1. Verificación de Identidad (KYC) - Paso Obligatorio
Para poder crear una campaña, el usuario debe primero completar su perfil y ser verificado.
Formulario de KYC:
Subir foto de Cédula de Identidad o RIF (para organizaciones).
Proveer datos personales (nombre completo, teléfono).
Datos de Retiro: Registrar los datos donde recibirá los fondos recaudados (Cuenta en Bs., PagoMóvil, Zelle, PayPal, Wallet USDT).
Estado de Verificación: El perfil mostrará "Pendiente", "Verificado" o "Rechazado" (con motivo).
5.2. Creación y Gestión de Campañas
Formulario de Creación (Solo para Verificados):
Título, Categoría, Monto Meta (en USD).
Carga de imagen principal, galería de fotos/videos.
Editor de texto para la "Historia".
Carga de "Documentos de Soporte" (informes, presupuestos).
Invitar Garante (Opcional pero recomendado):
Una función para invitar a un tercero (email) a ser el "Garante" de la campaña para aumentar la confianza.
Estado de la Campaña:
Borrador: Guardada pero no enviada a revisión.
Pendiente de Revisión: Enviada al Administrador para aprobación.
Activa: Pública y recibiendo fondos.
Cerrada: Finalizada (exitosa o no).
Rechazada: No cumple las normas (con motivo).
5.3. Dashboard del Creador
Visión General: Estadísticas de sus campañas (visitas, donantes, monto recaudado en $).
Gestión de Retiros:
Ver sus saldos disponibles (Saldo en Bs. y Saldo en $).
Botón para "Solicitar Retiro" de fondos.
El creador elige qué monto y a qué destino (de sus cuentas pre-registradas) desea el retiro.
Historial de retiros (pendientes, completados).
Gestión de Campaña Activa:
Función para "Publicar Actualización" en el blog de su campaña.
Agradecer a los donantes.
6. Funcionalidades del Garante (Veedor)
6.1. Verificación de Garante (KYC)
Recibe una invitación por email de un Creador de Campaña.
Debe registrarse y pasar su propio KYC (Ej. RIF de la ONG, carnet del colegio de médicos, etc.).
6.2. Panel del Garante
Ver las solicitudes de "apadrinamiento" de campañas.
Aceptar o Rechazar ser el garante de una campaña.
Una vez aceptado, su nombre/organización y sello de confianza aparecen públicamente en la campaña.
(Opcional - Seguridad Avanzada): Posibilidad de requerir la aprobación del Garante para que el Creador pueda retirar los fondos.
7. Funcionalidades del Administrador (Back-Office)
7.1. Dashboard de Verificación (Control de Confianza)
Cola de KYC de Usuarios: Panel para ver, revisar (documentos) y Aprobar/Rechazar a los Creadores de Campaña.
Cola de KYC de Garantes: Panel para Aprobar/Rechazar a los Garantes.
Cola de Campañas: Panel para revisar (historia, documentos de soporte) y Aprobar (publicar)/Rechazar las campañas nuevas.
7.2. Dashboard Financiero (Control de Pagos)
Cola de Pagos Manuales (Crítico):
El panel más importante del día.
Ver la lista de reportes de Zelle, Transferencias Bs. y Cripto.
Comparar el capture/referencia con las cuentas bancarias de "LaVaca".
Botón de "Aprobar" (que acredita el saldo en $ a la campaña) o "Rechazar" (con motivo).
Cola de Solicitudes de Retiro:
Ver las solicitudes de retiro de los Creadores.
Botón para marcar como "Procesado" (luego de que el admin realiza la transferencia manualmente desde el banco o PayPal).
Configuración:
Definir el porcentaje de comisión de la plataforma.
Establecer la tasa de cambio BCV (manual o automática).
7.3. Gestión de Contenido
Marcar campañas como "Destacadas" para la página de inicio.
Suspender o dar de baja campañas fraudulentas.
Editar categorías.






















Documento de Requerimientos de Software (SRS)

1. Introducción
1.1. Propósito
Este documento especifica los requerimientos técnicos, funcionales y no funcionales para el desarrollo de la plataforma de crowdfunding "LaVaca". Está destinado al equipo de desarrollo, diseño y QA.
1.2. Visión General del Producto
"LaVaca" será una plataforma web (con enfoque PWA) que permitirá a usuarios venezolanos crear y gestionar campañas de recaudación de fondos. El sistema está diseñado para mitigar los problemas de confianza y volatilidad económica de Venezuela.
1.3. Objetivos Técnicos Clave
Mitigar Volatilidad: Toda la lógica financiera (metas, progreso) se manejará en USD como moneda principal. Las donaciones en Bolívares (Bs.) se convertirán a USD en tiempo real.
Generar Confianza: Implementar un sistema de verificación de identidad robusto (KYC) y un rol de "Garante" (veedor) para validar la legitimidad de las campañas.
Flexibilidad de Pagos: Soportar un ecosistema de pago fragmentado, incluyendo pasarelas automatizadas (PagoMóvil, Stripe) y reportes manuales (Zelle, Bs., Cripto).




2. Arquitectura y Stack Tecnológico
Componente
Tecnología
Razón de Elección
Framework
Next.js (con App Router)
SSR y SSG para SEO y rendimiento. API Routes para lógica de backend segura (pagos, webhooks).
Hosting (Frontend)
Vercel
Integración nativa con Next.js, despliegue continuo (CI/CD) y escalabilidad serverless.
Backend (BaaS)
Supabase
Backend "todo en uno": Base de datos PostgreSQL, Autenticación, Storage y APIs instantáneas.
Hosting (Backend)
Supabase Cloud
Infraestructura gestionada para la base de datos y servicios.
Base de Datos
PostgreSQL (vía Supabase)
Relacional, robusta y con soporte para Row Level Security (RLS).
Autenticación
Supabase Auth
Manejo de usuarios, JWT y políticas de seguridad. Integración con RLS.
Almacenamiento
Supabase Storage
Almacenamiento seguro de archivos (KYC, capturas de pago, fotos de campaña).
Pagos (Intl.)
Stripe, PayPal
Pasarelas estándar para TCD internacional y fondos desde el exterior.
Pagos (Nacional)
APIs Bancarias (PagoMóvil C2P/P2C)
Integración directa para pagos automatizados en Bolívares.
APIs Externas
API del BCV (o similar)
Para obtener la tasa de cambio Bs./USD diaria.


3. Requerimientos Funcionales (RF)
RF-AUTH: Autenticación y Perfil
RF-A01: El sistema permitirá el registro de usuarios mediante Email/Contraseña y proveedores OAuth (Google). Se usará supabase.auth.signUp().
RF-A02: El sistema permitirá el inicio de sesión (supabase.auth.signInWithPassword()).
RF-A03 (KYC): El perfil de usuario debe incluir un formulario para subir documentos (Cédula/RIF) y datos personales.
RF-A04 (Storage): Los documentos de KYC se subirán a un bucket seguro de Supabase Storage (kyc-documents). El bucket debe ser privado y accesible solo por el admin y el propio usuario vía RLS.
RF-A05 (Datos de Retiro): El perfil debe permitir al usuario almacenar de forma segura sus datos para recibir retiros (Cuenta Bs., Zelle, PayPal, Wallet USDT).
RF-CAMP: Gestión de Campañas
RF-C01: El sistema solo permitirá el acceso al formulario de creación de campaña a usuarios con profiles.kyc_status = 'verified'.
RF-C02: El formulario de creación debe guardar: title, slug (URL única), story (descripción), goal_amount_usd (meta en USD), e main_image_url.
RF-C03: El formulario debe permitir la subida de documentos de soporte (informes, presupuestos) a supabase.storage.from('campaign-support').
RF-C04: El sistema permitirá al Creador vincular un garante_id (UUID de otro perfil verificado como garante) a su campaña.
RF-C05: La página pública de la campaña (/campaña/[slug]) debe ser renderizada por servidor (SSR) o generada estáticamente (SSG) para optimización SEO.
RF-C06: El progreso de la campaña (current_amount_usd) debe calcularse como un SUM() de las donaciones aprobadas en la tabla donations.
RF-C07: El Creador podrá publicar "Actualizaciones" (CRUD simple) vinculadas a su campaign_id.
RF-PAY: Lógica de Pagos y Donaciones
RF-P01: El flujo de donación debe solicitar el monto en USD.
RF-P02 (API Tasa): Se debe crear una API Route (/api/tasa-bcv) que obtenga la tasa del BCV y la almacene en caché/BD para ser consultada por los flujos de pago en Bs.
RF-P03 (API PagoMóvil): API Route (/api/pagar/pagomovil) que:
Recibe el amount_usd.
Consulta la tasa (RF-P02) y calcula el amount_bs.
Inicia la transacción C2P/P2C con el banco.
Al confirmar, crea el registro en donations (status: completed).
RF-P04 (API Stripe): API Route (/api/pagar/stripe) que crea un PaymentIntent de Stripe.
RF-P05 (Webhook Stripe): API Route (/api/webhooks/stripe) para recibir confirmaciones de pago de Stripe.
RF-P06 (API PayPal): API Route (/api/pagar/paypal) para generar la orden de pago.
RF-P07 (Reporte Manual): Un formulario de "Reportar Pago" (Zelle, Bs., Cripto) que:
Toma los datos de la transferencia (referencia, monto).
Permite subir un capture (RF-P08).
Crea un registro en donations con status = 'pending_approval'.
RF-P08 (Storage Captures): Los captures de pagos manuales se subirán a supabase.storage.from('payment-captures').
RF-ADMIN: Panel de Administración
RF-A01: El dashboard de admin será una sección protegida de la aplicación Next.js, accesible solo por roles de admin.
RF-A02 (Cola KYC): El panel debe mostrar una vista de profiles donde kyc_status = 'pending'. Debe permitir visualizar los documentos de kyc-documents y cambiar el estado a verified o rejected.
RF-A03 (Cola Campañas): El panel debe mostrar campaigns donde status = 'pending_review'. Debe permitir revisar los datos y documentos y cambiar el estado a active o rejected.
RF-A04 (Cola Pagos Manuales): El panel debe mostrar donations donde status = 'pending_approval'. Debe mostrar el capture y los datos del reporte.
RF-A05 (Aprobación Pago): Un botón "Aprobar" (para RF-A04) que:
Cambia donations.status a completed.
Actualiza (vía trigger/función de BD) el campaigns.current_amount_usd sumando la donations.amount_usd.
RF-A06 (Cola Retiros): El panel debe mostrar withdrawals donde status = 'pending'.
RF-A07 (Proceso Retiro): Un botón "Marcar como Procesado" que actualiza withdrawals.status a completed (esto es un registro contable; el pago es manual por el admin).
4. Requerimientos No Funcionales (RNF)
RNF-01 (Seguridad - RLS): Se debe implementar Row Level Security (RLS) en PostgreSQL/Supabase de forma estricta:
Usuarios solo pueden leer/editar su propio perfil en profiles.
Creadores solo pueden editar/actualizar sus propias campañas en campaigns.
Los archivos en Storage (kyc-documents, payment-captures) solo deben ser accesibles por el usuario propietario o un rol de admin.
Las claves de API (Stripe, Bancos, Supabase) deben almacenarse exclusivamente en variables de entorno (.env.local).
RNF-02 (Rendimiento):
La aplicación debe ser una PWA (Progressive Web App) para mejorar la resiliencia en conexiones lentas.
Optimización de imágenes con next/image (formato WebP).
Las páginas públicas de campañas (SSR/SSG) deben tener un LCP (Largest Contentful Paint) < 2.5 segundos.
RNF-03 (Usabilidad):
El diseño debe ser Mobile-First y 100% responsivo.
El flujo de donación no debe exceder los 3 pasos.
RNF-04 (Localización):
El idioma principal será Español (Venezuela).
La moneda de visualización principal será USD, con conversión a Bs. al momento del pago.
RNF-05 (Escalabilidad): La arquitectura serverless (Vercel + Supabase) debe escalar horizontalmente bajo demanda.

