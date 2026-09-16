package httpadapter

import (
	"net/http"
	"strings"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/httpx"
	autotaguc "image-storage/apps/api/internal/usecase/autotag"
)

type AutoTagHandler struct {
	AutoTag *autotaguc.Service
}

func (h *AutoTagHandler) Status(w http.ResponseWriter, r *http.Request) {
	if h.AutoTag == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"jobs": []any{}})
		return
	}
	userID, _ := jwtauth.UserIDFromContext(r.Context())
	var ids []string
	if raw := strings.TrimSpace(r.URL.Query().Get("ids")); raw != "" {
		for _, part := range strings.Split(raw, ",") {
			if id := strings.TrimSpace(part); id != "" {
				ids = append(ids, id)
			}
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"jobs": h.AutoTag.ListStatus(userID, ids),
	})
}
