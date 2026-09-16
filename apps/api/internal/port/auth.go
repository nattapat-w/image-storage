package port

type PasswordHasher interface {
	Hash(password string) (string, error)
	Check(hash, password string) error
}

type TokenService interface {
	Issue(userID string) (string, error)
	Parse(token string) (string, error)
}
