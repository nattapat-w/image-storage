package dto

import "image-storage/apps/api/internal/domain"

type Notification struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Href      string `json:"href"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"createdAt"`
}

func NotificationFromDomain(n domain.Notification) Notification {
	return Notification{
		ID:        n.ID,
		Type:      n.Type,
		Title:     n.Title,
		Body:      n.Body,
		Href:      n.Href,
		Read:      n.ReadAt != nil,
		CreatedAt: n.CreatedAt,
	}
}
