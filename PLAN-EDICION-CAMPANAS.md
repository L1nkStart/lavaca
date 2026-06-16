# Plan de trabajo — Edición segura de campañas

**Estado**: en implementación
**Fecha**: junio 2026
**Ruta principal**: `/creator/campaigns/[id]/edit`

**Decisiones confirmadas (vía preguntas):**
1. **Imágenes**: cola de moderación (shadow editing) + historial de multimedia + límites de peso/formato/cantidad **ahora**. El reprocesado con Sharp (resize 1200x630 + webp) queda para una **segunda fase** (es la parte de mayor riesgo en Coolify/Nixpacks porque obliga a subir vía endpoint server-side).
2. **Stretch goals**: **diferidos** (patrón de proyectos creativos; LaVaca es salud/benéfico). Se documentan como fase futura.
3. **Aumento de meta**: **auto con transparencia total** (motivo obligatorio, historial, etiqueta "Meta original", comentario del sistema en el muro, notificaciones). Se congela solo si la campaña cerró o ya retiró fondos → ahí requiere admin.
4. **Título / historia / categoría**: **siguen bloqueados** (igual que hoy). El alcance se concentra en meta + imágenes + documentos + updates.

> Nota de realidad: el envío de correo a donantes **todavía no es posible** (Resend está diferido). Por ahora cada cambio relevante genera: (a) una **actualización** (`campaign_updates`) con el motivo, (b) un **comentario del sistema** en el muro y (c) **notificaciones in-app** a donantes y seguidores. Cuando se integre Resend, se engancha el correo en el mismo punto.

---

## 1. Estado actual (lo que hay que cambiar)

- El formulario de edición hace **escrituras directas desde el cliente**:
  - Meta: `update` plano a `campaigns.goal_amount_usd`, sin validación contra lo recaudado, sin historial, sin notificación.
  - Galería: sube del navegador directo a Storage y mete la URL en `campaign_details.gallery_images` — sin moderación, sin límites, sin poder eliminar.
  - `main_image_url` (portada) **no es editable** desde aquí.
  - Documentos: se pueden **borrar libremente** (riesgo: borrar evidencia tras recaudar).
- `campaign_updates`, `campaign_comments` (con `is_from_creator`), `notifications` (enum incluye `campaign_update`) ya existen y funcionan.

---

## 2. Modelo de datos (migración `32-campaign-edit-governance.sql`)

### 2.1 Historial de meta
```sql
ALTER TABLE campaigns ADD COLUMN original_goal_amount_usd numeric; -- se fija en el 1er cambio

CREATE TABLE campaign_goal_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  previous_goal numeric NOT NULL,
  new_goal numeric NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('increase','decrease')),
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 Cola de moderación de imágenes (shadow editing)
```sql
CREATE TABLE campaign_media_changes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  change_type text NOT NULL CHECK (change_type IN ('main_image','gallery_add','gallery_remove')),
  proposed_url text,            -- nueva imagen (main_image / gallery_add)
  previous_url text,            -- lo que estaba antes (main_image) o la que se quita (gallery_remove)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
```
- La imagen nueva **se sube a Storage** pero **no toca la campaña** hasta aprobarse. La web sigue mostrando la imagen aprobada.
- Excepción sin moderación: **"Establecer como portada"** desde una imagen que **ya está en la galería** (ya fue aprobada en su momento) → se aplica directo.

### 2.3 Historial / archivo de multimedia
```sql
CREATE TABLE campaign_media_archive (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('main_image','gallery')),
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
```
- Las imágenes reemplazadas/quitadas **no se borran** de Storage; se registran aquí para auditoría anti-fraude.

### 2.4 Comentarios del sistema en el muro
```sql
ALTER TABLE campaign_comments ADD COLUMN is_system boolean NOT NULL DEFAULT false;
```
- Cada cambio de meta publica un comentario `is_system = true` tipo:
  *"El creador actualizó la meta de $X a $Y. Motivo: …"*.

### 2.5 RLS
- `campaign_goal_history`, `campaign_media_archive`: lectura del creador dueño + admin; escritura solo service-role (vía endpoints).
- `campaign_media_changes`: lectura del creador dueño + admin; escritura del creador (insert pending) + admin (update estado), pero la **aprobación** la hace el endpoint admin con service-role.

---

## 3. Flujo de cambio de meta (`/api/campaigns/[id]/goal`)

`POST { newGoal, reason }` — server-side, valida y registra todo de forma atómica:

1. **Autorización**: solo el creador dueño.
2. **Congelamiento**: si la campaña está `closed`/`completed` **o** ya tiene retiros `processed`, se rechaza con mensaje "requiere revisión de soporte" (no se permite auto-cambio).
3. **Disminuir**: `newGoal ≥ current_amount_usd` (recaudado). Si no, error claro.
4. **Aumentar**: sin tope, pero `reason` obligatorio.
5. `reason` obligatorio en ambos casos (mín. ~10 caracteres).
6. Si `original_goal_amount_usd` es NULL → se fija con el valor **anterior** (la meta con la que arrancó).
7. Se actualiza `goal_amount_usd`, se inserta fila en `campaign_goal_history`.
8. Se crea una **actualización** (`campaign_updates`) titulada "Actualización de la meta" con el motivo.
9. Se inserta **comentario del sistema** en el muro.
10. **Notificaciones** a donantes (distintos `donor_id`/email con donación completada) y seguidores.

UI en el formulario de edición:
- Campo meta + **textarea de motivo (obligatorio al cambiar)**.
- Texto de reglas (no puede bajar de lo recaudado; el cambio es público y notifica a donantes).
- Aviso en vivo si intenta bajar por debajo de lo recaudado o si la campaña está congelada.

---

## 4. Flujo de imágenes (`/api/campaigns/[id]/media`)

### 4.1 Subir nueva portada o imagen de galería → **cola**
`POST` (multipart o URL ya subida) →
- Valida: dueño; formato ∈ {jpg,jpeg,png,webp}; peso ≤ 5 MB; galería ≤ 6 imágenes (contando aprobadas + pendientes).
- Sube a Storage e inserta `campaign_media_changes` (`pending`). **No** cambia la campaña.
- Devuelve el registro pendiente para mostrar "en revisión".

### 4.2 Establecer como portada desde galería → **inmediato**
`POST { action: 'set_cover', galleryUrl }` →
- Verifica que `galleryUrl` ya esté en `gallery_images` (ya aprobada).
- Archiva la portada anterior en `campaign_media_archive`, setea `main_image_url = galleryUrl`. Sin moderación.

### 4.3 Quitar imagen de galería → **cola** (`gallery_remove`)
- Se registra como cambio pendiente (para que un admin confirme que no se está borrando evidencia). Al aprobar se quita de `gallery_images` y se archiva.

### 4.4 Documentos de soporte
- Si la campaña tiene **donaciones completadas**: **no** se pueden borrar ni reemplazar documentos; solo **agregar**. La UI cambia el botón "Eliminar" por un aviso.
- Fotos de progreso → se empujan al módulo de **Actualizaciones** (no a la portada/galería). La UI lo aclara.

---

## 5. Cola de moderación en admin (`/admin/media-changes`)

- Lista de `campaign_media_changes` con estado `pending`: miniatura nueva vs actual, campaña, creador, tipo.
- Acciones **Aprobar** / **Rechazar (con motivo)** vía `PATCH /api/admin/media-changes/[id]` (service-role):
  - **Aprobar `main_image`**: archiva la anterior, setea `main_image_url`.
  - **Aprobar `gallery_add`**: agrega a `gallery_images`.
  - **Aprobar `gallery_remove`**: quita de `gallery_images` y archiva.
  - **Rechazar**: deja todo como estaba; notifica al creador con el motivo.
- Notificación al creador en ambos casos.
- Nuevo ítem en el sidebar admin + contador en `sidebar-badges`.

---

## 6. Página pública (`/campaigns/[id]`)

- Etiqueta **"Meta original: $X (actualizada el …)"** cuando `original_goal_amount_usd` difiere de la meta actual.
- Render de **comentarios del sistema** (`is_system`) en el muro, con estilo distinto (no es un comentario de usuario).
- (Opcional) Pequeño enlace "ver historial de metas" que liste los cambios.

---

## 7. Trazabilidad (resumen)

| Acción | Dónde queda registrada |
|--------|------------------------|
| Cambio de meta | `campaign_goal_history` + `campaign_updates` + comentario del sistema + notificaciones |
| Cambio de portada/galería | `campaign_media_changes` (quién/cuándo/qué) + `campaign_media_archive` (imágenes viejas) + `audit_logs` al aprobar/rechazar |
| Set portada desde galería | `campaign_media_archive` (portada anterior) |
| Documentos | inmutables si hay donaciones; solo se agregan |

---

## 8. Fases de implementación

| Fase | Contenido |
|------|-----------|
| **F1 — DB** | Migración 32: `original_goal_amount_usd`, `campaign_goal_history`, `campaign_media_changes`, `campaign_media_archive`, `campaign_comments.is_system`, RLS |
| **F2 — Meta** | `api/campaigns/[id]/goal` + UI con motivo obligatorio y reglas |
| **F3 — Imágenes** | `api/campaigns/[id]/media` (cola + set cover inmediato + límites) + UI de edición; documentos inmutables si hay donaciones |
| **F4 — Admin** | `/admin/media-changes` + `api/admin/media-changes/[id]` + badge en sidebar |
| **F5 — Público** | etiqueta "Meta original" + comentarios del sistema en el muro |

Cada fase termina con commit. Al final: build + push (deploy continuo en Coolify).

---

## 9. Diferido para fases futuras

- **Sharp**: subida vía endpoint server-side con resize 1200x630, compresión y conversión a webp.
- **Stretch goals** para campañas de emprendimiento/producto.
- **Correo a donantes** (al integrar Resend) enganchado en los mismos puntos que ya generan notificaciones in-app.
- **Edición moderada de título/historia** si en algún momento se decide abrirla.
