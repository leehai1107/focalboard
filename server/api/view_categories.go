package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
)

func (a *API) registerViewCategoriesRoutes(r *mux.Router) {
	// ViewCategory APIs
	r.HandleFunc("/boards/{boardID}/view-categories", a.sessionRequired(a.handleCreateViewCategory)).Methods(http.MethodPost)
	r.HandleFunc("/boards/{boardID}/view-categories/reorder", a.sessionRequired(a.handleReorderViewCategories)).Methods(http.MethodPut)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}", a.sessionRequired(a.handleUpdateViewCategory)).Methods(http.MethodPut)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}", a.sessionRequired(a.handleDeleteViewCategory)).Methods(http.MethodDelete)
	r.HandleFunc("/boards/{boardID}/view-categories", a.sessionRequired(a.handleGetUserViewCategoryViews)).Methods(http.MethodGet)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}/views/reorder", a.sessionRequired(a.handleReorderViewCategoryViews)).Methods(http.MethodPut)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}/views/{viewID}", a.sessionRequired(a.handleUpdateViewCategoryView)).Methods(http.MethodPost)
	r.HandleFunc("/boards/{boardID}/views/{viewID}/uncategorize", a.sessionRequired(a.handleUncategorizeView)).Methods(http.MethodPost)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}/views/{viewID}/hide", a.sessionRequired(a.handleHideView)).Methods(http.MethodPut)
	r.HandleFunc("/boards/{boardID}/view-categories/{categoryID}/views/{viewID}/unhide", a.sessionRequired(a.handleUnhideView)).Methods(http.MethodPut)
}

func (a *API) handleCreateViewCategory(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/view-categories createViewCategory
	//
	// Create a category for views
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: view category to create
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/ViewCategory"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/ViewCategory"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var viewCategory model.ViewCategory

	err = json.Unmarshal(requestBody, &viewCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "createViewCategory", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	// Set the userID from the session (ignore what's in the request)
	viewCategory.UserID = session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]

	if viewCategory.BoardID != boardID {
		a.errorResponse(w, r, model.NewErrBadRequest("boardID mismatch"))
		return
	}

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	createdViewCategory, err := a.app.CreateViewCategory(&viewCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryChange(board.TeamID, createdViewCategory)

	data, err := json.Marshal(createdViewCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.AddMeta("viewCategoryID", createdViewCategory.ID)
	auditRec.Success()
}

func (a *API) handleUpdateViewCategory(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/view-categories/{categoryID} updateViewCategory
	//
	// Update a view category
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: view category to update
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/ViewCategory"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/ViewCategory"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var viewCategory model.ViewCategory

	err = json.Unmarshal(requestBody, &viewCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "updateViewCategory", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]

	if viewCategory.BoardID != boardID {
		a.errorResponse(w, r, model.NewErrBadRequest("boardID mismatch"))
		return
	}

	if viewCategory.ID != categoryID {
		a.errorResponse(w, r, model.NewErrBadRequest("categoryID mismatch"))
		return
	}

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	updatedCategory, err := a.app.UpdateViewCategory(&viewCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryChange(board.TeamID, updatedCategory)

	data, err := json.Marshal(updatedCategory)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.AddMeta("viewCategoryID", updatedCategory.ID)
	auditRec.Success()
}

func (a *API) handleDeleteViewCategory(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /boards/{boardID}/view-categories/{categoryID} deleteViewCategory
	//
	// Delete a view category
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]

	auditRec := a.makeAuditRecord(r, "deleteViewCategory", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("categoryID", categoryID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	deletedCategory, err := a.app.DeleteViewCategory(categoryID, session.UserID, boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryChange(board.TeamID, deletedCategory)

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleGetUserViewCategoryViews(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /boards/{boardID}/view-categories getUserViewCategoryViews
	//
	// Gets view categories for a user in the board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/ViewCategoryViews"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]

	auditRec := a.makeAuditRecord(r, "getUserViewCategoryViews", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	userViewCategoryViews, err := a.app.GetUserViewCategoryViews(userID, boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(userViewCategoryViews)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleReorderViewCategories(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/view-categories/reorder reorderViewCategories
	//
	// Reorder view categories
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: view category IDs in new order
	//   required: true
	//   schema:
	//     type: array
	//     items:
	//       type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         type: string
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var newCategoryOrder []string

	err = json.Unmarshal(requestBody, &newCategoryOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]

	auditRec := a.makeAuditRecord(r, "reorderViewCategories", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	newOrder, err := a.app.ReorderViewCategories(userID, boardID, newCategoryOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category reorder
	a.app.BroadcastViewCategoryReorder(board.TeamID, userID, boardID, newOrder)

	data, err := json.Marshal(newOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleReorderViewCategoryViews(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/view-categories/{categoryID}/views/reorder reorderViewCategoryViews
	//
	// Reorder views within a category
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: view IDs in new order
	//   required: true
	//   schema:
	//     type: array
	//     items:
	//       type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         type: string
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var newViewsOrder []string

	err = json.Unmarshal(requestBody, &newViewsOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]

	auditRec := a.makeAuditRecord(r, "reorderViewCategoryViews", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("categoryID", categoryID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	newOrder, err := a.app.ReorderViewCategoryViews(categoryID, newViewsOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category views reorder
	a.app.BroadcastViewCategoryViewsReorder(board.TeamID, categoryID, newOrder)

	data, err := json.Marshal(newOrder)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleUpdateViewCategoryView(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/view-categories/{categoryID}/views/{viewID} updateViewCategoryView
	//
	// Move a view to a different category
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// - name: viewID
	//   in: path
	//   description: View ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]
	viewID := vars["viewID"]

	auditRec := a.makeAuditRecord(r, "updateViewCategoryView", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("categoryID", categoryID)
	auditRec.AddMeta("viewID", viewID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	err = a.app.AddUpdateViewCategoryView(userID, categoryID, []string{viewID})
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryViewUpdate(board.TeamID, userID, categoryID, viewID, false)

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleHideView(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/view-categories/{categoryID}/views/{viewID}/hide hideView
	//
	// Hide a view
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// - name: viewID
	//   in: path
	//   description: View ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]
	viewID := vars["viewID"]

	auditRec := a.makeAuditRecord(r, "hideView", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("categoryID", categoryID)
	auditRec.AddMeta("viewID", viewID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	err = a.app.SetViewVisibility(userID, categoryID, viewID, false)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryViewUpdate(board.TeamID, userID, categoryID, viewID, true)

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleUnhideView(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/view-categories/{categoryID}/views/{viewID}/unhide unhideView
	//
	// Unhide a view
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: categoryID
	//   in: path
	//   description: Category ID
	//   required: true
	//   type: string
	// - name: viewID
	//   in: path
	//   description: View ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	categoryID := vars["categoryID"]
	viewID := vars["viewID"]

	auditRec := a.makeAuditRecord(r, "unhideView", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("categoryID", categoryID)
	auditRec.AddMeta("viewID", viewID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	existingCategory, err := a.app.GetViewCategory(categoryID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if existingCategory.UserID != session.UserID {
		a.errorResponse(w, r, model.NewErrPermission("access denied to view category"))
		return
	}

	err = a.app.SetViewVisibility(userID, categoryID, viewID, true)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// send websocket message about view category change
	a.app.BroadcastViewCategoryViewUpdate(board.TeamID, userID, categoryID, viewID, false)

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleUncategorizeView(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/views/{viewID}/uncategorize uncategorizeView
	//
	// Remove a view from its category (move to uncategorized)
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: viewID
	//   in: path
	//   description: View ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	viewID := vars["viewID"]

	auditRec := a.makeAuditRecord(r, "uncategorizeView", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("viewID", viewID)

	_, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(session.UserID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	// Move to uncategorized by setting category_id to empty string
	err = a.app.AddUpdateViewCategoryView(userID, "", []string{viewID})
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}
