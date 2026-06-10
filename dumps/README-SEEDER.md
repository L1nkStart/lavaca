# 🌱 Seeder de Datos de Prueba - LaVaca

Este documento explica cómo usar el seeder de datos de prueba para LaVaca.

## 📋 Contenido del Seeder

El archivo `08-seed-test-data.sql` incluye:

### Usuarios (10 total)
- **1 Admin**: `admin@lavaca.com.ve`
- **4 Creadores**:
  - `maria.gonzalez@example.com` (verificada) - Campaña de salud
  - `carlos.rodriguez@example.com` (verificado) - Campaña educativa
  - `ana.martinez@example.com` (verificada) - Campañas de emergencia y emprendimiento
  - `jose.perez@example.com` (pendiente) - Sin campañas
- **5 Donantes**:
  - `pedro.lopez@example.com`
  - `lucia.fernandez@example.com`
  - `roberto.sanchez@example.com`
  - `elena.torres@example.com` (verificada)
  - `miguel.ramirez@example.com`

### Campañas (4 activas)

1. **"Ayuda para cirugía de mi hija Sofía"**
   - Categoría: Salud 🏥
   - Meta: $15,000 USD
   - Recaudado: $8,750.50 (58%)
   - Urgencia: Crítica
   - Creador: María González
   - 7 donaciones, 5 reacciones, 4 comentarios

2. **"Biblioteca Comunitaria en Zona Rural"**
   - Categoría: Educación 📚
   - Meta: $12,000 USD
   - Recaudado: $3,200 (27%)
   - Urgencia: Media
   - Creador: Carlos Rodríguez
   - 3 donaciones, 2 reacciones, 1 comentario

3. **"Reconstrucción tras inundaciones"**
   - Categoría: Emergencia 🚨
   - Meta: $25,000 USD
   - Recaudado: $15,800 (63%)
   - Urgencia: Crítica
   - Creador: Ana Martínez
   - 3 donaciones, 2 reacciones, 1 comentario

4. **"Panadería Artesanal: Pan para Todos"**
   - Categoría: Emprendimiento 💼
   - Meta: $8,000 USD
   - Recaudado: $950 (12%)
   - Urgencia: Baja
   - Creador: Ana Martínez
   - Recién iniciada

### Interacciones Sociales (FASE 1)
- ✅ **Comentarios**: 6 comentarios distribuidos en las campañas
- ✅ **Reacciones**: 9 reacciones/hearts
- ✅ **Seguidores**: 5 usuarios siguiendo campañas
- ✅ **Compartidos**: 8 compartidos en diferentes plataformas
- ✅ **Notificaciones**: 5 notificaciones de ejemplo

## 🚀 Cómo Ejecutar el Seeder

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Crea un nuevo query
4. Copia y pega TODO el contenido de `08-seed-test-data.sql`
5. Haz click en **Run**
6. Espera el mensaje de confirmación

### Opción 2: Desde Terminal con psql

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f dumps/08-seed-test-data.sql
```

### Opción 3: Ejecutar Solo Partes Específicas

Si solo quieres insertar algunas categorías de datos:

```sql
-- Solo usuarios
-- Copia la sección "3. USUARIOS DE PRUEBA"

-- Solo campañas
-- Copia las secciones "4. CAMPAÑAS" y "5. DETALLES DE CAMPAÑAS"

-- Solo interacciones sociales
-- Copia las secciones 8, 9, 10, 11 (Comentarios, Reacciones, Seguidores, Compartidos)
```

## 🧪 Probar las Funcionalidades

### 1. Ver Campañas en el Home
```
http://localhost:3001/
```
Deberías ver las 4 campañas activas.

### 2. Ver Detalle de Campaña con Todas las Funcionalidades
```
http://localhost:3001/campaigns/ca000000-0000-0000-0000-000000000001
```
O busca "Ayuda para cirugía de mi hija Sofía"

**Deberías ver:**
- ✅ Botones de Reacción, Seguir y Reportar
- ✅ Tab de Comentarios con 4 comentarios existentes
- ✅ Actualizaciones de campaña (2)
- ✅ Lista de donantes
- ✅ Botón de compartir con tracking

### 3. Interactuar como Usuario

Para probar las funcionalidades sociales, necesitas:

1. **Crear una cuenta real** en tu app (el seeder solo crea registros en la tabla `users`, no en Supabase Auth)
2. O **temporalmente**: Modifica las políticas RLS para permitir inserts sin auth (solo para desarrollo)

```sql
-- SOLO PARA DESARROLLO - Permitir comentarios anónimos
DROP POLICY IF EXISTS "Users can create comments" ON campaign_comments;
CREATE POLICY "Anyone can create comments" ON campaign_comments FOR INSERT WITH CHECK (true);

-- SOLO PARA DESARROLLO - Permitir reacciones anónimas  
DROP POLICY IF EXISTS "Users can add reactions" ON campaign_reactions;
CREATE POLICY "Anyone can add reactions" ON campaign_reactions FOR INSERT WITH CHECK (true);
```

### 4. Probar Comentarios
1. Ve a cualquier campaña
2. Click en tab "Comentarios"
3. Escribe un comentario
4. Marca/desmarca "Comentar como anónimo"
5. Envía

### 5. Probar Reacciones
1. Ve a cualquier campaña
2. Click en el botón del corazón
3. Debería cambiar a relleno y aumentar el contador

### 6. Probar Seguir Campaña
1. Ve a cualquier campaña
2. Click en "Seguir"
3. Debería cambiar a "Siguiendo"

### 7. Probar Compartir con Tracking
1. Ve a cualquier campaña
2. Click en "Compartir"
3. Selecciona una plataforma
4. Verifica en la BD que se guardó en `campaign_shares`

### 8. Probar Reportar
1. Ve a cualquier campaña
2. Click en "Reportar"
3. Selecciona categoría
4. Escribe descripción
5. Envía

## 🗑️ Limpiar Datos de Prueba

Si quieres empezar de cero:

```sql
-- CUIDADO: Esto borra TODOS los datos
TRUNCATE TABLE 
  campaign_comments, 
  campaign_reactions, 
  campaign_followers, 
  notifications, 
  campaign_reports, 
  campaign_shares, 
  donations, 
  campaign_updates, 
  campaign_details, 
  campaigns, 
  withdrawal_accounts,
  categories, 
  users 
CASCADE;
```

## 📊 Verificar que el Seeder Funcionó

```sql
-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM users) as usuarios,
  (SELECT COUNT(*) FROM categories) as categorias,
  (SELECT COUNT(*) FROM campaigns) as campañas,
  (SELECT COUNT(*) FROM donations) as donaciones,
  (SELECT COUNT(*) FROM campaign_comments) as comentarios,
  (SELECT COUNT(*) FROM campaign_reactions) as reacciones,
  (SELECT COUNT(*) FROM campaign_followers) as seguidores,
  (SELECT COUNT(*) FROM campaign_shares) as compartidos,
  (SELECT COUNT(*) FROM notifications) as notificaciones;
```

Resultado esperado:
```
usuarios: 10
categorias: 5
campañas: 4
donaciones: 13+
comentarios: 6
reacciones: 9
seguidores: 5
compartidos: 8
notificaciones: 5
```

## ⚠️ Notas Importantes

1. **UUIDs Fijos**: El seeder usa UUIDs fijos para facilitar referencias. En producción, usa `uuid_generate_v4()`.

2. **Imágenes**: Las imágenes usan URLs de Unsplash y DiceBear (servicio de avatares). Son públicas y gratuitas.

3. **Auth vs Users**: El seeder solo inserta en la tabla `users`. Para login real, necesitas cuentas en Supabase Auth.

4. **RLS Policies**: Las políticas de seguridad pueden bloquear inserts anónimos. Ajusta según necesites para desarrollo.

5. **Status de Donaciones**: Solo las donaciones con status 'completed' cuentan para el `current_amount_usd`.

## 🎯 Próximos Pasos

Después de ejecutar el seeder:

1. ✅ Navega por el home y ve las 4 campañas
2. ✅ Entra a una campaña y explora todas las tabs
3. ✅ Prueba comentar, reaccionar y seguir
4. ✅ Verifica que las notificaciones funcionen
5. ✅ Comparte una campaña y verifica el tracking
6. ✅ Reporta una campaña y verifica que se guarde

¡Listo para probar! 🚀
