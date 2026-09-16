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
	folderuc "image-storage/apps/api/internal/usecase/folder"
	imageuc "image-storage/apps/api/internal/usecase/image"
)

type ImageHandler struct {
	Images         *imageuc.Service
	Folders        *folderuc.Service
	EnableDevTools bool
}

func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	filter := domain.ImageListFilter{
		UserID:   userID,
		FolderID: r.URL.Query().Get("folderId"),
		Trash:    r.URL.Query().Get("trash") == "1",
		Favorite: r.URL.Query().Get("favorite") == "1",
		Tag:      r.URL.Query().Get("tag"),
		Sort:     r.URL.Query().Get("sort"),
	}
	out, err := h.Images.List(filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.ImagesFromDomain(out))
}

func (h *ImageHandler) Timeline(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	groups, err := h.Images.Timeline(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.TimelineFromDomain(groups))
}

func (h *ImageHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid multipart form")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "read file failed")
		return
	}
	mime := header.Header.Get("Content-Type")
	img, err := h.Images.Upload(userID, r.FormValue("folderId"), header.Filename, mime, data)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, dto.ImageFromDomain(img))
}

func (h *ImageHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	img, err := h.Images.Get(userID, chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.ImageFromDomain(img))
}

func (h *ImageHandler) Download(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	meta, err := h.Images.AccessFile(chi.URLParam(r, "id"), userID, true)
	if err != nil {
		WriteError(w, err)
		return
	}
	h.serveFile(w, r, meta)
}

func (h *ImageHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	var body struct {
		Name       *string `json:"name"`
		FolderID   *string `json:"folderId"`
		Visibility *string `json:"visibility"`
		Favorite   *bool   `json:"favorite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	img, err := h.Images.Update(userID, chi.URLParam(r, "id"), domain.ImageUpdate{
		Name:       body.Name,
		FolderID:   body.FolderID,
		Visibility: body.Visibility,
		Favorite:   body.Favorite,
	})
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.ImageFromDomain(img))
}

func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.Images.SoftDelete(userID, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ImageHandler) Restore(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	img, err := h.Images.Restore(userID, chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.ImageFromDomain(img))
}

func (h *ImageHandler) DeletePermanent(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.Images.DeletePermanent(userID, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ImageHandler) DeleteAllPermanent(w http.ResponseWriter, r *http.Request) {
	if !h.EnableDevTools {
		httpx.Error(w, http.StatusNotFound, "not found")
		return
	}
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	count, err := h.Images.DeleteAllPermanent(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	folderCount := 0
	if h.Folders != nil {
		folderCount, err = h.Folders.PurgeAll(userID)
		if err != nil {
			WriteError(w, err)
			return
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]int{"deleted": count, "foldersDeleted": folderCount})
}

func (h *ImageHandler) serveFile(w http.ResponseWriter, r *http.Request, meta domain.ImageFile) {
	obj, err := h.Images.OpenFile(meta)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "file missing")
		return
	}
	defer obj.Body.Close()
	w.Header().Set("Content-Type", meta.MimeType)
	if obj.Size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(obj.Size, 10))
	}
	w.Header().Set("Content-Disposition", "inline; filename=\""+meta.Name+"\"")
	_, _ = io.Copy(w, obj.Body)
}
