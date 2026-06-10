-- ============================================
-- SEEDER DE DATOS DE PRUEBA
-- Para LaVaca - GoFundMe Venezolano
-- ============================================

-- IMPORTANTE: Este script usa UUIDs fijos para facilitar las referencias
-- En producción, los UUIDs serían generados automáticamente

-- ============================================
-- 1. LIMPIAR DATOS EXISTENTES (OPCIONAL)
-- ============================================

-- Descomentar si quieres empezar desde cero
-- TRUNCATE TABLE campaign_comments, campaign_reactions, campaign_followers, 
-- notifications, campaign_reports, campaign_shares, donations, 
-- campaign_updates, campaign_details, campaigns, categories, users CASCADE;

-- ============================================
-- 2. CATEGORÍAS
-- ============================================

INSERT INTO categories (id, name, description, icon_emoji, order_index) VALUES
('11111111-1111-1111-1111-111111111111', 'Salud', 'Campañas médicas y de salud', '🏥', 1),
('22222222-2222-2222-2222-222222222222', 'Educación', 'Proyectos educativos', '📚', 2),
('33333333-3333-3333-3333-333333333333', 'Emergencia', 'Situaciones de emergencia', '🚨', 3),
('44444444-4444-4444-4444-444444444444', 'Comunidad', 'Proyectos comunitarios', '🏘️', 4),
('55555555-5555-5555-5555-555555555555', 'Emprendimiento', 'Negocios y emprendimientos', '💼', 5),
('66666666-6666-6666-6666-666666666666', 'Vivienda', 'Apoyo para vivienda y mejoras del hogar', '🏠', 6),
('77777777-7777-7777-7777-777777777777', 'Alimentación', 'Comidas, insumos básicos y comedores', '🍽️', 7),
('88888888-8888-8888-8888-888888888888', 'Transporte', 'Traslados médicos, escolares o comunitarios', '🚌', 8),
('99999999-9999-9999-9999-999999999999', 'Tecnología', 'Equipos y conectividad para estudiar o trabajar', '💻', 9),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Deportes', 'Formación y apoyo deportivo', '⚽', 10),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Arte y Cultura', 'Proyectos artísticos y culturales', '🎨', 11),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Medio Ambiente', 'Iniciativas ecológicas y de sostenibilidad', '🌱', 12),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Animales', 'Rescate y cuidado animal', '🐾', 13),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Adultos Mayores', 'Apoyo integral para adultos mayores', '👵', 14),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Discapacidad e Inclusión', 'Accesibilidad, terapias y apoyo inclusivo', '♿', 15)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. USUARIOS DE PRUEBA
-- ============================================

-- Usuario Admin
INSERT INTO users (id, email, full_name, role, kyc_status, bio, location, avatar_url, created_at) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin@lavaca.com.ve', 'Admin LaVaca', 'admin', 'verified', 
'Administrador de la plataforma LaVaca', 'Caracas, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', NOW() - INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;

-- Creadores Verificados
INSERT INTO users (id, email, full_name, role, kyc_status, bio, location, avatar_url, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'maria.gonzalez@example.com', 'María González', 'creator', 'verified',
'Madre de familia luchando por la salud de mi hija', 'Valencia, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria', NOW() - INTERVAL '4 months'),

('c0000000-0000-0000-0000-000000000002', 'carlos.rodriguez@example.com', 'Carlos Rodríguez', 'creator', 'verified',
'Profesor universitario comprometido con la educación', 'Maracaibo, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos', NOW() - INTERVAL '5 months'),

('c0000000-0000-0000-0000-000000000003', 'ana.martinez@example.com', 'Ana Martínez', 'creator', 'verified',
'Emprendedora venezolana apasionada por ayudar', 'Barquisimeto, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ana', NOW() - INTERVAL '3 months'),

('c0000000-0000-0000-0000-000000000004', 'jose.perez@example.com', 'José Pérez', 'creator', 'pending',
'Líder comunitario en zonas rurales', 'Mérida, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=jose', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- Donantes
INSERT INTO users (id, email, full_name, role, kyc_status, location, avatar_url, created_at) VALUES
('d0000000-0000-0000-0000-000000000001', 'pedro.lopez@example.com', 'Pedro López', 'donor', 'pending', 
'Caracas, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=pedro', NOW() - INTERVAL '2 months'),

('d0000000-0000-0000-0000-000000000002', 'lucia.fernandez@example.com', 'Lucía Fernández', 'donor', 'pending',
'Valencia, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lucia', NOW() - INTERVAL '3 months'),

('d0000000-0000-0000-0000-000000000003', 'roberto.sanchez@example.com', 'Roberto Sánchez', 'donor', 'pending',
'Maracay, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=roberto', NOW() - INTERVAL '1 month'),

('d0000000-0000-0000-0000-000000000004', 'elena.torres@example.com', 'Elena Torres', 'donor', 'verified',
'Caracas, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena', NOW() - INTERVAL '4 months'),

('d0000000-0000-0000-0000-000000000005', 'miguel.ramirez@example.com', 'Miguel Ramírez', 'donor', 'pending',
'Barquisimeto, Venezuela', 'https://api.dicebear.com/7.x/avataaars/svg?seed=miguel', NOW() - INTERVAL '2 weeks')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CAMPAÑAS
-- ============================================

-- Campaña 1: Salud - Activa y con buen progreso
INSERT INTO campaigns (id, creator_id, category_id, title, slug, story, description, location, 
goal_amount_usd, current_amount_usd, status, urgency_level, main_image_url, created_at, published_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
'Ayuda para cirugía de mi hija Sofía', 'ayuda-cirugia-sofia',
'Mi nombre es María González y soy madre de Sofía, una niña de 8 años que necesita una cirugía cardíaca urgente. Vivimos en Valencia y hace 3 meses nos dieron el diagnóstico. Los médicos nos han dicho que la operación debe realizarse lo antes posible.

El costo total de la cirugía es de $15,000 USD, lo cual incluye:
- Cirugía cardíaca especializada
- Hospitalización post-operatoria (10 días)
- Medicamentos y cuidados especiales
- Seguimiento médico por 6 meses

Hemos logrado reunir parte del dinero vendiendo nuestras pertenencias, pero aún nos falta mucho. Cada dólar cuenta y puede hacer la diferencia entre la vida y la muerte de mi pequeña.

Sofía es una niña alegre, le encanta dibujar y sueña con ser doctora algún día. Por favor, ayúdennos a darle la oportunidad de crecer y cumplir sus sueños.

¡Gracias de todo corazón!',
'Cirugía cardíaca urgente para niña de 8 años en Valencia',
'Valencia, Carabobo, Venezuela',
15000, 8750.50, 'active', 'critical',
'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800',
NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- Campaña 2: Educación - Activa
INSERT INTO campaigns (id, creator_id, category_id, title, slug, story, description, location,
goal_amount_usd, current_amount_usd, status, urgency_level, main_image_url, created_at, published_at) VALUES
('ca000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
'Biblioteca Comunitaria en Zona Rural', 'biblioteca-comunitaria-rural',
'Soy Carlos Rodríguez, profesor de la Universidad del Zulia. Durante años he trabajado con comunidades rurales y he visto cómo la falta de acceso a libros y material educativo limita las oportunidades de los niños.

Queremos construir una biblioteca comunitaria en la comunidad de El Moján, donde 300 niños y jóvenes tendrán acceso gratuito a:
- 2,000 libros nuevos y usados
- 10 computadoras con internet
- Espacio de estudio climatizado
- Programas de lectura y tutorías

El proyecto incluye:
✓ Acondicionamiento del local donado
✓ Compra de estanterías y mobiliario
✓ Adquisición de libros
✓ Equipos tecnológicos
✓ Material didáctico

Con tu ayuda, estos niños tendrán un futuro mejor. La educación es el camino para salir de la pobreza.',
'Construyamos una biblioteca para 300 niños en zona rural del Zulia',
'El Moján, Zulia, Venezuela',
12000, 3200, 'active', 'medium',
'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800',
NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Campaña 3: Emergencia - Muy activa
INSERT INTO campaigns (id, creator_id, category_id, title, slug, story, description, location,
goal_amount_usd, current_amount_usd, status, urgency_level, main_image_url, created_at, published_at) VALUES
('ca000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333',
'Reconstrucción tras inundaciones', 'reconstruccion-inundaciones-barquisimeto',
'Las recientes lluvias devastaron 45 hogares en nuestra comunidad de Barquisimeto. Familias enteras perdieron todo: casas, ropa, documentos y enseres.

Soy Ana Martínez, líder comunitaria, y junto con las familias afectadas hemos organizado este fondo de emergencia para:

NECESIDADES INMEDIATAS:
- Alimentos no perecederos
- Agua potable
- Ropa y calzado
- Colchones y sábanas
- Artículos de higiene

RECONSTRUCCIÓN:
- Material de construcción
- Techos y paredes
- Puertas y ventanas
- Sistemas eléctricos básicos

Son 45 familias (aproximadamente 200 personas) que necesitan ayuda URGENTE. Muchos están viviendo en refugios temporales.

CADA DÓLAR SERÁ DOCUMENTADO Y PUBLICADO. Tenemos el apoyo del consejo comunal y la alcaldía.',
'45 familias perdieron todo en inundaciones - Ayuda urgente',
'Barquisimeto, Lara, Venezuela',
25000, 15800, 'active', 'critical',
'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800',
NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

-- Campaña 4: Emprendimiento - Recién iniciada
INSERT INTO campaigns (id, creator_id, category_id, title, slug, story, description, location,
goal_amount_usd, current_amount_usd, status, urgency_level, main_image_url, created_at, published_at) VALUES
('ca000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555',
'Panadería Artesanal: Pan para Todos', 'panaderia-artesanal-pan-para-todos',
'¡Hola! Soy Ana y junto a mi esposo queremos abrir una panadería artesanal en nuestro barrio.

Durante la pandemia perdimos nuestros empleos y descubrimos nuestra pasión por hacer pan. Comenzamos vendiendo desde casa y nuestros vecinos quedaron encantados. Ahora queremos formalizar y crear empleos.

EL PROYECTO:
🥖 Panadería artesanal con productos de calidad
🥐 Precios accesibles para la comunidad  
👨‍🍳 Generación de 5 empleos directos
📚 Talleres gratuitos de panadería

NECESITAMOS:
- Horno industrial ($3,000)
- Batidora profesional ($1,500)
- Mesas de trabajo ($800)
- Vitrinas ($1,000)
- Materia prima inicial ($1,500)
- Permisos y documentación ($1,200)

Queremos que nuestro barrio tenga pan fresco y de calidad todos los días. ¡Ayúdanos a lograrlo!',
'Ayúdanos a abrir panadería artesanal y generar empleos',
'Barquisimeto, Lara, Venezuela',
8000, 950, 'active', 'low',
'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. DETALLES DE CAMPAÑAS
-- ============================================

INSERT INTO campaign_details (campaign_id, full_story, gallery_images, videos_urls, support_documents) VALUES
('ca000000-0000-0000-0000-000000000001', 
'Historia completa de Sofía...', 
ARRAY['https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800', 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800'],
ARRAY[]::text[],
ARRAY['https://example.com/doc-medico-sofia.pdf']::text[]),

('ca000000-0000-0000-0000-000000000002',
'Detalles del proyecto de biblioteca...',
ARRAY['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800', 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800'],
ARRAY[]::text[],
ARRAY[]::text[]),

('ca000000-0000-0000-0000-000000000003',
'Documentación de daños por inundación...',
ARRAY['https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800'],
ARRAY[]::text[],
ARRAY['https://example.com/reporte-danos.pdf']::text[])
ON CONFLICT (campaign_id) DO NOTHING;

-- ============================================
-- 6. DONACIONES
-- ============================================

-- Donaciones para Campaña 1 (Sofía)
INSERT INTO donations (campaign_id, donor_id, email, amount_usd, amount_bs, payment_method, payment_status, 
is_anonymous, donor_name, created_at, completed_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'pedro.lopez@example.com', 
100, 3650, 'zelle', 'completed', false, 'Pedro López', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'lucia.fernandez@example.com',
50, 1825, 'pagomovil', 'completed', false, 'Lucía Fernández', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),

('ca000000-0000-0000-0000-000000000001', NULL, 'anonimo@example.com',
250, NULL, 'stripe', 'completed', true, 'Anónimo', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'elena.torres@example.com',
500, NULL, 'paypal', 'completed', false, 'Elena Torres', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'roberto.sanchez@example.com',
75.50, 2755.75, 'bank_transfer_bs', 'completed', false, 'Roberto Sánchez', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

('ca000000-0000-0000-0000-000000000001', NULL, 'anonimo2@example.com',
1000, NULL, 'crypto', 'completed', true, 'Anónimo', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'miguel.ramirez@example.com',
25, 912.50, 'pagomovil', 'completed', false, 'Miguel Ramírez', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- Donaciones para Campaña 2 (Biblioteca)
INSERT INTO donations (campaign_id, donor_id, email, amount_usd, payment_method, payment_status, 
is_anonymous, created_at, completed_at) VALUES
('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'pedro.lopez@example.com',
200, 'zelle', 'completed', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'elena.torres@example.com',
300, 'paypal', 'completed', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

('ca000000-0000-0000-0000-0000-000000002', NULL, 'anonimo3@example.com',
150, 'stripe', 'completed', true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');

-- Donaciones para Campaña 3 (Inundaciones)
INSERT INTO donations (campaign_id, donor_id, email, amount_usd, payment_method, payment_status,
is_anonymous, created_at, completed_at) VALUES
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'pedro.lopez@example.com',
500, 'zelle', 'completed', false, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),

('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'lucia.fernandez@example.com',
300, 'pagomovil', 'completed', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'elena.torres@example.com',
1000, 'paypal', 'completed', false, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

-- ============================================
-- 7. ACTUALIZACIONES DE CAMPAÑAS
-- ============================================

INSERT INTO campaign_updates (campaign_id, creator_id, title, content, created_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
'¡Gracias por su apoyo!', 
'Queridos donantes, no tienen idea de lo feliz que estoy. Hemos alcanzado más del 50% de la meta. Los médicos ya programaron la cirugía para dentro de 2 semanas. Sofía está emocionada y llena de esperanza. ¡Gracias infinitas!',
NOW() - INTERVAL '10 days'),

('ca000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
'Exámenes pre-operatorios completados',
'Hoy Sofía completó todos los exámenes. Los doctores están optimistas. Solo nos falta 40% para cubrir todos los gastos. ¡Sigamos adelante!',
NOW() - INTERVAL '5 days'),

('ca000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
'Primera reunión con la comunidad',
'Tuvimos nuestra primera reunión con padres y estudiantes. ¡La emoción es increíble! Ya identificamos el local perfecto.',
NOW() - INTERVAL '15 days');

-- ============================================
-- 8. COMENTARIOS
-- ============================================

INSERT INTO campaign_comments (campaign_id, user_id, content, is_anonymous, created_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
'Mucha fuerza María! Mi hija también pasó por algo similar. Todo saldrá bien. 🙏', false, NOW() - INTERVAL '38 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
'Que Dios bendiga a Sofía. Ya doné lo que pude. Compartiré esta campaña con todos mis contactos.', false, NOW() - INTERVAL '34 days'),

('ca000000-0000-0000-0000-000000000001', NULL,
'Donación hecha. Ánimo y bendiciones para la pequeña. 💪❤️', true, NOW() - INTERVAL '29 days'),

('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
'Mi familia y yo estamos orando por Sofía. Acabamos de donar. ¡Fuerza!', false, NOW() - INTERVAL '24 days'),

('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
'Excelente proyecto profesor Carlos. La educación lo es todo. Cuente con mi apoyo.', false, NOW() - INTERVAL '23 days'),

('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
'Situación terrible. Ya doné y compartí en redes sociales. ¡Todos debemos ayudar!', false, NOW() - INTERVAL '11 days');

-- ============================================
-- 9. REACCIONES
-- ============================================

INSERT INTO campaign_reactions (campaign_id, user_id, created_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '40 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '35 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '30 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '25 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '10 days'),
('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days'),
('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '20 days'),
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '12 days'),
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. SEGUIDORES
-- ============================================

INSERT INTO campaign_followers (campaign_id, user_id, notify_updates, notify_milestones, created_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', true, true, NOW() - INTERVAL '40 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', true, true, NOW() - INTERVAL '35 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', true, false, NOW() - INTERVAL '25 days'),
('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', true, true, NOW() - INTERVAL '25 days'),
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', true, true, NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. COMPARTIDOS
-- ============================================

INSERT INTO campaign_shares (campaign_id, user_id, platform, created_at) VALUES
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'whatsapp', NOW() - INTERVAL '39 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'twitter', NOW() - INTERVAL '34 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'whatsapp', NOW() - INTERVAL '29 days'),
('ca000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'email', NOW() - INTERVAL '24 days'),
('ca000000-0000-0000-0000-000000000001', NULL, 'link', NOW() - INTERVAL '20 days'),
('ca000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'whatsapp', NOW() - INTERVAL '24 days'),
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'whatsapp', NOW() - INTERVAL '11 days'),
('ca000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'twitter', NOW() - INTERVAL '9 days');

-- ============================================
-- 12. NOTIFICACIONES
-- ============================================

INSERT INTO notifications (user_id, type, title, message, link, read, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'donation_received', 'Nueva donación recibida',
'Pedro López donó $100 a tu campaña', '/campaigns/ayuda-cirugia-sofia', false, NOW() - INTERVAL '40 days'),

('c0000000-0000-0000-0000-000000000001', 'donation_received', 'Nueva donación recibida',
'Recibiste una donación anónima de $250', '/campaigns/ayuda-cirugia-sofia', false, NOW() - INTERVAL '30 days'),

('c0000000-0000-0000-0000-000000000001', 'comment_received', 'Nuevo comentario',
'Pedro López comentó en tu campaña', '/campaigns/ayuda-cirugia-sofia', true, NOW() - INTERVAL '38 days'),

('c0000000-0000-0000-0000-000000000001', 'new_reaction', 'Nueva reacción',
'Elena Torres reaccionó a tu campaña', '/campaigns/ayuda-cirugia-sofia', true, NOW() - INTERVAL '25 days'),

('d0000000-0000-0000-0000-000000000001', 'campaign_update', 'Nueva actualización',
'María González publicó una actualización en "Ayuda para cirugía de mi hija Sofía"', '/campaigns/ayuda-cirugia-sofia', false, NOW() - INTERVAL '10 days');

-- ============================================
-- 13. ACTUALIZAR CONTADORES EN CAMPAÑAS
-- ============================================

UPDATE campaigns SET
    reaction_count = (SELECT COUNT(*) FROM campaign_reactions WHERE campaign_id = campaigns.id),
    comment_count = (SELECT COUNT(*) FROM campaign_comments WHERE campaign_id = campaigns.id AND deleted_at IS NULL),
    follower_count = (SELECT COUNT(*) FROM campaign_followers WHERE campaign_id = campaigns.id),
    share_count = (SELECT COUNT(*) FROM campaign_shares WHERE campaign_id = campaigns.id),
    donor_count = (SELECT COUNT(DISTINCT donor_id) FROM donations WHERE campaign_id = campaigns.id AND payment_status = 'completed')
WHERE status = 'active';

-- ============================================
-- FIN DEL SEEDER
-- ============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SEEDER COMPLETADO EXITOSAMENTE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Usuarios creados: 10 (1 admin, 4 creadores, 5 donantes)';
    RAISE NOTICE 'Categorías: 5';
    RAISE NOTICE 'Campañas activas: 4';
    RAISE NOTICE 'Donaciones: 13+';
    RAISE NOTICE 'Comentarios: 6';
    RAISE NOTICE 'Reacciones: 9';
    RAISE NOTICE 'Seguidores: 5';
    RAISE NOTICE 'Notificaciones: 5';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Puedes probar la app con estos usuarios:';
    RAISE NOTICE 'Creadores: maria.gonzalez@example.com, carlos.rodriguez@example.com';
    RAISE NOTICE 'Donantes: pedro.lopez@example.com, elena.torres@example.com';
    RAISE NOTICE '============================================';
END $$;
