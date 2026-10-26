"""Pluton logo kit, concept B (Crossing): a planet cut by its moon's orbit, the moon riding that orbit.

Writes the masters and lockups into kit/. Run: python3 brand/logo/build_kit.py
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "kit")
os.makedirs(OUT, exist_ok=True)

ULTRAMARINE = "#2B3BFF"
INK = "#101018"
WHITE = "#FFFFFF"

# Constructed wordmark (24-unit strokes, x-height 120), placed for the horizontal lockup at x 296.
WORDMARK = (
    "M296 68 H320 V228 H296 Z M296 128 A60 60 0 1 1 416 128 A60 60 0 1 1 296 128 Z "
    "M320 128 A36 36 0 1 0 392 128 A36 36 0 1 0 320 128 Z M438 32 H462 V188 H438 Z "
    "M484 68 H508 V128 H484 Z M580 68 H604 V188 H580 Z M604 128 A60 60 0 0 1 484 128 L508 128 "
    "A36 36 0 0 0 580 128 Z M642 44 H666 V188 H642 Z M626 68 H698 V92 H626 Z "
    "M720 128 A60 60 0 1 1 840 128 A60 60 0 1 1 720 128 Z M744 128 A36 36 0 1 0 816 128 "
    "A36 36 0 1 0 744 128 Z M862 68 H886 V188 H862 Z M958 128 H982 V188 H958 Z "
    "M862 128 A60 60 0 0 1 982 128 L958 128 A36 36 0 0 0 886 128 Z"
)
WORDMARK_W = 686  # x 296..982


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def pt(c, r, a):
    """Point at angle a (degrees, 0 = east, counter-clockwise on screen) on the circle (c, r)."""
    return c[0] + r * math.cos(math.radians(a)), c[1] - r * math.sin(math.radians(a))


def ang(c, p):
    return math.degrees(math.atan2(-(p[1] - c[1]), p[0] - c[0])) % 360


def arc_to(c, r, a0, a1):
    x, y = pt(c, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 0 if a1 > a0 else 1
    return f"A{f(r)} {f(r)} 0 {large} {sweep} {f(x)} {f(y)}"


def circle(c, r):
    x, y = c
    return f"M{f(x - r)} {f(y)} A{f(r)} {f(r)} 0 1 1 {f(x + r)} {f(y)} A{f(r)} {f(r)} 0 1 1 {f(x - r)} {f(y)} Z"


def intersections(c0, r0, c1, r1):
    (x0, y0), (x1, y1) = c0, c1
    d = math.hypot(x1 - x0, y1 - y0)
    a = (r0 ** 2 - r1 ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(r0 ** 2 - a ** 2)
    xm, ym = x0 + a * (x1 - x0) / d, y0 + a * (y1 - y0) / d
    return [(xm + h * (y1 - y0) / d, ym - h * (x1 - x0) / d), (xm - h * (y1 - y0) / d, ym + h * (x1 - x0) / d)]


def symbol(groove=6, moon_r=20):
    """The planet (disc C0, R) cut by a groove of half-width `groove` along the orbit (Cb, rho)."""
    C0, R = (102, 128), 88
    Cb, rho = (282, 304), 248
    inner, outer = rho - groove, rho + groove

    def inside(a, rad):
        x, y = pt(C0, R, a)
        return math.hypot(x - Cb[0], y - Cb[1]) < rad

    # The small piece, between the disc's edge and the inner side of the groove.
    a1, a2 = sorted(ang(C0, p) for p in intersections(C0, R, Cb, inner))
    s, e = (a1, a2) if inside((a1 + a2) / 2, inner) else (a2, a1 + 360)
    xs, ys = pt(C0, R, s)
    near = f"M{f(xs)} {f(ys)} {arc_to(C0, R, s, e)} A{f(inner)} {f(inner)} 0 0 1 {f(xs)} {f(ys)} Z"
    # The large piece, beyond the outer side of the groove.
    b1, b2 = sorted(ang(C0, p) for p in intersections(C0, R, Cb, outer))
    s, e = (b1, b2) if not inside((b1 + b2) / 2, outer) else (b2, b1 + 360)
    xs, ys = pt(C0, R, s)
    far = f"M{f(xs)} {f(ys)} {arc_to(C0, R, s, e)} A{f(outer)} {f(outer)} 0 0 0 {f(xs)} {f(ys)} Z"
    moon = circle(pt(Cb, rho, 104), moon_r)
    return " ".join([far, near, moon])


def scaled(d, k, dx=0, dy=0):
    """Scale and move one of our absolute paths (M/L/H/V/A/Z only)."""
    out, toks, i = [], d.split(), 0
    while i < len(toks):
        t, c = toks[i], toks[i][0]
        if c in "ML":
            out += [c + f(float(t[1:]) * k + dx), f(float(toks[i + 1]) * k + dy)]; i += 2
        elif c == "H":
            out.append("H" + f(float(t[1:]) * k + dx)); i += 1
        elif c == "V":
            out.append("V" + f(float(t[1:]) * k + dy)); i += 1
        elif c == "A":
            out += ["A" + f(float(t[1:]) * k), f(float(toks[i + 1]) * k), *toks[i + 2:i + 5],
                    f(float(toks[i + 5]) * k + dx), f(float(toks[i + 6]) * k + dy)]; i += 7
        else:
            out.append("Z"); i += 1
    return " ".join(out)


def doc(w, h, groups):
    body = "".join(f'<path id="{gid}" fill="{fill}" d="{d}"/>' for gid, fill, d in groups)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}" '
            f'role="img" aria-labelledby="title"><title id="title">Pluton</title>{body}</svg>\n')


def save(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)


if __name__ == "__main__":
    master = symbol()
    small = symbol(groove=10, moon_r=23)   # 16-48 px: a wider groove and a bigger moon so both survive
    reversed_ = symbol(groove=7.5)         # white on dark: light spreads, so open the groove a little

    save("pluton-symbol.svg", doc(256, 256, [("symbol", ULTRAMARINE, master)]))
    save("pluton-symbol-black.svg", doc(256, 256, [("symbol", "#000000", master)]))
    save("pluton-symbol-small.svg", doc(256, 256, [("symbol", ULTRAMARINE, small)]))
    save("pluton-symbol-white.svg", doc(256, 256, [("symbol", WHITE, reversed_)]))

    save("pluton-wordmark.svg", doc(WORDMARK_W + 16, 212, [("wordmark", INK, scaled(WORDMARK, 1, -288, -24))]))

    # Horizontal: symbol on a 256 square, wordmark from x 296.
    w = 296 + WORDMARK_W + 8
    horiz = lambda sym, s, t: doc(w, 256, [("symbol", s, sym), ("wordmark", t, WORDMARK)])
    save("pluton-horizontal.svg", horiz(master, ULTRAMARINE, INK))
    save("pluton-horizontal-black.svg", horiz(master, "#000000", "#000000"))
    save("pluton-horizontal-white.svg", horiz(reversed_, WHITE, WHITE))
    save("pluton-horizontal-on-ink.svg", horiz(reversed_, ULTRAMARINE, WHITE))

    # Stacked: the symbol (visually y 40..216) above the wordmark at 0.46.
    k = 0.46
    sw = WORDMARK_W * k
    W = sw + 32
    sym_dx, sym_dy = (W - 256) / 2, -24
    wm_dx = (W - sw) / 2 - 296 * k
    wm_dy = 192 + 28 - 32 * k
    H = wm_dy + 228 * k + 16
    stacked = lambda s, t, sym: doc(W, H, [("symbol", s, scaled(sym, 1, sym_dx, sym_dy)),
                                           ("wordmark", t, scaled(WORDMARK, k, wm_dx, wm_dy))])
    save("pluton-stacked.svg", stacked(ULTRAMARINE, INK, master))
    save("pluton-stacked-black.svg", stacked("#000000", "#000000", master))
    save("pluton-stacked-white.svg", stacked(WHITE, WHITE, reversed_))
    print("ok")
