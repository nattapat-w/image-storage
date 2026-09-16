package domain

import "errors"

var (
	ErrNotFound     = errors.New("not found")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	ErrInvalidInput = errors.New("invalid input")
	ErrUnauthorized = errors.New("unauthorized")
)

type InputError struct {
	Message string
}

func (e *InputError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return ErrInvalidInput.Error()
}

func (e *InputError) Is(target error) bool {
	return target == ErrInvalidInput
}

type DuplicateImageError struct {
	ExistingID string
	SameFolder bool
}

func (e *DuplicateImageError) Error() string {
	return "duplicate image"
}

func IsDuplicate(err error) (*DuplicateImageError, bool) {
	var d *DuplicateImageError
	if errors.As(err, &d) {
		return d, true
	}
	return nil, false
}
