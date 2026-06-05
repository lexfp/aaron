// Each theme: bgDraw(ctx, W, H, camX, t), platColor, platTopColor, platSide, accentColor, groundColor
export const STAGE_THEMES = [
  // 1: Meadow
  {
    name: 'Meadow',
    spikeColor: '#8a5a2b',
    accentColor: '#2ecc71',
    platColor: '#4a9c3f',
    platTopColor: '#6dce5e',
    platSide: '#357a2e',
    groundColor: '#357a2e',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#4fc3f7');
      sky.addColorStop(1, '#b3e5fc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const offsets = [[60, 70, 70, 22], [220, 100, 90, 26], [450, 60, 65, 18], [640, 85, 80, 24], [-80, 110, 60, 20]];
      for (const [bx, by, bw, bh] of offsets) {
        const cx = ((bx - camX * 0.18 + W * 3) % (W + 200)) - 100;
        drawCloud(ctx, cx, by, bw, bh);
      }
      // Ground strip
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, H - 35, W, 35);
    },
  },
  // 2: Cave
  {
    name: 'Cave',
    spikeColor: '#8d8d99',
    accentColor: '#e67e22',
    platColor: '#5a5a5a',
    platTopColor: '#7a7a7a',
    platSide: '#3a3a3a',
    groundColor: '#2a2a2a',
    bgDraw(ctx, W, H, camX, t) {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
      // Stalactites
      ctx.fillStyle = '#222230';
      for (let i = 0; i < 9; i++) {
        const sx = ((i * 110 - camX * 0.08 % (W + 100) + W * 3) % (W + 110)) - 55;
        const sh = 35 + (i * 19 % 55);
        ctx.beginPath();
        ctx.moveTo(sx - 13, 0); ctx.lineTo(sx + 13, 0); ctx.lineTo(sx, sh);
        ctx.closePath(); ctx.fill();
      }
      // Torch glows
      for (let i = 0; i < 4; i++) {
        const tx = ((i * 260 + 80 - camX * 0.25 + W * 3) % (W + 200)) - 100;
        const flicker = 0.7 + Math.sin(t * 9 + i * 2.1) * 0.3;
        const g = ctx.createRadialGradient(tx, H * 0.65, 0, tx, H * 0.65, 80 * flicker);
        g.addColorStop(0, `rgba(255,140,40,${0.18 * flicker})`);
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(tx - 90, H * 0.65 - 90, 180, 180);
      }
    },
  },
  // 3: Icy Peaks
  {
    name: 'Icy Peaks',
    spikeColor: '#aee3ff',
    accentColor: '#74b9ff',
    platColor: '#8ec8e8',
    platTopColor: '#b8e0f8',
    platSide: '#60a0c0',
    groundColor: '#60a0c0',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#b0d8f8'); sky.addColorStop(1, '#e0f0ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Mountains
      ctx.fillStyle = '#d4edf8';
      for (let i = 0; i < 7; i++) {
        const mx = ((i * 160 - camX * 0.12 + W * 3) % (W + 200)) - 100;
        const mh = H * 0.35 + (i * 23 % 60);
        ctx.beginPath();
        ctx.moveTo(mx - 80, H); ctx.lineTo(mx, H - mh); ctx.lineTo(mx + 80, H);
        ctx.closePath(); ctx.fill();
      }
      // Snow particles
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 71 + t * 25 - camX * 0.04 + W * 3) % (W + 20)) - 10;
        const sy = (i * 47 + t * 18 * (i % 3 + 1) * 0.4) % H;
        ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    },
  },
  // 4: Desert Ruins
  {
    name: 'Desert Ruins',
    spikeColor: '#4e9a3e',
    accentColor: '#f39c12',
    platColor: '#c8a05a',
    platTopColor: '#dbb870',
    platSide: '#a07840',
    groundColor: '#a07840',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#e8921a'); sky.addColorStop(0.5, '#f8c870'); sky.addColorStop(1, '#e0b050');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Sun
      ctx.fillStyle = '#fff5c0';
      ctx.beginPath(); ctx.arc(W * 0.82, 55, 32, 0, Math.PI * 2); ctx.fill();
      // Dunes
      ctx.fillStyle = '#c8a04a';
      for (let i = 0; i < 5; i++) {
        const dx = ((i * 220 - camX * 0.2 + W * 3) % (W + 300)) - 150;
        ctx.beginPath(); ctx.ellipse(dx, H + 15, 150, 55, 0, Math.PI, 0); ctx.fill();
      }
    },
  },
  // 5: Lava Realm
  {
    name: 'Lava Realm',
    spikeColor: '#ff7b29',
    accentColor: '#e74c3c',
    platColor: '#3d1a1a',
    platTopColor: '#5a2828',
    platSide: '#250a0a',
    groundColor: '#1a0808',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#120000'); sky.addColorStop(0.6, '#3a0808'); sky.addColorStop(1, '#6a1010');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Lava glow bottom
      const lavaG = ctx.createLinearGradient(0, H - 70, 0, H);
      lavaG.addColorStop(0, 'rgba(255,80,0,0)');
      lavaG.addColorStop(1, `rgba(255,${90 + Math.sin(t * 2) * 20},0,0.45)`);
      ctx.fillStyle = lavaG; ctx.fillRect(0, H - 70, W, 70);
      // Embers rising
      for (let i = 0; i < 18; i++) {
        const ex = ((i * 79 + t * 35 * (i % 4 + 1) - camX * 0.08 + W * 3) % (W + 40)) - 20;
        const progress = ((t * 55 * (i % 4 + 1) + i * 130) % H) / H;
        const ey = H - progress * H;
        ctx.globalAlpha = Math.max(0, 0.9 - progress);
        ctx.fillStyle = `rgb(255,${140 + i * 5},0)`;
        ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
  // 6: Sky Kingdom
  {
    name: 'Sky Kingdom',
    spikeColor: '#e8ecff',
    accentColor: '#f0e0ff',
    platColor: '#d8d8e8',
    platTopColor: '#f0f0ff',
    platSide: '#b0b0cc',
    groundColor: '#a0a0c0',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1a6fd8'); sky.addColorStop(1, '#82b8f0');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Large cloud platforms (decorative)
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const clouds = [[50, 90, 100, 30], [250, 130, 80, 25], [480, 70, 110, 35], [700, 110, 90, 28], [-60, 150, 75, 22]];
      for (const [bx, by, bw, bh] of clouds) {
        const cx = ((bx - camX * 0.28 + W * 3) % (W + 230)) - 115;
        drawCloud(ctx, cx, by, bw, bh);
      }
    },
  },
  // 7: Deep Forest
  {
    name: 'Deep Forest',
    spikeColor: '#5a8f3c',
    accentColor: '#27ae60',
    platColor: '#4a2e10',
    platTopColor: '#2e7d32',
    platSide: '#2a1a08',
    groundColor: '#1a1008',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#071a07'); sky.addColorStop(1, '#0d2a0d');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Far trees
      ctx.fillStyle = '#0a1e0a';
      for (let i = 0; i < 10; i++) {
        const tx = ((i * 115 - camX * 0.08 + W * 3) % (W + 100)) - 50;
        drawTree(ctx, tx, H, 18, 65);
      }
      // Near trees
      ctx.fillStyle = '#133a13';
      for (let i = 0; i < 7; i++) {
        const tx = ((i * 155 + 55 - camX * 0.35 + W * 3) % (W + 160)) - 80;
        drawTree(ctx, tx, H, 28, 95);
      }
      // Fireflies
      for (let i = 0; i < 12; i++) {
        const fx = ((i * 91 + t * 22 - camX * 0.05 + W * 3) % (W + 30)) - 15;
        const fy = H * 0.35 + Math.sin(t * 1.4 + i) * H * 0.22;
        const alpha = Math.max(0, 0.5 + Math.sin(t * 4.5 + i * 2.3) * 0.45);
        ctx.fillStyle = `rgba(180,255,80,${alpha})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2.8, 0, Math.PI * 2); ctx.fill();
      }
    },
  },
  // 8: Space Station
  {
    name: 'Space Station',
    spikeColor: '#46d5ff',
    accentColor: '#00d2ff',
    platColor: '#1e2a40',
    platTopColor: '#2e3e5a',
    platSide: '#0e1828',
    groundColor: '#080e18',
    bgDraw(ctx, W, H, camX, t) {
      ctx.fillStyle = '#030510'; ctx.fillRect(0, 0, W, H);
      // Stars
      for (let i = 0; i < 90; i++) {
        const sx = (i * 137 + 30) % W;
        const sy = (i * 91 + 15) % H;
        const alpha = 0.35 + (i % 6) * 0.1;
        ctx.fillStyle = `rgba(190,210,255,${alpha})`;
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1.5, i % 3 === 0 ? 2 : 1.5);
      }
      // Nebula
      const neb = ctx.createRadialGradient(W * 0.65, H * 0.32, 0, W * 0.65, H * 0.32, 160);
      neb.addColorStop(0, 'rgba(60,0,180,0.09)'); neb.addColorStop(1, 'rgba(0,0,60,0)');
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      // Planet
      ctx.fillStyle = '#15093a';
      ctx.beginPath(); ctx.arc(W * 0.14, H * 0.22, 48, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,200,0.28)'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.ellipse(W * 0.14, H * 0.22, 82, 20, -0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    },
  },
  // 9: Crystal Cavern
  {
    name: 'Crystal Cavern',
    spikeColor: '#00ffe5',
    accentColor: '#00ffe5',
    platColor: '#152040',
    platTopColor: '#204060',
    platSide: '#0a1028',
    groundColor: '#080a20',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04002a'); sky.addColorStop(1, '#0c0038');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Crystal stalagmites
      for (let i = 0; i < 12; i++) {
        const cx = ((i * 105 - camX * 0.09 + W * 3) % (W + 150)) - 75;
        const ch = 28 + (i * 21 % 55);
        const hue = 190 + i * 15;
        ctx.fillStyle = `hsla(${hue},80%,55%,0.18)`;
        ctx.beginPath(); ctx.moveTo(cx - 10, H); ctx.lineTo(cx, H - ch); ctx.lineTo(cx + 10, H); ctx.closePath(); ctx.fill();
        const g = ctx.createRadialGradient(cx, H - ch, 0, cx, H - ch, 38);
        g.addColorStop(0, `hsla(${hue},100%,70%,0.18)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 38, H - ch - 38, 76, 76);
      }
      // Floor pulse
      const pulse = 0.1 + Math.sin(t * 1.6) * 0.06;
      const fg = ctx.createLinearGradient(0, H - 55, 0, H);
      fg.addColorStop(0, 'rgba(0,255,200,0)'); fg.addColorStop(1, `rgba(0,255,200,${pulse})`);
      ctx.fillStyle = fg; ctx.fillRect(0, H - 55, W, 55);
    },
  },
  // 10: Dark Fortress
  {
    name: 'Dark Fortress',
    spikeColor: '#b0392b',
    accentColor: '#9b59b6',
    platColor: '#2a1838',
    platTopColor: '#3c2250',
    platSide: '#180a24',
    groundColor: '#100618',
    bgDraw(ctx, W, H, camX, t) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#040010'); sky.addColorStop(1, '#0e0028');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Stars
      for (let i = 0; i < 50; i++) {
        const sx = (i * 157 + 20) % W;
        const sy = (i * 83 + 10) % (H * 0.7);
        ctx.fillStyle = `rgba(200,150,255,${0.2 + i % 5 * 0.08})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      // Moon
      ctx.fillStyle = '#c8a8ff';
      ctx.beginPath(); ctx.arc(W * 0.78, 62, 36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#050012';
      ctx.beginPath(); ctx.arc(W * 0.78 + 14, 57, 34, 0, Math.PI * 2); ctx.fill();
      // Fortress silhouette
      const fOff = ((-camX * 0.04 + W * 5) % (W * 2)) - W * 0.5;
      ctx.fillStyle = '#080015';
      ctx.fillRect(fOff, H - 115, 55, 115);
      ctx.fillRect(fOff + 55, H - 78, 110, 78);
      ctx.fillRect(fOff + 165, H - 95, 55, 95);
      // Lightning flicker
      if (Math.sin(t * 7.3) > 0.97) {
        ctx.fillStyle = 'rgba(180,130,255,0.07)';
        ctx.fillRect(0, 0, W, H);
      }
    },
  },
];

function drawCloud(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.arc(x, y, h, 0, Math.PI * 2);
  ctx.arc(x + w * 0.28, y - h * 0.22, h * 0.78, 0, Math.PI * 2);
  ctx.arc(x + w * 0.58, y, h * 0.88, 0, Math.PI * 2);
  ctx.arc(x + w, y + h * 0.12, h * 0.68, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx, x, y, w, h) {
  ctx.fillRect(x - w * 0.1, y - h * 0.32, w * 0.2, h * 0.32);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.52, y - h * 0.32);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.52, y - h * 0.32);
  ctx.closePath();
  ctx.fill();
}

export function drawBackground(ctx, W, H, camX, stage, t) {
  const theme = STAGE_THEMES[(stage - 1) % 10];
  theme.bgDraw(ctx, W, H, camX, t);
}

export function getTheme(stage) {
  return STAGE_THEMES[(stage - 1) % 10];
}
