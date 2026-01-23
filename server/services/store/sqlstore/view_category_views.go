package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const viewCategoryViewSortOrderGap = 10

func (s *SQLStore) viewCategoryViewMetadataFields() []string {
	return []string{
		"view_id",
		"category_id",
		"hidden",
		"COALESCE(sort_order, 0)",
	}
}

func (s *SQLStore) getUserViewCategoryViews(db sq.BaseRunner, userID, boardID string) ([]model.ViewCategoryViews, error) {
	// First get all view categories for the user and board
	categories, err := s.getUserViewCategories(db, userID, boardID)
	if err != nil {
		s.logger.Error("getUserViewCategoryViews error fetching view categories", mlog.Err(err))
		return nil, err
	}

	categoryViews := make([]model.ViewCategoryViews, len(categories))

	for i, category := range categories {
		categoryViews[i] = model.ViewCategoryViews{
			ViewCategory: category,
			ViewMetadata: []model.ViewCategoryViewMetadata{},
		}

		// Get all view IDs and metadata for this category
		query := s.getQueryBuilder(db).
			Select(s.viewCategoryViewMetadataFields()...).
			From(s.tablePrefix + "view_category_views").
			Where(sq.Eq{"category_id": category.ID}).
			OrderBy("sort_order")

		rows, err := query.Query()
		if err != nil {
			s.logger.Error("getUserViewCategoryViews error fetching view metadata", mlog.Err(err))
			return nil, err
		}

		metadata, err := s.viewCategoryViewMetadataFromRows(rows)
		if err != nil {
			s.logger.Error("getUserViewCategoryViews error parsing view metadata", mlog.Err(err))
			return nil, err
		}

		categoryViews[i].ViewMetadata = metadata
	}

	return categoryViews, nil
}

func (s *SQLStore) addUpdateViewCategoryView(db sq.BaseRunner, userID, categoryID string, viewIDs []string) error {
	for _, viewID := range viewIDs {
		// Check if the mapping already exists
		existsQuery := s.getQueryBuilder(db).
			Select("view_id").
			From(s.tablePrefix + "view_category_views").
			Where(sq.Eq{"view_id": viewID})

		var existingViewID string
		err := existsQuery.QueryRow().Scan(&existingViewID)

		if err != nil && err != sql.ErrNoRows {
			s.logger.Error("addUpdateViewCategoryView error checking existing mapping", mlog.Err(err))
			return err
		}

		if err == sql.ErrNoRows {
			// Insert new mapping
			insertQuery := s.getQueryBuilder(db).
				Insert(s.tablePrefix+"view_category_views").
				Columns("view_id", "category_id", "hidden", "sort_order").
				Values(viewID, categoryID, false, 0)

			if _, err := insertQuery.Exec(); err != nil {
				s.logger.Error("addUpdateViewCategoryView error inserting new mapping", mlog.Err(err))
				return err
			}
		} else {
			// Update existing mapping
			updateQuery := s.getQueryBuilder(db).
				Update(s.tablePrefix+"view_category_views").
				Set("category_id", categoryID).
				Where(sq.Eq{"view_id": viewID})

			if _, err := updateQuery.Exec(); err != nil {
				s.logger.Error("addUpdateViewCategoryView error updating mapping", mlog.Err(err))
				return err
			}
		}
	}

	return nil
}

func (s *SQLStore) reorderViewCategoryViews(db sq.BaseRunner, categoryID string, newViewsOrder []string) ([]string, error) {
	// Get existing views for this category
	query := s.getQueryBuilder(db).
		Select(s.viewCategoryViewMetadataFields()...).
		From(s.tablePrefix + "view_category_views").
		Where(sq.Eq{"category_id": categoryID}).
		OrderBy("sort_order")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("reorderViewCategoryViews error fetching views", mlog.Err(err))
		return nil, err
	}

	existingViews, err := s.viewCategoryViewMetadataFromRows(rows)
	if err != nil {
		s.logger.Error("reorderViewCategoryViews error parsing views", mlog.Err(err))
		return nil, err
	}

	if len(existingViews) == 0 {
		return []string{}, nil
	}

	currentOrder := make([]string, len(existingViews))
	for i, view := range existingViews {
		currentOrder[i] = view.ViewID
	}

	if len(newViewsOrder) != len(currentOrder) {
		return currentOrder, nil
	}

	orderMap := make(map[string]int)
	for i, viewID := range newViewsOrder {
		orderMap[viewID] = i * viewCategoryViewSortOrderGap
	}

	for _, view := range existingViews {
		newOrder, exists := orderMap[view.ViewID]
		if !exists {
			continue
		}

		updateQuery := s.getQueryBuilder(db).
			Update(s.tablePrefix+"view_category_views").
			Set("sort_order", newOrder).
			Where(sq.Eq{
				"view_id":     view.ViewID,
				"category_id": categoryID,
			})

		if _, err := updateQuery.Exec(); err != nil {
			s.logger.Error("reorderViewCategoryViews failed to update view order", mlog.String("view_id", view.ViewID), mlog.Err(err))
			return currentOrder, err
		}
	}

	return newViewsOrder, nil
}

func (s *SQLStore) setViewVisibility(db sq.BaseRunner, userID, categoryID, viewID string, visible bool) error {
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"view_category_views").
		Set("hidden", !visible).
		Where(sq.Eq{
			"view_id":     viewID,
			"category_id": categoryID,
		})

	_, err := query.Exec()
	if err != nil {
		s.logger.Error("setViewVisibility error", mlog.Err(err))
		return err
	}

	return nil
}

func (s *SQLStore) viewCategoryViewMetadataFromRows(rows *sql.Rows) ([]model.ViewCategoryViewMetadata, error) {
	defer rows.Close()

	metadata := []model.ViewCategoryViewMetadata{}

	for rows.Next() {
		var item model.ViewCategoryViewMetadata
		var categoryID string
		var sortOrder int

		err := rows.Scan(
			&item.ViewID,
			&categoryID,
			&item.Hidden,
			&sortOrder,
		)
		if err != nil {
			return nil, err
		}

		metadata = append(metadata, item)
	}

	return metadata, nil
}
