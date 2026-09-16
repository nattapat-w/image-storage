package httpadapter

import (
	"errors"
	"net/http"

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
		httpx.Error(w, http.StatusBadRequest, "invalid request")
	case errors.Is(err, domain.ErrUnauthorized):
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
	default:
		httpx.Error(w, http.StatusInternalServerError, "internal server error")
	}
}
