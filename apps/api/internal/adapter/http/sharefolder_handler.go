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
	sharefolderuc "image-storage/apps/api/internal/usecase/sharefolder"
	notificationuc "image-storage/apps/api/internal/usecase/notification"
)

type ShareFolderHandler struct {
	ShareFolders    *sharefolderuc.Service
	Images          *imageuc.Service
	Notifications   *notificationuc.Service
}

func (h *ShareFolderHandler) EnableSharing(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	folderID := chi.URLParam(r, "id")
	f, err := h.ShareFolders.EnableSharing(userID, folderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.FolderFromDomain(f))
}

func (h *ShareFolderHandler) DisableSharing(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.ShareFolders.DisableSharing(userID, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShareFolderHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	folderID := chi.URLParam(r, "id")
	members, err := h.ShareFolders.ListMembers(userID, folderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	invites, err := h.ShareFolders.ListPendingInvites(userID, folderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"members": dto.FolderMembersFromDomain(members),
		"invites": dto.FolderInvitesFromDomain(invites, h.ShareFolders.InviteURL),
	})
}

func (h *ShareFolderHandler) InviteMember(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	folderID := chi.URLParam(r, "id")
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	inv, err := h.ShareFolders.InviteByEmail(userID, folderID, body.Email)
	if err != nil {
		WriteError(w, err)
		return
	}
	if h.Notifications != nil {
		_ = h.Notifications.EnsureShareInviteNotification(inv)
	}
	httpx.WriteJSON(w, http.StatusCreated, dto.FolderInviteFromDomain(inv, h.ShareFolders.InviteURL(inv.Token)))
}

func (h *ShareFolderHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	folderID := chi.URLParam(r, "id")
	memberID := chi.URLParam(r, "userId")
	if err := h.ShareFolders.RemoveMember(userID, folderID, memberID); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShareFolderHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	token := chi.URLParam(r, "token")
	previewInv, _, _ := h.ShareFolders.InvitePreview(token)
	entry, err := h.ShareFolders.AcceptInvite(userID, token)
	if err != nil {
		WriteError(w, err)
		return
	}
	if h.Notifications != nil && previewInv.ID != "" {
		_ = h.Notifications.MarkShareInviteRead(userID, previewInv.ID)
	}
	httpx.WriteJSON(w, http.StatusOK, dto.SharedFolderEntryFromDomain(entry))
}

func (h *ShareFolderHandler) PreviewInvite(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	inv, folder, err := h.ShareFolders.InvitePreview(token)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"invite": dto.FolderInviteFromDomain(inv, h.ShareFolders.InviteURL(inv.Token)),
		"folder": dto.FolderFromDomain(folder),
	})
}

func (h *ShareFolderHandler) ListSharedFolders(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	list, err := h.ShareFolders.ListSharedFolders(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.SharedFolderEntriesFromDomain(list))
}

func (h *ShareFolderHandler) ListIncomingInvites(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	list, err := h.ShareFolders.ListIncomingInvites(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	out := make([]dto.IncomingShareFolderInvite, len(list))
	for i, row := range list {
		out[i] = dto.IncomingShareFolderInvite{
			Invite:     dto.FolderInviteFromDomain(row.Invite, h.ShareFolders.InviteURL(row.Invite.Token)),
			Folder:     dto.FolderFromDomain(row.Folder),
			OwnerEmail: row.OwnerEmail,
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *ShareFolderHandler) ListFolderTree(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	rootID := chi.URLParam(r, "rootId")
	opts, err := h.ShareFolders.ListFolderTree(userID, rootID)
	if err != nil {
		WriteError(w, err)
		return
	}
	out := make([]dto.FolderOption, len(opts))
	for i, o := range opts {
		out[i] = dto.FolderOptionFromDomain(o)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *ShareFolderHandler) Breadcrumb(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	rootID := chi.URLParam(r, "rootId")
	folderID := r.URL.Query().Get("folderId")
	if folderID == "" {
		folderID = rootID
	}
	crumbs, err := h.ShareFolders.Breadcrumb(userID, rootID, folderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, dto.BreadcrumbsFromDomain(crumbs))
}

func (h *ShareFolderHandler) ResolveContext(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	folderID := r.URL.Query().Get("folderId")
	if folderID == "" {
		httpx.Error(w, http.StatusBadRequest, "folderId required")
		return
	}
	ctx, ok, err := h.ShareFolders.ResolveFolderContext(userID, folderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	if !ok {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"active": false})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"active":  true,
		"rootId":  ctx.RootID,
		"ownerId": ctx.OwnerID,
		"role":    ctx.Role,
	})
}

func (h *ShareFolderHandler) CopyImage(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	var body struct {
		FolderID string `json:"folderId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.FolderID == "" {
		httpx.Error(w, http.StatusBadRequest, "folderId required")
		return
	}
	img, err := h.ShareFolders.CopyImage(userID, chi.URLParam(r, "imageId"), body.FolderID)
	if err != nil {
		WriteError(w, err)
		return
	}
	out := dto.ImageFromDomain(img)
	dto.EnrichImageUploader(&out, h.ShareFolders.Users.FindByID)
	httpx.WriteJSON(w, http.StatusCreated, out)
}

func (h *ShareFolderHandler) Browse(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	rootID := chi.URLParam(r, "rootId")
	parentID := r.URL.Query().Get("parentId")
	var parent *string
	if parentID != "" {
		parent = &parentID
	}
	view, err := h.ShareFolders.Browse(userID, rootID, parent)
	if err != nil {
		WriteError(w, err)
		return
	}
	images := dto.ImagesFromDomain(view.Images)
	dto.EnrichImageUploaders(images, h.ShareFolders.Users.FindByID)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"rootId":  view.RootID,
		"ownerId": view.OwnerID,
		"folders": dto.FoldersFromDomain(view.Folders),
		"images":  images,
	})
}

func (h *ShareFolderHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	rootID := chi.URLParam(r, "rootId")
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
	folderID := r.FormValue("folderId")
	if folderID == "" {
		folderID = rootID
	}
	mime := header.Header.Get("Content-Type")
	img, err := h.ShareFolders.UploadImage(userID, rootID, folderID, header.Filename, mime, data)
	if err != nil {
		WriteError(w, err)
		return
	}
	out := dto.ImageFromDomain(img)
	dto.EnrichImageUploader(&out, h.ShareFolders.Users.FindByID)
	httpx.WriteJSON(w, http.StatusCreated, out)
}

func (h *ShareFolderHandler) CreateSubfolder(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	rootID := chi.URLParam(r, "rootId")
	var body struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	parentID := body.ParentID
	if parentID == "" {
		parentID = rootID
	}
	f, err := h.ShareFolders.CreateSubfolder(userID, rootID, parentID, body.Name)
	if err != nil {
		WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, dto.FolderFromDomain(f))
}

func (h *ShareFolderHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.ShareFolders.DeleteImage(userID, chi.URLParam(r, "imageId")); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShareFolderHandler) ImageFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	meta, err := h.ShareFolders.AccessImageFile(userID, chi.URLParam(r, "imageId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	h.serveShareFile(w, meta)
}

func (h *ShareFolderHandler) serveShareFile(w http.ResponseWriter, meta domain.ImageFile) {
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
