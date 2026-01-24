# View Categories Feature

This document describes the view categories feature that allows users to organize views within boards into custom categories, similar to how boards are organized in the sidebar.

## Overview

View categories provide a way to group and organize different views (Board, Table, Gallery, Calendar) within a board. Users can:
- Create custom categories for views
- Move views between categories via drag-and-drop
- Reorder views within categories
- Collapse/expand categories
- Rename and delete categories

## Components

### Frontend Components

Located in `webapp/src/components/viewCategoryList/`:

1. **ViewCategoryList** (`viewCategoryList.tsx`)
   - Main container component that manages the view category panel
   - Displays all categories and their views
   - Handles drag-and-drop for both categories and views
   - Shows "Uncategorized" section for views not in any category
   - Provides "Add Category" button

2. **ViewCategoryItem** (`viewCategoryItem.tsx`)
   - Individual category component
   - Supports collapse/expand functionality
   - Provides context menu with rename and delete options
   - Inline editing for category names
   - Drag-and-drop support for reordering

3. **ViewItem** (`viewItem.tsx`)
   - Draggable view item within a category
   - Shows view icon based on type (Board, Table, Gallery, Calendar)
   - Highlights active view
   - Click to navigate to the view

4. **CreateViewCategoryDialog** (`createViewCategoryDialog.tsx`)
   - Modal dialog for creating new categories
   - Input validation
   - Keyboard shortcuts (Enter to create, Escape to cancel)

### Backend Components

Located in `server/`:

1. **Models** (`server/model/`)
   - `view_category.go` - ViewCategory data model
   - `view_category_views.go` - ViewCategoryViews junction table model

2. **API Endpoints** (`server/api/view_categories.go`)
   - `GET /api/v2/boards/{boardID}/view-categories` - Get all categories for a board
   - `POST /api/v2/boards/{boardID}/view-categories` - Create a new category
   - `PATCH /api/v2/boards/{boardID}/view-categories/{categoryID}` - Update category
   - `DELETE /api/v2/boards/{boardID}/view-categories/{categoryID}` - Delete category
   - `POST /api/v2/boards/{boardID}/view-categories/reorder` - Reorder categories
   - `POST /api/v2/boards/{boardID}/view-categories/{categoryID}/views/reorder` - Reorder views in category
   - `POST /api/v2/boards/{boardID}/views/{viewID}/move` - Move view to category
   - `POST /api/v2/boards/{boardID}/views/{viewID}/hide` - Hide view from categories
   - `POST /api/v2/boards/{boardID}/views/{viewID}/unhide` - Unhide view

3. **Business Logic** (`server/app/view_category.go`)
   - Category management operations
   - View-category association logic
   - Validation and authorization

4. **Database Layer** (`server/services/store/sqlstore/`)
   - `view_category.go` - CRUD operations for categories
   - `view_category_views.go` - Junction table operations
   - Migration #41 - Database schema creation

### Database Schema

**view_categories table:**
```sql
CREATE TABLE view_categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    board_id VARCHAR(36) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    collapsed BOOLEAN NOT NULL DEFAULT false,
    type VARCHAR(32) NOT NULL DEFAULT 'custom',
    create_at BIGINT NOT NULL,
    update_at BIGINT NOT NULL,
    delete_at BIGINT NOT NULL DEFAULT 0
);
```

**view_category_views table:**
```sql
CREATE TABLE view_category_views (
    category_id VARCHAR(36) NOT NULL,
    view_id VARCHAR(36) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    hidden BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (category_id, view_id),
    FOREIGN KEY (category_id) REFERENCES view_categories(id) ON DELETE CASCADE
);
```

## WebSocket Events

The feature supports real-time updates through WebSocket:

- `UPDATE_VIEW_CATEGORY` - Category created/updated/deleted
- `REORDER_VIEW_CATEGORIES` - Categories reordered
- `UPDATE_VIEW_CATEGORY_VIEW` - View added/removed from category
- `REORDER_VIEW_CATEGORY_VIEWS` - Views reordered within category

## User Interface

The view category panel appears to the right of the board sidebar when a board is open. It provides:

1. **Header Section**
   - "Views" title
   - Add category button (+)

2. **Category List**
   - Draggable categories
   - Each category shows:
     - Expand/collapse chevron
     - Category name (double-click to edit)
     - Options menu (rename, delete)
     - List of views when expanded

3. **View Items**
   - Draggable within and between categories
   - View type icon (Board/Table/Gallery/Calendar)
   - View name
   - Active state highlighting

4. **Uncategorized Section**
   - Shows views not in any category
   - Can drag views from here to categories

## Usage Examples

### Creating a Category
1. Click the "+" button in the Views panel header
2. Enter a category name
3. Click "Create" or press Enter

### Moving Views
1. Drag a view from one category to another
2. Or drag from the Uncategorized section to a category
3. The API automatically saves the new position

### Reordering
- Drag categories up/down to reorder them
- Drag views within a category to reorder them

### Managing Categories
- Double-click a category name to rename it
- Click the options menu (⋮) for more actions
- Delete removes the category (views move to Uncategorized)

## Technical Notes

### Drag and Drop
- Uses `react-beautiful-dnd` library
- Supports nested droppables (categories contain views)
- Two drag types: 'CATEGORY' and 'VIEW'

### State Management
- View categories loaded on demand when board is opened
- Local state for UI interactions
- WebSocket updates trigger re-fetch of categories

### API Integration
- All category operations use the OctoClient API methods
- Error handling with fallback to previous state
- Optimistic updates for better UX

### TypeScript Considerations
- Dialog component's `title` prop expects JSX.Element, not string
- Use `<FormattedMessage>` component instead of `intl.formatMessage()`
- ViewCategoryViews extends ViewCategory and includes `viewMetadata` array
- All API methods require `boardID` as first parameter

## Future Enhancements

Potential improvements:
1. Bulk operations (select multiple views)
2. Category templates
3. Keyboard shortcuts for navigation
4. Search/filter within categories
5. Category sharing between team members
6. Category-level permissions
7. Export/import category configurations
