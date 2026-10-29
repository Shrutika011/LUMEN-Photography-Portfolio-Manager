-- ============================================================
-- LUMEN — Photography Portfolio Manager
-- Database: lumen_db
-- Target: MySQL 8.0+ / MariaDB 10.5+
-- Project: Full-Stack MySQL Migration & College Submission
-- ============================================================

CREATE DATABASE IF NOT EXISTS `lumen_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lumen_db`;

-- Temporarily disable foreign key checks for schema creation & reset
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Table 1: users
-- Studio personas, authentication credentials, and RBAC roles
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `client_notes`;
DROP TABLE IF EXISTS `album_photos`;
DROP TABLE IF EXISTS `albums`;
DROP TABLE IF EXISTS `photo_tags`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `photos`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `portfolio_briefs`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `role` ENUM('OWNER', 'EDITOR', 'CLIENT', 'VIEWER') NOT NULL DEFAULT 'OWNER',
  `title` VARCHAR(150) NULL,
  `avatar` TEXT NULL,
  `studio_role_label` VARCHAR(150) NULL,
  `bio` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 2: categories
-- Photography genres & thematic collections
-- ------------------------------------------------------------
CREATE TABLE `categories` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `is_custom` TINYINT(1) NOT NULL DEFAULT 0,
  `user_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 3: photos
-- Master image vault with technical metadata, scores, and status
-- ------------------------------------------------------------
CREATE TABLE `photos` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `url` TEXT NOT NULL,
  `file_path` VARCHAR(500) NULL,
  `camera` VARCHAR(100) NULL,
  `lens` VARCHAR(100) NULL,
  `aperture` VARCHAR(30) NULL,
  `shutter` VARCHAR(30) NULL,
  `iso` VARCHAR(30) NULL,
  `dimensions` VARCHAR(50) NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `category_id` VARCHAR(64) NULL,
  `category_name` VARCHAR(150) NULL,
  `shoot` VARCHAR(100) NULL,
  `shoot_label` VARCHAR(150) NULL,
  `score` DECIMAL(4,2) NOT NULL DEFAULT 9.00,
  `is_favorite` TINYINT(1) NOT NULL DEFAULT 0,
  `in_active_portfolio` TINYINT(1) NOT NULL DEFAULT 0,
  `plate_number` INT NULL,
  `is_cover_hero` TINYINT(1) NOT NULL DEFAULT 0,
  `client_status` VARCHAR(50) NOT NULL DEFAULT 'UNREVIEWED',
  `description` TEXT NULL,
  `date_photographed` VARCHAR(50) NULL,
  `user_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_photos_category` (`category_id`),
  INDEX `idx_photos_favorite` (`is_favorite`),
  INDEX `idx_photos_portfolio` (`in_active_portfolio`),
  INDEX `idx_photos_client_status` (`client_status`),
  CONSTRAINT `fk_photos_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_photos_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 4: tags
-- Searchable keywords and mood tags
-- ------------------------------------------------------------
CREATE TABLE `tags` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tags_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 5: photo_tags (Many-to-Many junction)
-- ------------------------------------------------------------
CREATE TABLE `photo_tags` (
  `photo_id` VARCHAR(64) NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`photo_id`, `tag_id`),
  CONSTRAINT `fk_pt_photo` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 6: albums
-- Curated client collections and thematic monographs
-- ------------------------------------------------------------
CREATE TABLE `albums` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `cover_image_id` VARCHAR(64) NULL,
  `cover_url` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_albums_user` (`user_id`),
  CONSTRAINT `fk_albums_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_albums_cover` FOREIGN KEY (`cover_image_id`) REFERENCES `photos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 7: album_photos (Many-to-Many junction with ordering)
-- ------------------------------------------------------------
CREATE TABLE `album_photos` (
  `album_id` VARCHAR(64) NOT NULL,
  `photo_id` VARCHAR(64) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`album_id`, `photo_id`),
  INDEX `idx_ap_album_order` (`album_id`, `position`),
  CONSTRAINT `fk_ap_album` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ap_photo` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 8: client_notes
-- Editorial feedback, revision remarks, and proofing approvals
-- ------------------------------------------------------------
CREATE TABLE `client_notes` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `photo_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `author_name` VARCHAR(150) NOT NULL,
  `note` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notes_photo` (`photo_id`),
  CONSTRAINT `fk_notes_photo` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table 9: portfolio_briefs
-- Curatorial strategy, target parameters, and publication state
-- ------------------------------------------------------------
CREATE TABLE `portfolio_briefs` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `title` VARCHAR(255) NOT NULL,
  `purpose` VARCHAR(255) NOT NULL DEFAULT 'Editorial & Monograph Submission',
  `target_audience` VARCHAR(255) NOT NULL DEFAULT 'Curators, Gallerists, High-Fashion Publishers',
  `target_count` INT NOT NULL DEFAULT 24,
  `curation_strategy` VARCHAR(100) NOT NULL DEFAULT 'visual_tempo',
  `candidate_pool_count` INT NOT NULL DEFAULT 24,
  `selected_album_id` VARCHAR(64) NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_briefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- INITIAL SEED DATA
-- Default Studio Personas, Categories, Albums, Photos & Tags
-- ============================================================

INSERT INTO `users` (`id`, `name`, `email`, `role`, `title`, `avatar`, `studio_role_label`, `bio`) VALUES
('usr-owner-01', 'Madhura Dhoke', 'madhura@lumen.studio', 'OWNER', 'Studio Founder & Master Photographer', '', 'Studio Owner (Full Access)', 'Leica Hall of Fame honoree, specializes in brutalist high-contrast fashion and chiaroscuro editorial spreads.'),
('usr-editor-01', 'Rahul Verma', 'rahul@lumen.studio', 'EDITOR', 'Curatorial Associate & Senior Editor', '', 'Curatorial Associate (Editor)', 'Oversees monograph sequencing, RAW grading, and client selection drafts.'),
('usr-client-01', 'Anita & Vikram', 'anita.vikram@sharmagroup.com', 'CLIENT', 'Wedding & Monograph Commissioners', '', 'Private Client (Proofing Only)', 'Private commissioners reviewing 60 plates from the Udaipur Palace Colonnade ceremony.'),
('usr-viewer-01', 'Sarah Lin', 'sarah.lin@xyzmagazine.com', 'VIEWER', 'Guest Curator', '', 'Guest Curator (Read Only)', 'Invited review delegate for upcoming Biennial Photography Monograph.')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Categories Seed
INSERT INTO `categories` (`id`, `name`, `is_custom`, `user_id`) VALUES
("cat-fashion", "Fashion & Editorial", 0, 'usr-owner-01'),
("cat-portrait", "Portraits & Character Studies", 0, 'usr-owner-01'),
("cat-landscape", "Landscape & Nature", 0, 'usr-owner-01'),
("cat-street", "Street & Travel", 0, 'usr-owner-01'),
("cat-arch", "Architecture & Heritage", 0, 'usr-owner-01'),
("cat-food", "Food & Product", 0, 'usr-owner-01'),
("cat-wildlife", "Wildlife & Nature", 0, 'usr-owner-01'),
("cat-wedding", "Weddings & Celebrations", 0, 'usr-owner-01'),
("cat-indian-culture", "Indian Cultural & Ethnic", 0, 'usr-owner-01'),
("cat-fine-art", "Fine Art & Monograph", 0, 'usr-owner-01'),
("cat-other", "Other", 0, 'usr-owner-01')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Photos Seed
INSERT INTO `photos` (`id`, `title`, `url`, `camera`, `lens`, `aperture`, `shutter`, `iso`, `dimensions`, `file_size`, `category_id`, `category_name`, `shoot`, `shoot_label`, `score`, `is_favorite`, `in_active_portfolio`, `plate_number`, `is_cover_hero`, `client_status`, `description`, `date_photographed`, `user_id`) VALUES
("p-01", "Silk Organza & Saree Drapery", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85", "Leica M11", "Noctilux-M 50mm f/0.95", "f/1.4", "1/1000s", "64", "9528 × 6328", 52428800, "cat-fashion", "Fashion & Editorial", "fashion", "Contemporary Indian Couture", 99, 1, 0, NULL, 0, "selected", "Translucent Varanasi silk organza folds capturing directional sidelight in minimalist studio setting.", "2026-10-20", 'usr-owner-01'),
("p-02", "Contemporary Khadi & Handloom Silhouette", "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85", "Hasselblad X2D 100C", "XCD 55mm f/2.5 V", "f/2.8", "1/800s", "100", "11656 × 8742", 89128960, "cat-fashion", "Fashion & Editorial", "fashion", "Contemporary Indian Couture", 97, 0, 0, NULL, 0, "needs_review", "Sculptural silhouette cut from handspun organic khadi cotton against raw travertine backdrop.", "2026-10-20", 'usr-owner-01'),
("p-03", "Brutalist Flâneur — Charcoal Wool", "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85", "Leica SL2-S", "APO-Summicron-SL 50mm f/2", "f/2.0", "1/640s", "100", "6000 × 4000", 45088768, "cat-fashion", "Fashion & Editorial", "fashion", "Autumn Couture Series", 96, 1, 0, NULL, 0, "approved", "Architectural lapel tailoring and matte wool texture study under diffused skylight.", "2026-10-21", 'usr-owner-01'),
("p-04", "Raw Tweed & Zari Weave Macro", "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85", "Canon EOS R5", "RF 100mm f/2.8L Macro", "f/5.6", "1/250s", "100", "8192 × 5464", 49283072, "cat-fashion", "Fashion & Editorial", "fashion", "Textile Studies", 93, 0, 0, NULL, 0, "changes_requested", "Extreme close-up revealing intertwining metallic zari threads with raw wild tussar silk fibers.", "2026-10-21", 'usr-owner-01'),
("p-05", "Profile in Chiaroscuro — Studio Light", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 85mm f/1.4 GM II", "f/1.4", "1/500s", "100", "9504 × 6336", 62914560, "cat-portrait", "Portraits & Character Studies", "portrait", "Editorial Character Studies", 98, 1, 0, NULL, 0, "selected", "Single-source continuous tungsten beam sculpted across facial contours with dramatic falloff.", "2026-10-22", 'usr-owner-01'),
("p-06", "Elder Weaver of Varanasi — Morning Light", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=85", "Leica M11", "Summilux-M 35mm f/1.4", "f/2.0", "1/400s", "200", "9528 × 6328", 54525952, "cat-portrait", "Portraits & Character Studies", "portrait", "Master Artisans", 96, 0, 0, NULL, 0, "needs_review", "Intimate environmental portrait of a fifth-generation master jacquard loom artisan in Madanpura.", "2026-10-22", 'usr-owner-01'),
("p-07", "Editorial Portrait — Ochre Tones", "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 50mm f/1.2 GM", "f/1.8", "1/640s", "100", "9504 × 6336", 61865984, "cat-portrait", "Portraits & Character Studies", "portrait", "Tonal Monograph", 95, 0, 0, NULL, 0, "needs_review", "Subtle tonal gradation with earthen clay background and soft northern studio window exposure.", "2026-10-22", 'usr-owner-01'),
("p-08", "Himalayan Ridge at Twilight — Ladakh Pass", "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85", "Hasselblad X2D 100C", "XCD 38mm f/2.5 V", "f/8.0", "1.5s", "64", "11656 × 8742", 94371840, "cat-landscape", "Landscape & Nature", "landscape", "Alpine Monograph", 99, 1, 0, NULL, 0, "approved", "High-altitude cold desert ridges in Changthang illuminated by lingering indigo afterglow.", "2026-10-15", 'usr-owner-01'),
("p-09", "Glacial Alpine Solitude & Fjord", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 24-70mm f/2.8 GM II", "f/8.0", "1/200s", "100", "9504 × 6336", 68157440, "cat-landscape", "Landscape & Nature", "landscape", "Alpine Monograph", 97, 1, 0, NULL, 0, "selected", "Sharp pyramid mountain summit piercing high-altitude cirrus clouds above turquoise waters.", "2026-10-16", 'usr-owner-01'),
("p-10", "Monsoon Mist Over Western Ghats", "https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?auto=format&fit=crop&w=1200&q=85", "Leica SL2-S", "Vario-Elmarit-SL 24-90mm f/2.8-4", "f/5.6", "1/320s", "160", "6000 × 4000", 47185920, "cat-landscape", "Landscape & Nature", "landscape", "Monsoon Studies", 94, 0, 0, NULL, 0, "needs_review", "Layered cloud banks rolling across dense shola rainforest slopes at dawn.", "2026-10-17", 'usr-owner-01'),
("p-11", "Old Delhi Alleyways — Chawri Bazar Geometry", "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=85", "Leica M11", "Summicron-M 28mm f/2 ASPH", "f/4.0", "1/500s", "200", "9528 × 6328", 56623104, "cat-street", "Street & Travel", "street", "Shahjahanabad Monograph", 98, 1, 0, NULL, 0, "selected", "Overhead lattice of telephone lines and historic haveli balconies framing early morning pedestrian flow.", "2026-10-18", 'usr-owner-01'),
("p-12", "Twilight on the Ganges River Ghats", "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 35mm f/1.4 GM", "f/2.0", "1/160s", "800", "9504 × 6336", 64487424, "cat-street", "Street & Travel", "street", "Varanasi Studies", 99, 1, 0, NULL, 0, "approved", "Ethereal mist and wooden boat silhouettes resting at Dashashwamedh Ghat at blue hour.", "2026-10-19", 'usr-owner-01'),
("p-13", "Modern Architecture & Glass Facades", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85", "Canon EOS R5", "RF 15-35mm f/2.8L", "f/8.0", "1/320s", "100", "8192 × 5464", 52428800, "cat-street", "Street & Travel", "street", "Metropolis Reflections", 93, 0, 0, NULL, 0, "needs_review", "Upward dynamic perspective capturing geometric glass facade reflections against clear sky.", "2026-10-21", 'usr-owner-01'),
("p-14", "Jaipur Stepwell Geometries — Panna Meena Ka Kund", "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=85", "Hasselblad X2D 100C", "XCD 28mm f/4 P", "f/11", "1/125s", "64", "11656 × 8742", 98566144, "cat-arch", "Architecture & Heritage", "arch", "Heritage Geometries", 99, 1, 0, NULL, 0, "selected", "Mesmerizing crisscrossing symmetrical yellow sandstone staircases leading to emerald basin.", "2026-10-22", 'usr-owner-01'),
("p-15", "Brutalist Concrete Pavilion Shadows", "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=85", "Hasselblad X2D 100C", "XCD 38mm f/2.5 V", "f/8.0", "1/400s", "64", "11656 × 8742", 91226112, "cat-arch", "Architecture & Heritage", "arch", "Modern Brutalism", 94, 0, 0, NULL, 0, "rejected", "Chiaroscuro diagonal shadow cuts across raw board-formed concrete cantilever.", "2026-10-23", 'usr-owner-01'),
("p-16", "Mughal Sandstone Jali & Light Spill", "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=85", "Leica M11", "Summicron-M 50mm f/2", "f/2.8", "1/320s", "100", "9528 × 6328", 58720256, "cat-arch", "Architecture & Heritage", "arch", "Mughal Architecture", 97, 1, 0, NULL, 0, "approved", "Intricate perforated stone lattice casting geometric ray patterns onto polished marble flooring.", "2026-10-23", 'usr-owner-01'),
("p-17", "Artisanal Saffron Infusion & Handcrafted Brass", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 90mm f/2.8 Macro G", "f/4.0", "1/160s", "100", "9504 × 6336", 59768832, "cat-food", "Food & Product", "still-life", "Culinary Heritage", 96, 0, 0, NULL, 0, "selected", "Pure Kashmiri saffron filaments infusing warm amber tones within an antique hammered brass vessel.", "2026-10-24", 'usr-owner-01'),
("p-18", "Terracotta Still Life & Heritage Spices", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=85", "Leica SL2-S", "APO-Summicron-SL 50mm f/2", "f/3.5", "1/200s", "100", "6000 × 4000", 48234496, "cat-food", "Food & Product", "still-life", "Culinary Heritage", 94, 0, 0, NULL, 0, "needs_review", "Whole cardamom, star anise, and cinnamon bark arranged on rustic hand-thrown terracotta plate.", "2026-10-24", 'usr-owner-01'),
("p-19", "Bengal Tiger in Morning Mist — Ranthambore", "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?auto=format&fit=crop&w=1200&q=85", "Canon EOS R5", "RF 400mm f/2.8L IS", "f/3.2", "1/1250s", "400", "8192 × 5464", 73400320, "cat-wildlife", "Wildlife & Nature", "wildlife", "Fauna Conservation", 99, 1, 0, NULL, 0, "needs_review", "Solitary royal Bengal tiger prowling through early winter canopy mist in zone 3 of Ranthambore.", "2026-10-14", 'usr-owner-01'),
("p-20", "Migratory Crane at Sunrise Wetland", "https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 200-600mm f/5.6-6.3 G", "f/6.3", "1/2000s", "250", "9504 × 6336", 67108864, "cat-wildlife", "Wildlife & Nature", "wildlife", "Avian Sanctuary", 95, 0, 0, NULL, 0, "needs_review", "Sarus crane pair silhouette taking flight over golden marsh waters at Bharatpur Bird Sanctuary.", "2026-10-14", 'usr-owner-01'),
("p-21", "Palace Colonnade Golden Hour Ceremony", "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 85mm f/1.4 GM II", "f/1.4", "1/1000s", "100", "9504 × 6336", 66060288, "cat-wedding", "Weddings & Celebrations", "wedding", "Heritage Royal Ceremony", 99, 1, 0, NULL, 0, "approved", "Bride and groom walking beneath carved sandstone arches during sunset royal ceremony in Udaipur.", "2026-10-23", 'usr-owner-01'),
("p-22", "Marigold & Turmeric Haldi Ritual", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85", "Sony A7R V", "FE 50mm f/1.2 GM", "f/1.4", "1/500s", "100", "9504 × 6336", 65011712, "cat-wedding", "Weddings & Celebrations", "wedding", "Heritage Royal Ceremony", 98, 0, 0, NULL, 0, "selected", "Shower of fresh orange marigold petals captured mid-air during joyous family Haldi blessing ceremony.", "2026-10-23", 'usr-owner-01'),
("p-23", "Kathakali Mudra & Dramatic Chiaroscuro", "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=1200&q=85", "Leica M11", "Noctilux-M 50mm f/0.95", "f/1.2", "1/320s", "400", "9528 × 6328", 61865984, "cat-indian-culture", "Indian Cultural & Ethnic", "fine-art", "Classical Indian Arts", 99, 1, 0, NULL, 0, "approved", "Expressive eye gesture and painted green Vesham mask captured under flickering oil lamp illumination.", "2026-10-24", 'usr-owner-01'),
("p-24", "Block Printing Artisan Hands — Bagru Indigo", "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=85", "Leica SL2-S", "APO-Summicron-SL 35mm f/2", "f/2.5", "1/500s", "200", "6000 × 4000", 46137344, "cat-indian-culture", "Indian Cultural & Ethnic", "street", "Handcraft Heritage", 96, 0, 0, NULL, 0, "needs_review", "Indigo-stained hands of a master artisan pressing hand-carved teakwood block onto cotton cloth.", "2026-10-24", 'usr-owner-01')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Tags Seed
INSERT INTO `tags` (`name`) VALUES
("saree"),
("silk"),
("handloom"),
("editorial"),
("khadi"),
("minimalist"),
("silhouette"),
("wool"),
("tailoring"),
("monochrome"),
("textile"),
("zari"),
("macro"),
("craftsmanship"),
("chiaroscuro"),
("rembrandt-light"),
("monograph"),
("artisan"),
("varanasi"),
("documentary"),
("portrait"),
("warmth"),
("natural-light"),
("himalayas"),
("ladakh"),
("high-altitude"),
("twilight"),
("alpine"),
("glacier"),
("peaks"),
("monsoon"),
("western-ghats"),
("mist"),
("canopy"),
("delhi"),
("old-city"),
("street-photography"),
("heritage"),
("ganges"),
("river"),
("spiritual"),
("travel"),
("skyscraper"),
("metropolis"),
("reflection"),
("lines"),
("stepwell"),
("jaipur"),
("geometry"),
("symmetry"),
("brutalism"),
("concrete"),
("shadow"),
("jali"),
("mughal"),
("sandstone"),
("pattern"),
("light"),
("saffron"),
("brassware"),
("tea"),
("still-life"),
("spices"),
("terracotta"),
("organic"),
("product"),
("tiger"),
("wildlife"),
("ranthambore"),
("nature"),
("birds"),
("wetland"),
("sunrise"),
("wedding"),
("palace"),
("udaipur"),
("ceremony"),
("golden-hour"),
("haldi"),
("marigold"),
("turmeric"),
("ritual"),
("joy"),
("kathakali"),
("kerala"),
("mudra"),
("theatre"),
("classical"),
("block-printing"),
("indigo"),
("bagru"),
("hands"),
("craft")
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Photo-Tags Seed
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-01", `id` FROM `tags` WHERE `name` = "saree";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-01", `id` FROM `tags` WHERE `name` = "silk";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-01", `id` FROM `tags` WHERE `name` = "handloom";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-01", `id` FROM `tags` WHERE `name` = "editorial";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-02", `id` FROM `tags` WHERE `name` = "khadi";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-02", `id` FROM `tags` WHERE `name` = "handloom";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-02", `id` FROM `tags` WHERE `name` = "minimalist";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-02", `id` FROM `tags` WHERE `name` = "silhouette";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-03", `id` FROM `tags` WHERE `name` = "wool";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-03", `id` FROM `tags` WHERE `name` = "tailoring";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-03", `id` FROM `tags` WHERE `name` = "monochrome";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-03", `id` FROM `tags` WHERE `name` = "editorial";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-04", `id` FROM `tags` WHERE `name` = "textile";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-04", `id` FROM `tags` WHERE `name` = "zari";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-04", `id` FROM `tags` WHERE `name` = "macro";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-04", `id` FROM `tags` WHERE `name` = "craftsmanship";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-05", `id` FROM `tags` WHERE `name` = "chiaroscuro";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-05", `id` FROM `tags` WHERE `name` = "rembrandt-light";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-05", `id` FROM `tags` WHERE `name` = "monograph";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-06", `id` FROM `tags` WHERE `name` = "artisan";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-06", `id` FROM `tags` WHERE `name` = "varanasi";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-06", `id` FROM `tags` WHERE `name` = "documentary";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-06", `id` FROM `tags` WHERE `name` = "portrait";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-07", `id` FROM `tags` WHERE `name` = "editorial";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-07", `id` FROM `tags` WHERE `name` = "warmth";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-07", `id` FROM `tags` WHERE `name` = "natural-light";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-08", `id` FROM `tags` WHERE `name` = "himalayas";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-08", `id` FROM `tags` WHERE `name` = "ladakh";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-08", `id` FROM `tags` WHERE `name` = "high-altitude";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-08", `id` FROM `tags` WHERE `name` = "twilight";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-09", `id` FROM `tags` WHERE `name` = "alpine";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-09", `id` FROM `tags` WHERE `name` = "glacier";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-09", `id` FROM `tags` WHERE `name` = "peaks";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-09", `id` FROM `tags` WHERE `name` = "minimalist";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-10", `id` FROM `tags` WHERE `name` = "monsoon";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-10", `id` FROM `tags` WHERE `name` = "western-ghats";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-10", `id` FROM `tags` WHERE `name` = "mist";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-10", `id` FROM `tags` WHERE `name` = "canopy";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-11", `id` FROM `tags` WHERE `name` = "delhi";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-11", `id` FROM `tags` WHERE `name` = "old-city";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-11", `id` FROM `tags` WHERE `name` = "street-photography";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-11", `id` FROM `tags` WHERE `name` = "heritage";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-12", `id` FROM `tags` WHERE `name` = "varanasi";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-12", `id` FROM `tags` WHERE `name` = "ganges";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-12", `id` FROM `tags` WHERE `name` = "river";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-12", `id` FROM `tags` WHERE `name` = "spiritual";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-12", `id` FROM `tags` WHERE `name` = "travel";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-13", `id` FROM `tags` WHERE `name` = "skyscraper";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-13", `id` FROM `tags` WHERE `name` = "metropolis";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-13", `id` FROM `tags` WHERE `name` = "reflection";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-13", `id` FROM `tags` WHERE `name` = "lines";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-14", `id` FROM `tags` WHERE `name` = "stepwell";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-14", `id` FROM `tags` WHERE `name` = "jaipur";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-14", `id` FROM `tags` WHERE `name` = "geometry";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-14", `id` FROM `tags` WHERE `name` = "heritage";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-14", `id` FROM `tags` WHERE `name` = "symmetry";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-15", `id` FROM `tags` WHERE `name` = "brutalism";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-15", `id` FROM `tags` WHERE `name` = "concrete";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-15", `id` FROM `tags` WHERE `name` = "shadow";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-15", `id` FROM `tags` WHERE `name` = "lines";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-16", `id` FROM `tags` WHERE `name` = "jali";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-16", `id` FROM `tags` WHERE `name` = "mughal";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-16", `id` FROM `tags` WHERE `name` = "sandstone";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-16", `id` FROM `tags` WHERE `name` = "pattern";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-16", `id` FROM `tags` WHERE `name` = "light";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-17", `id` FROM `tags` WHERE `name` = "saffron";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-17", `id` FROM `tags` WHERE `name` = "brassware";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-17", `id` FROM `tags` WHERE `name` = "tea";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-17", `id` FROM `tags` WHERE `name` = "still-life";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-18", `id` FROM `tags` WHERE `name` = "spices";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-18", `id` FROM `tags` WHERE `name` = "terracotta";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-18", `id` FROM `tags` WHERE `name` = "organic";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-18", `id` FROM `tags` WHERE `name` = "product";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-19", `id` FROM `tags` WHERE `name` = "tiger";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-19", `id` FROM `tags` WHERE `name` = "wildlife";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-19", `id` FROM `tags` WHERE `name` = "ranthambore";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-19", `id` FROM `tags` WHERE `name` = "nature";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-20", `id` FROM `tags` WHERE `name` = "birds";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-20", `id` FROM `tags` WHERE `name` = "wetland";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-20", `id` FROM `tags` WHERE `name` = "sunrise";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-20", `id` FROM `tags` WHERE `name` = "wildlife";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-21", `id` FROM `tags` WHERE `name` = "wedding";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-21", `id` FROM `tags` WHERE `name` = "palace";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-21", `id` FROM `tags` WHERE `name` = "udaipur";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-21", `id` FROM `tags` WHERE `name` = "ceremony";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-21", `id` FROM `tags` WHERE `name` = "golden-hour";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-22", `id` FROM `tags` WHERE `name` = "haldi";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-22", `id` FROM `tags` WHERE `name` = "marigold";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-22", `id` FROM `tags` WHERE `name` = "turmeric";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-22", `id` FROM `tags` WHERE `name` = "ritual";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-22", `id` FROM `tags` WHERE `name` = "joy";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-23", `id` FROM `tags` WHERE `name` = "kathakali";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-23", `id` FROM `tags` WHERE `name` = "kerala";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-23", `id` FROM `tags` WHERE `name` = "mudra";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-23", `id` FROM `tags` WHERE `name` = "theatre";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-23", `id` FROM `tags` WHERE `name` = "classical";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-24", `id` FROM `tags` WHERE `name` = "block-printing";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-24", `id` FROM `tags` WHERE `name` = "indigo";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-24", `id` FROM `tags` WHERE `name` = "bagru";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-24", `id` FROM `tags` WHERE `name` = "hands";
INSERT IGNORE INTO `photo_tags` (`photo_id`, `tag_id`) SELECT "p-24", `id` FROM `tags` WHERE `name` = "craft";

INSERT INTO `client_notes` (`photo_id`, `user_id`, `author_name`, `note`) VALUES ("p-04", 'usr-client-01', 'Anita & Vikram', "Check focus on edge weave; increase local shadow detail.");
INSERT INTO `client_notes` (`photo_id`, `user_id`, `author_name`, `note`) VALUES ("p-15", 'usr-client-01', 'Anita & Vikram', "Too stark for this monograph theme.");
INSERT INTO `client_notes` (`photo_id`, `user_id`, `author_name`, `note`) VALUES ("p-21", 'usr-client-01', 'Anita & Vikram', "Central spread candidate for royal ceremony monograph.");

-- Albums Seed
INSERT INTO `albums` (`id`, `user_id`, `title`, `description`, `cover_image_id`, `cover_url`) VALUES
("alb-01", 'usr-owner-01', "Alpine Light", "Sublime mountain ridges, glacial lakes, and atmospheric mist studies.", "p-09", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85"),
("alb-02", 'usr-owner-01', "Urban Stories", "Candid street rhythm, Chawri Bazar geometries, and twilight river reflections.", "p-11", "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=85"),
("alb-03", 'usr-owner-01', "Form & Fabric", "Contemporary Indian silhouettes, handwoven organza, and tactile macro weave studies.", "p-01", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85"),
("alb-04", 'usr-owner-01', "Still Life Studies", "Artisanal saffron, handcrafted brassware, and raw spice chiaroscuro.", "p-17", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=85"),
("alb-05", 'usr-owner-01', "Faces & Moments", "Editorial chiaroscuro character studies, artisans, and royal ceremonial milestones.", "p-05", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85"),
("alb-06", 'usr-owner-01', "Heritage in Focus", "Historic stepwells, Mughal sandstone light spill, and Kathakali cultural artistry.", "p-14", "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=85")
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Album Photos Seed
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-01", "p-08", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-01", "p-09", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-01", "p-10", 2);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-02", "p-11", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-02", "p-12", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-02", "p-13", 2);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-03", "p-01", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-03", "p-02", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-03", "p-03", 2);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-03", "p-04", 3);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-04", "p-17", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-04", "p-18", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-05", "p-05", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-05", "p-06", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-05", "p-07", 2);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-05", "p-21", 3);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-05", "p-22", 4);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-06", "p-14", 0);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-06", "p-15", 1);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-06", "p-16", 2);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-06", "p-23", 3);
INSERT IGNORE INTO `album_photos` (`album_id`, `photo_id`, `position`) VALUES ("alb-06", "p-24", 4);

-- Portfolio Brief Seed
INSERT INTO `portfolio_briefs` (`id`, `user_id`, `title`, `purpose`, `target_audience`, `target_count`, `curation_strategy`, `candidate_pool_count`, `selected_album_id`, `is_published`) VALUES
('brief-usr-owner-01', 'usr-owner-01', 'High-Contrast Monograph 2025', 'Editorial & Monograph Submission', 'Curators, Gallerists, High-Fashion Publishers', 24, 'visual_tempo', 24, 'alb-01', 1),
('brief-default', 'usr-owner-01', 'Studio Master Monograph', 'Curatorial Editorial Spread', 'Gallery Directors', 20, 'tonal_balance', 24, 'alb-02', 0)
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Setup verification summary
SELECT 'lumen_db initialized successfully!' AS `status`, COUNT(*) AS `total_photos` FROM `photos`;
