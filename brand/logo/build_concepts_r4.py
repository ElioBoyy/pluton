"""Round 4 of the Pluton logo concepts (J, K, L): form first, story second. Earlier rounds stay untouched."""
from build_concepts import circle, f, lockup, save, svg


def rrect(x0, y0, x1, y1, rx, cw=True):
    """Rounded rectangle; cw=False reverses winding to punch a hole."""
    if cw:
        return (f"M{f(x0 + rx)} {f(y0)} H{f(x1 - rx)} A{f(rx)} {f(rx)} 0 0 1 {f(x1)} {f(y0 + rx)} "
                f"V{f(y1 - rx)} A{f(rx)} {f(rx)} 0 0 1 {f(x1 - rx)} {f(y1)} H{f(x0 + rx)} "
                f"A{f(rx)} {f(rx)} 0 0 1 {f(x0)} {f(y1 - rx)} V{f(y0 + rx)} "
                f"A{f(rx)} {f(rx)} 0 0 1 {f(x0 + rx)} {f(y0)} Z")
    return (f"M{f(x0 + rx)} {f(y0)} A{f(rx)} {f(rx)} 0 0 0 {f(x0)} {f(y0 + rx)} V{f(y1 - rx)} "
            f"A{f(rx)} {f(rx)} 0 0 0 {f(x0 + rx)} {f(y1)} H{f(x1 - rx)} "
            f"A{f(rx)} {f(rx)} 0 0 0 {f(x1)} {f(y1 - rx)} V{f(y0 + rx)} "
            f"A{f(rx)} {f(rx)} 0 0 0 {f(x1 - rx)} {f(y0)} Z")


# ---------------------------------------------------------------- J: Quarter
def symbol_j():
    # A disc with its top-right quarter pulled out along the diagonal.
    R, g = 96, 13
    cx, cy = 128 - g / 2, 128 + g / 2
    qx, qy = cx + g, cy - g
    return [f"M{f(cx)} {f(cy)} L{f(cx)} {f(cy - R)} A{f(R)} {f(R)} 0 1 0 {f(cx + R)} {f(cy)} Z",
            f"M{f(qx)} {f(qy)} L{f(qx)} {f(qy - R)} A{f(R)} {f(R)} 0 0 1 {f(qx + R)} {f(qy)} Z"]


# ---------------------------------------------------------------- K: Out of frame
def symbol_k():
    # A heavy rounded frame; a disc sits on its corner and breaks out of it.
    x0, y0, x1, y1, t = 24, 64, 192, 232, 30
    return [rrect(x0, y0, x1, y1, 44), rrect(x0 + t, y0 + t, x1 - t, y1 - t, 14, cw=False),
            circle(x1 - 4, y0 + 4, 46)]


# ---------------------------------------------------------------- L: Capsule
def symbol_l():
    # A tall capsule with one round hole high up: a solid, toy-like form that hints at a p.
    return [rrect(70, 16, 186, 240, 58), circle(128, 74, 26, cw=False)]


if __name__ == "__main__":
    for key, fn, title in (("j", symbol_j, "J"), ("k", symbol_k, "K"), ("l", symbol_l, "L")):
        paths = fn()
        save(f"{key}-symbol.svg", svg(paths, title=f"Pluton symbol {title}"))
        save(f"{key}-lockup.svg", lockup(paths, name=f"lockup {title}"))
    print("ok")
