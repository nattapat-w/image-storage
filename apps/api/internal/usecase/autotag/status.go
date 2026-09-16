package autotaguc

import (
	"sync"
	"time"
)

const (
	StatusRunning = "running"
	StatusDone    = "done"
	StatusFailed  = "failed"
)

type JobStatus struct {
	ImageID    string     `json:"imageId"`
	State      string     `json:"state"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
	ElapsedSec int        `json:"elapsedSec"`
	Error      string     `json:"error,omitempty"`
}

type statusEntry struct {
	userID     string
	imageID    string
	state      string
	startedAt  time.Time
	finishedAt *time.Time
	errMsg     string
}

type StatusTracker struct {
	mu      sync.RWMutex
	entries map[string]*statusEntry
}

func NewStatusTracker() *StatusTracker {
	return &StatusTracker{entries: make(map[string]*statusEntry)}
}

func (t *StatusTracker) Start(userID, imageID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.entries[imageID] = &statusEntry{
		userID:    userID,
		imageID:   imageID,
		state:     StatusRunning,
		startedAt: time.Now().UTC(),
	}
}

func (t *StatusTracker) Done(userID, imageID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	e, ok := t.entries[imageID]
	if !ok || e.userID != userID {
		return
	}
	now := time.Now().UTC()
	e.state = StatusDone
	e.finishedAt = &now
}

func (t *StatusTracker) Fail(userID, imageID, errMsg string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	e, ok := t.entries[imageID]
	if !ok || e.userID != userID {
		return
	}
	now := time.Now().UTC()
	e.state = StatusFailed
	e.finishedAt = &now
	e.errMsg = errMsg
}

func (t *StatusTracker) List(userID string, imageIDs []string) []JobStatus {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.pruneLocked()

	filter := map[string]bool{}
	for _, id := range imageIDs {
		filter[id] = true
	}
	useFilter := len(filter) > 0

	out := []JobStatus{}
	for id, e := range t.entries {
		if e.userID != userID {
			continue
		}
		if useFilter && !filter[id] {
			continue
		}
		out = append(out, e.toJobStatus())
	}
	return out
}

func (t *StatusTracker) IsRunning(userID, imageID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e, ok := t.entries[imageID]
	return ok && e.userID == userID && e.state == StatusRunning
}

func (t *StatusTracker) pruneLocked() {
	cutoff := time.Now().UTC().Add(-5 * time.Minute)
	for id, e := range t.entries {
		if e.state == StatusRunning {
			continue
		}
		end := e.startedAt
		if e.finishedAt != nil {
			end = *e.finishedAt
		}
		if end.Before(cutoff) {
			delete(t.entries, id)
		}
	}
}

func (e *statusEntry) toJobStatus() JobStatus {
	end := time.Now().UTC()
	if e.finishedAt != nil {
		end = *e.finishedAt
	}
	elapsed := end.Sub(e.startedAt)
	if elapsed < 0 {
		elapsed = 0
	}
	return JobStatus{
		ImageID:    e.imageID,
		State:      e.state,
		StartedAt:  e.startedAt,
		FinishedAt: e.finishedAt,
		ElapsedSec: int(elapsed.Seconds()),
		Error:      e.errMsg,
	}
}
