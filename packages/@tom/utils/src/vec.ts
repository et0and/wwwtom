/**
@module   vec.ts
@desc     2D vector helper functions
@category public

- Taken from https://github.com/ertdfgcvb/play.core and ported to TypeScript
- No vector class (a 'vector' is just any object with {x, y})
- The functions never modify the original object.
- An optional destination object can be passed as last parameter to all
  the functions (except vec2()).
- All function can be exported individually or grouped via default export.
*/

export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function copy(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x;
  out.y = a.y;
  return out;
}

export function add(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function sub(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  return out;
}

export function mul(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x * b.x;
  out.y = a.y * b.y;
  return out;
}

export function div(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x / b.x;
  out.y = a.y / b.y;
  return out;
}

export function addN(a: Vec2, k: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x + k;
  out.y = a.y + k;
  return out;
}

export function subN(a: Vec2, k: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x - k;
  out.y = a.y - k;
  return out;
}

export function mulN(a: Vec2, k: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x * k;
  out.y = a.y * k;
  return out;
}

export function divN(a: Vec2, k: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x / k;
  out.y = a.y / k;
  return out;
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function lengthSq(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function norm(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  const l = length(a);
  if (l > 0.00001) {
    out.x = a.x / l;
    out.y = a.y / l;
  } else {
    out.x = 0;
    out.y = 0;
  }
  return out;
}

export function neg(v: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = -v.x;
  out.y = -v.y;
  return out;
}

export function rot(a: Vec2, ang: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  const s = Math.sin(ang);
  const c = Math.cos(ang);
  out.x = a.x * c - a.y * s;
  out.y = a.x * s + a.y * c;
  return out;
}

export function mix(a: Vec2, b: Vec2, t: number, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = (1 - t) * a.x + t * b.x;
  out.y = (1 - t) * a.y + t * b.y;
  return out;
}

export function abs(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.abs(a.x);
  out.y = Math.abs(a.y);
  return out;
}

export function max(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.max(a.x, b.x);
  out.y = Math.max(a.y, b.y);
  return out;
}

export function min(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.min(a.x, b.x);
  out.y = Math.min(a.y, b.y);
  return out;
}

export function fract(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = a.x - Math.floor(a.x);
  out.y = a.y - Math.floor(a.y);
  return out;
}

export function floor(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.floor(a.x);
  out.y = Math.floor(a.y);
  return out;
}

export function ceil(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.ceil(a.x);
  out.y = Math.ceil(a.y);
  return out;
}

export function round(a: Vec2, out?: Vec2): Vec2 {
  out = out || vec2(0, 0);
  out.x = Math.round(a.x);
  out.y = Math.round(a.y);
  return out;
}
