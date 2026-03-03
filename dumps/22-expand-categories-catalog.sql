-- ============================================================================
-- 17. EXPAND CATEGORIES CATALOG
-- ============================================================================
-- Adds more campaign categories so the creator form selector includes
-- broader options without breaking existing references.

INSERT INTO categories (name, description, icon_emoji, order_index) VALUES
  ('Salud', 'Campañas médicas y de salud', '🏥', 1),
  ('Educación', 'Becas y apoyo educativo', '📚', 2),
  ('Emprendimiento', 'Negocios y startups', '💼', 3),
  ('Comunitaria', 'Proyectos comunitarios', '🤝', 4),
  ('Vivienda', 'Apoyo de vivienda', '🏠', 5),
  ('Emergencias', 'Situaciones de emergencia', '🆘', 6),
  ('Alimentación', 'Comidas, insumos básicos y comedores', '🍽️', 7),
  ('Transporte', 'Traslados médicos, escolares o comunitarios', '🚌', 8),
  ('Tecnología', 'Equipos y conectividad para estudiar o trabajar', '💻', 9),
  ('Deportes', 'Formación y apoyo deportivo', '⚽', 10),
  ('Arte y Cultura', 'Proyectos artísticos y culturales', '🎨', 11),
  ('Medio Ambiente', 'Iniciativas ecológicas y de sostenibilidad', '🌱', 12),
  ('Animales', 'Rescate y cuidado animal', '🐾', 13),
  ('Adultos Mayores', 'Apoyo integral para adultos mayores', '👵', 14),
  ('Discapacidad e Inclusión', 'Accesibilidad, terapias y apoyo inclusivo', '♿', 15)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon_emoji = EXCLUDED.icon_emoji,
  order_index = EXCLUDED.order_index;