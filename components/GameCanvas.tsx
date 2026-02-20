import React, { useRef, useEffect, useCallback } from 'react';
import { Snake, Food, GameConfig, Point, SNAKE_COLORS, GameState, SkinType } from '../types';
import { getDistance, lerpAngle, randomPosition, clamp, hslToHex } from '../utils/gameMath';
import { generateBotNames, getGameOverCommentary } from '../services/geminiService';

interface GameCanvasProps {
  playerName: string;
  gameState: GameState;
  onGameOver: (score: number, msg: string) => void;
  onScoreUpdate: (score: number) => void;
}

// CONFIGURAZIONE 1:1 SLITHER.IO
const CONFIG: GameConfig = {
  worldWidth: 24000, // Mappa Titanica
  worldHeight: 24000,
  baseSpeed: 5.5,
  boostSpeed: 13.5,      
  baseTurnSpeed: 0.2, // Virata lenta e pesante
  baseLength: 10,
};

const INITIAL_FOOD_COUNT = 6000; 
const BOT_COUNT = 55; 
const GRID_SIZE = 400; 

const GameCanvas: React.FC<GameCanvasProps> = ({ playerName, gameState, onGameOver, onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const snakesRef = useRef<Snake[]>([]);
  const foodRef = useRef<Food[]>([]);
  // Spatial Hash Map: "x,y" -> [index in foodRef]
  const foodGridRef = useRef<Map<string, number[]>>(new Map());

  const particlesRef = useRef<Array<{x: number, y: number, vx: number, vy: number, color: string, life: number, size: number}>>([]);
  
  // Inputs & Camera
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const isMouseDownRef = useRef<boolean>(false);
  const cameraRef = useRef<{x: number, y: number, zoom: number}>({ x: CONFIG.worldWidth/2, y: CONFIG.worldHeight/2, zoom: 0.6 });
  const shakeRef = useRef<number>(0); 
  
  // Logic Control
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const playerIdRef = useRef<string>('player-hero');
  const isInitializedRef = useRef<boolean>(false);

  // --- SPATIAL HASH HELPERS ---
  const getGridKey = (x: number, y: number) => `${Math.floor(x / GRID_SIZE)},${Math.floor(y / GRID_SIZE)}`;

  const addToGrid = (foodIndex: number, food: Food, grid: Map<string, number[]>) => {
    const key = getGridKey(food.x, food.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(foodIndex);
  };

  const rebuildFoodGrid = useCallback(() => {
    const grid = new Map<string, number[]>();
    foodRef.current.forEach((f, i) => addToGrid(i, f, grid));
    foodGridRef.current = grid;
  }, []);

  const getNearbyFoodIndices = (x: number, y: number): number[] => {
    const keys = [
      getGridKey(x, y),
      getGridKey(x + GRID_SIZE, y),
      getGridKey(x - GRID_SIZE, y),
      getGridKey(x, y + GRID_SIZE),
      getGridKey(x, y - GRID_SIZE),
      getGridKey(x + GRID_SIZE, y + GRID_SIZE),
      getGridKey(x - GRID_SIZE, y - GRID_SIZE),
      getGridKey(x + GRID_SIZE, y - GRID_SIZE),
      getGridKey(x - GRID_SIZE, y + GRID_SIZE),
    ];
    
    // De-duplicate indices
    const indices = new Set<number>();
    const grid = foodGridRef.current;
    
    for (const key of keys) {
      const cell = grid.get(key);
      if (cell) {
        for(const idx of cell) indices.add(idx);
      }
    }
    return Array.from(indices);
  };

  // --- INITIALIZATION ---
  const initWorld = useCallback(async () => {
    if (isInitializedRef.current) return;
    
    // Generate Food in Clusters (Procedural Patches)
    const foods: Food[] = [];
    let placed = 0;
    while(placed < INITIAL_FOOD_COUNT) {
        // Spawn a cluster center
        const cx = Math.random() * CONFIG.worldWidth;
        const cy = Math.random() * CONFIG.worldHeight;
        const clusterSize = Math.floor(Math.random() * 20) + 5; // 5 to 25 items per cluster
        
        for(let j=0; j<clusterSize; j++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 150; // Spread radius
            const fx = clamp(cx + Math.cos(angle) * dist, 0, CONFIG.worldWidth);
            const fy = clamp(cy + Math.sin(angle) * dist, 0, CONFIG.worldHeight);
            foods.push(spawnFood({x: fx, y: fy}));
            placed++;
        }
    }
    
    foodRef.current = foods;
    rebuildFoodGrid();

    // Generate Bots
    const botNames = await generateBotNames(BOT_COUNT);
    const bots: Snake[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      bots.push(createBot(botNames[i % botNames.length] || `Bot ${i}`));
    }
    snakesRef.current = bots;

    isInitializedRef.current = true;
  }, [rebuildFoodGrid]);

  const spawnPlayer = useCallback(() => {
    const playerStart = randomPosition(CONFIG.worldWidth, CONFIG.worldHeight);
    
    const playerSnake: Snake = {
      id: playerIdRef.current,
      name: playerName || "You",
      body: [],
      angle: Math.random() * Math.PI * 2,
      targetAngle: 0,
      speed: CONFIG.baseSpeed,
      width: 28, 
      targetLength: CONFIG.baseLength,
      color: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)],
      secondaryColor: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)],
      skinType: SkinType.STRIPED,
      isBot: false,
      isDead: false,
      isBoosting: false,
      score: 0,
      hueShift: 0
    };

    // Pre-fill body so it doesn't start as a dot
    for (let i = 0; i < playerSnake.targetLength * 8; i++) {
        playerSnake.body.push({ x: playerStart.x, y: playerStart.y });
    }

    snakesRef.current = snakesRef.current.filter(s => s.id !== playerIdRef.current);
    snakesRef.current.push(playerSnake);
    
    cameraRef.current.x = playerStart.x;
    cameraRef.current.y = playerStart.y;
    cameraRef.current.zoom = 1;
    shakeRef.current = 0;
  }, [playerName]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      spawnPlayer();
    }
  }, [gameState, spawnPlayer]);

  const createBot = (name: string): Snake => {
      const start = randomPosition(CONFIG.worldWidth, CONFIG.worldHeight);
      const skin = Math.floor(Math.random() * 4) as SkinType; // Use all skin types
      
      const snake: Snake = {
        id: `bot-${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        body: [],
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        speed: CONFIG.baseSpeed,
        width: 25 + Math.random() * 15, // Varied sizes
        targetLength: CONFIG.baseLength + Math.floor(Math.random() * 80), // Start slightly longer
        color: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)],
        secondaryColor: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)],
        skinType: skin,
        isBot: true,
        isDead: false,
        isBoosting: false,
        score: Math.floor(Math.random() * 800),
        hueShift: Math.random() * 360
      };
      
      // Initialize body
      for (let i = 0; i < snake.targetLength * 5; i++) {
          snake.body.push({ 
              x: start.x - Math.cos(snake.angle) * i, 
              y: start.y - Math.sin(snake.angle) * i 
          });
      }
      return snake;
  };

  const spawnFood = (pos?: Point, value: number = 1, sizeMod: number = 1, glow: boolean = false): Food => {
    const p = pos || randomPosition(CONFIG.worldWidth, CONFIG.worldHeight);
    const isBig = !pos && Math.random() < 0.01; // Rare big food naturally
    const val = value * (isBig ? 15 : 1);
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: p.x,
      y: p.y,
      value: val,
      color: glow ? (Math.random() > 0.5 ? '#ffaa00' : '#ffffff') : (isBig ? '#ffffff' : SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)]),
      radius: (val > 5 ? 12 : (Math.random() * 3 + 4)) * sizeMod, 
      origX: p.x,
      origY: p.y,
      offset: Math.random() * Math.PI * 2
    };
  };

  const spawnDeathFood = (snake: Snake) => {
      const massToDrop = snake.score * 0.7; 
      const points = snake.body.length;
      if (points === 0) return;
      
      const player = snakesRef.current.find(s => s.id === playerIdRef.current);
      if (player && !player.isDead) {
          const dist = getDistance(snake.body[0], player.body[0]);
          if (dist < 1000 || snake.id === playerIdRef.current) {
               const intensity = Math.min(30, snake.width);
               shakeRef.current = intensity;
          }
      }

      // Drop food along the body spine
      const totalFood = Math.min(massToDrop, 800); 
      const step = Math.max(1, Math.floor(points / totalFood));
      
      const newFoods: Food[] = [];

      for(let i=0; i < points; i += step) {
          const pt = snake.body[i];
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (snake.width * 1.5); 
          const fx = pt.x + Math.cos(angle) * dist;
          const fy = pt.y + Math.sin(angle) * dist;
          
          const food = spawnFood({x: fx, y: fy}, 4 + Math.random()*8, 1.8, true);
          newFoods.push(food);

          if (Math.random() < 0.3) {
              particlesRef.current.push({
                  x: pt.x, y: pt.y,
                  vx: (Math.random() - 0.5) * 12, 
                  vy: (Math.random() - 0.5) * 12,
                  color: snake.color,
                  life: 25 + Math.random() * 15,
                  size: snake.width * 0.4
              });
          }
      }

      foodRef.current.push(...newFoods);
      const startIdx = foodRef.current.length - newFoods.length;
      newFoods.forEach((f, i) => addToGrid(startIdx + i, f, foodGridRef.current));
  };

  // ---------------- GAME LOOP ---------------- //
  const update = useCallback((time: number) => {
    const dtRaw = (time - lastTimeRef.current) / 16.67;
    const dt = Math.min(dtRaw, 2.0); 
    lastTimeRef.current = time;

    // Shake Decay
    if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    const snakes = snakesRef.current;
    const foods = foodRef.current;
    const player = snakes.find(s => s.id === playerIdRef.current);
    const isPlaying = gameState === GameState.PLAYING && player && !player.isDead;

    // --- 1. Process Snakes ---
    snakes.forEach(snake => {
      if (snake.isDead) return;

      // Scale Logic (Logarithmic growth like Slither)
      const scale = 1 + Math.log10(1 + snake.score / 150); 
      snake.width = 24 * scale;
      
      // Slither.io Physics: Turning radius increases with Size
      let turnFactor = 1.0 / (1.0 + (snake.width - 24) * 0.05);
      if (snake.isBoosting) turnFactor *= 0.75; 
      
      const currentTurnSpeed = CONFIG.baseTurnSpeed * turnFactor;
      
      // Input / AI
      if (snake.id === playerIdRef.current && isPlaying) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = mouseRef.current.x - cx;
        const dy = mouseRef.current.y - cy;
        snake.targetAngle = Math.atan2(dy, dx);
        
        snake.isBoosting = isMouseDownRef.current && snake.score > 10;
      } else {
        updateBot(snake, snakes);
      }

      // Movement
      snake.angle = lerpAngle(snake.angle, snake.targetAngle, currentTurnSpeed * dt);
      const speed = snake.isBoosting ? CONFIG.boostSpeed : CONFIG.baseSpeed;
      
      const head = snake.body[0];
      const moveDist = speed * dt;
      const nextX = head.x + Math.cos(snake.angle) * moveDist;
      const nextY = head.y + Math.sin(snake.angle) * moveDist;

      // World Border (Lethal)
      if (nextX < 0 || nextX > CONFIG.worldWidth || nextY < 0 || nextY > CONFIG.worldHeight) {
          snake.isDead = true; 
          spawnDeathFood(snake);
          if (snake.id === playerIdRef.current) {
              shakeRef.current = 20; 
              getGameOverCommentary(snake.score, "The World Border").then(msg => onGameOver(snake.score, msg));
          }
      } else {
          snake.body.unshift({ x: nextX, y: nextY });
      }

      // Tail Pruning (Maintain length based on score)
      // Visual Length needs to grow noticeably but not infinitely
      const targetPixelLength = 200 + (snake.score * 8); 
      
      let distAcc = 0;
      for(let i=0; i < snake.body.length - 1; i++) {
          distAcc += getDistance(snake.body[i], snake.body[i+1]);
          if (distAcc > targetPixelLength) {
              snake.body.length = i + 1;
              break;
          }
      }

      // Boost Cost
      if (snake.isBoosting) {
          if (Math.random() < 0.25 * dt) {
              const lostScore = Math.max(1, Math.floor(snake.score * 0.008));
              snake.score = Math.max(10, snake.score - lostScore);
              
              const tail = snake.body[snake.body.length - 1];
              const waste = {
                  id: `waste-${Math.random()}`,
                  x: tail.x + (Math.random()-0.5)*10,
                  y: tail.y + (Math.random()-0.5)*10,
                  value: lostScore, 
                  color: snake.color,
                  radius: 3 + Math.min(lostScore, 6),
                  origX: tail.x,
                  origY: tail.y,
                  offset: 0
              };
              
              foods.push(waste);
              addToGrid(foods.length - 1, waste, foodGridRef.current);
              
              if (Math.random() < 0.5) {
                particlesRef.current.push({
                    x: tail.x, y: tail.y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    color: '#fff',
                    life: 15,
                    size: 4
                });
              }
          }
      }
    });

    // --- 2. Collision Logic ---
    const indicesToRemove = new Set<number>();
    
    snakes.forEach(killer => {
      if (killer.isDead) return;
      const head = killer.body[0];
      const headRad = killer.width / 2;

      // A. Eat Food
      const nearbyIndices = getNearbyFoodIndices(head.x, head.y);
      for (const idx of nearbyIndices) {
          if (indicesToRemove.has(idx)) continue;
          const f = foods[idx];
          if (!f) continue; 

          const dist = getDistance(head, f);
          const pullDist = headRad + f.radius + 100; // Magnetic pull radius
          
          if (dist < pullDist) {
              const pullStrength = 0.3 * dt;
              f.x += (head.x - f.x) * pullStrength;
              f.y += (head.y - f.y) * pullStrength;
              
              if (dist < headRad + f.radius) {
                  killer.score += f.value;
                  killer.hueShift += 1;
                  indicesToRemove.add(idx);
                  
                  if (Math.random() > 0.8) {
                    particlesRef.current.push({
                        x: f.x, y: f.y,
                        vx: 0, vy: 0,
                        color: f.color,
                        life: 10,
                        size: f.radius * 1.5
                    });
                  }
              }
          }
      }

      // B. Hit Snakes
      snakes.forEach(victim => {
          if (victim.isDead || killer.id === victim.id) return;
          
          // Optimization: Bounds check
          if (Math.abs(head.x - victim.body[0].x) > 3000) return; 

          // Hitbox logic: Slither uses a tighter hitbox than the visual body
          const crashRad = killer.width * 0.4; // Tighter head hitbox
          
          // Check segments
          const stride = 2; 
          let crashed = false;

          for(let i = 0; i < victim.body.length; i += stride) {
               const seg = victim.body[i];
               const dist = getDistance(head, seg);
               
               // The body hitbox is forgiving
               const bodyRad = victim.width * 0.45; 
               
               if (dist < crashRad + bodyRad) {
                   crashed = true;
                   break;
               }
          }

          if (crashed) {
               killer.isDead = true;
               spawnDeathFood(killer);
               
               if (killer.id === playerIdRef.current && isPlaying) {
                   getGameOverCommentary(killer.score, victim.name).then(msg => {
                       onGameOver(killer.score, msg);
                   });
               }
          }
      });
    });

    if (indicesToRemove.size > 0) {
        const keptFoods: Food[] = [];
        for(let i=0; i<foods.length; i++) {
            if(!indicesToRemove.has(i)) keptFoods.push(foods[i]);
        }
        foodRef.current = keptFoods;
        rebuildFoodGrid();
    }

    // --- 3. Respawn ---
    for(let i = snakesRef.current.length - 1; i >= 0; i--) {
        if(snakesRef.current[i].isDead) snakesRef.current.splice(i, 1);
    }
    
    // Bot Respawn
    if (snakesRef.current.length < BOT_COUNT) {
         generateBotNames(2).then(names => {
             names.forEach(n => snakesRef.current.push(createBot(n)));
         });
    }
    
    // Food Respawn - Cluster logic for respawn too
    if (foodRef.current.length < INITIAL_FOOD_COUNT) {
        const needed = INITIAL_FOOD_COUNT - foodRef.current.length;
        // Spawn a batch if low
        if (needed > 20) {
            const clusterCenter = randomPosition(CONFIG.worldWidth, CONFIG.worldHeight);
            const size = Math.floor(Math.random() * 8) + 3;
            for(let k=0; k<size; k++) {
                 const angle = Math.random() * Math.PI * 2;
                 const dist = Math.random() * 80;
                 const f = spawnFood({
                     x: clamp(clusterCenter.x + Math.cos(angle)*dist, 0, CONFIG.worldWidth),
                     y: clamp(clusterCenter.y + Math.sin(angle)*dist, 0, CONFIG.worldHeight)
                 });
                 foodRef.current.push(f);
                 addToGrid(foodRef.current.length-1, f, foodGridRef.current);
            }
        }
    }

    // Update Particles
    for(let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.size *= 0.90;
        if (p.life <= 0 || p.size < 0.5) particlesRef.current.splice(i, 1);
    }

    // --- 4. Camera Zoom Logic ---
    if (isPlaying && player) {
       const cam = cameraRef.current;
       // Smooth camera follow
       cam.x += (player.body[0].x - cam.x) * 0.08 * dt;
       cam.y += (player.body[0].y - cam.y) * 0.08 * dt;
       
       // Logarithmic zoom calculation (Slither exact)
       // Base zoom is 1.0. Large snakes drop to 0.4 or lower.
       const base = 28; // starting width
       const factor = (player.width - base) / 100; 
       const targetZoom = Math.max(0.1, 0.95 / (1 + factor * 2));
       
       cam.zoom += (targetZoom - cam.zoom) * 0.04 * dt;
       
       onScoreUpdate(Math.floor(player.score));
    } else {
       // Spectator Mode
       let target = snakesRef.current[0];
       let maxScore = -1;
       snakesRef.current.forEach(s => {
           if (s.score > maxScore) { maxScore = s.score; target = s; }
       });
       
       if (target && target.body.length > 0) {
           const cam = cameraRef.current;
           cam.x += (target.body[0].x - cam.x) * 0.05 * dt;
           cam.y += (target.body[0].y - cam.y) * 0.05 * dt;
           const factor = (target.width - 28) / 100;
           const targetZoom = Math.max(0.15, 0.8 / (1 + factor * 1.5));
           cam.zoom += (targetZoom - cam.zoom) * 0.05 * dt;
       }
    }

    render();
    animationFrameRef.current = requestAnimationFrame(update);
  }, [gameState, onGameOver, onScoreUpdate, createBot, rebuildFoodGrid, getNearbyFoodIndices]);


  // Improved Bot AI
  const updateBot = (bot: Snake, snakes: Snake[]) => {
      const head = bot.body[0];
      const lookDist = 200 + bot.width * 3;
      
      const nextX = head.x + Math.cos(bot.angle) * lookDist;
      const nextY = head.y + Math.sin(bot.angle) * lookDist;
      
      // 1. World Boundaries (Panic turn)
      if (nextX < 150 || nextX > CONFIG.worldWidth - 150 || nextY < 150 || nextY > CONFIG.worldHeight - 150) {
          const centerX = CONFIG.worldWidth / 2;
          const centerY = CONFIG.worldHeight / 2;
          const angleToCenter = Math.atan2(centerY - head.y, centerX - head.x);
          bot.targetAngle = angleToCenter;
          bot.isBoosting = true;
          return;
      }

      // 2. Scan for Threats & Targets
      let danger = false;
      let targetFood: Food | null = null;
      let closestSnakeDist = 9999;
      let closestSnake: Snake | null = null;

      // Check snakes
      for(const other of snakes) {
          if (other.id === bot.id) continue;
          
          const dToOtherHead = getDistance(head, other.body[0]);
          if (dToOtherHead < closestSnakeDist) {
              closestSnakeDist = dToOtherHead;
              closestSnake = other;
          }

          if (dToOtherHead > 800) continue; 
          
          // Collision Avoidance
          // Check future head position against all body parts of 'other'
          // Optimization: check steps
          for(let i=0; i<other.body.length; i+=10) {
              const d = getDistance({x: nextX, y: nextY}, other.body[i]);
              if (d < other.width + bot.width + 100) {
                  danger = true;
                  break;
              }
          }
          if (danger) break;
      }

      if (danger) {
          // Sharp turn away (plus some randomness so they don't loop perfectly predictable)
          bot.targetAngle += Math.PI * 0.8 + (Math.random() - 0.5);
          bot.isBoosting = true;
      } else {
          bot.isBoosting = false;

          // INTERCEPT LOGIC (Slither-like aggression)
          if (closestSnake && closestSnakeDist < 600 && bot.width > closestSnake.width) {
               // Predict future position of prey
               const preyAngle = closestSnake.angle;
               const interceptDist = 150;
               const targetX = closestSnake.body[0].x + Math.cos(preyAngle) * interceptDist;
               const targetY = closestSnake.body[0].y + Math.sin(preyAngle) * interceptDist;
               
               bot.targetAngle = Math.atan2(targetY - head.y, targetX - head.x);
               
               // Sprint if lined up
               const diff = Math.abs(bot.angle - bot.targetAngle);
               if (diff < 0.2) bot.isBoosting = true; 
          }
          // Scavenger Logic: Find food
          else {
               // Find closest big food or cluster
               let bestVal = 0;
               const nearbyIndices = getNearbyFoodIndices(head.x, head.y);
               // Look a bit further for food
               const scanRadius = 400;
               
               for(const idx of nearbyIndices) {
                   const f = foodRef.current[idx];
                   if (!f) continue;
                   const d = getDistance(head, f);
                   if (d < scanRadius && f.value > bestVal) {
                       bestVal = f.value;
                       targetFood = f;
                   }
               }
               
               if (targetFood) {
                   bot.targetAngle = Math.atan2(targetFood.y - head.y, targetFood.x - head.x);
               } else {
                   // Center drift (The Pit)
                   const centerX = CONFIG.worldWidth / 2;
                   const centerY = CONFIG.worldHeight / 2;
                   const distToCenter = getDistance(head, {x: centerX, y: centerY});
                   
                   // Bots naturally gravitate to center over time
                   if (Math.random() < 0.02) {
                        bot.targetAngle = Math.atan2(centerY - head.y, centerX - head.x) + (Math.random()-0.5);
                   } else if (Math.random() < 0.05) {
                       // Wiggle
                       bot.targetAngle += (Math.random() - 0.5) * 1.5;
                   }
               }
          }
      }
  };


  // ---------------- RENDER ---------------- //
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { width, height } = canvas;
    const { x: camX, y: camY, zoom } = cameraRef.current;

    // Viewport Culling
    const viewW = width / zoom;
    const viewH = height / zoom;
    const viewL = camX - viewW/2 - 200;
    const viewR = camX + viewW/2 + 200;
    const viewT = camY - viewH/2 - 200;
    const viewB = camY + viewH/2 + 200;

    const shakeX = (Math.random() - 0.5) * shakeRef.current;
    const shakeY = (Math.random() - 0.5) * shakeRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#161c22'; 
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // 1. Background (Parallax Hexagons)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#202630'; 
    
    const r = 50; 
    const h = r * Math.sqrt(3);
    const startX = Math.floor(viewL / (r * 3)) * (r * 3) - r*3;
    const endX = viewR + r * 3;
    const startY = Math.floor(viewT / h) * h - h;
    const endY = viewB + h;

    ctx.beginPath();
    for (let x = startX; x < endX; x += r * 3) {
        for (let y = startY; y < endY; y += h) {
            const cx = x + (Math.floor(y/h) % 2 === 0 ? 0 : r * 1.5);
            const cy = y;
            // Hexagon path
            ctx.moveTo(cx + r, cy);
            ctx.lineTo(cx + r * 0.5, cy + h * 0.5);
            ctx.lineTo(cx - r * 0.5, cy + h * 0.5);
            ctx.lineTo(cx - r, cy);
            ctx.lineTo(cx - r * 0.5, cy - h * 0.5);
            ctx.lineTo(cx + r * 0.5, cy - h * 0.5);
            ctx.closePath();
        }
    }
    ctx.stroke();

    ctx.strokeStyle = '#600000'; // Dark red border
    ctx.lineWidth = 100;
    ctx.strokeRect(-50, -50, CONFIG.worldWidth+100, CONFIG.worldHeight+100);

    // 2. Food
    const time = Date.now() * 0.005;
    const foods = foodRef.current;
    
    // Batch draw food
    for(let i=0; i<foods.length; i++) {
        const f = foods[i];
        if (f.x < viewL || f.x > viewR || f.y < viewT || f.y > viewB) continue;
        
        ctx.beginPath();
        const r = f.radius + Math.sin(time + f.offset) * 1.0;
        
        ctx.fillStyle = f.color;
        // Optimization: Only glow high value food to save performance
        if (f.value > 5 && zoom > 0.4) {
             ctx.shadowColor = f.color;
             ctx.shadowBlur = 10;
        }
        
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Inner shine
        if (zoom > 0.3) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(f.x - r*0.2, f.y - r*0.2, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3. SNAKE RENDERING - DUAL PASS
    // This gives the "stacked" effect where bodies float over shadows
    
    // Pre-calculate visible snakes
    const visibleSnakes: {snake: Snake, points: Point[]}[] = [];
    snakesRef.current.forEach(s => {
        const head = s.body[0];
        // Loose culling bound
        if (head.x < viewL - 1000 || head.x > viewR + 1000 || head.y < viewT - 1000 || head.y > viewB + 1000) return;
        
        // Interpolate points for smooth spine
        const points: Point[] = [];
        const gap = s.width * 0.20; 
        let acc = 0;
        points.push(s.body[0]);
        for(let i=0; i<s.body.length - 1; i++) {
            const p1 = s.body[i];
            const p2 = s.body[i+1];
            const d = getDistance(p1, p2);
            acc += d;
            while(acc >= gap) {
                const t = 1 - (acc - gap) / d; 
                points.push({
                   x: p1.x * (1-t) + p2.x * t,
                   y: p1.y * (1-t) + p2.y * t
                }); 
                acc -= gap;
            }
        }
        visibleSnakes.push({snake: s, points});
    });

    // PASS 1: Shadows
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    visibleSnakes.forEach(({snake, points}) => {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.lineWidth = snake.width; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; // The physical shadow stroke
        
        ctx.moveTo(points[0].x, points[0].y);
        // Optimization: Draw every 2nd point for shadow to be faster
        for(let i=1; i<points.length; i+=2) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
    });
    
    ctx.shadowBlur = 0; // Reset for bodies

    // PASS 2: Bodies
    // Helper to draw a single snake body
    const drawSnakeBody = (s: Snake, points: Point[]) => {
        if (points.length === 0) return;

        // Draw from TAIL to HEAD
        for (let i = points.length - 1; i >= 0; i--) {
             const pt = points[i];
             
             // Taper tail
             let rad = s.width / 2;
             if (i > points.length - 8) rad *= (points.length - i) / 8;

             ctx.beginPath();
             ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);

             // Skin Logic
             if (s.skinType === SkinType.RAINBOW) {
                 const hue = (s.hueShift + i * 8) % 360;
                 ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
             } else if (s.skinType === SkinType.STRIPED) {
                 const band = Math.floor(i / 5) % 2;
                 ctx.fillStyle = band === 0 ? s.color : s.secondaryColor;
             } else if (s.skinType === SkinType.PIXEL) {
                  // Checkered pattern
                  const band = (Math.floor(i/3) + (i%2)) % 2;
                  ctx.fillStyle = band === 0 ? s.color : '#222';
             } else {
                 ctx.fillStyle = s.color;
             }
             ctx.fill();
        }

        // Draw Head / Eyes
        const h = points[0];
        ctx.save();
        ctx.translate(h.x, h.y);
        
        let lookAngle = s.targetAngle - s.angle;
        // Normalize angle
        while (lookAngle <= -Math.PI) lookAngle += Math.PI*2;
        while (lookAngle > Math.PI) lookAngle -= Math.PI*2;
        lookAngle = clamp(lookAngle, -0.7, 0.7); // Limit eye tracking range

        ctx.rotate(s.angle);
        
        const eyeOffsetX = s.width * 0.35;
        const eyeOffsetY = s.width * 0.3;
        const eyeSize = s.width * 0.28;
        
        // Sclera
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.arc(eyeOffsetX, -eyeOffsetY, eyeSize, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pupil
        ctx.fillStyle = '#000';
        const pupilDist = eyeSize * 0.4;
        const px = Math.cos(lookAngle) * pupilDist;
        const py = Math.sin(lookAngle) * pupilDist;
        
        ctx.beginPath();
        ctx.arc(eyeOffsetX + px + 1, -eyeOffsetY + py, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX + px + 1, eyeOffsetY + py, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Name
        if (zoom > 0.35) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = `bold ${Math.max(10, s.width * 0.5)}px Arial`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5;
            ctx.strokeText(s.name, h.x, h.y - s.width - 5);
            ctx.fillText(s.name, h.x, h.y - s.width - 5);
        }
    };

    // Render other snakes
    visibleSnakes.forEach(({snake, points}) => {
        if (snake.id !== playerIdRef.current) drawSnakeBody(snake, points);
    });

    // Render Player last (on top)
    const playerEntry = visibleSnakes.find(e => e.snake.id === playerIdRef.current);
    if (playerEntry) drawSnakeBody(playerEntry.snake, playerEntry.points);

    // Particles (Top Layer)
    for(let i=0; i<particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        if (p.x < viewL || p.x > viewR || p.y < viewT || p.y > viewB) continue;

        ctx.globalAlpha = clamp(p.life / 10, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // -- UI Layers --
    // Minimap
    const mapSize = 140;
    const mapPad = 20;
    const mapX = width - mapSize - mapPad;
    const mapY = height - mapSize - mapPad;
    
    ctx.fillStyle = 'rgba(20, 30, 40, 0.65)';
    ctx.beginPath();
    ctx.arc(mapX + mapSize/2, mapY + mapSize/2, mapSize/2, 0, Math.PI*2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();

    snakesRef.current.forEach(s => {
        if (s.isDead) return;
        const rx = s.body[0].x / CONFIG.worldWidth;
        const ry = s.body[0].y / CONFIG.worldHeight;
        
        const mx = mapX + rx * mapSize;
        const my = mapY + ry * mapSize;
        
        if (s.id === playerIdRef.current) {
             ctx.fillStyle = '#fff';
             ctx.beginPath();
             ctx.arc(mx, my, 4, 0, Math.PI*2);
             ctx.fill();
             // Pulse
             ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(Date.now()*0.01)*0.3})`;
             ctx.beginPath();
             ctx.arc(mx, my, 8, 0, Math.PI*2);
             ctx.fill();
        } else if (s.width > 30) { 
             ctx.fillStyle = '#aaa';
             ctx.beginPath();
             ctx.arc(mx, my, 2.5, 0, Math.PI*2);
             ctx.fill();
        }
    });

    // Leaderboard
    const lbW = 200;
    const lbX = width - lbW - 10;
    const lbY = 10;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(lbX, lbY, lbW, 280, 8);
    ctx.fill();
    
    ctx.fillStyle = '#ddd';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Leaderboard', width - 20, 35);
    
    const topSnakes = [...snakesRef.current].sort((a,b) => b.score - a.score).slice(0, 10);
    topSnakes.forEach((s, i) => {
        const isMe = s.id === playerIdRef.current;
        ctx.fillStyle = isMe ? '#fff' : '#aaa';
        if (isMe) ctx.font = 'bold 14px sans-serif';
        else ctx.font = '13px sans-serif';
        
        let n = s.name.substring(0, 14);
        ctx.fillText(`${i+1}. ${n}   ${Math.floor(s.score)}`, width - 20, 65 + i * 22);
    });
  };

  useEffect(() => {
      initWorld();
      
      const handleResize = () => {
        if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
        }
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      };
      const handleMouseDown = () => isMouseDownRef.current = true;
      const handleMouseUp = () => isMouseDownRef.current = false;
      const handleTouchStart = (e: TouchEvent) => {
          isMouseDownRef.current = true;
          mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };
      const handleTouchMove = (e: TouchEvent) => {
          mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };
      const handleTouchEnd = () => isMouseDownRef.current = false;

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);

      animationFrameRef.current = requestAnimationFrame(update);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        cancelAnimationFrame(animationFrameRef.current);
      };
  }, [update, initWorld]);

  return <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />;
};

export default GameCanvas;