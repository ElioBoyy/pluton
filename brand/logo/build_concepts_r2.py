"""Round 2 of the Pluton logo concepts (D, E, F). Round 1 stays in build_concepts.py."""
import math

from build_concepts import circle, f, lockup, save, svg


def arc_short(c, r, x, y):
    """Short arc around centre c from point x to point y (y-down screen coords)."""
    cross = (x[0] - c[0]) * (y[1] - c[1]) - (x[1] - c[1]) * (y[0] - c[0])
    return f"A{f(r)} {f(r)} 0 0 {1 if cross > 0 else 0} {f(y[0])} {f(y[1])}"


# ---------------------------------------------------------------- D: Hidden P
def symbol_d():
    # A planet with a P carved out of it; the P's counter stays solid and becomes the moon.
    cx, cy, R = 128, 128, 112
    x0, S, yt, yb, Rb, rb = 82, 30, 56, 200, 46, 18
    bx, by = x0 + Rb, yt + Rb
    jy = by + math.sqrt(Rb ** 2 - (x0 + S - bx) ** 2)
    p = (f"M{f(x0)} {f(yb)} V{f(yt)} H{f(bx)} A{f(Rb)} {f(Rb)} 0 1 1 {f(x0 + S)} {f(jy)} "
         f"V{f(yb)} H{f(x0)} Z")
    return [circle(cx, cy, R, cw=False), p, circle(bx, by, rb, cw=False)]


# ---------------------------------------------------------------- E: Face to face
def symbol_e():
    # Pluto and Charon are tidally locked: each always shows the other the same face.
    # Two discs, each flattened on the side that faces the other, on a 30deg axis.
    a = math.radians(30)
    u = (math.cos(a), -math.sin(a))
    n = (-u[1], u[0])
    R, r, c0, c1, gap = 80, 42, 54, 26, 14
    d = c0 + gap + c1

    def flat_disc(C, rad, c, sign):
        # chord at distance c from C along sign*u; arc goes round the far side through F.
        m = (C[0] + sign * c * u[0], C[1] + sign * c * u[1])
        h = math.sqrt(rad ** 2 - c ** 2)
        A = (m[0] + h * n[0], m[1] + h * n[1])
        B = (m[0] - h * n[0], m[1] - h * n[1])
        F = (C[0] - sign * rad * u[0], C[1] - sign * rad * u[1])
        return (f"M{f(A[0])} {f(A[1])} L{f(B[0])} {f(B[1])} {arc_short(C, rad, B, F)} "
                f"{arc_short(C, rad, F, A)} Z")

    # centre the pair's bounding box on the canvas
    p0 = (0.0, 0.0)
    p1 = (d * u[0], d * u[1])
    xs = [p0[0] - R, p0[0] + c0 * u[0] + 0, p1[0] + r]
    ys = [p0[1] + R, p1[1] - r]
    ox, oy = 128 - (min(xs) + max(xs)) / 2, 128 - (min(ys) + max(ys)) / 2
    P0, P1 = (p0[0] + ox, p0[1] + oy), (p1[0] + ox, p1[1] + oy)
    return [flat_disc(P0, R, c0, 1), flat_disc(P1, r, c1, -1)]


# ---------------------------------------------------------------- F: The one that stands out
def symbol_f():
    # A planet sliced into four rows, like a list of leads; one row steps out of line.
    cx, cy, R, g, n, shifted, dx = 116, 128, 104, 12, 4, 2, 24
    h = (2 * R - (n - 1) * g) / n
    paths = []
    for i in range(n):
        y1 = cy - R + i * (h + g)
        y2 = y1 + h
        w1 = math.sqrt(max(R ** 2 - (y1 - cy) ** 2, 0))
        w2 = math.sqrt(max(R ** 2 - (y2 - cy) ** 2, 0))
        o = dx if i == shifted else 0
        paths.append(f"M{f(cx - w1 + o)} {f(y1)} L{f(cx + w1 + o)} {f(y1)} "
                     f"A{f(R)} {f(R)} 0 0 1 {f(cx + w2 + o)} {f(y2)} L{f(cx - w2 + o)} {f(y2)} "
                     f"A{f(R)} {f(R)} 0 0 1 {f(cx - w1 + o)} {f(y1)} Z")
    return paths


if __name__ == "__main__":
    for key, fn, title in (("d", symbol_d, "D"), ("e", symbol_e, "E"), ("f", symbol_f, "F")):
        paths = fn()
        save(f"{key}-symbol.svg", svg(paths, title=f"Pluton symbol {title}"))
        save(f"{key}-lockup.svg", lockup(paths, name=f"lockup {title}"))
    print("ok")
