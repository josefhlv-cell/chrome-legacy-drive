"""Pacifica 41 showroom v2.

Exteriors are cut out with the existing IMG.LY mask and planted so the
visible tyre contact, not the alpha-box bottom, meets the wheel line.
Interiors keep every interior pixel. Only hand-checked outside regions
are replaced with the unstretched master plate.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
MASTER_PATH = ROOT / "public/assets/showroom/master_showroom_background.jpg"
CANVAS_W = 1500
CANVAS_H = 846
WHEEL_RATIO = 0.895
MAX_W = 0.72
MAX_H = 0.53
SINK_PX = 4

# Window and door attempts were rendered and rejected in visual QA.
# They are not written as finals. The delivered file is the untouched original.
QA_REJECTED = {
    "07-sedacky-zezadu.jpg": "Side-window polygons still left the field visible and did not form a clean glass boundary.",
    "08-prava-stredni-sedacka.jpg": "The master logo was pasted into the right window. Rejected.",
    "09-prava-predni-sedacka.jpg": "A cut-off logo fragment appeared in the side window. Rejected.",
    "12-leva-stredni-sedacka.jpg": "Black ceiling bars and a partial logo appeared inside the glass. Rejected.",
    "14-dvere-ridic.jpg": "A border mask either clipped the door frame or left a patchy brick replacement. Rejected.",
}

UNCHANGED = {
    "10-dvd.jpg": "ambiguous_glass",
    "11-pristrojovka-zprostred.jpg": "ambiguous_glass",
    "13-zprostred-predek-ridic.jpg": "ambiguous_glass",
    "15-km.jpg": "detail_no_outside",
    "16-stredovy-panel.jpg": "detail_no_outside",
    "17-vrch-stropnice.jpg": "detail_no_outside",
    "19-vin-za-oknem.jpg": "ambiguous_glass",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def choose_contacts(profile: np.ndarray) -> dict:
    xs = np.where(profile >= 0)[0]
    if len(xs) == 0:
        raise ValueError("empty profile")
    x0, x1 = int(xs.min()), int(xs.max())
    span = max(1, x1 - x0)

    def band_max(a: int, b: int):
        sl = profile[max(0, a):b]
        sl = sl[sl >= 0]
        return int(sl.max()) if len(sl) else None

    left = band_max(x0, x0 + int(span * 0.16))
    right = band_max(x1 - int(span * 0.16), x1 + 1)
    center = band_max(x0 + int(span * 0.30), x0 + int(span * 0.70))
    outer_vals = [v for v in (left, right) if v is not None]
    outer = max(outer_vals)
    if center is not None and center > outer + 45:
        return {
            "kind": "frontal",
            "near": outer,
            "far": min(outer_vals),
            "left": left,
            "right": right,
            "center": center,
        }
    near = int(profile[profile >= 0].max())
    near_x = int(np.where(profile == near)[0][0])
    if near_x > (x0 + x1) / 2:
        far = band_max(x0, x0 + int(span * 0.35))
    else:
        far = band_max(x1 - int(span * 0.35), x1 + 1)
    return {
        "kind": "three_quarter",
        "near": near,
        "far": far,
        "left": left,
        "right": right,
        "center": center,
    }


def _core_mask(alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    solid = alpha > 200
    opened = ndimage.binary_opening(solid, structure=np.ones((3, 3)))
    labels, count = ndimage.label(opened)
    if count == 0:
        raise ValueError("no solid vehicle")
    sizes = ndimage.sum(opened, labels, range(1, count + 1))
    core = labels == (int(np.argmax(sizes)) + 1)
    near = ndimage.binary_dilation(core, iterations=2)
    mask = core | ((alpha > 50) & near)
    labels2, count2 = ndimage.label(mask)
    sizes2 = ndimage.sum(mask, labels2, range(1, count2 + 1))
    mask = labels2 == (int(np.argmax(sizes2)) + 1)
    return core, mask


def bottom_profile(core: np.ndarray) -> np.ndarray:
    height, width = core.shape
    profile = np.full(width, -1, dtype=np.int32)
    for x in range(width):
        ys = np.where(core[:, x])[0]
        if len(ys) == 0:
            continue
        bottom = int(ys.max())
        if core[max(0, bottom - 15):bottom + 1, x].sum() >= 10:
            profile[x] = bottom
    return profile


def composite_exterior(source: np.ndarray, cutout: np.ndarray, master: Image.Image) -> tuple[Image.Image, dict]:
    alpha = cutout[:, :, 3]
    core, mask = _core_mask(alpha)
    profile = bottom_profile(core)
    contacts = choose_contacts(profile)
    ys, xs = np.where(mask)
    top, bottom, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    crop_mask = mask[top:bottom + 1, left:right + 1]
    rgb = source[top:bottom + 1, left:right + 1].copy()
    soft = crop_mask & ~core[top:bottom + 1, left:right + 1]
    rgb[soft] = cutout[top:bottom + 1, left:right + 1, :3][soft]
    sprite = Image.fromarray(np.dstack([rgb, crop_mask.astype(np.uint8) * 255]), "RGBA")
    mw, mh = master.size
    if (mw, mh) != (CANVAS_W, CANVAS_H):
        raise ValueError(f"master is {mw}x{mh}")
    scale = min((mw * MAX_W) / sprite.width, (mh * MAX_H) / sprite.height)
    draw_w = max(1, int(round(sprite.width * scale)))
    draw_h = max(1, int(round(sprite.height * scale)))
    sprite = sprite.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    wheel = mh * WHEEL_RATIO + SINK_PX
    tyre_off = (contacts["near"] - top) * (draw_h / (bottom - top + 1))
    y = int(round(wheel - tyre_off))
    x = int(round((mw - draw_w) / 2))
    if y < 0 or y + draw_h > mh or x < 0 or x + draw_w > mw:
        raise ValueError(f"placement leaves the canvas: {x},{y} {draw_w}x{draw_h}")
    shadow = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    rx = draw_w * 0.34
    ry = max(8, draw_h * 0.038)
    draw.ellipse([mw / 2 - rx, wheel - ry, mw / 2 + rx, wheel + ry], fill=(0, 0, 0, 64))
    far = contacts["far"]
    far_y = None
    if far is not None and abs(far - contacts["near"]) > 20:
        far_off = (far - top) * (draw_h / (bottom - top + 1))
        far_y = y + far_off
        far_x = x + draw_w * (0.22 if far < contacts["near"] else 0.78)
        draw.ellipse(
            [far_x - draw_w * 0.13, far_y - ry, far_x + draw_w * 0.13, far_y + ry],
            fill=(0, 0, 0, 56),
        )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    out = master.convert("RGBA")
    out.alpha_composite(shadow)
    out.alpha_composite(sprite, (x, y))
    width_ratio = draw_w / mw
    height_ratio = draw_h / mh
    if width_ratio > MAX_W + 1e-6 or height_ratio > MAX_H + 1e-6:
        raise ValueError("scale ceiling exceeded")
    info = {
        "kind": contacts["kind"],
        "near_source_y": contacts["near"],
        "far_source_y": far,
        "draw": [draw_w, draw_h],
        "origin": [x, y],
        "width_ratio": round(width_ratio, 4),
        "height_ratio": round(height_ratio, 4),
        "wheel_line_y": round(mh * WHEEL_RATIO, 2),
        "tyre_canvas_y": round(y + tyre_off, 2),
        "far_tyre_canvas_y": None if far_y is None else round(far_y, 2),
        "bbox_bottom_canvas": y + draw_h,
    }
    return out.convert("RGB"), info


def showroom_cover(master: Image.Image, size: tuple[int, int]) -> np.ndarray:
    mw, mh = master.size
    tw, th = size
    scale = max(tw / mw, th / mh)
    resized = master.convert("RGB").resize((int(round(mw * scale)), int(round(mh * scale))), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - tw) // 2)
    top = max(0, (resized.height - th) // 2)
    return np.array(resized.crop((left, top, left + tw, top + th)))


def polygon_mask(size: tuple[int, int], polygons: list[list[tuple[int, int]]]) -> np.ndarray:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(7))
    return np.array(mask).astype(np.float32) / 255.0


def composite_interior(source: np.ndarray, master: Image.Image, polygons: list, open_air: bool) -> tuple[np.ndarray, dict]:
    height, width = source.shape[:2]
    mask = polygon_mask((width, height), polygons)
    plate = showroom_cover(master, (width, height)).astype(np.float32)
    src = source.astype(np.float32)
    if open_air:
        mixed = plate
        mode = "open_air_outside_door"
    else:
        blur = ndimage.uniform_filter(src, size=(17, 17, 1))
        high = src - blur
        show_luma = plate.mean(axis=2, keepdims=True) + 1e-3
        glass_luma = blur.mean(axis=2, keepdims=True)
        factor = np.clip(glass_luma / show_luma, 0.28, 1.05)
        mixed = np.clip(plate * factor + high * 0.72, 0, 255)
        mode = "glass_tint_and_high_frequency_kept"
    alpha = mask[:, :, None]
    out = np.clip(src * (1 - alpha) + mixed * alpha, 0, 255).astype(np.uint8)
    protected = mask < 0.015
    out[protected] = source[protected]
    if np.any(out[protected] != source[protected]):
        raise ValueError("interior pixels outside the mask changed")
    return out, {
        "mode": mode,
        "replaced_fraction": round(float((mask > 0.5).mean()), 4),
        "polygons": polygons,
    }


def main() -> None:
    originals = Path("/tmp/pacifica41/named")
    cutouts = Path("/tmp/pacifica41")
    out_dir = Path("/tmp/pacifica41/v2")
    out_dir.mkdir(parents=True, exist_ok=True)
    master_before = sha256(MASTER_PATH)
    master = Image.open(MASTER_PATH)
    source_hashes = {p.name: sha256(p) for p in originals.glob("*.jpg")}
    entries = []

    exteriors = {
        "01-prava-prednii.jpg": "01",
        "05-predek.jpg": "05",
        "06-kufr.jpg": "06",
    }
    for filename, key in exteriors.items():
        source = np.array(Image.open(originals / filename).convert("RGB"))
        cutout = np.array(Image.open(cutouts / f"cutout-{key}.png").convert("RGBA"))
        image, info = composite_exterior(source, cutout, master)
        dest = out_dir / filename.replace(".jpg", ".showroom-v2.jpg")
        image.save(dest, quality=92)
        entries.append({
            "filename": filename,
            "role": "exterior",
            "status": "showroom_v2",
            "final": True,
            "output": str(dest),
            "placement": info,
            "changed": "Background removed. Vehicle pixels kept. Tyre contact placed on the wheel line. Blurred elliptical shadow.",
            "preserved": "Body, wheels, lamps, badging, plate, water droplets, photographed angle.",
            "uncertain": (
                "Far wheel stays higher because the original 3/4 camera is close and low. It is not forced onto the same horizontal line."
                if info["kind"] == "three_quarter" else
                "Bumper overhang may sit slightly below the tyre line because it is closer to the camera than the contact patch."
            ),
        })

    for filename, reason in UNCHANGED.items():
        dest = out_dir / filename.replace(".jpg", ".interior-v2.jpg")
        dest.write_bytes((originals / filename).read_bytes())
        entries.append({
            "filename": filename,
            "role": "interior",
            "status": reason,
            "final": True,
            "output": str(dest),
            "changed": "Nothing. Output bytes are the original file.",
            "preserved": "Entire frame, including any glass.",
            "uncertain": (
                "Outside is visible only through glass mixed with rain, tint or reflections, so it was not separated."
                if reason == "ambiguous_glass" else
                "No separate outside area is visible."
            ),
        })

    for filename, reason in QA_REJECTED.items():
        dest = out_dir / filename.replace(".jpg", ".interior-v2.jpg")
        dest.write_bytes((originals / filename).read_bytes())
        entries.append({
            "filename": filename,
            "role": "interior",
            "status": "qa_failed_original_kept",
            "output": str(dest),
            "changed": "Nothing in the delivered file. A replacement was rendered and rejected.",
            "preserved": "Entire original frame.",
            "uncertain": reason,
            "final": False,
        })

    for name, digest in source_hashes.items():
        if sha256(originals / name) != digest:
            raise SystemExit(f"original changed: {name}")
    if sha256(MASTER_PATH) != master_before:
        raise SystemExit("master changed")
    manifest = {
        "master": {"path": str(MASTER_PATH), "sha256": master_before, "width": CANVAS_W, "height": CANVAS_H},
        "originals_sha256": source_hashes,
        "entries": entries,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"outputs": len(entries), "dir": str(out_dir)}, indent=2))


if __name__ == "__main__":
    main()
