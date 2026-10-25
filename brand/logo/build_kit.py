"""Final Pluton logo kit, built from concept H (Inclinée): masters, lockups and colour versions."""
import math
import os

from build_concepts import f, shift, wordmark

OUT = os.path.join(os.path.dirname(__file__), "kit")
os.makedirs(OUT, exist_ok=True)

ULTRAMARINE = "#2B3BFF"
INK = "#101018"
WHITE = "#FFFFFF"
TILT = 17  # degrees, the inclination of Pluto's orbit


def symbol(cx=128, cy=128, R=100, slide=18, gap=7):
    """A disc cut along a 17deg line, its two halves sliding past each other.

    slide: how far each half moves along the cut; gap: half the width of the white cut.
    """
    a = math.radians(TILT)
    u = (math.cos(a), -math.sin(a))
    n = (-u[1], u[0])

    def half(sign_n, sign_s, sweep):
        ox = cx + sign_s * slide * u[0] + sign_n * gap * n[0]
        oy = cy + sign_s * slide * u[1] + sign_n * gap * n[1]
        lx, ly = ox - R * u[0], oy - R * u[1]
        rx, ry = ox + R * u[0], oy + R * u[1]
        return f"M{f(lx)} {f(ly)} L{f(rx)} {f(ry)} A{f(R)} {f(R)} 0 0 {sweep} {f(lx)} {f(ly)} Z"

    return " ".join([half(-1, 1, 0), half(1, -1, 1)])


def doc(w, h, groups, title):
    body = "".join(f'<path id="{gid}" fill="{fill}" d="{d}"/>' for gid, fill, d in groups)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}" '
            f'role="img" aria-labelledby="title"><title id="title">{title}</title>{body}</svg>\n')


def save(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)


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


if __name__ == "__main__":
    master = symbol()
    small = symbol(R=96, slide=20, gap=12)      # 16-32 px: a wider cut so it stays open
    reversed_ = symbol(gap=8.5)                 # white on dark: light spreads, so open the cut a little

    save("pluton-symbol.svg", doc(256, 256, [("symbol", ULTRAMARINE, master)], "Pluton"))
    save("pluton-symbol-black.svg", doc(256, 256, [("symbol", "#000000", master)], "Pluton"))
    save("pluton-symbol-small.svg", doc(256, 256, [("symbol", ULTRAMARINE, small)], "Pluton"))
    save("pluton-symbol-white.svg", doc(256, 256, [("symbol", WHITE, reversed_)], "Pluton"))

    wm_paths, wm_w = wordmark(0)
    wm = " ".join(wm_paths)
    # Wordmark alone: glyphs span y 32..228 inside a 256 box; crop to 24..236.
    save("pluton-wordmark.svg", doc(wm_w + 16, 212, [("wordmark", INK, scaled(wm, 1, 8, -24))], "Pluton"))

    # Horizontal lockup: symbol height = 256, gap = one symbol cut-to-edge distance (40).
    gap = 40
    x_wm = 256 + gap
    w = x_wm + wm_w + 8
    horiz = lambda sym, s, t: doc(w, 256, [("symbol", s, sym), ("wordmark", t, scaled(wm, 1, x_wm))], "Pluton")
    save("pluton-horizontal.svg", horiz(master, ULTRAMARINE, INK))
    save("pluton-horizontal-black.svg", horiz(master, "#000000", "#000000"))
    save("pluton-horizontal-white.svg", horiz(reversed_, WHITE, WHITE))
    save("pluton-horizontal-on-ink.svg", horiz(reversed_, ULTRAMARINE, WHITE))

    # Stacked lockup: symbol centred above the wordmark, wordmark at 0.46 of its horizontal size.
    k = 0.46
    sw = wm_w * k
    W = max(sw, 256) + 32
    sym_x = (W - 256) / 2
    wm_x = (W - sw) / 2
    H = 256 + 8 + 212 * k + 16
    stacked = lambda s, t, sym: doc(W, H, [("symbol", s, scaled(sym, 1, sym_x)),
                                           ("wordmark", t, scaled(wm, k, wm_x, 256 + 8 - 24 * k))], "Pluton")
    save("pluton-stacked.svg", stacked(ULTRAMARINE, INK, master))
    save("pluton-stacked-black.svg", stacked("#000000", "#000000", master))
    save("pluton-stacked-white.svg", stacked(WHITE, WHITE, reversed_))
    print("ok")
