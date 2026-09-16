package imageuc

import "testing"

func TestUniqueImageName(t *testing.T) {
	taken := map[string]bool{
		"photo.jpg":     true,
		"photo (1).jpg": true,
	}

	got := uniqueImageName("photo.jpg", taken)
	if got != "photo (2).jpg" {
		t.Fatalf("expected photo (2).jpg, got %q", got)
	}

	got = uniqueImageName("vacation.png", taken)
	if got != "vacation.png" {
		t.Fatalf("expected vacation.png, got %q", got)
	}
}
