package app

import (
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"
)

func (a *App) GetViewCategory(id string) (*model.ViewCategory, error) {
	return a.store.GetViewCategory(id)
}

func (a *App) CreateViewCategory(viewCategory *model.ViewCategory) (*model.ViewCategory, error) {
	if viewCategory.ID == "" {
		viewCategory.ID = utils.NewID(utils.IDTypeNone)
	}
	viewCategory.Hydrate()

	if err := viewCategory.IsValid(); err != nil {
		return nil, err
	}

	if viewCategory.CreateAt == 0 {
		viewCategory.CreateAt = utils.GetMillis()
	}

	if viewCategory.UpdateAt == 0 {
		viewCategory.UpdateAt = viewCategory.CreateAt
	}

	if err := a.store.CreateViewCategory(*viewCategory); err != nil {
		return nil, err
	}

	return viewCategory, nil
}

func (a *App) UpdateViewCategory(viewCategory *model.ViewCategory) (*model.ViewCategory, error) {
	viewCategory.Hydrate()

	if err := viewCategory.IsValid(); err != nil {
		return nil, err
	}

	viewCategory.UpdateAt = utils.GetMillis()

	if err := a.store.UpdateViewCategory(*viewCategory); err != nil {
		return nil, err
	}

	return viewCategory, nil
}

func (a *App) DeleteViewCategory(categoryID, userID, boardID string) (*model.ViewCategory, error) {
	existingCategory, err := a.store.GetViewCategory(categoryID)
	if err != nil {
		return nil, err
	}

	if err := a.store.DeleteViewCategory(categoryID, userID, boardID); err != nil {
		return nil, err
	}

	existingCategory.DeleteAt = utils.GetMillis()

	return existingCategory, nil
}

func (a *App) ReorderViewCategories(userID, boardID string, newCategoryOrder []string) ([]string, error) {
	return a.store.ReorderViewCategories(userID, boardID, newCategoryOrder)
}

func (a *App) GetUserViewCategoryViews(userID, boardID string) ([]model.ViewCategoryViews, error) {
	return a.store.GetUserViewCategoryViews(userID, boardID)
}

func (a *App) AddUpdateViewCategoryView(userID, categoryID string, viewIDs []string) error {
	return a.store.AddUpdateViewCategoryView(userID, categoryID, viewIDs)
}

func (a *App) ReorderViewCategoryViews(categoryID string, newViewsOrder []string) ([]string, error) {
	return a.store.ReorderViewCategoryViews(categoryID, newViewsOrder)
}

func (a *App) SetViewVisibility(userID, categoryID, viewID string, visible bool) error {
	return a.store.SetViewVisibility(userID, categoryID, viewID, visible)
}

// Broadcast functions for WebSocket support

func (a *App) BroadcastViewCategoryChange(teamID string, category *model.ViewCategory) {
	a.wsAdapter.BroadcastViewCategoryChange(teamID, category)
}

func (a *App) BroadcastViewCategoryReorder(teamID, userID, boardID string, categoryOrder []string) {
	a.wsAdapter.BroadcastViewCategoryReorder(teamID, userID, boardID, categoryOrder)
}

func (a *App) BroadcastViewCategoryViewUpdate(teamID, userID, categoryID, viewID string, hidden bool) {
	a.wsAdapter.BroadcastViewCategoryViewUpdate(teamID, userID, categoryID, viewID, hidden)
}

func (a *App) BroadcastViewCategoryViewsReorder(teamID, categoryID string, viewOrder []string) {
	a.wsAdapter.BroadcastViewCategoryViewsReorder(teamID, categoryID, viewOrder)
}
