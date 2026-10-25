"""Round 3 of the Pluton logo concepts (G, H, I): more abstract, bolder. Earlier rounds stay untouched."""
import math

from build_concepts import circle, f, lockup, save, svg


# ---------------------------------------------------------------- G: Eccentric
def symbol_g():
    # Pluto has the most eccentric orbit of the old nine: a heavy ring whose hole is pushed off-centre,
    # thick on one side, almost breaking on the other.
    cx, cy, R, r, thin = 128, 128, 112, 76, 10
    off = R - r - thin
    hx, hy = cx + off * math.cos(math.radians(45)), cy - off * math.sin(math.radians(45))
    return [circle(cx, cy, R), circle(hx, hy, r, cw=False)]


# ---------------------------------------------------------------- H: Inclined
def symbol_h():
    # Pluto's orbit is tilted 17deg off the plane of the other planets: a disc cut along that tilt,
    # its two halves sliding past each other.
    cx, cy, R, slide, gap = 128, 128, 100, 22, 6
    a = math.radians(17)
    u = (math.cos(a), -math.sin(a))
    n = (-u[1], u[0])  # points down-right of the cut

    def half(sign_n, sign_s, sweep):
        ox = cx + sign_s * slide * u[0] + sign_n * gap * n[0]
        oy = cy + sign_s * slide * u[1] + sign_n * gap * n[1]
        lx, ly = ox - R * u[0], oy - R * u[1]
        rx, ry = ox + R * u[0], oy + R * u[1]
        return f"M{f(lx)} {f(ly)} L{f(rx)} {f(ry)} A{f(R)} {f(R)} 0 0 {sweep} {f(lx)} {f(ly)} Z"

    return [half(-1, 1, 0), half(1, -1, 1)]


# ---------------------------------------------------------------- I: Ninth
def symbol_i():
    # Nine dots, Pluto's old place as the ninth planet: eight hold the grid, the ninth breaks out.
    r, pitch, out = 20, 52, 40
    pts = [(c * pitch, row * pitch) for row in range(3) for c in range(3) if (c, row) != (2, 0)]
    pts.append((2 * pitch + out, -out))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    ox = 128 - (min(xs) + max(xs)) / 2
    oy = 128 - (min(ys) + max(ys)) / 2
    return [circle(x + ox, y + oy, r) for x, y in pts]


if __name__ == "__main__":
    for key, fn, title in (("g", symbol_g, "G"), ("h", symbol_h, "H"), ("i", symbol_i, "I")):
        paths = fn()
        save(f"{key}-symbol.svg", svg(paths, title=f"Pluton symbol {title}"))
        save(f"{key}-lockup.svg", lockup(paths, name=f"lockup {title}"))
    print("ok")
