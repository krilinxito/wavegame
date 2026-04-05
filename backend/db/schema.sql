CREATE TABLE IF NOT EXISTS games (
  id            VARCHAR(36)  PRIMARY KEY,
  room_code     VARCHAR(8)   NOT NULL UNIQUE,
  mode          ENUM('normal','teams','basta') NOT NULL DEFAULT 'normal',
  status        ENUM('lobby','playing','finished') NOT NULL DEFAULT 'lobby',
  range_min     INT          NOT NULL DEFAULT 1,
  range_max     INT          NOT NULL DEFAULT 1000,
  win_condition ENUM('points','rounds') NOT NULL DEFAULT 'points',
  win_value     INT          NOT NULL DEFAULT 10,
  guess_time    INT          NOT NULL DEFAULT 120,
  current_round INT          NOT NULL DEFAULT 0,
  psychic_id    VARCHAR(36)  NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_room_code (room_code),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS players (
  id           VARCHAR(36)  PRIMARY KEY,
  game_id      VARCHAR(36)  NOT NULL,
  display_name VARCHAR(50)  NOT NULL,
  photo_path   VARCHAR(255) NULL,
  score        INT          NOT NULL DEFAULT 0,
  team         TINYINT      NULL,
  turn_order   TINYINT      NOT NULL DEFAULT 0,
  is_host      BOOLEAN      NOT NULL DEFAULT FALSE,
  socket_id    VARCHAR(100) NULL,
  connected    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game_id (game_id),
  INDEX idx_socket_id (socket_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id           VARCHAR(36)   PRIMARY KEY,
  game_id      VARCHAR(36)   NOT NULL,
  round_number INT           NOT NULL,
  psychic_id   VARCHAR(36)   NOT NULL,
  target_pct   DECIMAL(6,4)  NOT NULL,
  clue         VARCHAR(255)  NULL,
  status       ENUM('clue_giving','guessing','revealing','scoring','done') NOT NULL DEFAULT 'clue_giving',
  started_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revealed_at  DATETIME      NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game_round (game_id, round_number)
);

CREATE TABLE IF NOT EXISTS categories (
  id           VARCHAR(36)  PRIMARY KEY,
  game_id      VARCHAR(36)  NOT NULL,
  term         VARCHAR(255) NOT NULL,
  left_extreme VARCHAR(100) NOT NULL,
  right_extreme VARCHAR(100) NOT NULL,
  created_by   VARCHAR(36)  NOT NULL,
  used         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE CASCADE,
  INDEX idx_game_id (game_id)
);

CREATE TABLE IF NOT EXISTS guesses (
  id           VARCHAR(36)  PRIMARY KEY,
  round_id     VARCHAR(36)  NOT NULL,
  player_id    VARCHAR(36)  NOT NULL,
  guess_pct    DECIMAL(6,4) NOT NULL,
  submitted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_first     BOOLEAN      NOT NULL DEFAULT FALSE,
  score_delta  INT          NULL,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_round_player (round_id, player_id),
  INDEX idx_round_id (round_id)
);

CREATE TABLE IF NOT EXISTS powers (
  id          TINYINT      PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  cost        TINYINT      NOT NULL,
  description VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS round_powers (
  id            VARCHAR(36) PRIMARY KEY,
  round_id      VARCHAR(36) NOT NULL,
  player_id     VARCHAR(36) NOT NULL,
  power_id      TINYINT     NOT NULL,
  activated     BOOLEAN     NOT NULL DEFAULT FALSE,
  target_player VARCHAR(36) NULL,
  activated_at  DATETIME    NULL,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (power_id) REFERENCES powers(id),
  UNIQUE KEY uq_round_player_power (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS score_log (
  id         VARCHAR(36)  PRIMARY KEY,
  game_id    VARCHAR(36)  NOT NULL,
  round_id   VARCHAR(36)  NOT NULL,
  player_id  VARCHAR(36)  NOT NULL,
  delta      INT          NOT NULL,
  reason     VARCHAR(100) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_game_player (game_id, player_id),
  INDEX idx_round_id (round_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id       VARCHAR(36) PRIMARY KEY,
  game_id  VARCHAR(36) NOT NULL,
  team_num TINYINT     NOT NULL,
  name     VARCHAR(50) NULL,
  score    INT         NOT NULL DEFAULT 0,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE KEY uq_game_team (game_id, team_num)
);

-- Migrations para volúmenes existentes
ALTER TABLE games ADD COLUMN IF NOT EXISTS guess_time INT NOT NULL DEFAULT 120;
