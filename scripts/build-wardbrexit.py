"""Prepare the standalone Brexit explorer from the supplied local MRP results.

Reuse the verified 2022 census ward topology already served by /ward2024.
Keep the original CSV and method byte-for-byte for downloads and provenance.
"""
import argparse
import csv
import hashlib
import json
import math
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESPONSES = {"rejoin", "out"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(csv_path, method_path):
    wards = {}
    keys = set()
    counts = {}
    with csv_path.open(newline="") as source:
        for row in csv.DictReader(source):
            key = (row["ward"], row["response"])
            assert key not in keys, f"Duplicate ward-response: {key}"
            keys.add(key)
            assert row["response"] in RESPONSES, key
            est, lo, hi, votes, voters = (float(row[k]) for k in ("est", "lci", "uci", "votes", "voters"))
            assert all(math.isfinite(x) and 0 <= x <= 1 for x in (est, lo, hi)), key
            assert lo <= hi, key
            assert math.isfinite(votes) and math.isfinite(voters) and 0 <= votes <= voters and voters > 0, key
            assert math.isclose(est, votes / voters, abs_tol=1e-12), key
            metadata = {"id": row["ward"], "name": row["ward_name"], "pcon": row["pcon_name"],
                        "pconCode": row["pcon"], "region": row["region"]}
            assert all(metadata.values()), key
            ward = wards.setdefault(row["ward"], {**metadata, "votes": []})
            assert all(ward[k] == v for k, v in metadata.items()), key
            ward["votes"].append([row["response"], est, lo, hi])
            counts.setdefault(row["ward"], []).append((votes, voters))

    assert len(wards) == 7993, f"Unexpected coverage: {len(wards)}"
    for ward in wards.values():
        assert {v[0] for v in ward["votes"]} == RESPONSES, ward["id"]
        assert math.isclose(sum(v[1] for v in ward["votes"]), 1, abs_tol=1e-12), ward["id"]
        totals = counts[ward["id"]]
        assert math.isclose(totals[0][1], totals[1][1], abs_tol=1e-8), ward["id"]
        assert math.isclose(sum(c[0] for c in totals), totals[0][1], abs_tol=1e-8), ward["id"]
        ward["votes"].sort(key=lambda v: (-v[1], v[0]))
        ward["leader"] = ward["votes"][0][0] if ward["votes"][0][1] != ward["votes"][1][1] else "tie"

    topology_path = ROOT / "public/data/ward2024/wards.topo.json"
    topology = json.loads(topology_path.read_text())
    geometries = topology["objects"]["wards"]["geometries"]
    codes = [g["properties"]["ward"] for g in geometries]
    assert len(codes) == len(set(codes)) == len(wards)
    assert set(codes) == set(wards), "Boundary / estimate mismatch"
    assert all(g["type"] in ("Polygon", "MultiPolygon") and g["arcs"] for g in geometries)
    boundary_manifest = json.loads((topology_path.parent / "sources.json").read_text())

    target = ROOT / "public/data/wardbrexit"
    target.mkdir(parents=True, exist_ok=True)
    download = "/data/wardbrexit/ward_brexit_results.csv"
    method = "/data/wardbrexit/method.md"
    manifest = {
        "source": "brexit_ward_mrp/_output/ward_brexit_results.csv (local project snapshot)",
        "download": download, "csvSha256": sha256(csv_path),
        "method": method, "methodSha256": sha256(method_path),
        "wardCount": len(wards), "rowCount": len(keys),
        "responses": {"rejoin": "Rejoin the EU", "out": "Stay out of the EU"},
        "survey": "British Election Study Internet Panel, Wave 31",
        "estimand": "Voting intention among those choosing Rejoin or Stay out; excludes don't knows and non-voters",
        "pointEstimate": "Mean expected response count divided by mean total expected Rejoin and Stay out count",
        "interval": "2.5th and 97.5th percentiles of posterior draw-level response shares",
        "calibration": "Not calibrated to election results; 2024 election results and estimated 2016 Leave shares are contextual predictors",
        "boundaries": "/data/ward2024/wards.topo.json", "topologySha256": sha256(topology_path),
        **{key: boundary_manifest[key] for key in ("boundarySource", "boundaryDescription", "shapefileSha256", "simplification", "attribution")},
        "sharePrecision": "Source CSV numeric precision preserved in browser JSON; displayed percentages rounded to one decimal place",
    }
    shutil.copyfile(csv_path, target / "ward_brexit_results.csv")
    shutil.copyfile(method_path, target / "method.md")
    (target / "estimates.json").write_text(json.dumps({"source": download, "download": download, "wards": list(wards.values())}, separators=(",", ":")) + "\n")
    (target / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {len(keys):,} rows across {len(wards):,} wards; exact boundary coverage verified.")
    print(f"CSV SHA-256: {manifest['csvSha256']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--method", type=Path, required=True)
    args = parser.parse_args()
    build(args.csv, args.method)
