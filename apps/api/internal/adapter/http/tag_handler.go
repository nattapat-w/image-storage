package httpadapter

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/adapter/http/dto"
	"image-storage/apps/api/internal/httpx"
	taguc "image-storage/apps/api/internal/usecase/tag"
)

type TagHandler struct {
	Tags *taguc.Service
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	out, err := h.Tags.List(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.TagsFromDomain(out))
}

func (h *TagHandler) SetImageTags(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	imageID := chi.URLParam(r, "id")
	var body struct {
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	img, err := h.Tags.SetImageTags(userID, imageID, body.Tags)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.ImageFromDomain(img))
}
