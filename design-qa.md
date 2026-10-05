# Design QA · FStructure Solver 2D

## Comparison target

- Source visual truth: `/Users/crismora/Desktop/FusionStructureBrand/brandbook-site/app/globals.css` and `/Users/crismora/Desktop/FusionStructureBrand/brandbook-site/app/sections/Patterns.tsx` for color, typography, material, radii, spacing and motion.
- Geometry-only references: `/tmp/codex-remote-attachments/01a087db-d997-7073-b0ab-59e509c02aa0/8E60A4F0-EC76-4180-AF17-2FADD5A2B972/1-Foto-1.jpg`, `2-Foto-2.jpg` and `3-Foto-3.jpg` for the recessed canvas and 24 × 24 / 2 px rounded icon language.
- Implementation evidence: `output/playwright/fstructure-final-desktop.png`, `output/playwright/fstructure-final-mobile.png`, `output/playwright/fstructure-final-dark.png`, `output/playwright/fstructure-final-welcome-desktop.png` and `output/playwright/fstructure-final-welcome-mobile.png`.
- Latest canvas evidence: `output/playwright/sunken-grid-desktop.png`, `output/playwright/sunken-grid-mobile.png` and `output/playwright/sunken-grid-dark.png`.
- State: empty Solver 2D workbench, inspector collapsed, light theme on desktop/mobile; dark theme also checked on desktop.

## Normalization

- Desktop implementation: 1440 × 1000 px, CSS viewport 1440 × 1000, density 1.
- Mobile implementation: 390 × 844 px, CSS viewport 390 × 844, density 1.
- Supplied phone-board references: 588 × 1280 px. They are framed photos of a design board rather than a matching runnable viewport, so comparison is intentionally limited to the two patterns named by the user; no color or product-layout fidelity is inferred from them.
- Icon reference: 1205 × 227 px. Its readable 24 × 24 / 2 px construction rule is compared against the rendered Lucide controls and the CSS optical treatment.

## Full-view comparison evidence

- Desktop: the canvas is inset 8 px inside an elevated frame, uses the Brandbook `surface-sunken` plane and exact recessed shadow, and keeps the CAD grid visible above that plane. The salmon Analysis action remains the dominant CTA.
- Mobile: the canvas occupies a 370 × 684 CSS-pixel recessed frame at x=10/y=66, preserving the persistent top and bottom controls without viewport overflow; the grid remains visible in the inner plane.
- Dark: the same depth model remains legible with the Brandbook night values; no light-theme shadow or green action leaks into the surface.

## Focused comparison evidence

No additional crop was needed: the mobile 390 px capture shows the complete frame edge, inner shadow, floating controls and bottom icon dock at readable scale. The icon sheet was inspected at original resolution; visible controls use the existing Lucide library with 20 px rendering inside the optical button box, 2 px stroke and rounded joins/caps.

## Required fidelity surfaces

- Fonts and typography: Space Grotesk, Inter and IBM Plex Mono roles come from the web Brandbook; hierarchy and truncation remain intact at both viewports.
- Spacing and layout rhythm: desktop 12 px and mobile 10 px frame gaps create the requested embedded-canvas effect without losing usable area; card radius and shadows are Brandbook tokens.
- Colors and visual tokens: paper/charcoal neutrals and salmon Analysis actions come exclusively from the web Brandbook. The green shown in the supplied references was intentionally not copied.
- Image and asset fidelity: no raster asset, handcrafted SVG or CSS-drawn icon was introduced. Existing Lucide icons provide the closest matching standard outline language.
- Copy and content: existing Solver 2D labels and interaction language are preserved.

## Findings

- No actionable P0, P1 or P2 mismatch remains within the approved reference scope.
- P3: the supplied mobile reference contains a floating “Añadir” CTA, but FStructure already exposes creation tools persistently in its bottom dock; duplicating the action would reduce clarity and was intentionally omitted.

## Interaction and runtime checks

- Opened the Layers control in the 390 × 844 viewport.
- Opened the desktop Inspector state and verified its clay raised surface.
- Verified the canvas geometry and computed Brandbook inset shadow.
- Checked light and dark themes.
- Browser console and page errors: none.

## Comparison history

- Pass 1: compared the supplied references and the revised desktop/mobile captures together. A P2 optical issue was found in the desktop console: invisible labels still occupied flex space and shifted icons left.
- Fix: X2 console actions now use an explicit centered grid and remove hidden labels from layout; no geometry or label behavior changes on mobile.
- Pass 2: rerendered desktop and mobile at the same viewports, then measured every visible button. All visible labels fit, all icon-only controls are centered within 3 px, and no P0/P1/P2 issue remains.
- Pass 3: the inner canvas was compared with the Brandbook web workbench pattern. The SVG was made transparent so the host owns the `surface-sunken` fill, the retícula was restored with the canonical stronger grid token, and the desktop active tool was aligned with the mobile salmon selected state. Light, dark and 390 px captures now show the recessed plane and grid together.
- Pass 4: held normal and selected tools in desktop and touch-mobile states. Their bounding boxes remain unchanged, `transform` resolves to `none`, and the press is now communicated solely by the Brandbook inset shadow; primary topbar actions use the same non-moving press treatment.

## Implementation checklist

- [x] Recessed canvas on desktop and mobile.
- [x] Brandbook-only color, matter and motion tokens.
- [x] Salmon primary action.
- [x] 2 px rounded outline icon language.
- [x] Motion features loaded asynchronously with user reduced-motion support.
- [x] Build, focused tests, interaction and visual verification.

final result: passed
