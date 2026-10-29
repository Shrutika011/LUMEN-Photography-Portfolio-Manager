-- Fresh-database bootstrap matching the inspected active LUMEN MySQL schema.
-- Connect to the intended empty database before running this file.
-- This file never drops, truncates, alters, or seeds records.

CREATE TABLE IF NOT EXISTS users (
  id varchar(100) NOT NULL,
  name varchar(255) DEFAULT NULL,
  email varchar(255) DEFAULT NULL,
  password_hash varchar(255) DEFAULT NULL,
  role varchar(100) DEFAULT NULL,
  title varchar(255) DEFAULT NULL,
  avatar text,
  studio_role_label varchar(255) DEFAULT NULL,
  bio text,
  created_at datetime DEFAULT NULL,
  updated_at datetime DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS categories (
  id varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  is_custom tinyint(1) DEFAULT '0',
  user_id varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS photos (
  id varchar(100) NOT NULL,
  user_id varchar(100) DEFAULT NULL,
  title varchar(255) DEFAULT NULL,
  image_url longtext NOT NULL,
  camera varchar(255) DEFAULT NULL,
  lens varchar(255) DEFAULT NULL,
  aperture varchar(100) DEFAULT NULL,
  shutter varchar(100) DEFAULT NULL,
  iso varchar(100) DEFAULT NULL,
  dimensions varchar(100) DEFAULT NULL,
  file_size bigint DEFAULT NULL,
  category_id varchar(100) DEFAULT NULL,
  category_name varchar(255) DEFAULT NULL,
  shoot varchar(255) DEFAULT NULL,
  shoot_label varchar(255) DEFAULT NULL,
  score decimal(10,2) DEFAULT NULL,
  is_favorite tinyint(1) DEFAULT '0',
  in_active_portfolio tinyint(1) DEFAULT '0',
  client_status varchar(100) DEFAULT NULL,
  plate_number varchar(100) DEFAULT NULL,
  is_cover_hero tinyint(1) DEFAULT '0',
  description text,
  date_photographed date DEFAULT NULL,
  created_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY category_id (category_id),
  CONSTRAINT photos_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT photos_ibfk_2 FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS albums (
  id varchar(100) NOT NULL,
  user_id varchar(100) DEFAULT NULL,
  title varchar(255) NOT NULL,
  description text,
  cover_image_id varchar(100) DEFAULT NULL,
  cover_url longtext,
  created_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT albums_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS album_photos (
  album_id varchar(100) NOT NULL,
  photo_id varchar(100) NOT NULL,
  position int DEFAULT '0',
  PRIMARY KEY (album_id, photo_id),
  KEY photo_id (photo_id),
  CONSTRAINT album_photos_ibfk_1 FOREIGN KEY (album_id) REFERENCES albums (id) ON DELETE CASCADE,
  CONSTRAINT album_photos_ibfk_2 FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id varchar(100) NOT NULL,
  tag varchar(255) NOT NULL,
  PRIMARY KEY (photo_id, tag),
  CONSTRAINT photo_tags_ibfk_1 FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS photo_client_notes (
  id int NOT NULL AUTO_INCREMENT,
  photo_id varchar(100) NOT NULL,
  note text NOT NULL,
  position int DEFAULT '0',
  PRIMARY KEY (id),
  KEY photo_id (photo_id),
  CONSTRAINT photo_client_notes_ibfk_1 FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS portfolio_briefs (
  id varchar(100) NOT NULL,
  user_id varchar(100) DEFAULT NULL,
  title varchar(255) DEFAULT NULL,
  purpose text,
  audience text,
  target_count int DEFAULT NULL,
  curation_strategy text,
  candidate_pool_count int DEFAULT NULL,
  selected_album_id varchar(100) DEFAULT NULL,
  portfolio_data json DEFAULT NULL,
  is_published tinyint(1) DEFAULT '0',
  created_at datetime DEFAULT NULL,
  updated_at datetime DEFAULT NULL,
  published_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY selected_album_id (selected_album_id),
  CONSTRAINT portfolio_briefs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT portfolio_briefs_ibfk_2 FOREIGN KEY (selected_album_id) REFERENCES albums (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
