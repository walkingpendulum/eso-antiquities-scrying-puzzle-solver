# Recognition regression fixtures

The five WebP files are lossless board-only crops, rectified into calibration coordinates, from user-provided game screenshots and photographs. They contain game artwork only; the surrounding room and original photo metadata are excluded. Each crop is placed at `(220, 220)` in the reference canvas for glyph-recognition tests. Alignment is tested separately using the complete reference and transformed copies.

The JSON files are manually checked ground-truth labels, not solver outputs. The animated-rays fixture reproduces the six uncertain cells reported against HTML v1.7 and validates the adaptive second recognition pass introduced in v1.8.

These images are test/calibration material, not covered by the project's MIT software license. The Elder Scrolls Online artwork and trademarks remain the property of their respective owners.
