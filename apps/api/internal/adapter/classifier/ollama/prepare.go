package ollama

import (
	"bytes"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
)

const maxVisionDim = 384

func prepareImageForVision(data []byte) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, nil
	}
	resized := resizeToMax(img, maxVisionDim)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 85}); err != nil {
		return data, nil
	}
	return buf.Bytes(), nil
}

func resizeToMax(src image.Image, maxDim int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxDim && h <= maxDim {
		return src
	}
	var nw, nh int
	if w >= h {
		nw = maxDim
		nh = max(1, h*maxDim/w)
	} else {
		nh = maxDim
		nw = max(1, w*maxDim/h)
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	for y := 0; y < nh; y++ {
		for x := 0; x < nw; x++ {
			sx := b.Min.X + x*w/nw
			sy := b.Min.Y + y*h/nh
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
