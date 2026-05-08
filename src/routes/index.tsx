import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

type Vec = { x: number; y: number };
type Bullet = Vec & { vx: number; vy: number; life: number };
type EnemyKind = "grunt" | "slow" | "tank";
type Enemy = Vec & {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number; // dps on contact
  reward: number; // score on kill
  color: string;
};

const ENEMY_DEFS: Record<EnemyKind, Omit<Enemy, "x" | "y" | "hp" | "kind">> = {
  grunt: {
    maxHp: 2,
    speed: 90,
    radius: 14,
    damage: 30,
    reward: 1,
    color: "#e3433b",
  },
  slow: {
    // resistente a meio caminho, devagar, pouco dano
    maxHp: 5,
    speed: 45,
    radius: 16,
    damage: 18,
    reward: 3,
    color: "#9b6bff",
  },
  tank: {
    // muito HP, bem lento, dano alto
    maxHp: 12,
    speed: 30,
    radius: 22,
    damage: 50,
    reward: 8,
    color: "#3a7d44",
  },
};

const WORLD_W = 1600;
const WORLD_H = 1000;
const PLAYER_SPEED = 220; // px/s
const BULLET_SPEED = 900;
const MAG_SIZE = 30;
const RELOAD_MS = 1500;
const FIRE_RATE_MS = 90;

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [ammo, setAmmo] = useState(MAG_SIZE);
  const [reloading, setReloading] = useState(false);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // refs hold mutable game state without rerenders
  const keys = useRef<Record<string, boolean>>({});
  const mouse = useRef<Vec>({ x: 0, y: 0 });
  const firing = useRef(false);
  const lastShot = useRef(0);
  const reloadTimer = useRef<number | null>(null);
  const player = useRef<Vec>({ x: WORLD_W / 2, y: WORLD_H / 2 });
  const bullets = useRef<Bullet[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const spawnAcc = useRef(0);
  const ammoRef = useRef(MAG_SIZE);
  const reloadingRef = useRef(false);
  const hpRef = useRef(100);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);
  useEffect(() => {
    reloadingRef.current = reloading;
  }, [reloading]);
  useEffect(() => {
    runningRef.current = running && !gameOver;
  }, [running, gameOver]);

  const startReload = () => {
    if (reloadingRef.current || ammoRef.current === MAG_SIZE) return;
    setReloading(true);
    reloadTimer.current = window.setTimeout(() => {
      setAmmo(MAG_SIZE);
      setReloading(false);
      reloadTimer.current = null;
    }, RELOAD_MS);
  };

  const resetGame = () => {
    player.current = { x: WORLD_W / 2, y: WORLD_H / 2 };
    bullets.current = [];
    enemies.current = [];
    spawnAcc.current = 0;
    hpRef.current = 100;
    scoreRef.current = 0;
    setHp(100);
    setScore(0);
    setAmmo(MAG_SIZE);
    setReloading(false);
    if (reloadTimer.current) {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    }
    setGameOver(false);
    setRunning(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      keys.current[e.key.toLowerCase()] = down;
      if (down && e.key.toLowerCase() === "r") startReload();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) firing.current = true;
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("contextmenu", onContext);

    let last = performance.now();
    let raf = 0;

    const shoot = (now: number) => {
      if (now - lastShot.current < FIRE_RATE_MS) return;
      if (reloadingRef.current) return;
      if (ammoRef.current <= 0) {
        startReload();
        return;
      }
      lastShot.current = now;
      const cam = getCam();
      const wx = mouse.current.x + cam.x;
      const wy = mouse.current.y + cam.y;
      const dx = wx - player.current.x;
      const dy = wy - player.current.y;
      const len = Math.hypot(dx, dy) || 1;
      // small spread
      const spread = 0.04;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread * 2;
      bullets.current.push({
        x: player.current.x,
        y: player.current.y,
        vx: Math.cos(ang) * BULLET_SPEED,
        vy: Math.sin(ang) * BULLET_SPEED,
        life: 1.2,
      });
      setAmmo((a) => {
        const n = a - 1;
        if (n <= 0) startReload();
        return n;
      });
      // suppress unused warning
      void len;
    };

    const getCam = (): Vec => {
      const cx = player.current.x - canvas.width / 2;
      const cy = player.current.y - canvas.height / 2;
      return {
        x: Math.max(0, Math.min(WORLD_W - canvas.width, cx)),
        y: Math.max(0, Math.min(WORLD_H - canvas.height, cy)),
      };
    };

    const spawnEnemy = () => {
      // spawn at random edge
      const side = Math.floor(Math.random() * 4);
      let x = 0,
        y = 0;
      if (side === 0) {
        x = Math.random() * WORLD_W;
        y = 0;
      } else if (side === 1) {
        x = WORLD_W;
        y = Math.random() * WORLD_H;
      } else if (side === 2) {
        x = Math.random() * WORLD_W;
        y = WORLD_H;
      } else {
        x = 0;
        y = Math.random() * WORLD_H;
      }
      // weighted pick: mais grunts no início, slow/tank ficam comuns conforme a partida
      const s = scoreRef.current;
      const wGrunt = 70;
      const wSlow = Math.min(35, 8 + s * 0.6);
      const wTank = Math.min(20, 2 + s * 0.4);
      const total = wGrunt + wSlow + wTank;
      const r = Math.random() * total;
      const kind: EnemyKind =
        r < wGrunt ? "grunt" : r < wGrunt + wSlow ? "slow" : "tank";
      const def = ENEMY_DEFS[kind];
      enemies.current.push({
        x,
        y,
        kind,
        hp: def.maxHp,
        maxHp: def.maxHp,
        // pequena variação de velocidade para não andarem em bloco
        speed: def.speed * (0.9 + Math.random() * 0.2),
        radius: def.radius,
        damage: def.damage,
        reward: def.reward,
        color: def.color,
      });
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (runningRef.current) {
        // movement
        let mx = 0,
          my = 0;
        if (keys.current["w"] || keys.current["arrowup"]) my -= 1;
        if (keys.current["s"] || keys.current["arrowdown"]) my += 1;
        if (keys.current["a"] || keys.current["arrowleft"]) mx -= 1;
        if (keys.current["d"] || keys.current["arrowright"]) mx += 1;
        const ml = Math.hypot(mx, my);
        if (ml > 0) {
          mx /= ml;
          my /= ml;
        }
        player.current.x = Math.max(
          16,
          Math.min(WORLD_W - 16, player.current.x + mx * PLAYER_SPEED * dt),
        );
        player.current.y = Math.max(
          16,
          Math.min(WORLD_H - 16, player.current.y + my * PLAYER_SPEED * dt),
        );

        if (firing.current) shoot(now);

        // spawn
        spawnAcc.current += dt;
        const spawnInterval = Math.max(0.3, 1.5 - scoreRef.current * 0.01);
        while (spawnAcc.current >= spawnInterval) {
          spawnAcc.current -= spawnInterval;
          spawnEnemy();
        }

        // bullets
        for (const b of bullets.current) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
        }
        bullets.current = bullets.current.filter(
          (b) =>
            b.life > 0 &&
            b.x >= 0 &&
            b.x <= WORLD_W &&
            b.y >= 0 &&
            b.y <= WORLD_H,
        );

        // enemies
        for (const e of enemies.current) {
          const dx = player.current.x - e.x;
          const dy = player.current.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * e.speed * dt;
          e.y += (dy / d) * e.speed * dt;
          if (d < e.radius + 8) {
            hpRef.current -= e.damage * dt;
            setHp(Math.max(0, Math.round(hpRef.current)));
          }
        }

        // collisions bullet/enemy
        for (const b of bullets.current) {
          for (const e of enemies.current) {
            if (e.hp <= 0) continue;
            const dd = Math.hypot(b.x - e.x, b.y - e.y);
            if (dd < e.radius + 2) {
              e.hp -= 1;
              b.life = 0;
              if (e.hp <= 0) {
                scoreRef.current += e.reward;
                setScore(scoreRef.current);
              }
            }
          }
        }
        enemies.current = enemies.current.filter((e) => e.hp > 0);

        if (hpRef.current <= 0) {
          runningRef.current = false;
          setRunning(false);
          setGameOver(true);
        }
      }

      // RENDER
      const cam = getCam();
      ctx.fillStyle = "#0f1115";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const gs = 64;
      const ox = -((cam.x % gs) + gs) % gs;
      const oy = -((cam.y % gs) + gs) % gs;
      for (let x = ox; x < canvas.width; x += gs) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = oy; y < canvas.height; y += gs) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // world bounds
      ctx.strokeStyle = "rgba(255,140,0,0.5)";
      ctx.lineWidth = 3;
      ctx.strokeRect(-cam.x, -cam.y, WORLD_W, WORLD_H);

      // enemies
      for (const e of enemies.current) {
        const x = e.x - cam.x;
        const y = e.y - cam.y;
        // tank ganha um anel de armadura; slow um halo roxo
        if (e.kind === "tank") {
          ctx.strokeStyle = "#1a1a1a";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, e.radius + 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.kind === "slow") {
          ctx.fillStyle = "rgba(155,107,255,0.18)";
          ctx.beginPath();
          ctx.arc(x, y, e.radius + 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x, y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        // health bar
        const bw = e.radius * 2;
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x - e.radius, y - e.radius - 8, bw, 4);
        ctx.fillStyle = "#3ddc84";
        ctx.fillRect(
          x - e.radius,
          y - e.radius - 8,
          (bw * e.hp) / e.maxHp,
          4,
        );
      }

      // bullets
      ctx.fillStyle = "#ffd54a";
      for (const b of bullets.current) {
        ctx.beginPath();
        ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // player
      const px = player.current.x - cam.x;
      const py = player.current.y - cam.y;
      const ang = Math.atan2(
        mouse.current.y - py,
        mouse.current.x - px,
      );
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      // body
      ctx.fillStyle = "#4ea8ff";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      // gun
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(8, -3, 18, 6);
      ctx.restore();

      // crosshair
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      const cx = mouse.current.x;
      const cy = mouse.current.y;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx - 3, cy);
      ctx.moveTo(cx + 3, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy - 3);
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();

      // start overlay text
      if (!runningRef.current && !gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          "Clique em INICIAR para começar",
          canvas.width / 2,
          canvas.height / 2,
        );
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("contextmenu", onContext);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center gap-3">
      <header className="w-full max-w-5xl flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Arena Shooter — estilo CS
        </h1>
        <div className="flex gap-2">
          {!running || gameOver ? (
            <button
              onClick={resetGame}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              {gameOver ? "Jogar novamente" : "Iniciar"}
            </button>
          ) : (
            <button
              onClick={() => setRunning(false)}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-semibold hover:opacity-90"
            >
              Pausar
            </button>
          )}
        </div>
      </header>

      <div className="w-full max-w-5xl flex flex-wrap gap-4 text-sm">
        <Stat label="HP" value={`${hp}`} />
        <Stat label="Munição" value={`${ammo} / ${MAG_SIZE}`} />
        <Stat label="Score" value={`${score}`} />
        <Stat
          label="Status"
          value={
            gameOver
              ? "GAME OVER"
              : reloading
                ? "Recarregando..."
                : running
                  ? "Em jogo"
                  : "Pausado"
          }
        />
      </div>

      <div
        className="w-full max-w-5xl rounded-lg overflow-hidden border border-border"
        style={{ aspectRatio: "16 / 10" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-5xl">
        <strong>WASD</strong> para mover · <strong>Mouse</strong> para mirar ·{" "}
        <strong>Clique esquerdo</strong> para atirar (segure para rajada) ·{" "}
        <strong>R</strong> para recarregar
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-md bg-card border border-border min-w-[110px]">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
