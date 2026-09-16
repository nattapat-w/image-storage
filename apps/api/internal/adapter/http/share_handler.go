package httpadapter

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/adapter/http/dto"
	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/httpx"
	imageuc "image-storage/apps/api/internal/usecase/image"
	shareuc "image-storage/apps/api/internal/usecase/share"
)

type ShareHandler struct {
	Shares *shareuc.Service
	Images *imageuc.Service
}

func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	var body struct {
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	share, err := h.Shares.Create(userID, body.ResourceType, body.ResourceID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, dto.ShareFromDomain(share))
}

func (h *ShareHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	out, err := h.Shares.List(userID, r.URL.Query().Get("resourceType"), r.URL.Query().Get("resourceId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.SharesFromDomain(out))
}

func (h *ShareHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.Shares.Delete(userID, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShareHandler) ViewByToken(w http.ResponseWriter, r *http.Request) {
	view, err := h.Shares.ViewByToken(chi.URLParam(r, "token"))
	if err != nil {
		WriteError(w, err)
		return
	}
	switch view.Type {
	case domain.ResourceImage:
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"type": "image", "image": dto.ImageFromDomain(*view.Image),
		})
	case domain.ResourceFolder:
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"type": "folder",
			"folders": dto.FoldersFromDomain(view.Folders),
			"images":  dto.ImagesFromDomain(view.Images),
		})
	default:
		httpx.Error(w, http.StatusNotFound, "not found")
	}
}

func (h *ShareHandler) ShareImageFile(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	imageID := chi.URLParam(r, "imageId")
	if err := h.Shares.CanAccessShareImage(token, imageID); err != nil {
		WriteError(w, err)
		return
	}
	meta, err := h.Images.FileMeta(imageID)
	if err != nil {
		WriteError(w, err)
		return
	}
	h.serveShareFile(w, r, meta)
}

func (h *ShareHandler) PublicImage(w http.ResponseWriter, r *http.Request) {
	meta, err := h.Shares.PublicImageFile(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, err)
		return
	}
	h.serveShareFile(w, r, meta)
}

func (h *ShareHandler) serveShareFile(w http.ResponseWriter, r *http.Request, meta domain.ImageFile) {
	obj, err := h.Shares.OpenFile(meta)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "file missing")
		return
	}
	defer obj.Body.Close()
	w.Header().Set("Content-Type", meta.MimeType)
	w.Header().Set("Content-Disposition", `inline; filename="`+meta.Name+`"`)
	if obj.Size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(obj.Size, 10))
	}
	_, _ = io.Copy(w, obj.Body)
}
