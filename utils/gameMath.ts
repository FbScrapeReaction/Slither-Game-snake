import { Point } from "../types";

export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const normalizeAngle = (angle: number): number => {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
};

// Smoothly rotate current angle towards target angle
export const lerpAngle = (current: number, target: number, turnSpeed: number): number => {
  const diff = target - current;
  const da = (diff + Math.PI) % (2 * Math.PI) - Math.PI; // Shortest path
  
  if (Math.abs(da) < 0.001) return target;
  
  // Cap the turn speed
  const step = Math.sign(da) * Math.min(Math.abs(da), turnSpeed);
  return current + step;
};

export const randomPosition = (width: number, height: number): Point => {
  return {
    x: Math.random() * width,
    y: Math.random() * height
  };
};

export const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

// Helper for rainbow effects
export const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};