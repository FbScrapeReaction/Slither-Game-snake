export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface SnakeSegment extends Point {}

export enum SkinType {
  SOLID = 0,
  STRIPED = 1,
  RAINBOW = 2,
  PIXEL = 3
}

export interface Snake {
  id: string;
  name: string;
  body: SnakeSegment[];
  angle: number;
  targetAngle: number;
  speed: number;
  width: number;
  targetLength: number; 
  // Primary color
  color: string;
  // Secondary color for stripes
  secondaryColor: string;
  skinType: SkinType;
  isBot: boolean;
  isDead: boolean;
  isBoosting: boolean;
  score: number;
  hueShift: number;
}

export interface Food extends Point {
  id: string;
  value: number;
  color: string;
  radius: number;
  origX: number;
  origY: number;
  offset: number;
}

export interface GameConfig {
  worldWidth: number;
  worldHeight: number;
  baseSpeed: number;
  boostSpeed: number;
  baseTurnSpeed: number;
  baseLength: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
}

export const SNAKE_COLORS = [
  '#C70039', // Red
  '#FF5733', // Orange
  '#FFC300', // Yellow
  '#DAF7A6', // Light Green
  '#33FF57', // Green
  '#33FFF5', // Cyan
  '#3357FF', // Blue
  '#8C33FF', // Purple
  '#F033FF', // Magenta
];