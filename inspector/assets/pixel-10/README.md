# Pixel 10 device artwork

Source: Android Open Source Project / Android Studio device-art resources.

- [Upstream files](https://android.googlesource.com/platform/tools/adt/idea/+/ae3a1b856719a44dd350cb8c4afe153df9505a57/artwork/resources/device-art-resources/pixel_10/)
- Revision: `ae3a1b856719a44dd350cb8c4afe153df9505a57`
- Copyright (C) 2025 The Android Open Source Project.
- License: Apache License 2.0; see the repository's `LICENSE` and upstream [resource manifest](https://android.googlesource.com/platform/tools/adt/idea/+/ae3a1b856719a44dd350cb8c4afe153df9505a57/artwork/resources/device-art-resources/device-art.xml).

`back.webp`, `mask.webp`, and `layout` are unmodified upstream files. The artwork
is rendered locally; the inspector makes no requests to Google for these files.
The images are embedded in `inspector/index.html` to work with the inspector's
existing static routes. After updating the source assets, regenerate the embedded
copies with `node scripts/embed-inspector-art.mjs` from the repository root.

The upstream layout specifies a 1198 × 2531 canvas and a 1080 × 2424 display at
(59, 55), with an 87-pixel corner radius. CSS uses these coordinates directly.
Live screenshots retain their own aspect ratio and fit inside that display.
The 1205 × 2535 background extends slightly past the layout canvas for the
side buttons; it uses the same scale as the display, without distortion.
The foreground mask supplies the camera opening and rounded screen edges.

Google and Pixel are trademarks of Google LLC. Their use here identifies the
device artwork and does not imply endorsement of this project.
