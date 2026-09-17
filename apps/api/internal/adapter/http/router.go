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
	notificationuc "image-storage/apps/api/internal/usecase/notification"
	sharefolderuc "image-storage/apps/api/internal/usecase/sharefolder"
	taguc "image-storage/apps/api/internal/usecase/tag"
)

type Services struct {
	Auth           *authuc.Service
	Folders        *folderuc.Service
	Images         *imageuc.Service
	Tags           *taguc.Service
	AutoTag        *autotaguc.Service
	Shares         *shareuc.Service
	ShareFolders   *sharefolderuc.Service
	Notifications  *notificationuc.Service
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
	folderH := &FolderHandler{Folders: svc.Folders, ShareFolders: svc.ShareFolders}
	imageH := &ImageHandler{
		Images: svc.Images, Folders: svc.Folders, AutoTag: svc.AutoTag,
		Users: svc.Auth.Users, EnableDevTools: svc.EnableDevTools,
	}
	tagH := &TagHandler{Tags: svc.Tags}
	autoTagH := &AutoTagHandler{AutoTag: svc.AutoTag}
	shareH := &ShareHandler{Shares: svc.Shares, Images: svc.Images}
	notificationH := &NotificationHandler{Notifications: svc.Notifications}
	shareFolderH := &ShareFolderHandler{
		ShareFolders: svc.ShareFolders, Images: svc.Images, Notifications: svc.Notifications,
	}

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
	r.Get("/api/share-folder/invites/{token}", shareFolderH.PreviewInvite)

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
		pr.Get("/api/folders/{id}/download", folderH.DownloadZip)
		pr.Get("/api/images", imageH.List)
		pr.Get("/api/images/timeline", imageH.Timeline)
		pr.Post("/api/images", imageH.Upload)
		pr.Get("/api/images/{id}", imageH.Get)
		pr.Get("/api/images/{id}/file", imageH.Download)
		pr.Get("/api/images/{id}/url", imageH.ImageURL)
		pr.Post("/api/images/{id}/copy", imageH.Copy)
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
		pr.Get("/api/notifications", notificationH.List)
		pr.Post("/api/notifications/read-all", notificationH.MarkAllRead)
		pr.Post("/api/notifications/{id}/read", notificationH.MarkRead)
		pr.Get("/api/autotag/status", autoTagH.Status)
		pr.Get("/api/shares", shareH.List)
		pr.Post("/api/shares", shareH.Create)
		pr.Delete("/api/shares/{id}", shareH.Delete)
		pr.Post("/api/folders/{id}/sharing", shareFolderH.EnableSharing)
		pr.Delete("/api/folders/{id}/sharing", shareFolderH.DisableSharing)
		pr.Get("/api/folders/{id}/members", shareFolderH.ListMembers)
		pr.Post("/api/folders/{id}/members", shareFolderH.InviteMember)
		pr.Delete("/api/folders/{id}/members/{userId}", shareFolderH.RemoveMember)
		pr.Post("/api/share-folder/invites/{token}/accept", shareFolderH.AcceptInvite)
		pr.Get("/api/share-folder/my-invites", shareFolderH.ListIncomingInvites)
		pr.Get("/api/share-folder/context", shareFolderH.ResolveContext)
		pr.Get("/api/share-folder/folders", shareFolderH.ListSharedFolders)
		pr.Get("/api/share-folder/folders/{rootId}/all", shareFolderH.ListFolderTree)
		pr.Get("/api/share-folder/folders/{rootId}/breadcrumb", shareFolderH.Breadcrumb)
		pr.Get("/api/share-folder/folders/{rootId}/browse", shareFolderH.Browse)
		pr.Post("/api/share-folder/folders/{rootId}/images", shareFolderH.UploadImage)
		pr.Post("/api/share-folder/folders/{rootId}/folders", shareFolderH.CreateSubfolder)
		pr.Post("/api/share-folder/images/{imageId}/copy", shareFolderH.CopyImage)
		pr.Delete("/api/share-folder/images/{imageId}", shareFolderH.DeleteImage)
		pr.Get("/api/share-folder/images/{imageId}/file", shareFolderH.ImageFile)
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
