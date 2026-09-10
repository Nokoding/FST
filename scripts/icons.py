#!/usr/bin/env python3
"""
Regenerates public/icons.

Three comic panels torn apart from one collision point, running to the edge of
the canvas. The geometry is computed once and emitted as both PNG and SVG, so
the vector source and the exported bitmaps cannot drift apart.

    pip install pillow
    python3 scripts/icons.py

Design notes:
  - full bleed on purpose. Apple's guidance is to not bake a rounded rectangle
    into the source, because the system applies its own shape and derives the
    dark, tinted and clear variants from what you give it. An icon with its own
    rounded box gets rounded twice, and the derived variants have no clear
    figure to pull out of a flat field. Android's adaptive icons want edge to
    edge artwork for the same reason
  - it still looks like a rounded panel on the home screen, because the shape
    comes from the operating system rather than from the artwork
  - flat fills only, no texture. Anything finer than a few pixels turns to
    mush by 192px, and an icon lives its whole life below that
  - no baked gloss or highlight. iOS and Android apply their own treatment, and
    a highlight underneath a highlight looks wrong
  - everything is drawn at 4x and downsampled, since PIL polygons have no
    antialiasing and angled edges show that badly
"""

import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

INK = "#0D0D11"
PAPER = "#F4F1E8"
COLORS = ["#F472B6", "#7FE03C", "#A855F7"]   # regions sweep clockwise from the
                                             # up seam: upper right, bottom, upper left
ANGLES = (-95, 25, 145)                       # direction of each seam
GAP = 5.0        # half seam width in degrees, so seams widen slightly outward
AMP = 11.0       # how far a tear kinks sideways, in 512 units
KINKS = 5
SS = 4

REF = 512.0
BOX = 0.658      # box size as a fraction of the canvas
RADIUS = 0.153   # corner radius as a fraction of the box
BORDER = 0.039   # border thickness as a fraction of the box
STROKE = 7.0     # ink edge on each panel, in 512 units
DROP = 0.02      # collision point below box centre, as a fraction of box height


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ray_to_rect(cx, cy, ang, L, T, R, B):
    dx, dy = math.cos(ang), math.sin(ang)
    best = None
    for num, den in ((L - cx, dx), (R - cx, dx)):
        if abs(den) > 1e-9:
            t = num / den
            if t > 0:
                y = cy + dy * t
                if T - 1e-6 <= y <= B + 1e-6 and (best is None or t < best[0]):
                    best = (t, cx + dx * t, y)
    for num, den in ((T - cy, dy), (B - cy, dy)):
        if abs(den) > 1e-9:
            t = num / den
            if t > 0:
                x = cx + dx * t
                if L - 1e-6 <= x <= R + 1e-6 and (best is None or t < best[0]):
                    best = (t, x, cy + dy * t)
    return best[1], best[2]


def perim_t(x, y, L, T, R, B):
    """position around the rectangle, 0 at top left, clockwise to 4"""
    e = 1e-6
    if abs(y - T) < e: return (x - L) / (R - L)
    if abs(x - R) < e: return 1 + (y - T) / (B - T)
    if abs(y - B) < e: return 2 + (R - x) / (R - L)
    return 3 + (B - y) / (B - T)


def tear(cx, cy, ex, ey, amp, seed):
    dx, dy = ex - cx, ey - cy
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    pts = []
    for i in range(KINKS + 1):
        t = i / KINKS
        # the kink dies out at the collision point and eases off at the edge
        off = amp * math.sin(t * KINKS * 0.62 * math.pi + seed) * min(1.0, t * 2.6) * (1 - 0.45 * t)
        pts.append((cx + dx * t - off * uy, cy + dy * t + off * ux))
    return pts


def layout(canvas, scale=1.0):
    """all measurements in pixels for a given canvas size"""
    box = canvas * scale
    ox = (canvas - box) / 2
    u = box / REF
    return (ox, ox, ox + box, ox + box), u


def regions(inner, u):
    L, T, R, B = inner
    cx = (L + R) / 2
    cy = (T + B) / 2 + (B - T) * DROP
    corners = [(L, T, 0.0), (R, T, 1.0), (R, B, 2.0), (L, B, 3.0)]
    out = []
    for i, color in enumerate(COLORS):
        a0, a1 = ANGLES[i], ANGLES[(i + 1) % 3]
        while a1 <= a0:
            a1 += 360
        x0, y0 = ray_to_rect(cx, cy, math.radians(a0 + GAP), L, T, R, B)
        x1, y1 = ray_to_rect(cx, cy, math.radians(a1 - GAP), L, T, R, B)
        t0, t1 = perim_t(x0, y0, L, T, R, B), perim_t(x1, y1, L, T, R, B)
        while t1 <= t0:
            t1 += 4
        walk = []
        for cxx, cyy, ct in corners:
            c = ct
            while c < t0:
                c += 4
            if c < t1:
                walk.append((c, (cxx, cyy)))
        walk.sort()
        poly = tear(cx, cy, x0, y0, AMP * u, i * 2.1)
        poly += [p for _, p in walk]
        poly += tear(cx, cy, x1, y1, AMP * u, i * 2.1 + 1.3)[::-1]
        out.append((color, poly))
    return out


def png(size, scale=1.0):
    from PIL import Image, ImageDraw
    S = size * SS
    area, u = layout(S, scale)
    img = Image.new("RGB", (S, S), hex_rgb(PAPER))
    d = ImageDraw.Draw(img)
    for color, poly in regions(area, u):
        d.polygon(poly, fill=hex_rgb(color), outline=hex_rgb(INK), width=max(1, int(STROKE * u)))
    return img.resize((size, size), Image.LANCZOS)


def svg():
    area, u = layout(REF)
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
        f'  <rect width="512" height="512" fill="{PAPER}"/>',
        f'  <g clip-path="url(#edge)" stroke="{INK}" stroke-width="{STROKE:.0f}" stroke-linejoin="round">',
        '    <clipPath id="edge"><rect width="512" height="512"/></clipPath>',
    ]
    for color, poly in regions(area, u):
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in poly)
        parts.append(f'    <polygon points="{pts}" fill="{color}"/>')
    parts += ["  </g>", "</svg>", ""]
    return "\n".join(parts)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for size in (192, 512):
        p = os.path.join(OUT, f"icon-{size}.png"); png(size).save(p); made.append(p)
    # full bleed is already the right shape for a maskable icon: a circular
    # crop trims the corners and leaves the collision point centred
    p = os.path.join(OUT, "maskable-512.png"); png(512).save(p); made.append(p)
    p = os.path.join(OUT, "apple-touch-icon.png"); png(180).save(p); made.append(p)
    p = os.path.join(OUT, "icon.svg")
    with open(p, "w") as f:
        f.write(svg())
    made.append(p)
    for p in made:
        print(f"  {os.path.relpath(p)}  {os.path.getsize(p) / 1024:.1f}kb")


if __name__ == "__main__":
    main()
