package ollama

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode"

	appconfig "image-storage/apps/api/internal/config"
)

// Moondream returns empty output for strict "comma-separated tags" prompts.
// Ask for a brief description and derive tags from the response.
const defaultTagPrompt = "Describe this image."

var fallbackTagPrompts = []string{
	"What do you see in this image?",
}

const maxTagLen = 15
const maxTags = 10

type Client struct {
	baseURL    string
	model      string
	httpClient *http.Client
}

func New(cfg appconfig.ClassifierConfig) *Client {
	baseURL := strings.TrimRight(cfg.OllamaURL, "/")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:11435"
	}
	model := cfg.OllamaModel
	if model == "" {
		model = "phototagger"
	}
	return &Client{
		baseURL: baseURL,
		model:   model,
		httpClient: &http.Client{
			Timeout: 3 * time.Minute,
		},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && strings.TrimSpace(c.baseURL) != "" && strings.TrimSpace(c.model) != ""
}

func (c *Client) SuggestTags(imageData []byte) ([]string, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("ollama classifier disabled")
	}
	if len(imageData) == 0 {
		return nil, fmt.Errorf("empty image")
	}

	visionData, err := prepareImageForVision(imageData)
	if err != nil {
		return nil, err
	}

	imageB64 := base64.StdEncoding.EncodeToString(visionData)
	prompts := append([]string{defaultTagPrompt}, fallbackTagPrompts...)
	var lastRaw string
	for i, prompt := range prompts {
		raw, err := c.chatOnce(prompt, imageB64)
		if err != nil {
			return nil, err
		}
		lastRaw = raw
		tags := parseTags(raw)
		if len(tags) > 0 {
			return tags, nil
		}
		if raw != "" {
			log.Printf("ollama: could not parse tags from response %q", raw)
		}
		if i < len(prompts)-1 {
			log.Printf("ollama: empty or unparseable response, retrying with fallback prompt")
		}
	}
	return nil, fmt.Errorf("model returned no usable tags (raw=%q)", lastRaw)
}

func (c *Client) chatOnce(prompt, imageB64 string) (string, error) {
	payload := chatRequest{
		Model:  c.model,
		Stream: false,
		Messages: []chatMessage{
			{
				Role:    "user",
				Content: prompt,
				Images:  []string{imageB64},
			},
		},
		Options: &chatOptions{
			NumPredict:  128,
			Temperature: 0.2,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var out chatResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Message.Content), nil
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
	Options  *chatOptions  `json:"options,omitempty"`
}

type chatOptions struct {
	NumPredict  int     `json:"num_predict,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
}

type chatMessage struct {
	Role    string   `json:"role"`
	Content string   `json:"content"`
	Images  []string `json:"images,omitempty"`
}

type chatResponse struct {
	Message chatMessage `json:"message"`
}

var tagStopWords = map[string]bool{
	"a": true, "an": true, "the": true, "and": true, "or": true, "of": true, "in": true,
	"on": true, "at": true, "to": true, "for": true, "with": true, "is": true, "are": true,
	"this": true, "that": true, "it": true, "image": true, "photo": true, "picture": true,
	"shows": true, "showing": true, "depicts": true, "contains": true, "featuring": true,
	"tags": true, "tag": true, "there": true, "no": true, "not": true, "any": true,
	"which": true, "who": true, "what": true, "where": true, "when": true, "how": true,
	"has": true, "have": true, "had": true, "was": true, "were": true, "be": true, "been": true,
	"its": true, "their": true, "them": true, "they": true, "into": true, "from": true,
	"by": true, "as": true, "also": true, "very": true, "just": true, "only": true,
}

func parseTags(raw string) []string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)
	for _, prefix := range []string{"tags:", "tag:", "answer:", "response:"} {
		if strings.HasPrefix(strings.ToLower(raw), prefix) {
			raw = strings.TrimSpace(raw[len(prefix):])
		}
	}
	if raw == "" {
		return nil
	}

	seen := make(map[string]bool)
	out := []string{}
	appendTag := func(tag string) {
		tag = normalizeTag(tag)
		if tag == "" || seen[tag] {
			return
		}
		seen[tag] = true
		out = append(out, tag)
	}

	for _, part := range splitTagParts(raw) {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		words := strings.Fields(part)
		if len(words) <= 2 && len(part) <= maxTagLen {
			appendTag(part)
			if len(out) >= maxTags {
				return out
			}
			continue
		}
		for _, word := range words {
			appendTag(word)
			if len(out) >= maxTags {
				return out
			}
		}
	}
	return out
}

func splitTagParts(raw string) []string {
	replacer := strings.NewReplacer(";", ",", "\n", ",", "|", ",")
	raw = replacer.Replace(raw)
	return strings.Split(raw, ",")
}

func normalizeTag(raw string) string {
	tag := strings.TrimSpace(strings.ToLower(raw))
	tag = strings.Trim(tag, ".\"'!?()[]{}: ")
	tag = strings.TrimPrefix(tag, "ai:")
	if tag == "" || tagStopWords[tag] {
		return ""
	}
	if len(tag) > maxTagLen {
		return ""
	}
	for _, r := range tag {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' {
			return ""
		}
	}
	return tag
}
