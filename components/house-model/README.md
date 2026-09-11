# Versioned house models

`v1` is the first interactive publication model. Its geometry, furniture layout, room data and renderer are kept with the app so published documents do not follow later dashboard changes. Publications store `drawingVersion: 1`; older image-only documents retain their original images.

When changing the house layout or its visual geometry, copy this directory to a new version. Point the dashboard re-exports, snapshot capture and new-publication version at the new model together. Keep every previously published model available and add its viewer to the publication version switch. Never silently fall back to the current model for an unknown version.

Public viewing uses `previewOnly` to disable comment actions and `showPreviewControls` to expose furniture/closet controls. View settings are local React state; no publication writes or authenticated APIs are used. JPEG captures remain the print and unavailable-WebGL fallback.
