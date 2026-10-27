// Pluto behind the price, lit like in the launch video: New Horizons' global map (NASA's colour, the
// USGS 300 m mosaic's detail) wrapped on a sphere that turns a full 360°, a sun that swings round it as the section scrolls in,
// and the thin blue haze on its limb. The photo stays in the page underneath; the canvas only takes
// over once it has drawn.

// Where the disc sits in pluto-disc.webp, as fractions of the image's width (see .price-planet-photo's clip).
const CENTER = [0.53, 0.51];
const RADIUS = 0.475;
// The canvas overhangs the photo so the haze has room: 1 = the photo's width.
const SPAN = 1.24;
// Equirectangular, 360° of longitude, Sputnik Planum (the heart) at the centre. The far side and the
// south (in polar night during the flyby) are filled in, so we still look from a little above the
// equator, where the real images are.
// 4096 wide: at its largest the disc is ~1450 device pixels across, about one texel per pixel.
const MAP = "/img/pluto-map.webp";
const TILT = -0.42;
const TURN_SECONDS = 90;

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = (lod: boolean) => `${lod ? "#extension GL_EXT_shader_texture_lod : enable\n" : ""}precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uSun;
uniform float uSpin, uTilt, uNight, uPx, uDensity;
void main(){
  // image coordinates (y down), then sphere coordinates (y up) with the disc's radius as 1
  vec2 img = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * ${SPAN.toFixed(2)} + 0.5;
  vec2 q = (img - vec2(${CENTER[0]}, ${CENTER[1]})) / ${RADIUS};
  q.y = -q.y;
  float r = length(q);
  float edge = smoothstep(1.0 + uPx, 1.0 - uPx, r);
  vec3 col = vec3(0.0); float a = 0.0;
  if (r < 1.0 + uPx) {
    vec2 qq = q / max(r, 1.0);
    vec3 n = vec3(qq, sqrt(max(0.0, 1.0 - dot(qq, qq))));
    // into the planet's frame: tip the north pole towards us, then turn about the pole
    float ct = cos(uTilt), st = sin(uTilt);
    vec3 b = vec3(n.x, ct * n.y - st * n.z, st * n.y + ct * n.z);
    float c = cos(uSpin), s = sin(uSpin);
    vec3 m = vec3(c * b.x + s * b.z, b.y, -s * b.x + c * b.z);
    vec2 uv = vec2(0.5 + atan(m.x, m.z) / 6.2831853, 0.5 - asin(clamp(m.y, -1.0, 1.0)) / 3.1415927);
    // pick the mip level from the sphere's own geometry: the seam in u would fool the GPU's guess
    ${lod
      ? `float level = max(0.0, log2(uDensity) + 0.5 * log2(1.0 / max(n.z, 0.12)));
    vec3 alb = pow(texture2DLodEXT(uTex, uv, level).rgb, vec3(1.12));`
      : `vec3 alb = pow(texture2D(uTex, uv).rgb, vec3(1.12));`}
    float d = dot(n, uSun);
    float lit = max(d, 0.0) * smoothstep(-0.12, 0.55, d);
    vec3 surf = alb * (mix(0.24, 0.035, uNight) + 1.32 * lit);
    // the haze catches the light at the limb, on the lit side
    float rim = pow(1.0 - n.z, 3.0);
    surf += vec3(0.38, 0.55, 1.0) * rim * 0.45 * smoothstep(-0.35, 0.45, d);
    col = surf * edge; a = edge;
  }
  // outside: Pluto's blue haze, then a soft glow round the lit limb
  float beyond = max(r - 1.0, 0.0);
  vec2 dir = q / max(r, 1e-4);
  float side = smoothstep(-0.25, 0.65, dot(vec3(dir, 0.15), uSun));
  float haze = (exp(-beyond * 38.0) * 0.85 + exp(-beyond * 9.0) * 0.22) * side * (1.0 - edge * 0.999);
  vec3 hazeCol = mix(vec3(0.42, 0.6, 1.0), vec3(0.86, 0.9, 1.0), exp(-beyond * 60.0));
  col += hazeCol * haze; a += haze * mix(0.75, 1.0, uNight);
  gl_FragColor = vec4(col, min(a, 1.0));
}`;

export function lightPluto(root: HTMLElement, reduced: boolean) {
  const photo = root.querySelector<HTMLImageElement>(".price-planet-photo");
  const canvas = root.querySelector<HTMLCanvasElement>(".price-planet-light");
  if (!photo || !canvas) return;
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return;

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const lodExt = !!gl.getExtension("EXT_shader_texture_lod");
  const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG(lodExt));
  if (!vs || !fs) return;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uSun = u("uSun"), uSpin = u("uSpin"), uTilt = u("uTilt"), uNight = u("uNight"), uPx = u("uPx"), uDensity = u("uDensity");
  gl.clearColor(0, 0, 0, 0);

  let ready = false;
  const map = new Image();
  const upload = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, map);
    // mipmaps keep the fine map from shimmering as it turns; without explicit levels the seam would
    // pick the smallest one and draw a line, so plain sampling then
    if (lodExt) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lodExt ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ready = true;
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  };

  // The sun starts behind Pluto (a thin crescent) and swings round to light it from the upper left.
  const from = [0.72, 0.12, -0.68], to = [-0.58, 0.42, 0.7];
  const sunAt = (k: number) => {
    const v = from.map((f, i) => f + (to[i]! - f) * k);
    const l = Math.hypot(v[0]!, v[1]!, v[2]!);
    return v.map((x) => x / l) as [number, number, number];
  };
  // Dawn follows Pluto's centre up the screen: still dark as it enters at the bottom, fully lit once
  // it reaches the upper third. The light then eases towards that, so a quick scroll doesn't snap it on.
  const target = () => {
    if (reduced) return 1;
    const r = root.getBoundingClientRect(), vh = innerHeight;
    const centre = r.top + r.height / 2;
    const k = Math.min(1, Math.max(0, (vh * 1.05 - centre) / (vh * 0.75)));
    return k * k * (3 - 2 * k);
  };
  let light = reduced ? 1 : 0, last = 0;
  const progress = (time: number) => {
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    light += (target() - light) * (1 - Math.exp(-dt / 0.9));
    return reduced ? 1 : light;
  };
  const night = () => {
    const theme = document.documentElement.dataset.theme;
    return theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? 1 : 0;
  };

  const draw = (time: number) => {
    if (!ready) return;
    resize();
    gl.uniform3fv(uSun, sunAt(progress(time)));
    gl.uniform1f(uSpin, reduced ? 0 : ((time / 1000) / TURN_SECONDS) * Math.PI * 2 - 0.7);
    gl.uniform1f(uTilt, TILT);
    gl.uniform1f(uNight, night());
    gl.uniform1f(uPx, (1.6 / canvas.width) * (SPAN / RADIUS) * 0.5);
    // texels of the map per pixel of screen at the disc's centre
    gl.uniform1f(uDensity, map.naturalWidth / (Math.PI * 2) / ((canvas.width * RADIUS) / SPAN));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    root.classList.add("is-lit");
  };

  let frame = 0, visible = false;
  const loop = (time: number) => {
    draw(time);
    if (visible && !reduced) frame = requestAnimationFrame(loop);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  };

  const begin = () => {
    upload();
    new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(frame);
    }).observe(root);
    addEventListener("resize", () => draw(performance.now()));
    document.addEventListener("gg-change", () => draw(performance.now()));
  };
  // fetch the map only as the section comes near, then draw from it
  const near = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    near.disconnect();
    map.src = MAP;
    map.decode().then(begin, () => {});
  }, { rootMargin: "800px 0px" });
  near.observe(root);
}
