package httpadapter

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"image-storage/apps/api/internal/adapter/auth/jwtauth"
	"image-storage/apps/api/internal/health"
	"image-storage/apps/api/internal/httpx"
	authuc "image-storage/apps/api/internal/usecase/auth"
	autotaguc "image-storage/apps/api/internal/usecase/autotag"
	folderuc "image-storage/apps/api/internal/usecase/folder"
	imageuc "image-storage/apps/api/internal/usecase/image"
	shareuc "image-storage/apps/api/internal/usecase/share"
	taguc "image-storage/apps/api/internal/usecase/tag"
)

type Services struct {
	Auth           *authuc.Service
	Folders        *folderuc.Service
	Images         *imageuc.Service
	Tags           *taguc.Service
	AutoTag        *autotaguc.Service
	Shares         *shareuc.Service
	JWT            *jwtauth.Service
	EnableDevTools bool
}

func NewRouter(svc Services) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(recoverJSON)
	r.Use(requestLogger)
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, http.StatusNotFound, "not found")
	})

	authH := &AuthHandler{Auth: svc.Auth}
	folderH := &FolderHandler{Folders: svc.Folders}
	imageH := &ImageHandler{
		Images: svc.Images, Folders: svc.Folders, AutoTag: svc.AutoTag, EnableDevTools: svc.EnableDevTools,
	}
	tagH := &TagHandler{Tags: svc.Tags}
	autoTagH := &AutoTagHandler{AutoTag: svc.AutoTag}
	shareH := &ShareHandler{Shares: svc.Shares, Images: svc.Images}

	r.Get("/api/health", health.Handler().ServeHTTP)
	r.Post("/api/auth/register", authH.Register)
	r.Post("/api/auth/login", authH.Login)
	r.Post("/api/auth/forgot-password", authH.ForgotPassword)
	r.Post("/api/auth/reset-password", authH.ResetPassword)
	r.Get("/api/public/images/{id}/file", shareH.PublicImage)
	r.Get("/api/public/images/{id}/url", shareH.PublicImageURL)
	r.Get("/api/share/{token}", shareH.ViewByToken)
	r.Get("/api/share/{token}/images/{imageId}/file", shareH.ShareImageFile)
	r.Get("/api/share/{token}/images/{imageId}/url", shareH.ShareImageURL)

	r.Group(func(pr chi.Router) {
		pr.Use(svc.JWT.Middleware)
		pr.Get("/api/auth/me", authH.Me)
		pr.Patch("/api/auth/me", authH.UpdateProfile)
		pr.Patch("/api/auth/me/auto-tag", authH.UpdateAutoTagEnabled)
		pr.Post("/api/auth/change-password", authH.ChangePassword)
		pr.Delete("/api/auth/me", authH.DeleteAccount)
		pr.Get("/api/folders", folderH.List)
		pr.Get("/api/folders/all", folderH.ListAll)
		pr.Post("/api/folders", folderH.Create)
		pr.Get("/api/folders/breadcrumb", folderH.Breadcrumb)
		pr.Patch("/api/folders/{id}", folderH.Update)
		pr.Delete("/api/folders/{id}", folderH.Delete)
		pr.Get("/api/images", imageH.List)
		pr.Get("/api/images/timeline", imageH.Timeline)
		pr.Post("/api/images", imageH.Upload)
		pr.Get("/api/images/{id}", imageH.Get)
		pr.Get("/api/images/{id}/file", imageH.Download)
		pr.Get("/api/images/{id}/url", imageH.ImageURL)
		pr.Patch("/api/images/{id}", imageH.Update)
		pr.Delete("/api/images/{id}", imageH.Delete)
		pr.Post("/api/images/{id}/restore", imageH.Restore)
		pr.Delete("/api/images/{id}/permanent", imageH.DeletePermanent)
		pr.Delete("/api/trash", imageH.EmptyTrash)
		if svc.EnableDevTools {
			pr.Delete("/api/dev/images", imageH.DeleteAllPermanent)
		}
		pr.Put("/api/images/{id}/tags", tagH.SetImageTags)
		pr.Get("/api/tags", tagH.List)
		pr.Get("/api/autotag/status", autoTagH.Status)
		pr.Get("/api/shares", shareH.List)
		pr.Post("/api/shares", shareH.Create)
		pr.Delete("/api/shares/{id}", shareH.Delete)
	})
	return r
}

func NewHealthOnly() http.Handler {
	return NewRouter(Services{JWT: jwtauth.New("test")})
}

func recoverJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				httpx.Error(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		start := time.Now()
		next.ServeHTTP(ww, r)
		log.Printf("%s %s %d %s req_id=%s",
			r.Method, r.URL.Path, ww.Status(), time.Since(start), middleware.GetReqID(r.Context()))
	})
}
