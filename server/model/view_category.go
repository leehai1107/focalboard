package model

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const (
	ViewCategoryTypeSystem = "system"
	ViewCategoryTypeCustom = "custom"
)

// ViewCategory is a view category
// swagger:model
type ViewCategory struct {
	// The id for this view category
	// required: true
	ID string `json:"id"`

	// The name for this view category
	// required: true
	Name string `json:"name"`

	// The user's id for this view category
	// required: true
	UserID string `json:"userID"`

	// The board id for this view category
	// required: true
	BoardID string `json:"boardID"`

	// The creation time in miliseconds since the current epoch
	// required: true
	CreateAt int64 `json:"createAt"`

	// The last modified time in miliseconds since the current epoch
	// required: true
	UpdateAt int64 `json:"updateAt"`

	// The deleted time in miliseconds since the current epoch. Set to indicate this category is deleted
	// required: false
	DeleteAt int64 `json:"deleteAt"`

	// ViewCategory's state in client side
	// required: true
	Collapsed bool `json:"collapsed"`

	// Inter-category sort order per user per board
	// required: true
	SortOrder int `json:"sortOrder"`

	// ViewCategory's type
	// required: true
	Type string `json:"type"`
}

func (c *ViewCategory) Hydrate() {
	c.ID = strings.TrimSpace(c.ID)
	c.Name = strings.TrimSpace(c.Name)
}

func (c *ViewCategory) IsValid() error {
	if c.ID == "" {
		return NewErrInvalidViewCategory("view category id is required")
	}

	if c.Name == "" {
		return NewErrInvalidViewCategory("view category name is required")
	}

	if c.UserID == "" {
		return NewErrInvalidViewCategory("view category user id is required")
	}

	if c.BoardID == "" {
		return NewErrInvalidViewCategory("view category board id is required")
	}

	if c.Type != ViewCategoryTypeSystem && c.Type != ViewCategoryTypeCustom {
		return NewErrInvalidViewCategory("invalid view category type")
	}

	return nil
}

func ViewCategoryFromJSON(data io.Reader) (*ViewCategory, error) {
	var viewCategory ViewCategory

	if err := json.NewDecoder(data).Decode(&viewCategory); err != nil {
		return nil, err
	}

	viewCategory.Hydrate()

	return &viewCategory, viewCategory.IsValid()
}

func NewErrInvalidViewCategory(msg string) error {
	return fmt.Errorf("invalid view category: %s", msg)
}
