package health

import (
	"encoding/json"
	"net/http"
	"time"
)

func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"service": "api",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})
}
