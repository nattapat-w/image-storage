package httpadapter

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"image-storage/apps/api/internal/domain"
	"image-storage/apps/api/internal/httpx"
)

func WriteError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, domain.ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, domain.ErrConflict):
		httpx.Error(w, http.StatusConflict, "email already registered")
	case errors.Is(err, domain.ErrInvalidInput):
		msg := "invalid request"
		var inputErr *domain.InputError
		if errors.As(err, &inputErr) && inputErr.Message != "" {
			msg = inputErr.Message
		}
		httpx.Error(w, http.StatusBadRequest, msg)
	case errors.Is(err, domain.ErrUnauthorized):
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
	default:
		msg := uploadErrorMessage(err)
		if msg == "" {
			log.Printf("api error: %v", err)
			msg = "internal server error"
		}
		httpx.Error(w, http.StatusInternalServerError, msg)
	}
}

func uploadErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	switch {
	case strings.HasPrefix(msg, "save file:"):
		return "failed to save file to storage — check Supabase/S3 bucket access"
	case strings.HasPrefix(msg, "save metadata:"):
		return "failed to save image metadata to the database"
	default:
		return ""
	}
}
