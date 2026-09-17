package httpadapter

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/adapter/http/dto"
	"image-storage/apps/api/internal/httpx"
	notificationuc "image-storage/apps/api/internal/usecase/notification"
)

type NotificationHandler struct {
	Notifications *notificationuc.Service
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	list, err := h.Notifications.List(userID)
	if err != nil {
		WriteError(w, err)
		return
	}
	out := make([]dto.Notification, len(list))
	for i, n := range list {
		out[i] = dto.NotificationFromDomain(n)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.Notifications.MarkRead(userID, id); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	if err := h.Notifications.MarkAllRead(userID); err != nil {
		WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
