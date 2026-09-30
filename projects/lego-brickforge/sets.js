/* Built-in showcase sets — official LEGO® building-instruction metadata from LEGO.com, baked in so these
   sets work even where the LEGO API can't be reached (file:// pages, static hosting without a proxy).
   Every field mirrors LEGO's getBuildingInstructionsForSet response; `pages` comes from each PDF's own
   page count. Refresh with the query documented in README.md. */
(function () {
  const CDN = 'https://www.lego.com/cdn/product-assets/';
  const booklet = (id, size, pages, seq, total, extra) => ({
    seq: seq || 1, total: total || 1, extra: !!extra, pages: pages || 0, size,
    pdf: `${CDN}product.bi.core.pdf/${id}.pdf`, cover: `${CDN}product.bi.core.img/${id}.png`
  });
  const set = (num, name, year, theme, pieces, age, imgExt, booklets) => ({
    num, name, year, theme, pieces, age, img: `${CDN}product.img.pri/${num}_Prod.${imgExt}`, booklets
  });

  window.FEATURED_SET = '42171';
  window.BUILTIN_SETS = {
    '42171': Object.assign(set('42171', 'Mercedes-AMG F1 W14 E Performance', '2024', 'LEGO® Technic', 1643, '18+', 'png',
      [booklet('6562099', 101028381, 360)]), {
      // Step-by-step 3D model (LDraw, 461 official steps, 1,639 placed pieces) — see models/README in the main README.
      model: 'model 42171/42171.bin', modelSteps: 461,
      modelCredit: { author: 'MING YING CAI', source: 'LDraw.org forums · Technic 2024 thread', url: 'https://forums.ldraw.org/thread-27891.html' }
    }),
    '42143': Object.assign(set('42143', 'Ferrari Daytona SP3', '2022', 'LEGO® Technic', 3778, '18+', 'png',
      [booklet('6590123', 164501642, 404, 1, 2), booklet('6590116', 150623726, 420, 2, 2)]), {
      model: 'model 42143/42143.bin', modelSteps: 1252,
      modelCredit: { author: 'Jens Brühl [jb70]', source: 'LDraw.org forums · Technic 2022 thread', url: 'https://forums.ldraw.org/thread-25913.html' }
    }),
    '31215': set('31215', 'Vincent van Gogh – Sunflowers', '2025', 'LEGO® Art', 2615, '18+', 'png',
      [booklet('6568340', 149366054, 312)]),
    '31203': Object.assign(set('31203', 'World Map', '2021', 'LEGO® Art', 11695, '18+', 'jpg',
      [booklet('6372756', 70930028, 160)]), {
      model: 'model 31203/31203.bin', modelSteps: 20,
      modelCredit: { author: 'LDraw.org Official Model Repository', source: 'library.ldraw.org/omr (31203-1.mpd)', url: 'https://library.ldraw.org/omr/sets/1385' }
    }),
    '10300': set('10300', 'Back to the Future Time Machine', '2022', 'LEGO® Icons', 1872, '18+', 'png',
      [booklet('6413319', 134593434, 300)]),
    '75192': set('75192', 'Millennium Falcon™', '2017', 'LEGO® Star Wars™', 7541, '16+', 'jpg',
      [booklet('6564023', 347761793, 496)]),
    '21318': Object.assign(set('21318', 'Tree House', '2019', 'LEGO® Ideas', 3036, '16+', 'jpg',
      [booklet('6294836', 101453681, 436)]), {
      model: 'model 21318/21318.bin', modelSteps: 1040,
      modelCredit: { author: 'LDraw.org Official Model Repository', source: 'library.ldraw.org/omr (21318-1.mpd)', url: 'https://library.ldraw.org/omr/sets/1286' }
    }),
  };
})();
