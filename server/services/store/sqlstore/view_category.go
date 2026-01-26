package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const viewCategorySortOrderGap = 10

func (s *SQLStore) viewCategoryFields() []string {
	return []string{
		"id",
		"name",
		"user_id",
		"board_id",
		"create_at",
		"update_at",
		"delete_at",
		"collapsed",
		"COALESCE(sort_order, 0)",
		"type",
	}
}

func (s *SQLStore) getViewCategory(db sq.BaseRunner, id string) (*model.ViewCategory, error) {
	query := s.getQueryBuilder(db).
		Select(s.viewCategoryFields()...).
		From(s.tablePrefix + "view_categories").
		Where(sq.Eq{"id": id})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("getViewCategory error", mlog.Err(err))
		return nil, err
	}

	viewCategories, err := s.viewCategoriesFromRows(rows)
	if err != nil {
		s.logger.Error("getViewCategory row scan error", mlog.Err(err))
		return nil, err
	}

	if len(viewCategories) == 0 {
		return nil, model.NewErrNotFound("view category ID=" + id)
	}

	return &viewCategories[0], nil
}

func (s *SQLStore) createViewCategory(db sq.BaseRunner, viewCategory model.ViewCategory) error {
	// A new view category should always end up at the top.
	// So we first insert the provided category, then bump up
	// existing user-board view categories' order

	// creating provided view category
	query := s.getQueryBuilder(db).
		Insert(s.tablePrefix+"view_categories").
		Columns(
			"id",
			"name",
			"user_id",
			"board_id",
			"create_at",
			"update_at",
			"delete_at",
			"collapsed",
			"sort_order",
			"type",
		).
		Values(
			viewCategory.ID,
			viewCategory.Name,
			viewCategory.UserID,
			viewCategory.BoardID,
			viewCategory.CreateAt,
			viewCategory.UpdateAt,
			viewCategory.DeleteAt,
			viewCategory.Collapsed,
			viewCategory.SortOrder,
			viewCategory.Type,
		)

	_, err := query.Exec()
	if err != nil {
		s.logger.Error("Error creating view category", mlog.String("view category name", viewCategory.Name), mlog.Err(err))
		return err
	}

	// bumping up order of existing view categories for this board (shared across users)
	updateQuery := s.getQueryBuilder(db).
		Update(s.tablePrefix+"view_categories").
		Set("sort_order", sq.Expr(fmt.Sprintf("sort_order + %d", viewCategorySortOrderGap))).
		Where(
			sq.Eq{
				"board_id":  viewCategory.BoardID,
				"delete_at": 0,
			},
		).
		Where(sq.NotEq{"id": viewCategory.ID})

	if _, err := updateQuery.Exec(); err != nil {
		s.logger.Error(
			"createViewCategory failed to update sort order of existing user-board view categories",
			mlog.String("user_id", viewCategory.UserID),
			mlog.String("board_id", viewCategory.BoardID),
			mlog.Err(err),
		)

		return err
	}

	return nil
}

func (s *SQLStore) updateViewCategory(db sq.BaseRunner, viewCategory model.ViewCategory) error {
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"view_categories").
		Set("name", viewCategory.Name).
		Set("update_at", viewCategory.UpdateAt).
		Set("collapsed", viewCategory.Collapsed).
		Where(sq.Eq{"id": viewCategory.ID})

	_, err := query.Exec()
	if err != nil {
		s.logger.Error("Error updating view category", mlog.String("view_category_id", viewCategory.ID), mlog.Err(err))
		return err
	}

	return nil
}

func (s *SQLStore) deleteViewCategory(db sq.BaseRunner, categoryID, userID, boardID string) error {
	query := s.getQueryBuilder(db).
		Update(s.tablePrefix+"view_categories").
		Set("delete_at", utils.GetMillis()).
		Where(sq.Eq{
			"id":       categoryID,
			"user_id":  userID,
			"board_id": boardID,
		})

	_, err := query.Exec()
	if err != nil {
		s.logger.Error("deleteViewCategory error", mlog.Err(err))
		return err
	}

	return nil
}

func (s *SQLStore) getBoardViewCategories(db sq.BaseRunner, boardID string) ([]model.ViewCategory, error) {
	query := s.getQueryBuilder(db).
		Select(s.viewCategoryFields()...).
		From(s.tablePrefix + "view_categories").
		Where(sq.Eq{
			"board_id":  boardID,
			"delete_at": 0,
		}).
		OrderBy("sort_order")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("getBoardViewCategories error fetching view categories", mlog.Err(err))
		return nil, err
	}

	return s.viewCategoriesFromRows(rows)
}

func (s *SQLStore) getUserViewCategories(db sq.BaseRunner, userID, boardID string) ([]model.ViewCategory, error) {
	// Get all board categories (shared across users)
	return s.getBoardViewCategories(db, boardID)
}

func (s *SQLStore) reorderViewCategories(db sq.BaseRunner, userID, boardID string, newCategoryOrder []string) ([]string, error) {
	existingCategories, err := s.getUserViewCategories(db, userID, boardID)
	if err != nil {
		return nil, err
	}

	if len(existingCategories) == 0 {
		return []string{}, nil
	}

	currentOrder := make([]string, len(existingCategories))
	for i, category := range existingCategories {
		currentOrder[i] = category.ID
	}

	if len(newCategoryOrder) != len(currentOrder) {
		return currentOrder, nil
	}

	orderMap := make(map[string]int)
	for i, categoryID := range newCategoryOrder {
		orderMap[categoryID] = i * viewCategorySortOrderGap
	}

	for _, category := range existingCategories {
		newOrder, exists := orderMap[category.ID]
		if !exists {
			continue
		}

		query := s.getQueryBuilder(db).
			Update(s.tablePrefix+"view_categories").
			Set("sort_order", newOrder).
			Where(sq.Eq{"id": category.ID})

		if _, err := query.Exec(); err != nil {
			s.logger.Error("reorderViewCategories failed to update view category order", mlog.String("view_category_id", category.ID), mlog.Err(err))
			return currentOrder, err
		}
	}

	return newCategoryOrder, nil
}

func (s *SQLStore) viewCategoriesFromRows(rows *sql.Rows) ([]model.ViewCategory, error) {
	defer rows.Close()

	categories := []model.ViewCategory{}

	for rows.Next() {
		var category model.ViewCategory

		err := rows.Scan(
			&category.ID,
			&category.Name,
			&category.UserID,
			&category.BoardID,
			&category.CreateAt,
			&category.UpdateAt,
			&category.DeleteAt,
			&category.Collapsed,
			&category.SortOrder,
			&category.Type,
		)
		if err != nil {
			return nil, err
		}

		categories = append(categories, category)
	}

	return categories, nil
}
