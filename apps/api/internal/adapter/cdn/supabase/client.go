package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	appconfig "image-storage/apps/api/internal/config"
)

type Client struct {
	baseURL        string
	serviceRoleKey string
	bucket         string
	publicBucket   bool
	httpClient     *http.Client
}

func New(cfg appconfig.SupabaseConfig) *Client {
	return &Client{
		baseURL:        strings.TrimRight(cfg.URL, "/"),
		serviceRoleKey: cfg.ServiceRoleKey,
		bucket:         cfg.Bucket,
		publicBucket:   cfg.PublicBucket,
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.baseURL != "" && c.serviceRoleKey != "" && c.bucket != ""
}

func (c *Client) UsePublicObjectURL() bool {
	return c != nil && c.publicBucket
}

func (c *Client) SignedURL(objectKey string, expiresIn int) (string, error) {
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s",
		c.baseURL, url.PathEscape(c.bucket), escapeObjectKey(objectKey))

	body := map[string]any{"expiresIn": expiresIn}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("supabase sign object: %s", strings.TrimSpace(string(raw)))
	}

	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	if out.SignedURL == "" {
		return "", fmt.Errorf("supabase sign object: empty signedURL")
	}
	return absoluteStorageURL(c.baseURL, out.SignedURL), nil
}

func (c *Client) PublicObjectURL(objectKey string) (string, error) {
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s",
		c.baseURL, url.PathEscape(c.bucket), escapeObjectKey(objectKey)), nil
}

func absoluteStorageURL(baseURL, signedURL string) string {
	if strings.HasPrefix(signedURL, "http://") || strings.HasPrefix(signedURL, "https://") {
		return signedURL
	}
	base := strings.TrimRight(baseURL, "/")
	if strings.HasPrefix(signedURL, "/storage/v1/") {
		return base + signedURL
	}
	if strings.HasPrefix(signedURL, "/") {
		return base + "/storage/v1" + signedURL
	}
	return base + "/storage/v1/" + signedURL
}

func escapeObjectKey(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
