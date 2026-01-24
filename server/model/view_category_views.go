package model

import (
	"encoding/json"
	"io"
)

// ViewCategoryViews represents a view category with its associated views' metadata
// swagger:model
type ViewCategoryViews struct {
	ViewCategory

	// Contains the list of view ids and their metadata
	// required: true
	ViewMetadata []ViewCategoryViewMetadata `json:"viewMetadata"`
}

// ViewCategoryViewMetadata contains metadata about a view in a category
type ViewCategoryViewMetadata struct {
	ViewID string `json:"viewID"`
	Hidden bool   `json:"hidden"`
}

// ViewCategoryViewsReorderData is used to reorder views in a category
type ViewCategoryViewsReorderData struct {
	CategoryID   string                       `json:"categoryID"`
	ViewsMetadata []ViewCategoryViewMetadata `json:"viewsMetadata"`
}

func ViewCategoryViewsFromJSON(data io.Reader) ([]*ViewCategoryViews, error) {
	var viewCategoryViews []*ViewCategoryViews

	if err := json.NewDecoder(data).Decode(&viewCategoryViews); err != nil {
		return nil, err
	}

	for _, vcv := range viewCategoryViews {
		vcv.Hydrate()
		if err := vcv.IsValid(); err != nil {
			return nil, err
		}
	}

	return viewCategoryViews, nil
}
