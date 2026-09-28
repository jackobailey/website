"""Build the static ward explorer data from a pinned public CSV and ONS shapefile.

Requires R with sf/dplyr and the project's npm dev dependencies. Inputs stay outside
the website; the generated assets and provenance are sufficient for deployment.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PARTIES = {"lab", "con", "ld", "ref", "grn", "snp", "pc", "oth"}


def build(csv_path, shapefile, revision, release_metadata=None):
    wards = {}
    keys = set()
    with csv_path.open(newline="") as source:
        for row in csv.DictReader(source):
            key = (row["ward"], row["party"])
            assert key not in keys, f"Duplicate ward-party: {key}"
            keys.add(key)
            assert row["party"] in PARTIES, key
            est, lo, hi = (float(row[k]) for k in ("est", "lci", "uci"))
            assert all(math.isfinite(x) and 0 <= x <= 1 for x in (est, lo, hi)), key
            assert lo <= hi and est > 0, key
            metadata = {"id": row["ward"], "name": row["ward_name"],
                        "pcon": row["pcon_name"], "region": row["region"]}
            ward = wards.setdefault(row["ward"], {**metadata, "votes": []})
            assert all(ward[k] == v for k, v in metadata.items()), key
            ward["votes"].append([row["party"], est, lo, hi])
    assert len(wards) == 7993, f"Unexpected coverage: {len(wards)}"
    for ward in wards.values():
        assert abs(sum(v[1] for v in ward["votes"]) - 1) < 1e-6, ward["id"]
        ward["votes"].sort(key=lambda v: (-v[1], v[0]))
        highest = ward["votes"][0][1]
        # Determine exact ties before rounding the browser payload.
        ward["leader"] = (ward["votes"][0][0] if sum(v[1] == highest for v in ward["votes"]) == 1 else "tie")
        ward["votes"] = [[v[0], *[round(x, 6) for x in v[1:]]] for v in ward["votes"]]

    target = ROOT / "public/data/ward2024"
    target.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ward2024-") as scratch:
        geometry = Path(scratch) / "wards.shp"
        subprocess.run(["Rscript", str(ROOT / "scripts/prepare-ward2024-boundaries.R"),
                        str(shapefile.resolve()), str(geometry)], check=True)
        topology = Path(scratch) / "wards.topo.json"
        subprocess.run([str(ROOT / "node_modules/.bin/mapshaper"), str(geometry),
                        "-simplify", "dp", "interval=35", "keep-shapes",
                        "-proj", "wgs84", "-rename-layers", "wards",
                        "-o", str(topology), "format=topojson", "quantization=1000000"], check=True)
        # Repair quantization-induced coastal intersections without filling gaps.
        # The ~2 m snap is well below the 35 m display simplification tolerance.
        cleaned = Path(scratch) / "cleaned.topo.json"
        subprocess.run([str(ROOT / "node_modules/.bin/mapshaper"), str(topology),
                        "-clean", "gap-fill-area=0", "snap-interval=0.00002",
                        "-o", str(cleaned), "format=topojson", "quantization=1000000"], check=True)
        subprocess.run(["Rscript", str(ROOT / "scripts/validate-ward2024-boundaries.R"), str(cleaned)], check=True)
        boundaries = json.loads(cleaned.read_text())
        geometries = boundaries["objects"]["wards"]["geometries"]
        codes = [g["properties"]["ward"] for g in geometries]
        assert len(codes) == len(set(codes)) == len(wards)
        assert set(codes) == set(wards), "Boundary / estimate mismatch"
        assert all(g["type"] in ("Polygon", "MultiPolygon") and g["arcs"] for g in geometries)
        (target / "wards.topo.json").write_text(json.dumps(boundaries, separators=(",", ":")) + "\n")

    source_url = f"https://raw.githubusercontent.com/jackobailey/ward_mrp/{revision}/_output/ward_ge2024_results.csv"
    csv_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    download_url = source_url
    if release_metadata:
        release = json.loads(release_metadata.read_text())
        asset = next(a for a in release["assets"] if a["name"] == "ward_ge2024_results.csv")
        assert asset["digest"] == f"sha256:{csv_hash}", "Release download differs from the mapped CSV"
        download_url = asset["browser_download_url"]
    manifest = {
        "source": source_url, "download": download_url, "revision": revision,
        "csvSha256": csv_hash,
        "shapefileSha256": hashlib.sha256(shapefile.read_bytes()).hexdigest(),
        "wardCount": len(wards), "rowCount": len(keys),
        "boundarySource": "https://www.arcgis.com/home/item.html?id=a2c204fedefe4120ac93f062c647bdcb",
        "boundaryDescription": "ONS December 2022 UK BFC; dissolved/rekeyed to 2022 census wards, excluding Northern Ireland",
        "simplification": "Douglas-Peucker 35 metres in EPSG:27700; keep-shapes; WGS84 quantization 1000000; clean with no gap fill and 0.00002 degree snapping; final validity checked",
        "sharePrecision": "6 decimal places (proportions); leaders and exact ties identified before rounding",
        "attribution": "Contains OS data © Crown copyright and database right 2022. Contains National Statistics data © Crown copyright and database right 2022.",
    }
    (target / "estimates.json").write_text(json.dumps({"source": source_url, "download": download_url, "wards": list(wards.values())}, separators=(",", ":")) + "\n")
    (target / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    for asset in target.iterdir():
        print(f"{asset.name}: {asset.stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--shapefile", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--release-metadata", type=Path, help="Optional saved GitHub releases API JSON; asset SHA-256 must match the CSV")
    args = parser.parse_args()
    assert len(args.revision) == 40 and all(c in "0123456789abcdef" for c in args.revision)
    build(args.csv, args.shapefile, args.revision, args.release_metadata)
