package ollama

import "testing"

func TestParseTags(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in   string
		want []string
	}{
		{"beach, sunset, ocean, sky, travel", []string{"beach", "sunset", "ocean", "sky", "travel"}},
		{"This image shows a beach at sunset with ocean waves", []string{"beach", "sunset", "ocean", "waves"}},
		{"The image features a large, green circle in the center, surrounded by a blue background", []string{"features", "large", "green", "circle", "center", "surrounded", "blue", "background"}},
		{"beach;sunset;ocean", []string{"beach", "sunset", "ocean"}},
		{"", nil},
	}

	for _, tc := range tests {
		got := parseTags(tc.in)
		if len(got) != len(tc.want) {
			t.Fatalf("parseTags(%q) = %v, want %v", tc.in, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Fatalf("parseTags(%q)[%d] = %q, want %q", tc.in, i, got[i], tc.want[i])
			}
		}
	}
}
