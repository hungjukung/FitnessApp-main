import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'fittrack_db',
  user: process.env.DB_USER ?? 'fittrack_user',
  password: process.env.DB_PASSWORD ?? '',
  connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
  waitForConnections: true,
  queueLimit: 0,
});

export async function initDatabaseSchema(): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          VARCHAR(36)  PRIMARY KEY,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_email_verified TINYINT(1) NOT NULL DEFAULT 0,
      email_verify_token VARCHAR(255),
      email_verify_expires_at BIGINT,
      reset_token VARCHAR(255),
      reset_token_expires_at BIGINT,
      created_at  BIGINT       NOT NULL,
      updated_at  BIGINT       NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token       VARCHAR(512) PRIMARY KEY,
      user_id     VARCHAR(36)  NOT NULL,
      expires_at  BIGINT       NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id              VARCHAR(36)  PRIMARY KEY,
      nickname             VARCHAR(100),
      gender               VARCHAR(30),
      age                  INT,
      height_cm            FLOAT,
      initial_weight_kg    FLOAT,
      goal_weight_kg       FLOAT,
      goal                 VARCHAR(30),
      experience_level     VARCHAR(30),
      ai_consent_given     TINYINT(1)   NOT NULL DEFAULT 0,
      onboarding_completed TINYINT(1)   NOT NULL DEFAULT 0,
      updated_at           BIGINT       NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS weight_logs (
      user_id    VARCHAR(36)  NOT NULL,
      date       VARCHAR(10)  NOT NULL,
      weight     FLOAT        NOT NULL,
      created_at BIGINT       NOT NULL,
      updated_at BIGINT       NOT NULL,
      PRIMARY KEY (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS photo_logs (
      id         VARCHAR(36)  PRIMARY KEY,
      user_id    VARCHAR(36)  NOT NULL,
      date       VARCHAR(10)  NOT NULL,
      file_name  VARCHAR(255) NOT NULL,
      sort_index INT          NOT NULL DEFAULT 0,
      file_data  LONGTEXT     NOT NULL,
      created_at BIGINT       NOT NULL,
      INDEX idx_photo_user_date (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id           VARCHAR(36)  PRIMARY KEY,
      user_id      VARCHAR(36)  NOT NULL,
      date         VARCHAR(10)  NOT NULL,
      name         VARCHAR(100),
      started_at   BIGINT       NOT NULL,
      completed_at BIGINT,
      created_at   BIGINT       NOT NULL,
      updated_at   BIGINT       NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ws_user_date (user_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS workout_sets (
      id            VARCHAR(36)  PRIMARY KEY,
      session_id    VARCHAR(36)  NOT NULL,
      user_id       VARCHAR(36)  NOT NULL,
      exercise_id   VARCHAR(100) NOT NULL,
      exercise_name VARCHAR(100) NOT NULL,
      set_number    INT          NOT NULL,
      reps          INT,
      weight        FLOAT,
      duration      INT,
      created_at    BIGINT       NOT NULL,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_wset_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
