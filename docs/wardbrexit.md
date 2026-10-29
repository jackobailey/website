# Brexit ward explorer

`/wardbrexit` is a standalone sibling of `/ward2024`, using the same typography,
layout, map/search interaction, animated chart and accessible uncertainty table.
It has no main-site navigation. Its components are isolated from the election
explorer; the base stylesheet and verified 2022 census ward topology are shared.

The supplied CSV contains 15,986 rows: Rejoin the EU and Stay out of the EU for
each of 7,993 Great Britain census wards. These are BES Wave 31 voting intentions,
not estimates of the 2016 referendum result. Shares exclude don't knows and
non-voters. The point estimate is a ratio of mean expected counts; the supplied
95% bounds are quantiles of posterior draw-level shares. The model is not
calibrated to election results. See the bundled method and provenance for detail.

Map colours use the magma 0.2 and 0.7 endpoints, purple `#3B0F70` and coral
`#F76F5C`, around a warm off-white `#F6F1E7` midpoint at 50/50. The map background
is washed-out sage-grey `#D4DED8`, keeping pale, evenly split wards visibly
distinct from the surrounding space. Pale wards do not indicate missing data.
Colour position uses a gentle logistic transform of Stay
out share `p`: with `s(x) = 1 / (1 + exp(-x))`,
`t(p) = (s(10 * (p - 0.5)) - s(-5)) / (s(5) - s(-5))`.
This preserves exact 0%, 50% and 100% positions, increases contrast near 50/50,
and compresses the extremes without rescaling to observed ward extrema.
RGB interpolation runs from purple to off-white below the midpoint and from
off-white to coral above it.
The legend uses the same interpolation and
places actual-share ticks with the same transform: 60% Rejoin and 60% Stay out
appear at approximately 26.6% and 73.4% of the colour ramp. `colours.ts` contains
the shared transform, palette and tick values.

Chart bars use the corresponding endpoint colours. Tooltips show both shares.
Colours do not represent probabilities. Chart lengths and intervals retain
their linear 0–100% scale; only map colour positions are transformed.

Rebuild the checked-in browser snapshot with:

```sh
python3 scripts/build-wardbrexit.py \
  --csv ../brexit_ward_mrp/_output/ward_brexit_results.csv \
  --method ../brexit_ward_mrp/README.md
npm run build
```

The builder validates unique ward-response keys, both responses per ward, finite
shares and ordered bounds, within-ward sums, count/share consistency, metadata,
and exact boundary coverage. Source numerical precision is retained in the JSON.
The CSV and README are copied byte-for-byte and hashed in `sources.json`; the
download therefore matches the displayed snapshot. The shared topology is hashed
too. Rebuild both datasets if the shared boundary geography intentionally changes.

The source project currently retains the general-election repository remote, so
the page serves its own method snapshot rather than linking to an unrelated
GitHub method. The sticker opens “Method & data”.

The transparent sticker is `src/assets/wardbrexit/brexit-ward-mrp-hex.png`, with
a matching source-project copy at `brexit_ward_mrp/_output/brexit_ward_mrp_hex.png`.
It is decorative branding, not a data map.

QA should cover map clicks, continuous shading, search by name/code and keyboard,
direct-link reloads, invalid fragments, zoom/reset, the method dialog and exact
CSV download, plus desktop/mobile layouts and the original `/ward2024` route.
