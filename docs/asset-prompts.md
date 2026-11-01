# Racing artwork

These project-owned assets were generated with the built-in ImageGen tool. They do not depict an identified real person or real horse. No stock-photo licence, remote image request, or API key is required at runtime.

## Hero

- File: `public/assets/race-hero.png`
- Dimensions: 1536 × 1024, opaque RGB.
- Intended placement: wide, dark hero banner; right-aligned image with headline space on the left.
- Generation prompt:

> Use case: photorealistic-natural. Asset type: premium horse racing web application hero banner, 1536x1024 landscape composition. Create a cinematic editorial photograph of one majestic dark bay thoroughbred racehorse with a professional jockey wearing ivory and subtle chartreuse racing silks, galloping from left to right. Exact side/three-quarter profile, credible equine anatomy and riding tack. Entire horse and jockey fit with breathing room, positioned predominantly in RIGHT half (between 45% and 95% of canvas width), horse legs around the lower two thirds of composition. LEFT 45% is quiet dark deep evergreen negative space for white interface headline; absolutely no text. Low golden side light outlines horse and jockey, dark forest green distant racecourse, a little sunlit dust/mist and green turf. Premium atmospheric sports photography, tack-sharp subject, softly motion-blurred background, deep emerald shadows and warm cream highlights, elegant and restrained, realistic muscles and glossy bay coat, no second horse, no crowd, no logos, no watermark, no betting or advertising. Banner will be displayed at roughly 850x330 with object-fit cover; ensure subject centered vertically and avoid important detail at extreme top/bottom.

The generated subject faces slightly leftward toward the headline; this is retained as part of the composition.

## Horse gallop atlas

- File: `public/assets/horse-gallop.png`
- Dimensions: 1254 × 1254, genuine RGBA transparency.
- Layout: two columns and two rows, each cell 627 × 627 pixels; row-major frame order.
- Frames: extended suspension, front-leg landing, gathered suspension, hind-leg push-off.
- Generated at a larger resolution than requested; proportional cell placement is used by CSS.
- Original generation prompt:

> Use case: stylized-concept. Asset type: precise transparent 2D game sprite atlas for a premium realistic horse racing browser game. SQUARE 1024x1024 canvas divided into EXACTLY FOUR equal 512x512 cells in a 2-column by 2-row grid, no gridlines or labels. Each cell contains the SAME dark bay thoroughbred horse with SAME professional jockey crouched low wearing ivory neutral white silks and ivory helmet, black boots, blank ivory saddlecloth. All FOUR horses face TO THE RIGHT, nose on RIGHT, tail on LEFT, strict orthographic SIDE PROFILE with NO three-quarter view. Exactly one complete horse+jockey in each cell. Horse size, jockey size, orientation and body alignment identical in every cell: center of horse torso at cell center x256,y280; hooves baseline around y430; image bounds within local x50..465 and y65..440. At least 10% fully transparent padding around every sprite so no clipping or overlap into adjacent cells. Four successive DIFFERENT anatomically accurate galloping poses row-major: top-left fully extended suspension with front legs forward and hind legs backward; top-right forelegs landing; bottom-left gathered suspension with legs tucked under belly; bottom-right hind legs pushing off and forelegs reaching. Same upper body silhouette and saddle position, only natural gallop articulation changes. Premium realistic 3D rendered game asset, detailed glossy deep brown coat, dark mane and tail, believable leather tack, soft consistent studio rim light and ambient shading so visible on dark green background. Readable clear leg silhouettes at 80px wide. No floor, no environment, no drop shadow outside animal, no background of any color: actual transparent RGBA alpha everywhere around the horses. No text, numbers, labels, logos, watermark or borders. This is a rigorously aligned 4-frame animation atlas, not four different horses or a collage. Full horse from tail to nose and hooves to helmet remains completely within each cell.

The first generation's extended pose overlapped a cell boundary. The final asset was corrected through ImageGen with the following edit prompt, rather than cropped programmatically:

> Edit this transparent animation atlas. Keep the SAME dark bay horse, ivory jockey, realistic 3D style, four different gallop poses, all facing RIGHT. Change ONLY SCALE AND ALIGNMENT within cells. Critical defect to fix: sprites are currently too large and overlap the center vertical division; shrink EVERY horse to about 70% of the width of its equal square cell. Produce a square sheet of EXACTLY 2 columns × 2 rows with FOUR equal cells. Every cell contains one COMPLETE horse+jockey with at least 15% transparent padding on BOTH left and right, and generous transparent vertical padding. All four horses have the same torso length, same body horizontal center and same saddle height relative to their own cells. Place the center of each horse's torso at 50% of its cell width and 50% of its cell height. The maximum horse silhouette occupies local x15%..85% and local y25%..75% of each cell. Nothing crosses a cell boundary. Preserve all four distinct correct leg poses: extended, landing, gathered, pushing. The central vertical 25% of the whole sheet should be entirely transparent and form a clean gutter between left and right sprites. Likewise central horizontal 20% fully transparent gutter. No labels, no border, no guides. Maintain genuine alpha transparency. Do not enlarge horses to fill canvas. This is an engineering animation sheet where strict equal-cell alignment is more important than filling the page. Preserve square canvas and exact 2×2 layout.

## Inspection

Both assets were visually inspected. The atlas alpha channel was read without modifying it. Per-cell significant-alpha bounding boxes, in local pixels, are:

| Frame | Left | Top | Right | Bottom |
| --- | ---: | ---: | ---: | ---: |
| 1 | 46 | 213 | 573 | 518 |
| 2 | 69 | 214 | 558 | 545 |
| 3 | 63 | 191 | 540 | 462 |
| 4 | 57 | 191 | 557 | 496 |

The poses have a small natural vertical bob. The complete sprite cells should remain intact when animated; use equal-cell background positions instead of extracting arbitrary rectangles. Reduced-motion mode should display one still frame.
