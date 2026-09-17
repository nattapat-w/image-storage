package sharefolderuc

type FolderShareContext struct {
	RootID  string
	OwnerID string
	Role    string
}

func (s *Service) ResolveFolderContext(userID, folderID string) (FolderShareContext, bool, error) {
	rootID, ownerID, ok, err := s.ShareFolders.ResolveShareRoot(folderID)
	if err != nil || !ok {
		return FolderShareContext{}, false, err
	}
	can, err := s.canAccessShareRoot(userID, rootID)
	if err != nil {
		return FolderShareContext{}, false, err
	}
	if !can {
		return FolderShareContext{}, false, nil
	}
	role := "member"
	if ownerID == userID {
		role = "owner"
	}
	return FolderShareContext{RootID: rootID, OwnerID: ownerID, Role: role}, true, nil
}
