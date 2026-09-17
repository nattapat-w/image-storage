package httpadapter

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/adapter/http/dto"
	"image-storage/apps/api/internal/httpx"
	folderuc "image-storage/apps/api/internal/usecase/folder"
	sharefolderuc "image-storage/apps/api/internal/usecase/sharefolder"
)

type FolderHandler struct {
	Folders      *folderuc.Service
	ShareFolders *sharefolderuc.Service
}

func (h *FolderHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	parentID := r.URL.Query().Get("parentId")
	var parent *string
	if parentID != "" {
		parent = &parentID
	}
	out, err := h.Folders.List(userID, parent)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.FoldersFromDomain(out))
}

func (h *FolderHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	var body struct {
		Name     string  `json:"name"`
		ParentID *string `json:"parentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	f, err := h.Folders.Create(userID, body.Name, body.ParentID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, dto.FolderFromDomain(f))
}

func (h *FolderHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var fields map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	var name *string
	if raw, ok := fields["name"]; ok {
		if err := json.Unmarshal(raw, &name); err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid name")
			return
		}
	}
	var parentID *string
	updateParent := false
	if raw, ok := fields["parentId"]; ok {
		updateParent = true
		if string(raw) != "null" {
			if err := json.Unmarshal(raw, &parentID); err != nil {
				httpx.Error(w, http.StatusBadRequest, "invalid parentId")
				return
			}
		}
	}
	f, err := h.Folders.Update(userID, id, name, parentID, updateParent)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.FolderFromDomain(f))
}

func (h *FolderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.Folders.Delete(userID, id); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FolderHandler) Breadcrumb(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	crumbs, err := h.Folders.Breadcrumb(userID, r.URL.Query().Get("folderId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.BreadcrumbsFromDomain(crumbs))
}

func (h *FolderHandler) DownloadZip(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if h.ShareFolders == nil {
		httpx.Error(w, http.StatusNotImplemented, "share folders unavailable")
		return
	}
	if err := h.ShareFolders.StreamFolderZip(w, userID, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
}

func (h *FolderHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	out, err := h.Folders.ListAll(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	opts := make([]dto.FolderOption, len(out))
	for i, o := range out {
		opts[i] = dto.FolderOptionFromDomain(o)
	}
	httpx.WriteJSON(w, http.StatusOK, opts)
}
