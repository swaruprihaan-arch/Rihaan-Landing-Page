# Bricks A'Hoy

Official LEGO® building instructions, page by page — solo or with up to 10 builders in sync.

Type a set number and the site fetches the **real instruction booklets from LEGO.com** (the same data as
[lego.com/service/building-instructions](https://www.lego.com/en-us/service/building-instructions)) and turns each
page of the official PDF into a step: page turner, auto-turn, zoom, fullscreen, progress, collab rooms.
No keys required. Featured build: **42171 Mercedes-AMG F1 W14 E Performance** (1,643 pieces, 360 pages).

Static site: `index.html`, `style.css`, `app.js`, `sets.js`. No build step.

## Run it

Browsers only let a page talk to LEGO.com when it is served from **localhost** (LEGO's API allows `localhost`
origins, but not other domains). So run a tiny local server instead of double-clicking `index.html`:

```bash
cd Lego
python3 -m http.server 8080
# then open http://localhost:8080
```

That's it — every set with digital instructions on LEGO.com works, and booklets render right in the page.
Booklets you open are kept in the browser (Cache Storage), so the second time they load instantly.

Opened as a `file://` page, or hosted on another domain, the site still works for the built-in showcase sets
(`sets.js`): you get the set details and the official PDF links, and the booklet opens in a new tab.

### Hosting it (GitHub Pages etc.)

To read booklets in-page from a hosted site you need a tiny relay, because LEGO.com doesn't send CORS headers
for other domains. `proxy/cloudflare-worker.js` is a ready-made Cloudflare Worker (free tier is plenty):

1. dash.cloudflare.com → Workers & Pages → Create → paste the file → Deploy.
2. Copy the worker URL (e.g. `https://bricks-ahoy.<you>.workers.dev`).
3. In the site: Settings → Data sources → Instructions proxy URL → paste → Save.

The worker only forwards requests to `www.lego.com/api/graphql` and `www.lego.com/cdn/product-assets/…`,
and it passes `Range` headers through, so large booklets load page by page instead of all at once.

## 3D build mode (42171, 42143, 21318, 31203)

Sets that have a step-by-step 3D model get a **3D build** mode next to the booklet: every official step shows the
pieces snapping into place (highlighted orange), with a parts list for the step, bag markers with a "new bag"
animation, orbit/zoom, and the same page turner, auto-turn and collab sync as the booklet.

Each set with a model has its own folder (`model 42171/`, `model 42143/`, `model 21318/`). For 42171 the folder holds: `42171.bin` is pre-baked geometry (indexed, quantised, real LEGO colours —
Studio exports BrickLink colour IDs, which are remapped) so the site decodes it in about a second instead of
parsing LDraw for minutes; `42171.mpd` is the LDraw source it was baked from (one `0 STEP` per official step),
the community model by MING YING CAI from the LDraw.org forums (Technic 2024 thread) plus the LDraw primitives
it needs. 42143 (Ferrari Daytona SP3) is Jens Brühl's OMR-style model from the LDraw.org forums and 21318 (Tree House)
is the LDraw.org Official Model Repository file; both were flattened from nested sub-assemblies into one linear step
list and self-contained the same way. The `*.bin.js` files are the same data wrapped for `file://` pages, where
browsers block `fetch`. Piece pictures in the step panel and the Find-pieces helper are rendered from the model itself.
31203 (World Map) uses the LDraw.org OMR file with its 10,000+ tiles drawn as instanced meshes per section.
10300, 75192 and 31215 have no usable step-by-step 3D model yet, so they open in booklet mode.
To add a set: point `model` in `sets.js` at a `.bin` (baked) or `.mpd` (parsed at runtime with three.js's
`LDrawLoader`, slow for big sets) and add `modelSteps` and `modelCredit`.

## Features
- **Home**: featured build, quick picks, collection shelf (in progress / completed / wishlist), stats, 3D hero.
- **Build**: 3D build mode where available (see above); official booklets with cover, page count and size; in-page reader (pdf.js) with prev/next, auto-turn,
  zoom, fit, fullscreen, page grid; "Open PDF" and "LEGO.com" links for every set. Keyboard: ← → space, p, + − 0, f.
- **Collab**: room codes over PeerJS (WebRTC). Together (synced page), Divided (page ranges split), Race, Same device.
  Optional "Find pieces" role shows the full piece inventory (needs a Rebrickable key).
- **Settings**: theme, accent, reduce motion, sound, auto-turn speed, optional Rebrickable key, optional proxy URL.

## Optional: Rebrickable key
Instructions never need it. A free [Rebrickable API key](https://rebrickable.com/api/) only powers the
"Find pieces" helper (a sortable list of every piece in the set). Keys stay in your browser's localStorage. Never commit keys to a public repo.

## Where the data comes from
`app.js` runs the same GraphQL query LEGO's own instructions page uses:

```
POST https://www.lego.com/api/graphql
{ "operationName": "getSetBuildingInstructions", "variables": { "setNumber": "42171" },
  "query": "query getSetBuildingInstructions($setNumber: String!) { customerService { getBuildingInstructionsForSet(setNumber: $setNumber) { status data { name setNumber year ageRating setImage { src alt } setPieceCount theme { themeName } buildingInstructions { isAdditionalInfoBooklet sequence { total element } pdf { coverImage { src alt } pdfUrl fileSize } } } } } }" }
```

`sets.js` holds that same data, pre-fetched, for the showcase sets. Page counts come from each PDF.

LEGO® is a trademark of the LEGO Group, which does not sponsor or endorse this project. Instructions © The LEGO Group.

## License
The site's code is MIT licensed (see `LICENSE`). Third-party content is not covered by it:
- Building instructions are © The LEGO Group and are streamed from LEGO.com, never stored in this repo.
- 3D models: 42171 by MING YING CAI (shared on the LDraw.org forums), 42143 by Jens Brühl (LDraw.org forums,
  CCAL 2.0), 21318 and 31203 from the LDraw.org Official Model Repository (CCAL 2.0). LDraw parts are
  © LDraw.org contributors (CC BY 4.0). LEGO® is a trademark of the LEGO Group, which does not sponsor or endorse this project.
