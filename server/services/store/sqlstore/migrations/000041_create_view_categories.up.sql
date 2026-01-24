CREATE TABLE IF NOT EXISTS {{.prefix}}view_categories (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    board_id VARCHAR(36) NOT NULL,
    create_at BIGINT NOT NULL,
    update_at BIGINT NOT NULL,
    delete_at BIGINT DEFAULT 0,
    collapsed BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    type VARCHAR(10) NOT NULL DEFAULT 'custom',
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_view_categories_user_board ON {{.prefix}}view_categories(user_id, board_id, delete_at);
CREATE INDEX IF NOT EXISTS idx_view_categories_board ON {{.prefix}}view_categories(board_id, delete_at);

CREATE TABLE IF NOT EXISTS {{.prefix}}view_category_views (
    view_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    hidden BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (view_id),
    CONSTRAINT fk_view_category_views_category FOREIGN KEY (category_id) REFERENCES {{.prefix}}view_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_view_category_views_category ON {{.prefix}}view_category_views(category_id);
