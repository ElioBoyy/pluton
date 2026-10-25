"""Generate the Pluton logo concepts as clean, filled SVG paths (no strokes, no text)."""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "concepts")
os.makedirs(OUT, exist_ok=True)


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def circle(cx, cy, r, cw=True):
    """Full circle as two arcs; cw=False reverses winding (to punch a hole with nonzero)."""
    s = 1 if cw else 0
    return (f"M{f(cx - r)} {f(cy)} A{f(r)} {f(r)} 0 1 {s} {f(cx + r)} {f(cy)} "
            f"A{f(r)} {f(r)} 0 1 {s} {f(cx - r)} {f(cy)} Z")


def rect(x0, y0, x1, y1):
    return f"M{f(x0)} {f(y0)} H{f(x1)} V{f(y1)} H{f(x0)} Z"


def pt(cx, cy, r, a):
    # a in degrees, 0 = east, 90 = north (y up visually)
    return cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))


def arc_to(cx, cy, r, a0, a1):
    """Arc from angle a0 to a1 (degrees, counter-clockwise visually if a1 > a0)."""
    x, y = pt(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 0 if a1 > a0 else 1  # visually CCW in SVG's y-down space = sweep 0
    return f"A{f(r)} {f(r)} 0 {large} {sweep} {f(x)} {f(y)}"


def band(cx, cy, R, r, a0, a1):
    """Annulus segment between angles a0 -> a1 (CCW)."""
    # Wound clockwise like rects and circles so overlaps union under nonzero.
    x1, y1 = pt(cx, cy, R, a1)
    xi, yi = pt(cx, cy, r, a0)
    return (f"M{f(x1)} {f(y1)} {arc_to(cx, cy, R, a1, a0)} L{f(xi)} {f(yi)} "
            f"{arc_to(cx, cy, r, a0, a1)} Z")


def svg(paths, w=256, h=256, title="Pluton logo", rule="nonzero"):
    d = " ".join(paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-labelledby="title"><title id="title">{title}</title>'
            f'<path fill="#000" fill-rule="{rule}" d="{d}"/></svg>\n')


def save(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)


# ---------------------------------------------------------------- wordmark
# Geometric lowercase built on a 24-unit stroke: x-height 120 (y 68..188),
# ascender y 28, descender y 228, round bowls are rings r 60 / 36.
S, XT, BL, ASC, DESC = 24, 68, 188, 32, 228
RO, RI = 60, 36
MID = XT + RO  # 128, bowl centre line
GAP = 22


def letter_p(x):
    cx = x + RO
    return [rect(x, XT, x + S, DESC), circle(cx, MID, RO), circle(cx, MID, RI, cw=False)], 2 * RO


def letter_l(x):
    return [rect(x, ASC, x + S, BL)], S


def letter_u(x):
    cx = x + RO
    return [rect(x, XT, x + S, MID), rect(x + 2 * RO - S, XT, x + 2 * RO, BL),
            band(cx, MID, RO, RI, 180, 360)], 2 * RO


def letter_t(x):
    return [rect(x + 16, ASC + 12, x + 16 + S, BL), rect(x, XT, x + 72, XT + S)], 72


def orbit_o(cx, cy, R, r):
    # Orbit "o": the ring opens where Charon passes; the moon rides the orbit.
    a, gap_deg = 45, 60
    mx, my = pt(cx, cy, (R + r) / 2, a)
    return [band(cx, cy, R, r, a + gap_deg / 2, a + 360 - gap_deg / 2), circle(mx, my, (R - r) / 2)]


def letter_o(x, moon=False):
    cx = x + RO
    if not moon:
        return [circle(cx, MID, RO), circle(cx, MID, RI, cw=False)], 2 * RO
    return orbit_o(cx, MID, RO, RI), 2 * RO


def letter_n(x):
    cx = x + RO
    return [rect(x, XT, x + S, BL), rect(x + 2 * RO - S, MID, x + 2 * RO, BL),
            band(cx, MID, RO, RI, 0, 180)], 2 * RO


def wordmark(x0=0, moon=False):
    paths, x = [], x0
    for fn in (letter_p, letter_l, letter_u, letter_t,
               (lambda xx: letter_o(xx, moon)), letter_n):
        p, w = fn(x)
        paths += p
        x += w + GAP
    return paths, x - GAP


# ---------------------------------------------------------------- A: Orbit P
def symbol_a():
    # Stem 28 wide; bowl ring r 68 / 40 tangent to the stem's left edge; Charon offset in the counter.
    stem_x, top, bottom = 60, 28, 228
    R, r = 68, 40
    cx, cy = stem_x + R, top + R
    mx, my = pt(cx, cy, 12, 45)
    return [rect(stem_x, top, stem_x + 28, bottom), circle(cx, cy, R), circle(cx, cy, r, cw=False),
            circle(mx, my, 16)]


# ---------------------------------------------------------------- B: Crossing
def circle_intersections(c0, r0, c1, r1):
    (x0, y0), (x1, y1) = c0, c1
    d = math.hypot(x1 - x0, y1 - y0)
    a = (r0 ** 2 - r1 ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(r0 ** 2 - a ** 2)
    xm, ym = x0 + a * (x1 - x0) / d, y0 + a * (y1 - y0) / d
    return [(xm + h * (y1 - y0) / d, ym - h * (x1 - x0) / d),
            (xm - h * (y1 - y0) / d, ym + h * (x1 - x0) / d)]


def ang(c, p):
    return math.degrees(math.atan2(-(p[1] - c[1]), p[0] - c[0])) % 360


def symbol_b():
    # Planet disc cut by the moon's orbit (a 12-wide groove); the moon rides that orbit outside the disc.
    C0, R = (102, 128), 88
    Cb, rho, w = (282, 304), 248, 6
    inner, outer = rho - w, rho + w
    paths = []
    # Piece near the orbit centre (inside the inner groove circle).
    p1, p2 = circle_intersections(C0, R, Cb, inner)
    a1, a2 = sorted([ang(C0, p1), ang(C0, p2)])
    # pick the disc arc that lies inside the inner circle (towards Cb, i.e. lower right ~ 315deg)
    def inside(a, rad):
        x, y = pt(*C0, R, a)
        return math.hypot(x - Cb[0], y - Cb[1]) < rad
    mid = (a1 + a2) / 2
    s, e = (a1, a2) if inside(mid, inner) else (a2, a1 + 360)
    xs, ys = pt(*C0, R, s)
    xe, ye = pt(*C0, R, e)
    bs, be = ang(Cb, (xe, ye)), ang(Cb, (xs, ys))
    paths.append(f"M{f(xs)} {f(ys)} {arc_to(*C0, R, s, e)} {arc_to(*Cb, inner, bs, be if be > bs else be + 360) if False else ''}")
    # close along the inner orbit circle back to the start
    large = 0
    sweep = 1 if True else 0
    paths[-1] += f"A{f(inner)} {f(inner)} 0 {large} {sweep} {f(xs)} {f(ys)} Z"
    # Piece away from the orbit centre (outside the outer groove circle).
    q1, q2 = circle_intersections(C0, R, Cb, outer)
    b1, b2 = sorted([ang(C0, q1), ang(C0, q2)])
    midb = (b1 + b2) / 2
    s2, e2 = (b1, b2) if not inside(midb, outer) else (b2, b1 + 360)
    xs, ys = pt(*C0, R, s2)
    xe, ye = pt(*C0, R, e2)
    paths.append(f"M{f(xs)} {f(ys)} {arc_to(*C0, R, s2, e2)} A{f(outer)} {f(outer)} 0 0 0 {f(xs)} {f(ys)} Z")
    # Moon on the orbit, upper right, outside the disc.
    mx, my = pt(*Cb, rho, 104)
    paths.append(circle(mx, my, 20))
    return paths


# ---------------------------------------------------------------- C: wordmark with orbit o
def lockup(symbol_paths, moon=False, name="lockup"):
    # Symbol drawn at 256, wordmark sits beside it, same 256 height.
    wm, wend = wordmark(0, moon)
    offset = 256 + 40
    shifted = [shift(p, offset) for p in wm]
    return svg(symbol_paths + shifted, w=offset + wend + 8, title=f"Pluton {name}")


def shift(path, dx):
    # Shift absolute x coordinates in our own generated paths (M, L, H, A endpoints).
    out, toks = [], path.replace(",", " ").split()
    i = 0
    while i < len(toks):
        t = toks[i]
        cmd = t[0]
        if cmd in "ML":
            out.append(cmd + f(float(t[1:]) + dx)); out.append(toks[i + 1]); i += 2
        elif cmd == "H":
            out.append("H" + f(float(t[1:]) + dx)); i += 1
        elif cmd == "V":
            out.append(t); i += 1
        elif cmd == "A":
            out += toks[i:i + 5]; out.append(f(float(toks[i + 5]) + dx)); out.append(toks[i + 6]); i += 7
        elif cmd == "Z":
            out.append("Z"); i += 1
        else:
            raise ValueError(t)
    return " ".join(out)


if __name__ == "__main__":
    a, b = symbol_a(), symbol_b()
    save("a-symbol.svg", svg(a, title="Pluton symbol A"))
    save("b-symbol.svg", svg(b, title="Pluton symbol B"))
    save("a-lockup.svg", lockup(a, name="lockup A"))
    save("b-lockup.svg", lockup(b, name="lockup B"))
    wm, wend = wordmark(8, moon=True)
    save("c-wordmark.svg", svg(wm, w=wend + 8, title="Pluton wordmark C"))
    # C's symbol: the orbit o on its own, centred.
    save("c-symbol.svg", svg(orbit_o(128, 128, 112, 68), title="Pluton symbol C"))
    print("ok")
