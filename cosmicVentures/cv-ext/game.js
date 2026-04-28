
// ===== GAME DATA =====
const MANAGER_COSTS = [1000, 15000, 100000, 1500000, 20000000, 500000000, 15000000000, 500000000000, 20000000000000, 1e16];

const BUSINESSES = [
  { id:0, name:'Space Lemonade',   icon:'🍋', baseCost:50,           baseIncome:0.5,      time:1,    color:'#ffd700' },
  { id:1, name:'Asteroid Mine',    icon:'⛏️', baseCost:1200,          baseIncome:6,        time:3,    color:'#a0522d' },
  { id:2, name:'Lunar Farm',       icon:'🌙', baseCost:12000,         baseIncome:40,       time:6,    color:'#87ceeb' },
  { id:3, name:'Nebula Bakery',    icon:'🍞', baseCost:200000,        baseIncome:200,      time:12,   color:'#dda0dd' },
  { id:4, name:'Starship Factory', icon:'🚀', baseCost:3500000,       baseIncome:1000,     time:30,   color:'#ff6b35' },
  { id:5, name:'Dark Matter Lab',  icon:'🧪', baseCost:75000000,      baseIncome:5000,     time:60,   color:'#7c3aed' },
  { id:6, name:'Wormhole Casino',  icon:'🎰', baseCost:2000000000,    baseIncome:25000,    time:180,  color:'#00d4ff' },
  { id:7, name:'Galaxy Bank',      icon:'🏦', baseCost:60000000000,   baseIncome:120000,   time:600,  color:'#ffd700' },
  { id:8, name:'Time Corp',        icon:'⏳', baseCost:2000000000000, baseIncome:600000,   time:3600, color:'#ff4499' },
  { id:9, name:'Universe Inc',     icon:'🌌', baseCost:1e15,          baseIncome:100000000,time:7200, color:'#00ff88' },
];

const UPGRADES = [
  // CLICK
  { id:0,  name:'Turbo Clicker',       icon:'👆', desc:'Click x3',         cost:100,         effect:()=>{state.clickMult*=3},                         req:()=>true },
  { id:4,  name:'Mega Click',          icon:'💥', desc:'Click x3',         cost:500000,      effect:()=>{state.clickMult*=3},                         req:()=>state.totalEarned>=10000 },
  { id:15, name:'Click Frenzy',        icon:'⚡', desc:'Click x5',         cost:10000000,    effect:()=>{state.clickMult*=5},                         req:()=>state.totalEarned>=1e6 },
  { id:16, name:'Hyper Tap',           icon:'🖱️', desc:'Click x5',         cost:1e11,        effect:()=>{state.clickMult*=5},                         req:()=>state.totalEarned>=1e9 },
  { id:17, name:'Quantum Click',       icon:'🌀', desc:'Click x7',         cost:1e15,        effect:()=>{state.clickMult*=7},                         req:()=>state.totalEarned>=1e13 },
  { id:18, name:'God Tap',             icon:'☄️', desc:'Click x10',        cost:1e21,        effect:()=>{state.clickMult*=10},                        req:()=>state.totalEarned>=1e19 },
  // LEMONADE
  { id:1,  name:'Solar Panels',        icon:'☀️', desc:'Lemonade x3',      cost:2500,        effect:()=>{state.bizMult[0]*=3},                        req:()=>state.owned[0]>=1 },
  { id:12, name:"Lots o' Lemons",      icon:'🍋', desc:'Lemonade x3',      cost:50000,       effect:()=>{state.bizMult[0]*=3},                        req:()=>state.owned[0]>=10 },
  { id:19, name:'Cosmic Lemonade',     icon:'🌟', desc:'Lemonade x5',      cost:5e7,         effect:()=>{state.bizMult[0]*=5},                        req:()=>state.owned[0]>=25 },
  { id:20, name:'Infinite Lemons',     icon:'♾️', desc:'Lemonade x7',      cost:1e13,        effect:()=>{state.bizMult[0]*=7},                        req:()=>state.owned[0]>=50 },
  { id:51, name:'Lemon Singularity',   icon:'💛', desc:'Lemonade x10',     cost:1e20,        effect:()=>{state.bizMult[0]*=10},                       req:()=>state.owned[0]>=100 },
  // MINE
  { id:2,  name:'Diamond Drill',       icon:'💎', desc:'Mine x3',          cost:25000,       effect:()=>{state.bizMult[1]*=3},                        req:()=>state.owned[1]>=1 },
  { id:13, name:'Mega Mine',           icon:'⛏️', desc:'Mine x3',          cost:500000,      effect:()=>{state.bizMult[1]*=3},                        req:()=>state.owned[1]>=10 },
  { id:21, name:'Dark Matter Drill',   icon:'🕳️', desc:'Mine x5',          cost:5e8,         effect:()=>{state.bizMult[1]*=5},                        req:()=>state.owned[1]>=25 },
  { id:22, name:'Planet Cracker',      icon:'💫', desc:'Mine x7',          cost:1e14,        effect:()=>{state.bizMult[1]*=7},                        req:()=>state.owned[1]>=50 },
  { id:52, name:'Star Shatter',        icon:'💥', desc:'Mine x10',         cost:1e21,        effect:()=>{state.bizMult[1]*=10},                       req:()=>state.owned[1]>=100 },
  // FARM
  { id:3,  name:'Hydro Seeds',         icon:'🌱', desc:'Farm x3',          cost:200000,      effect:()=>{state.bizMult[2]*=3},                        req:()=>state.owned[2]>=1 },
  { id:14, name:'Hyperfarm',           icon:'🌾', desc:'Farm x3',          cost:5000000,     effect:()=>{state.bizMult[2]*=3},                        req:()=>state.owned[2]>=10 },
  { id:23, name:'Zero-G Harvest',      icon:'🚜', desc:'Farm x5',          cost:5e9,         effect:()=>{state.bizMult[2]*=5},                        req:()=>state.owned[2]>=25 },
  { id:24, name:'Terraformer',         icon:'🌍', desc:'Farm x7',          cost:1e15,        effect:()=>{state.bizMult[2]*=7},                        req:()=>state.owned[2]>=50 },
  { id:53, name:'Galaxy Garden',       icon:'🌺', desc:'Farm x10',         cost:1e22,        effect:()=>{state.bizMult[2]*=10},                       req:()=>state.owned[2]>=100 },
  // BAKERY
  { id:5,  name:'Quantum Yeast',       icon:'🧬', desc:'Bakery x3',        cost:2000000,     effect:()=>{state.bizMult[3]*=3},                        req:()=>state.owned[3]>=1 },
  { id:25, name:'Warp Oven',           icon:'🍞', desc:'Bakery x3',        cost:5e7,         effect:()=>{state.bizMult[3]*=3},                        req:()=>state.owned[3]>=10 },
  { id:26, name:'Nebula Spice',        icon:'✨', desc:'Bakery x5',        cost:5e10,        effect:()=>{state.bizMult[3]*=5},                        req:()=>state.owned[3]>=25 },
  { id:27, name:'Cosmic Confection',   icon:'🎂', desc:'Bakery x7',        cost:1e16,        effect:()=>{state.bizMult[3]*=7},                        req:()=>state.owned[3]>=50 },
  { id:54, name:'Universal Pastry',    icon:'🥐', desc:'Bakery x10',       cost:1e23,        effect:()=>{state.bizMult[3]*=10},                       req:()=>state.owned[3]>=100 },
  // FACTORY
  { id:6,  name:'Ion Thrusters',       icon:'🔥', desc:'Factory x3',       cost:20000000,    effect:()=>{state.bizMult[4]*=3},                        req:()=>state.owned[4]>=1 },
  { id:28, name:'Warp Drive',          icon:'🚀', desc:'Factory x3',       cost:5e8,         effect:()=>{state.bizMult[4]*=3},                        req:()=>state.owned[4]>=10 },
  { id:29, name:'Dyson Forge',         icon:'⚙️', desc:'Factory x5',       cost:5e11,        effect:()=>{state.bizMult[4]*=5},                        req:()=>state.owned[4]>=25 },
  { id:30, name:'Galactic Assembly',   icon:'🏗️', desc:'Factory x7',       cost:1e17,        effect:()=>{state.bizMult[4]*=7},                        req:()=>state.owned[4]>=50 },
  { id:55, name:'Omega Foundry',       icon:'⚒️', desc:'Factory x10',      cost:1e24,        effect:()=>{state.bizMult[4]*=10},                       req:()=>state.owned[4]>=100 },
  // LAB
  { id:7,  name:'Dark Engine',         icon:'🌀', desc:'Lab x3',           cost:200000000,   effect:()=>{state.bizMult[5]*=3},                        req:()=>state.owned[5]>=1 },
  { id:31, name:'Antimatter Core',     icon:'⚛️', desc:'Lab x3',           cost:5e9,         effect:()=>{state.bizMult[5]*=3},                        req:()=>state.owned[5]>=10 },
  { id:32, name:'Singularity Engine',  icon:'🕳️', desc:'Lab x5',           cost:5e12,        effect:()=>{state.bizMult[5]*=5},                        req:()=>state.owned[5]>=25 },
  { id:33, name:'Void Reactor',        icon:'🌑', desc:'Lab x7',           cost:1e18,        effect:()=>{state.bizMult[5]*=7},                        req:()=>state.owned[5]>=50 },
  { id:56, name:'Multiverse Lab',      icon:'🔬', desc:'Lab x10',          cost:1e25,        effect:()=>{state.bizMult[5]*=10},                       req:()=>state.owned[5]>=100 },
  // CASINO
  { id:8,  name:'Loaded Dice',         icon:'🎲', desc:'Casino x3',        cost:2000000000,  effect:()=>{state.bizMult[6]*=3},                        req:()=>state.owned[6]>=1 },
  { id:34, name:'Quantum Cards',       icon:'🃏', desc:'Casino x3',        cost:5e10,        effect:()=>{state.bizMult[6]*=3},                        req:()=>state.owned[6]>=10 },
  { id:35, name:'Wormhole Jackpot',    icon:'🎰', desc:'Casino x5',        cost:5e13,        effect:()=>{state.bizMult[6]*=5},                        req:()=>state.owned[6]>=25 },
  { id:36, name:'Reality Gamble',      icon:'🌌', desc:'Casino x7',        cost:1e19,        effect:()=>{state.bizMult[6]*=7},                        req:()=>state.owned[6]>=50 },
  { id:57, name:'Omniversal Odds',     icon:'🎯', desc:'Casino x10',       cost:1e26,        effect:()=>{state.bizMult[6]*=10},                       req:()=>state.owned[6]>=100 },
  // BANK
  { id:9,  name:'Compound Interest',   icon:'📈', desc:'Bank x3',          cost:20000000000, effect:()=>{state.bizMult[7]*=3},                        req:()=>state.owned[7]>=1 },
  { id:37, name:'Galactic Reserve',    icon:'🏦', desc:'Bank x3',          cost:5e11,        effect:()=>{state.bizMult[7]*=3},                        req:()=>state.owned[7]>=10 },
  { id:38, name:'Cosmic Treasury',     icon:'💰', desc:'Bank x5',          cost:5e14,        effect:()=>{state.bizMult[7]*=5},                        req:()=>state.owned[7]>=25 },
  { id:39, name:'Universal Mint',      icon:'🪙', desc:'Bank x7',          cost:1e20,        effect:()=>{state.bizMult[7]*=7},                        req:()=>state.owned[7]>=50 },
  { id:58, name:'Decillion Vault',     icon:'🔐', desc:'Bank x10',         cost:1e27,        effect:()=>{state.bizMult[7]*=10},                       req:()=>state.owned[7]>=100 },
  // TIME CORP
  { id:10, name:'Temporal Loop',       icon:'🔄', desc:'Time Corp x3',     cost:2e11,        effect:()=>{state.bizMult[8]*=3},                        req:()=>state.owned[8]>=1 },
  { id:40, name:'Paradox Engine',      icon:'⏳', desc:'Time Corp x3',     cost:5e12,        effect:()=>{state.bizMult[8]*=3},                        req:()=>state.owned[8]>=10 },
  { id:41, name:'Timeline Collapse',   icon:'⌛', desc:'Time Corp x5',     cost:5e15,        effect:()=>{state.bizMult[8]*=5},                        req:()=>state.owned[8]>=25 },
  { id:42, name:'Omega Clock',         icon:'🕰️', desc:'Time Corp x7',     cost:1e21,        effect:()=>{state.bizMult[8]*=7},                        req:()=>state.owned[8]>=50 },
  { id:59, name:'Eternity Engine',     icon:'⏱️', desc:'Time Corp x10',    cost:1e28,        effect:()=>{state.bizMult[8]*=10},                       req:()=>state.owned[8]>=100 },
  // UNIVERSE INC
  { id:43, name:'Big Bang Budget',     icon:'💥', desc:'Universe x3',      cost:2e12,        effect:()=>{state.bizMult[9]*=3},                        req:()=>state.owned[9]>=1 },
  { id:44, name:'Multiverse Merger',   icon:'🌌', desc:'Universe x3',      cost:5e13,        effect:()=>{state.bizMult[9]*=3},                        req:()=>state.owned[9]>=10 },
  { id:45, name:'Reality Engine',      icon:'🔭', desc:'Universe x5',      cost:5e16,        effect:()=>{state.bizMult[9]*=5},                        req:()=>state.owned[9]>=25 },
  { id:46, name:'Omniversal Control',  icon:'♾️', desc:'Universe x7',      cost:1e22,        effect:()=>{state.bizMult[9]*=7},                        req:()=>state.owned[9]>=50 },
  { id:60, name:'God Mode',            icon:'👑', desc:'Universe x10',     cost:1e29,        effect:()=>{state.bizMult[9]*=10},                       req:()=>state.owned[9]>=100 },
  // GLOBAL
  { id:11, name:'Omni Boost',          icon:'⭐', desc:'All income x3',    cost:1e12,        effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=3},   req:()=>state.totalEarned>=1e11 },
  { id:47, name:'Stellar Surge',       icon:'🌠', desc:'All income x3',    cost:1e18,        effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=3},   req:()=>state.totalEarned>=1e17 },
  { id:48, name:'Galactic Overdrive',  icon:'🌀', desc:'All income x5',    cost:1e22,        effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=5},   req:()=>state.totalEarned>=1e21 },
  { id:49, name:'Cosmic Singularity',  icon:'🕳️', desc:'All income x7',    cost:1e27,        effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=7},   req:()=>state.totalEarned>=1e26 },
  { id:50, name:'Decillion Dividend',  icon:'💎', desc:'All income x10',   cost:1e32,        effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=10},  req:()=>state.totalEarned>=1e31 },
  // LATE-GAME BUSINESS TIERS
  { id:61, name:'Plasma Lemonade',       icon:'🌡️', desc:'Lemonade x15',     cost:1e30,  effect:()=>{state.bizMult[0]*=15},                       req:()=>state.owned[0]>=250 },
  { id:62, name:'Void Citrus',           icon:'🌑', desc:'Lemonade x25',     cost:1e33,  effect:()=>{state.bizMult[0]*=25},                       req:()=>state.owned[0]>=500 },
  { id:63, name:'Omnilemon',             icon:'🍋', desc:'Lemonade x50',     cost:1e36,  effect:()=>{state.bizMult[0]*=50},                       req:()=>state.owned[0]>=1000 },
  { id:64, name:'Neutron Drill',         icon:'⚡', desc:'Mine x15',         cost:1e31,  effect:()=>{state.bizMult[1]*=15},                       req:()=>state.owned[1]>=250 },
  { id:65, name:'Black Hole Bore',       icon:'🕳️', desc:'Mine x25',         cost:1e34,  effect:()=>{state.bizMult[1]*=25},                       req:()=>state.owned[1]>=500 },
  { id:66, name:'Reality Miner',         icon:'💫', desc:'Mine x50',         cost:1e37,  effect:()=>{state.bizMult[1]*=50},                       req:()=>state.owned[1]>=1000 },
  { id:67, name:'Quantum Harvest',       icon:'🧬', desc:'Farm x15',         cost:1e32,  effect:()=>{state.bizMult[2]*=15},                       req:()=>state.owned[2]>=250 },
  { id:68, name:'Stellar Seeds',         icon:'🌟', desc:'Farm x25',         cost:1e35,  effect:()=>{state.bizMult[2]*=25},                       req:()=>state.owned[2]>=500 },
  { id:69, name:'Universe Farm',         icon:'🌌', desc:'Farm x50',         cost:1e38,  effect:()=>{state.bizMult[2]*=50},                       req:()=>state.owned[2]>=1000 },
  { id:70, name:'Void Oven',             icon:'🌑', desc:'Bakery x15',       cost:1e33,  effect:()=>{state.bizMult[3]*=15},                       req:()=>state.owned[3]>=250 },
  { id:71, name:'Cosmic Sourdough',      icon:'🌠', desc:'Bakery x25',       cost:1e36,  effect:()=>{state.bizMult[3]*=25},                       req:()=>state.owned[3]>=500 },
  { id:72, name:'Omnibake',              icon:'♾️', desc:'Bakery x50',       cost:1e39,  effect:()=>{state.bizMult[3]*=50},                       req:()=>state.owned[3]>=1000 },
  { id:73, name:'Singularity Press',     icon:'🕳️', desc:'Factory x15',      cost:1e34,  effect:()=>{state.bizMult[4]*=15},                       req:()=>state.owned[4]>=250 },
  { id:74, name:'Galactic Forge',        icon:'⚙️', desc:'Factory x25',      cost:1e37,  effect:()=>{state.bizMult[4]*=25},                       req:()=>state.owned[4]>=500 },
  { id:75, name:'Omni Factory',          icon:'🤖', desc:'Factory x50',      cost:1e40,  effect:()=>{state.bizMult[4]*=50},                       req:()=>state.owned[4]>=1000 },
  { id:76, name:'Reality Splicer',       icon:'🔭', desc:'Lab x15',          cost:1e35,  effect:()=>{state.bizMult[5]*=15},                       req:()=>state.owned[5]>=250 },
  { id:77, name:'Consciousness Core',    icon:'🧠', desc:'Lab x25',          cost:1e38,  effect:()=>{state.bizMult[5]*=25},                       req:()=>state.owned[5]>=500 },
  { id:78, name:'Omniscience Lab',       icon:'🔬', desc:'Lab x50',          cost:1e41,  effect:()=>{state.bizMult[5]*=50},                       req:()=>state.owned[5]>=1000 },
  { id:79, name:'Fate Engine',           icon:'🎰', desc:'Casino x15',       cost:1e36,  effect:()=>{state.bizMult[6]*=15},                       req:()=>state.owned[6]>=250 },
  { id:80, name:'Probability God',       icon:'🎲', desc:'Casino x25',       cost:1e39,  effect:()=>{state.bizMult[6]*=25},                       req:()=>state.owned[6]>=500 },
  { id:81, name:'Omniversal House',      icon:'💎', desc:'Casino x50',       cost:1e42,  effect:()=>{state.bizMult[6]*=50},                       req:()=>state.owned[6]>=1000 },
  { id:82, name:'Infinite Ledger',       icon:'📈', desc:'Bank x15',         cost:1e37,  effect:()=>{state.bizMult[7]*=15},                       req:()=>state.owned[7]>=250 },
  { id:83, name:'Cosmic Fed',            icon:'🏦', desc:'Bank x25',         cost:1e40,  effect:()=>{state.bizMult[7]*=25},                       req:()=>state.owned[7]>=500 },
  { id:84, name:'Universal Reserve',     icon:'💰', desc:'Bank x50',         cost:1e43,  effect:()=>{state.bizMult[7]*=50},                       req:()=>state.owned[7]>=1000 },
  { id:85, name:'Causality Loop',        icon:'⏳', desc:'Time Corp x15',    cost:1e38,  effect:()=>{state.bizMult[8]*=15},                       req:()=>state.owned[8]>=250 },
  { id:86, name:'Timeline God',          icon:'🌀', desc:'Time Corp x25',    cost:1e41,  effect:()=>{state.bizMult[8]*=25},                       req:()=>state.owned[8]>=500 },
  { id:87, name:'Omni Epoch',            icon:'♾️', desc:'Time Corp x50',    cost:1e44,  effect:()=>{state.bizMult[8]*=50},                       req:()=>state.owned[8]>=1000 },
  { id:88, name:'Multiverse CEO',        icon:'🌌', desc:'Universe x15',     cost:1e39,  effect:()=>{state.bizMult[9]*=15},                       req:()=>state.owned[9]>=250 },
  { id:89, name:'Omniversal Inc',        icon:'🔭', desc:'Universe x25',     cost:1e42,  effect:()=>{state.bizMult[9]*=25},                       req:()=>state.owned[9]>=500 },
  { id:90, name:'The Everything',        icon:'💥', desc:'Universe x50',     cost:1e45,  effect:()=>{state.bizMult[9]*=50},                       req:()=>state.owned[9]>=1000 },
  // LATE-GAME CLICK
  { id:91, name:'Nova Strike',           icon:'🌟', desc:'Click x15',        cost:1e26,  effect:()=>{state.clickMult*=15},                        req:()=>state.totalEarned>=1e25 },
  { id:92, name:'Pulsar Punch',          icon:'💫', desc:'Click x25',        cost:1e36,  effect:()=>{state.clickMult*=25},                        req:()=>state.totalEarned>=1e35 },
  { id:93, name:'Quasar Slam',           icon:'⚡', desc:'Click x50',        cost:1e51,  effect:()=>{state.clickMult*=50},                        req:()=>state.totalEarned>=1e50 },
  { id:94, name:'Big Bang Click',        icon:'💥', desc:'Click x100',       cost:1e71,  effect:()=>{state.clickMult*=100},                       req:()=>state.totalEarned>=1e70 },
  { id:95, name:'Reality Tap',           icon:'🔮', desc:'Click x500',       cost:1e101, effect:()=>{state.clickMult*=500},                       req:()=>state.totalEarned>=1e100 },
  { id:96, name:'God Click',             icon:'👑', desc:'Click x9999',      cost:1e151, effect:()=>{state.clickMult*=9999},                      req:()=>state.totalEarned>=1e150 },
  // LATE-GAME GLOBAL
  { id:97,  name:'Stellar Dominion',     icon:'🌟', desc:'All income x15',   cost:1e37,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=15},  req:()=>state.totalEarned>=1e36 },
  { id:98,  name:'Universal Hegemony',   icon:'🌌', desc:'All income x25',   cost:1e43,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=25},  req:()=>state.totalEarned>=1e42 },
  { id:99,  name:'Omniversal Apex',      icon:'👑', desc:'All income x50',   cost:1e51,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=50},  req:()=>state.totalEarned>=1e50 },
  { id:100, name:'Centillion Conquest',  icon:'💎', desc:'All income x100',  cost:1e61,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=100}, req:()=>state.totalEarned>=1e60 },
  { id:101, name:'Infinite Dominance',   icon:'♾️', desc:'All income x200',  cost:1e76,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=200}, req:()=>state.totalEarned>=1e75 },
  { id:102, name:'Reality Breach',       icon:'🕳️', desc:'All income x500',  cost:1e91,  effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=500}, req:()=>state.totalEarned>=1e90 },
  { id:103, name:'The Final Theorem',    icon:'🔮', desc:'All income x1000', cost:1e101, effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=1000},req:()=>state.totalEarned>=1e100 },
  { id:104, name:'Centillion Crown',     icon:'⭐', desc:'All income x5000', cost:1e151, effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=5000},req:()=>state.totalEarned>=1e150 },
  { id:105, name:'Beyond Everything',    icon:'🌈', desc:'All income x9999', cost:1e201, effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=9999},req:()=>state.totalEarned>=1e200 },
  { id:106, name:'The Absolute End',     icon:'💥', desc:'All income x99999',cost:1e251, effect:()=>{for(let i=0;i<10;i++)state.bizMult[i]*=99999},req:()=>state.totalEarned>=1e250 },
];

const MILESTONES = [
  // CLICKS
  { id:0,   icon:'💫', label:'First Click',            bonus:null,                               check:s=>s.totalClicks>=1 },
  { id:100, icon:'👆', label:'100 Clicks',             bonus:{ type:'income', mult:1.1  },       check:s=>s.totalClicks>=100,        reward:'All income x1.1' },
  { id:101, icon:'🖱️', label:'1,000 Clicks',           bonus:{ type:'speed',  mult:1.1  },       check:s=>s.totalClicks>=1000,       reward:'Cycles 10% faster' },
  { id:102, icon:'⚡', label:'10,000 Clicks',          bonus:{ type:'both',   mult:1.25 },       check:s=>s.totalClicks>=10000,      reward:'Income & speed x1.25' },
  { id:103, icon:'🔥', label:'100,000 Clicks',         bonus:{ type:'both',   mult:1.5  },       check:s=>s.totalClicks>=100000,     reward:'Income & speed x1.5' },
  { id:104, icon:'💥', label:'1M Clicks',              bonus:{ type:'both',   mult:2    },       check:s=>s.totalClicks>=1000000,    reward:'Income & speed x2' },
  // EARNINGS
  { id:1,   icon:'💰', label:'$1K Earned',             bonus:null,                               check:s=>s.totalEarned>=1000 },
  { id:3,   icon:'💵', label:'$1M Earned',             bonus:{ type:'income', mult:1.25 },       check:s=>s.totalEarned>=1e6,        reward:'All income x1.25' },
  { id:7,   icon:'🌟', label:'$1B Earned',             bonus:{ type:'speed',  mult:1.25 },       check:s=>s.totalEarned>=1e9,        reward:'Cycles 25% faster' },
  { id:10,  icon:'💰', label:'$1T Earned',             bonus:{ type:'both',   mult:1.5  },       check:s=>s.totalEarned>=1e12,       reward:'Income & speed x1.5' },
  { id:200, icon:'💎', label:'$1 Quadrillion Earned',  bonus:{ type:'both',   mult:2    },       check:s=>s.totalEarned>=1e15,       reward:'Income & speed x2' },
  { id:201, icon:'🌌', label:'$1 Quintillion Earned',  bonus:{ type:'both',   mult:3    },       check:s=>s.totalEarned>=1e18,       reward:'Income & speed x3' },
  { id:202, icon:'🪐', label:'$1 Sextillion Earned',   bonus:{ type:'both',   mult:5    },       check:s=>s.totalEarned>=1e21,       reward:'Income & speed x5' },
  { id:203, icon:'🌠', label:'$1 Septillion Earned',   bonus:{ type:'both',   mult:10   },       check:s=>s.totalEarned>=1e24,       reward:'Income & speed x10' },
  { id:204, icon:'♾️', label:'$1 Decillion Earned',    bonus:{ type:'both',   mult:25   },       check:s=>s.totalEarned>=1e33,       reward:'Income & speed x25' },
  // ENTERPRISES
  { id:2,   icon:'🏭', label:'3 Enterprises',          bonus:{ type:'income', mult:1.1  },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=3,    reward:'All income x1.1' },
  { id:4,   icon:'⚡', label:'10 Enterprises',         bonus:{ type:'speed',  mult:1.1  },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=10,   reward:'Cycles 10% faster' },
  { id:6,   icon:'💎', label:'25 Enterprises',         bonus:{ type:'income', mult:1.25 },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=25,   reward:'All income x1.25' },
  { id:8,   icon:'🚀', label:'50 Enterprises',         bonus:{ type:'speed',  mult:1.25 },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=50,   reward:'Cycles 25% faster' },
  { id:9,   icon:'🏆', label:'All 10 Types Owned',     bonus:{ type:'both',   mult:1.5  },       check:s=>s.owned.filter(v=>v>0).length>=10,  reward:'Income & speed x1.5' },
  { id:11,  icon:'🌌', label:'100 Enterprises',        bonus:{ type:'both',   mult:2    },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=100,  reward:'Income & speed x2' },
  { id:12,  icon:'⭐', label:'250 Enterprises',        bonus:{ type:'both',   mult:3    },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=250,  reward:'Income & speed x3' },
  { id:13,  icon:'🔥', label:'500 Enterprises',        bonus:{ type:'both',   mult:5    },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=500,  reward:'Income & speed x5' },
  { id:14,  icon:'👑', label:'1,000 Enterprises',      bonus:{ type:'both',   mult:10   },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=1000, reward:'Income & speed x10' },
  { id:300, icon:'🌍', label:'2,500 Enterprises',      bonus:{ type:'both',   mult:25   },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=2500, reward:'Income & speed x25' },
  { id:301, icon:'🌞', label:'5,000 Enterprises',      bonus:{ type:'both',   mult:50   },       check:s=>s.owned.reduce((a,v)=>a+v,0)>=5000, reward:'Income & speed x50' },
  // MANAGERS
  { id:5,   icon:'🤖', label:'First Manager',          bonus:{ type:'speed',  mult:1.15 },       check:s=>s.managers.some(Boolean),              reward:'Cycles 15% faster' },
  { id:400, icon:'🤖', label:'5 Managers',             bonus:{ type:'both',   mult:1.5  },       check:s=>s.managers.filter(Boolean).length>=5,  reward:'Income & speed x1.5' },
  { id:401, icon:'🤖', label:'All Managers',           bonus:{ type:'both',   mult:2    },       check:s=>s.managers.every(Boolean),             reward:'Income & speed x2' },
  // PRESTIGE
  { id:500, icon:'🌟', label:'First Prestige',         bonus:{ type:'both',   mult:2    },       check:s=>s.prestigeLevel>=1,        reward:'Income & speed x2' },
  { id:501, icon:'✨', label:'Prestige Level 5',       bonus:{ type:'both',   mult:5    },       check:s=>s.prestigeLevel>=5,        reward:'Income & speed x5' },
  { id:502, icon:'👑', label:'Prestige Level 10',      bonus:{ type:'both',   mult:10   },       check:s=>s.prestigeLevel>=10,       reward:'Income & speed x10' },
];

// Compute total milestone speed and income multipliers from completed milestones
function getMilestoneMults() {
  let incomeMult = 1, speedMult = 1;
  MILESTONES.forEach(m => {
    if(m.bonus && m.check(state)) {
      if(m.bonus.type === 'income') incomeMult *= m.bonus.mult;
      if(m.bonus.type === 'speed')  speedMult  *= m.bonus.mult;
      if(m.bonus.type === 'both') { incomeMult *= m.bonus.mult; speedMult *= m.bonus.mult; }
    }
  });
  return { incomeMult, speedMult };
}

// ===== STATE =====
let state = {
  money: 0,
  totalEarned: 0,
  totalClicks: 0,
  clickMult: 1,
  owned: new Array(10).fill(0),
  progress: new Array(10).fill(0),
  running: new Array(10).fill(false),
  bizMult: new Array(10).fill(1),
  managers: new Array(10).fill(false),
  purchasedUpgrades: new Set(),
  completedMilestones: new Set(),
  prestigeLevel: 0,
  buyQty: 1,
};

// ===== RANDOM EVENTS =====
const RANDOM_EVENTS = [
  { id:'solar_flare',    icon:'☀️',  label:'Solar Flare',         desc:'Cosmic radiation supercharges all operations!',  incomeMult:2,    speedMult:1,    duration:45, good:true  },
  { id:'asteroid_belt',  icon:'☄️',  label:'Asteroid Belt',       desc:'Debris slows all cycles significantly.',          incomeMult:1,    speedMult:0.4,  duration:40, good:false },
  { id:'warp_surge',     icon:'⚡',  label:'Warp Surge',          desc:'Spacetime anomaly doubles cycle speed!',           incomeMult:1,    speedMult:2,    duration:30, good:true  },
  { id:'market_crash',   icon:'📉',  label:'Market Crash',        desc:'Galactic markets collapse. Income halved.',        incomeMult:0.5,  speedMult:1,    duration:50, good:false },
  { id:'gold_rush',      icon:'🪙',  label:'Gold Rush',           desc:'Rare ore discovered! Triple income!',              incomeMult:3,    speedMult:1,    duration:25, good:true  },
  { id:'black_hole',     icon:'🕳️',  label:'Black Hole Nearby',   desc:'Gravitational pull warps time. Cycles 3x faster!', incomeMult:1,    speedMult:3,    duration:20, good:true  },
  { id:'space_storm',    icon:'🌀',  label:'Space Storm',         desc:'Electromagnetic storm halves income & speed.',     incomeMult:0.5,  speedMult:0.5,  duration:35, good:false },
  { id:'nova_burst',     icon:'💥',  label:'Nova Burst',          desc:'Supernova shockwave! 5x income for a short time!', incomeMult:5,    speedMult:1,    duration:15, good:true  },
  { id:'dark_energy',    icon:'🌑',  label:'Dark Energy Surge',   desc:'Mysterious force slows all cycles to a crawl.',    incomeMult:1,    speedMult:0.25, duration:30, good:false },
  { id:'cosmic_fortune', icon:'🌟',  label:'Cosmic Fortune',      desc:'The universe smiles upon you. Everything x2!',    incomeMult:2,    speedMult:2,    duration:20, good:true  },
];

// Instant one-shot money events (fire independently of duration events)
const MONEY_EVENTS = [
  { id:'space_treasure', icon:'💰', label:'Space Treasure!',    good:true,  mult:30,  msg:'Found a drifting cargo pod!' },
  { id:'comet_gold',     icon:'☄️', label:'Golden Comet!',      good:true,  mult:60,  msg:'A golden comet streaks past!' },
  { id:'alien_trade',    icon:'👽', label:'Alien Traders!',     good:true,  mult:120, msg:'Alien merchants make a deal!' },
  { id:'nebula_crystal', icon:'💎', label:'Nebula Crystal!',    good:true,  mult:300, msg:'Rare crystal formation discovered!' },
  { id:'jackpot',        icon:'🎰', label:'Cosmic Jackpot!',    good:true,  mult:600, msg:'The universe deals you a winner!' },
  { id:'tax_audit',      icon:'📋', label:'Galactic Tax Audit', good:false, mult:20,  msg:'The Galactic IRS strikes!' },
  { id:'pirate_raid',    icon:'🏴‍☠️', label:'Space Pirates!',    good:false, mult:45,  msg:'Pirates raided your fleet!' },
  { id:'black_market',   icon:'🌑', label:'Black Market Fine',  good:false, mult:90,  msg:'Caught running unlicensed wormholes!' },
  { id:'supernova_dmg',  icon:'💣', label:'Supernova Damage',   good:false, mult:180, msg:'Nearby supernova destroys equipment!' },
];

let nextMoneyEventIn = 60 + Math.random() * 60;

let activeEvent = null;
let eventTimer = 0;
let nextEventIn = 90 + Math.random() * 60; // first event 90-150s in

function tickEvents(dt) {
  nextEventIn -= dt;
  if(nextEventIn <= 0 && !activeEvent) {
    triggerRandomEvent();
    nextEventIn = 120 + Math.random() * 60;
  }
  if(activeEvent) {
    eventTimer -= dt;
    updateEventBanner();
    if(eventTimer <= 0) endEvent();
  }

  // Tick money events independently
  nextMoneyEventIn -= dt;
  if(nextMoneyEventIn <= 0) {
    triggerMoneyEvent();
    nextMoneyEventIn = 60 + Math.random() * 90; // every 1-2.5 mins
  }
}

function triggerRandomEvent() {
  const e = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  activeEvent = e;
  eventTimer = e.duration;
  showEventBanner(e);
  showNotification(`${e.icon} ${e.label}: ${e.desc}`);
}

function triggerMoneyEvent() {
  const cps = getCPS();
  if(cps <= 0) return;
  const e = MONEY_EVENTS[Math.floor(Math.random() * MONEY_EVENTS.length)];
  const amt = Math.floor(cps * e.mult);
  if(e.good) {
    state.money += amt;
    state.totalEarned += amt;
    showNotification(`${e.icon} ${e.label} — ${e.msg} +${fmt(amt)}`);
  } else {
    const loss = Math.min(amt, Math.floor(state.money * 0.25));
    state.money = Math.max(0, state.money - loss);
    showNotification(`${e.icon} ${e.label} — ${e.msg} -${fmt(loss)}`);
  }
}

function triggerEventById(id) {
  const e = id ? RANDOM_EVENTS.find(e => e.id === id) : null;
  const target = e || RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  activeEvent = target;
  eventTimer = target.duration * 3; // cheat gives 3x duration
  nextEventIn = 999;
  showEventBanner(target);
  showNotification(`${target.icon} [CHEAT] ${target.label} triggered! ${target.desc}`);
}

function endEvent() {
  if(!activeEvent) return;
  showNotification(`${activeEvent.icon} "${activeEvent.label}" has ended.`);
  activeEvent = null;
  hideEventBanner();
}

function showEventBanner(e) {
  const banner = document.getElementById('event-banner');
  if(!banner) return;
  banner.style.display = 'flex';
  banner.style.background = e.good
    ? 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.1))'
    : 'linear-gradient(135deg, rgba(255,50,50,0.15), rgba(200,0,100,0.1))';
  banner.style.borderColor = e.good ? 'rgba(0,255,136,0.4)' : 'rgba(255,80,80,0.4)';
  document.getElementById('event-icon').textContent = e.icon;
  document.getElementById('event-label').textContent = e.label;
  document.getElementById('event-desc').textContent = e.desc;
  document.getElementById('event-timer').textContent = Math.ceil(eventTimer)+'s';
}

function updateEventBanner() {
  const t = document.getElementById('event-timer');
  if(t) t.textContent = Math.ceil(eventTimer)+'s';
}

function hideEventBanner() {
  const banner = document.getElementById('event-banner');
  if(banner) banner.style.display = 'none';
}

function getEventMults() {
  if(!activeEvent) return { incomeMult:1, speedMult:1 };
  return { incomeMult: activeEvent.incomeMult, speedMult: activeEvent.speedMult };
}

function fmt(n) {
  n = parseFloat(n);
  if(!isFinite(n) || isNaN(n)) return '$0';
  if(n<1000) return '$'+n.toFixed(n<10?2:0);
  const units = [
    '','Thousand','Million','Billion','Trillion','Quadrillion','Quintillion',
    'Sextillion','Septillion','Octillion','Nonillion','Decillion','Undecillion',
    'Duodecillion','Tredecillion','Quattuordecillion','Quindecillion','Sexdecillion',
    'Septendecillion','Octodecillion','Novemdecillion','Vigintillion','Unvigintillion',
    'Duovigintillion','Trevigintillion','Quattuorvigintillion','Quinvigintillion',
    'Sexvigintillion','Septenvigintillion','Octovigintillion','Novemvigintillion',
    'Trigintillion','Untrigintillion','Duotrigintillion','Tretrigintillion',
    'Quattuortrigintillion','Quintrigintillion','Sextrigintillion','Septentrigintillion',
    'Octotrigintillion','Novemtrigintillion','Quadragintillion','Unquadragintillion',
    'Duoquadragintillion','Trequadragintillion','Quattuorquadragintillion',
    'Quinquadragintillion','Sexquadragintillion','Septenquadragintillion',
    'Octoquadragintillion','Novemquadragintillion','Quinquagintillion',
    'Unquinquagintillion','Duoquinquagintillion','Trequinquagintillion',
    'Quattuorquinquagintillion','Quinquinquagintillion','Sexquinquagintillion',
    'Septenquinquagintillion','Octoquinquagintillion','Novemquinquagintillion',
    'Sexagintillion','Unsexagintillion','Duosexagintillion','Tresexagintillion',
    'Quattuorsexagintillion','Quinsexagintillion','Sexsexagintillion',
    'Septensexagintillion','Octosexagintillion','Novemsexagintillion',
    'Septuagintillion','Unseptuagintillion','Duoseptuagintillion','Treseptuagintillion',
    'Quattuorseptuagintillion','Quinseptuagintillion','Sexseptuagintillion',
    'Septenseptuagintillion','Octoseptuagintillion','Novemseptuagintillion',
    'Octogintillion','Unoctogintillion','Duooctogintillion','Treoctogintillion',
    'Quattuoroctogintillion','Quinoctogintillion','Sexoctogintillion',
    'Septenoctogintillion','Octooctogintillion','Novemoctogintillion',
    'Nonagintillion','Unnonagintillion','Duononagintillion','Trenonagintillion',
    'Quattuornonagintillion','Quinnonagintillion','Sexnonagintillion',
    'Septennonagintillion','Octononagintillion','Novemnonagintillion','Centillion'
  ];
  let i=0; while(n>=999.5 && i<units.length-1){n/=1000;i++;}
  return '$'+n.toFixed(2)+(units[i] ? ' '+units[i] : '');
}
function fmtTime(seconds) {
  if(!isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if(h > 0) return `${h}h ${m}m ${s}s`;
  if(m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function getBizCost(idx, qty) {
  qty = qty || 1;
  const b = BUSINESSES[idx];
  const owned = state.owned[idx];
  const r = 1.15;
  const logCost = Math.log(b.baseCost) + owned * Math.log(r);
  const singleCost = Math.exp(logCost);
  if(!isFinite(singleCost)) return Infinity; // too expensive to display — treated as unaffordable
  if(qty === 1) return singleCost;
  return singleCost * (Math.pow(r, qty) - 1) / (r - 1);
}
function getMaxBuy(idx) {
  const b = BUSINESSES[idx];
  const r = 1.15;
  const owned = state.owned[idx];
  const singleCost = Math.exp(Math.log(b.baseCost) + owned * Math.log(r));
  if(!isFinite(singleCost) || state.money < singleCost) return 0;
  const inner = state.money * (r - 1) / singleCost + 1;
  return Math.max(0, Math.floor(Math.log(inner) / Math.log(r)));
}
function getBizIncome(idx) {
  const { incomeMult } = cachedMilestoneMults;
  const { incomeMult: eventIncome } = getEventMults();
  return BUSINESSES[idx].baseIncome * state.owned[idx] * state.bizMult[idx] * (1 + state.prestigeLevel) * incomeMult * eventIncome;
}
function getCPS() {
  const { incomeMult } = cachedMilestoneMults;
  const { incomeMult: eventIncome } = getEventMults();
  const globalMult = (1 + state.prestigeLevel) * incomeMult * eventIncome;
  return BUSINESSES.reduce((sum,b,i)=>{
    if(state.owned[i]===0) return sum;
    return sum + b.baseIncome * state.owned[i] * state.bizMult[i] * globalMult / b.time;
  }, 0);
}
function getClickValue() {
  const rawCPS = BUSINESSES.reduce((sum,b,i)=>{
    if(state.owned[i]===0) return sum;
    return sum + b.baseIncome * state.owned[i] * state.bizMult[i] / b.time;
  }, 0);
  return Math.max(1, Math.floor(rawCPS * 0.01 + 1)) * state.clickMult;
}

// ===== BUYING =====
function buyBusiness(idx) {
  let qty = state.buyQty === 'max' ? getMaxBuy(idx) : state.buyQty;
  if(qty <= 0) return;
  const cost = getBizCost(idx, qty);
  if(state.money < cost) return;
  state.money -= cost;
  state.owned[idx] += qty;
  render();
}
function buyUpgrade(id) {
  const u = UPGRADES.find(u => u.id === id);
  if(!u) return;
  if(state.purchasedUpgrades.has(id)) return;
  if(!u.req()) return;
  if(state.money < u.cost) return;
  state.money -= u.cost;
  u.effect();
  state.purchasedUpgrades.add(id);
  showNotification(`✨ Upgrade: ${u.name} purchased!`);
  render();
}

function buyManager(idx, e) {
  e.stopPropagation();
  if(state.managers[idx]) return;
  const cost = MANAGER_COSTS[idx];
  if(state.money < cost) { showNotification('⚠️ Cannot afford this manager!'); return; }
  state.money -= cost;
  state.managers[idx] = true;
  showNotification(`🤖 Manager hired for ${BUSINESSES[idx].name}!`);
  render();
}

// ===== CLICK =====
function handleClick(e) {
  console.log("[CV] handleClick fired, val:", getClickValue());
  const val = getClickValue();
  state.money += val;
  state.totalEarned += val;
  state.totalClicks++;
  // Floating popup
  const pop = document.createElement('div');
  pop.className='float-popup'; pop.textContent=fmt(val);
  pop.style.left=(e.clientX-20)+'px'; pop.style.top=(e.clientY-20)+'px';
  document.body.appendChild(pop);
  setTimeout(()=>pop.remove(), 900);
  renderStats();
}

// ===== PRESTIGE =====
function getPrestigeThreshold(level) {
  // Level 1: $1T, each level after multiplies by 100
  // Lv1=$1T, Lv2=$100T, Lv3=$10Q, Lv4=$1Qn, etc.
  return 1e12 * Math.pow(100, level);
}

function tryPrestige() {
  const threshold = getPrestigeThreshold(state.prestigeLevel);
  const canPrestige = state.totalEarned >= threshold;
  const pl = state.prestigeLevel + 1;
  document.getElementById('prestige-level-text').textContent = `Prestige to Level ${pl} (+${pl*100}% income)`;
  const lockedMsg = document.getElementById('prestige-locked-msg');
  const confirmBtn = document.getElementById('prestige-confirm-btn');
  if(!canPrestige) {
    lockedMsg.style.display = 'block';
    lockedMsg.textContent = `Need ${fmt(threshold)} lifetime earnings. You have ${fmt(state.totalEarned)}.`;
    confirmBtn.style.opacity = '0.4';
    confirmBtn.style.cursor = 'not-allowed';
  } else {
    lockedMsg.style.display = 'none';
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
  }
  document.getElementById('prestige-overlay').classList.remove('hidden');
}
function confirmPrestige() {
  if(state.totalEarned < getPrestigeThreshold(state.prestigeLevel)) return;
  closePrestige();
  doPrestige();
}
function openResetModal()  { document.getElementById('reset-overlay').classList.remove('hidden'); }
function closeResetModal() { document.getElementById('reset-overlay').classList.add('hidden'); }
function confirmReset() {
  closeResetModal();
  localStorage.removeItem('cosmicVentures');
  activeEvent = null;
  hideEventBanner();
  state = {
    money:0, totalEarned:0, totalClicks:0, clickMult:1,
    owned:[0,0,0,0,0,0,0,0,0,0],
    progress:[0,0,0,0,0,0,0,0,0,0],
    running:[false,false,false,false,false,false,false,false,false,false],
    bizMult:[1,1,1,1,1,1,1,1,1,1],
    managers:[false,false,false,false,false,false,false,false,false,false],
    purchasedUpgrades: new Set(),
    completedMilestones: new Set(),
    prestigeLevel:0, buyQty:1
  };
  render();
  showNotification('💀 Save wiped. Fresh start!');
}

function closePrestige() { document.getElementById('prestige-overlay').classList.add('hidden'); }
function closePrestigeOutside(e) { if(e.target.id==='prestige-overlay') closePrestige(); }

function doPrestige() {
  const pl = state.prestigeLevel + 1;
  const startingMoney = Math.pow(10, 3 + pl) * pl; // scales up each prestige
  state = {
    money: startingMoney,
    totalEarned: startingMoney,
    totalClicks: 0,
    clickMult: 1,
    owned: [0,0,0,0,0,0,0,0,0,0],
    progress: [0,0,0,0,0,0,0,0,0,0],
    running: [false,false,false,false,false,false,false,false,false,false],
    bizMult: [1,1,1,1,1,1,1,1,1,1],
    managers: [false,false,false,false,false,false,false,false,false,false],
    purchasedUpgrades: new Set(),
    completedMilestones: state.completedMilestones,
    prestigeLevel: pl,
    buyQty: state.buyQty
  };
  saveGame();
  showNotification(`🌟 Prestige Lv${pl}! +${pl*100}% income & ${fmt(startingMoney)} head start!`);
  render();
}

// ===== TICK =====
let lastTick = Date.now();
let slowTickCounter = 0;
let cachedMilestoneMults = { incomeMult:1, speedMult:1 };

// Cached per-business buy button state — only recomputed every 5 ticks
let cachedBuyState = BUSINESSES.map(()=>({ canAffordAny:false, canAffordRequested:false, maxQty:0, label:'Cannot afford' }));
let cachedMgrAfford = new Array(10).fill(false);

function updateBuyCache() {
  BUSINESSES.forEach((b,i)=>{
    const requestedQty = state.buyQty === 'max' ? 1 : state.buyQty;
    const maxQty = getMaxBuy(i);
    const canAffordAny = maxQty > 0;
    const canAffordRequested = state.money >= getBizCost(i, requestedQty);
    let label;
    if(state.buyQty === 'max') {
      label = maxQty > 0 ? 'Buy x' + maxQty : 'Cannot afford';
    } else {
      if(canAffordRequested) label = 'Buy x' + requestedQty;
      else if(canAffordAny)  label = 'Cannot afford x' + requestedQty;
      else                   label = 'Cannot afford';
    }
    cachedBuyState[i] = { canAffordAny, maxQty, label };
    cachedMgrAfford[i] = state.money >= MANAGER_COSTS[i];
  });
}

function gameTick() {
  const now = Date.now();
  const dt = Math.min((now - lastTick)/1000, 0.5);
  lastTick = now;

  slowTickCounter++;

  // Recompute milestone mults every 10 ticks (~1s)
  if(slowTickCounter % 10 === 0) {
    cachedMilestoneMults = getMilestoneMults();
  }

  const { speedMult } = cachedMilestoneMults;
  const { speedMult: eventSpeed } = getEventMults();
  const totalSpeed = speedMult * eventSpeed;
  tickEvents(dt);

  // Cache income multiplier for this tick
  const { incomeMult } = cachedMilestoneMults;
  const { incomeMult: eventIncome } = getEventMults();
  const globalIncomeMult = (1 + state.prestigeLevel) * incomeMult * eventIncome;

  BUSINESSES.forEach((b,i)=>{
    if(state.owned[i]===0) return;
    if(state.managers[i]) {
      state.progress[i] += dt / b.time * totalSpeed;
      if(state.progress[i] >= 1) {
        const cycles = Math.floor(state.progress[i]);
        state.progress[i] -= cycles;
        const earned = b.baseIncome * state.owned[i] * state.bizMult[i] * globalIncomeMult * cycles;
        state.money += earned;
        state.totalEarned += earned;
      }
    } else if(state.running[i]) {
      state.progress[i] += dt / b.time * totalSpeed;
      if(state.progress[i] >= 1) {
        state.progress[i] = 1;
        state.running[i] = false;
      }
    }
  });

  // Always update stats (just a few textContent writes — very cheap)
  renderStats();

  // Update only progress bars + timers (skip buy buttons every tick)
  BUSINESSES.forEach((b,i)=>{
    const bar = document.getElementById('prog-'+i);
    if(bar) bar.style.width = (state.progress[i]*100)+'%';
    const timerEl = document.getElementById('timer-'+i);
    if(timerEl) {
      const active = state.owned[i] > 0 && (state.running[i] || state.managers[i]);
      const done = state.progress[i] >= 1;
      if(active && !done) {
        const { speedMult: sm } = cachedMilestoneMults;
        const { speedMult: es } = getEventMults();
        const secsLeft = b.time * (1 - state.progress[i]) / (sm * es);
        timerEl.textContent = fmtTime(secsLeft);
        timerEl.style.color = secsLeft < 10 ? 'var(--gold)' : 'var(--muted)';
      } else {
        timerEl.textContent = '';
      }
    }
  });

  // Throttle expensive updates to every 5 ticks (~500ms)
  if(slowTickCounter % 5 === 0) {
    updateBuyCache();

    // Apply cached buy/mgr button states to DOM
    BUSINESSES.forEach((b,i)=>{
      const buyBtn = document.getElementById('buy-btn-'+i);
      if(buyBtn) {
        const s = cachedBuyState[i];
        buyBtn.className = 'buy-biz-btn ' + (s.canAffordAny ? 'can-afford' : 'no-afford');
        buyBtn.textContent = s.label;
      }
      const mgrBtn = document.getElementById('mgr-btn-'+i);
      if(mgrBtn) {
        mgrBtn.className = 'manager-buy-btn' + (cachedMgrAfford[i] ? ' affordable' : '');
      }
      // Collect/start button
      const btn = document.getElementById('collect-btn-'+i);
      if(!btn || state.managers[i]) return;
      const prog = state.progress[i];
      const owned = state.owned[i];
      const canCollect = owned > 0 && prog >= 1;
      const canStart = owned > 0 && !state.running[i] && prog < 1;
      if(canCollect) {
        btn.disabled = false; btn.className = 'collect-btn ready'; btn.textContent = 'COLLECT';
        btn.onclick = () => manualCollect(i);
      } else if(state.running[i]) {
        btn.disabled = true; btn.className = 'collect-btn'; btn.textContent = 'RUNNING...';
      } else {
        btn.disabled = !canStart; btn.className = 'collect-btn' + (canStart ? ' startable' : '');
        btn.textContent = 'START'; btn.onclick = () => startBusiness(i);
      }
    });

    // Upgrade affordability
    UPGRADES.forEach(u => {
      const el = document.getElementById('upg-'+u.id);
      if(!el || state.purchasedUpgrades.has(u.id)) return;
      const canAfford = state.money >= u.cost;
      el.className = 'upgrade-card ' + (canAfford ? 'affordable' : 'cant-afford');
      const costEl = document.getElementById('upg-cost-'+u.id);
      if(costEl) costEl.style.color = canAfford ? 'var(--green)' : 'var(--accent2)';
    });

    // Milestone completions
    MILESTONES.forEach(m => {
      if(m.reward && m.check(state) && !state.completedMilestones.has(m.id)) {
        state.completedMilestones.add(m.id);
        cachedMilestoneMults = getMilestoneMults();
        showNotification(`${m.icon} Milestone: ${m.label} — ${m.reward}!`);
      }
    });

    renderMilestones();
  }

  setTimeout(gameTick, 100);
}

function setQty(q, btn) {
  state.buyQty = q;
  document.querySelectorAll('.qty-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

// ===== RENDER =====
function renderStats() {
  document.getElementById('money-display').textContent = fmt(state.money);
  document.getElementById('total-display').textContent = fmt(state.totalEarned);
  document.getElementById('cps-header').textContent = fmt(getCPS())+'/s';
  document.getElementById('click-power').textContent = '+'+fmt(getClickValue());
  const badge = document.getElementById('prestige-level-badge');
  if(badge) {
    const threshold = getPrestigeThreshold(state.prestigeLevel);
    const ready = state.totalEarned >= threshold;
    if(state.prestigeLevel > 0) {
      badge.style.display = 'inline';
      badge.textContent = ready
        ? `Lv${state.prestigeLevel} ✦ READY`
        : `Lv${state.prestigeLevel} — ${fmt(state.totalEarned)}/${fmt(threshold)}`;
    } else {
      badge.style.display = 'inline';
      badge.textContent = ready ? '✦ READY' : `${fmt(state.totalEarned)}/${fmt(threshold)}`;
    }
    badge.style.color = ready ? '#ffdd00' : '';
  }
}



function renderMilestones() {
  const list = document.getElementById('milestones-list');
  if(!list) return;
  list.innerHTML = MILESTONES.map(m=>{
    const done = m.check(state);
    return `<div class="milestone-item ${done?'done':''}">
      <span class="ico">${m.icon}</span>
      <div style="flex:1">
        <div>${m.label}</div>
        ${m.reward ? `<div style="font-size:0.68rem;color:${done?'var(--gold)':'var(--muted)'};margin-top:1px">${m.reward}</div>` : ''}
      </div>
      ${done?'<span style="color:var(--gold);flex-shrink:0">✓</span>':''}
    </div>`;
  }).join('');
}

function render() {
  renderStats();
  renderBusinesses();
  renderUpgrades();
  renderMilestones();
}

function renderBusinesses() {
  const list = document.getElementById('businesses-list');
  list.innerHTML = BUSINESSES.map((b,i)=>{
    const owned = state.owned[i];
    const requestedQty = state.buyQty === 'max' ? Math.max(1, getMaxBuy(i)) : state.buyQty;
    const affordableQty = getMaxBuy(i);
    const cost = getBizCost(i, requestedQty);
    const canAffordAny = state.money >= getBizCost(i, 1);
    const canAffordRequested = state.money >= cost;
    const income = getBizIncome(i);
    const cps = owned > 0 ? (income / b.time).toFixed(2) : 0;
    const hasManager = state.managers[i];
    const prog = state.progress[i];
    const canCollect = owned > 0 && !hasManager && prog >= 1;
    const canStart = owned > 0 && !hasManager && !state.running[i] && prog < 1;
    const canAffordManager = state.money >= MANAGER_COSTS[i];

    let buyLabel;
    if(state.buyQty === 'max') {
      buyLabel = affordableQty > 0 ? 'Buy x' + affordableQty : 'Cannot afford';
    } else {
      if(canAffordRequested) buyLabel = 'Buy x' + requestedQty;
      else if(canAffordAny) buyLabel = 'Cannot afford x' + requestedQty;
      else buyLabel = 'Cannot afford';
    }

    const { speedMult: sm } = cachedMilestoneMults;
    const { speedMult: es } = getEventMults();
    const timerStr = (owned > 0 && (state.running[i] || hasManager) && prog < 1) ? fmtTime(b.time * (1 - prog) / (sm * es)) : '';

    return `<div class="business-card" style="--accent:${b.color}">
      <div class="biz-header">
        <div class="biz-icon">${b.icon}</div>
        <div class="biz-info">
          <div class="biz-name">${b.name}${hasManager ? '<span class="manager-badge">AUTO</span>' : ''}</div>
          <div class="biz-owned">Owned: <strong style="color:var(--accent)">${owned}</strong></div>
        </div>
        <div class="biz-right">
          <div class="biz-cost" style="color:${canAffordAny?'var(--gold)':'var(--muted)'}">${fmt(cost)}</div>
          <div class="biz-income">${owned>0 ? fmt(income)+'/cycle' : 'Buy to unlock'}</div>
        </div>
      </div>
      <div class="biz-progress-row">
        <div style="flex:1">
          <div class="progress-bar-wrap">
            <div class="progress-bar" id="prog-${i}" style="width:${prog*100}%;background:linear-gradient(90deg,${b.color},${b.color}88)"></div>
          </div>
          <div id="timer-${i}" style="font-size:0.65rem;color:var(--muted);margin-top:3px;font-family:'Orbitron',sans-serif;letter-spacing:1px;">${timerStr}</div>
        </div>
        ${!hasManager ? (canCollect
          ? `<button id="collect-btn-${i}" class="collect-btn ready" data-action="collect" data-idx="${i}">COLLECT</button>`
          : `<button id="collect-btn-${i}" class="collect-btn ${canStart ? 'startable' : ''}" data-action="start" data-idx="${i}" ${canStart ? '' : 'disabled'}>${state.running[i] ? 'RUNNING...' : 'START'}</button>`
        ) : ''}
      </div>
      <div class="biz-footer">
        <button id="buy-btn-${i}" class="buy-biz-btn ${canAffordAny ? 'can-afford' : 'no-afford'}" data-action="buy" data-idx="${i}">${buyLabel}</button>
        ${!hasManager
          ? `<button id="mgr-btn-${i}" class="manager-buy-btn ${canAffordManager ? 'affordable' : ''}" data-action="mgr" data-idx="${i}">🤖 ${fmt(MANAGER_COSTS[i])}</button>`
          : `<span style="color:var(--green);font-size:0.75rem">🤖 Manager active</span>`}
      </div>
    </div>`;
  }).join('');
}

function renderUpgrades() {
  const list = document.getElementById('upgrades-list');
  const sorted = [...UPGRADES].sort((a,b) => a.cost - b.cost);
  list.innerHTML = sorted.map((u)=>{
    const purchased = state.purchasedUpgrades.has(u.id);
    const available = u.req();
    const canAfford = state.money >= u.cost;
    if(!available && !purchased) return '';
    return `<div id="upg-${u.id}" class="upgrade-card ${purchased?'purchased':(canAfford?'affordable':'cant-afford')}"
      data-action="upg" data-id="${u.id}">
      <div class="upg-icon">${u.icon}</div>
      <div class="upg-info">
        <div class="upg-name">${u.name} ${purchased?'✓':''}</div>
        <div class="upg-desc">${u.desc}</div>
        ${!purchased?`<div id="upg-cost-${u.id}" class="upg-cost" style="color:${canAfford?'var(--green)':'var(--accent2)'}">${fmt(u.cost)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}



// ===== SAVE/LOAD =====
function saveGame() {
  const save = {
    ...state,
    purchasedUpgrades: [...state.purchasedUpgrades],
    completedMilestones: [...state.completedMilestones],
    savedAt: Date.now()
  };
  const _json = JSON.stringify(save);
  try { localStorage.setItem('cosmicVentures', _json); } catch(e) {}
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ cosmicVentures: _json });
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('cosmicVentures');
    if(!raw) return;
    const s = JSON.parse(raw);
    state = {
      ...state,
      ...s,
      bizMult: [1,1,1,1,1,1,1,1,1,1],
      clickMult: 1,
      running: s.running || new Array(10).fill(false),
      purchasedUpgrades: new Set(s.purchasedUpgrades || []),
      completedMilestones: new Set(s.completedMilestones || [])
    };
    // Re-apply all purchased upgrade effects from scratch
    [...state.purchasedUpgrades].forEach(id => {
      const u = UPGRADES.find(u => u.id === id);
      if(u) u.effect();
    });

    // Calculate offline earnings (manager-run businesses only)
    // Full rate for first 8 hours, then diminishing returns after that
    if(s.savedAt) {
      const offlineSecs = (Date.now() - s.savedAt) / 1000;
      if(offlineSecs > 60) {
        cachedMilestoneMults = getMilestoneMults();
        const { incomeMult } = cachedMilestoneMults;
        const globalMult = (1 + state.prestigeLevel) * incomeMult;
        let offlineEarned = 0;
        const fullRateCap = 8 * 3600; // 8 hours at full rate
        BUSINESSES.forEach((b, i) => {
          if(state.owned[i] > 0 && state.managers[i]) {
            const incomePerSec = b.baseIncome * state.owned[i] * state.bizMult[i] * globalMult / b.time;
            // Full earnings for first 8 hours
            const fullSecs = Math.min(offlineSecs, fullRateCap);
            let earned = incomePerSec * fullSecs;
            // Diminishing returns beyond 8 hours: each doubling of extra time gives 50% efficiency
            if(offlineSecs > fullRateCap) {
              const extraSecs = offlineSecs - fullRateCap;
              // efficiency = 1 / (1 + log2(extraSecs / 3600)) — drops off but never hits zero
              const extraHours = extraSecs / 3600;
              const efficiency = 1 / (1 + Math.log2(1 + extraHours));
              earned += incomePerSec * extraSecs * efficiency;
            }
            offlineEarned += earned;
          }
        });
        if(offlineEarned > 0) {
          state.money += offlineEarned;
          state.totalEarned += offlineEarned;
          const totalMins = Math.floor(offlineSecs / 60);
          const hrs = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          const note = offlineSecs > fullRateCap ? ' (reduced rate)' : '';
          setTimeout(() => showNotification(`⏰ Welcome back! Earned ${fmt(offlineEarned)} in ${timeStr} offline${note}.`), 500);
        }
      }
    }
  } catch(e) {}
}

function showNotification(msg) {
  const el = document.createElement('div');
  el.className='notification'; el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3100);
}

// ===== MANUAL BUSINESS CLICK =====
function manualCollect(i) {
  if(state.owned[i] > 0 && !state.managers[i] && state.progress[i] >= 1) {
    state.progress[i] = 0;
    state.running[i] = false;
    const earned = getBizIncome(i);
    state.money += earned;
    state.totalEarned += earned;
    showNotification(`💰 Collected ${fmt(earned)} from ${BUSINESSES[i].name}!`);
    render();
  }
}

function startBusiness(i) {
  if(state.owned[i] > 0 && !state.managers[i] && !state.running[i] && state.progress[i] < 1) {
    state.running[i] = true;
    render();
  }
}

// ===== CHEAT CODES =====
const CHEAT_CODES = [
  { code:'GIMME1K',    label:'GIMME1K',    desc:'+$1,000',          fn:()=>{ addMoney(1000);            return '💰 +$1,000 credited'; }},
  { code:'GIMME1M',    label:'GIMME1M',    desc:'+$1 Million',      fn:()=>{ addMoney(1e6);             return '💰 +$1,000,000 credited'; }},
  { code:'GIMME1B',    label:'GIMME1B',    desc:'+$1 Billion',      fn:()=>{ addMoney(1e9);             return '💰 +$1 Billion credited'; }},
  { code:'GIMME1T',    label:'GIMME1T',    desc:'+$1 Trillion',     fn:()=>{ addMoney(1e12);            return '💰 +$1 Trillion credited'; }},
  { code:'GIMME:?',    label:'GIMME:amount', desc:'Custom amount (e.g. GIMME:500000)', fn:()=>{ return null; }},
  { code:'CLICKGOD',   label:'CLICKGOD',   desc:'Click power x100', fn:()=>{ state.clickMult*=100;      render(); return '👆 Click power x100!'; }},
  { code:'SPEEDRUN',   label:'SPEEDRUN',   desc:'All income x10 for 60s',    fn:()=>{ state.bizMult=state.bizMult.map(v=>v*10); render(); showNotification('⚡ SPEEDRUN active! 60 seconds...'); let t=59; const iv=setInterval(()=>{ t--; if(t===10) showNotification('⚡ SPEEDRUN ending in 10s!'); if(t<=0){ clearInterval(iv); state.bizMult=state.bizMult.map(v=>v/10); render(); showNotification('⏱️ SPEEDRUN expired!'); } },1000); return '⚡ All income x10 for 60 seconds!'; }},
  { code:'MAXOUT',     label:'MAXOUT',     desc:'Own 100 of each biz', fn:()=>{ state.owned=state.owned.map(v=>Math.max(v,100)); state.managers=state.managers.map(()=>true); render(); return '🏭 100x all businesses + managers!'; }},
  { code:'ULTRAMANAGER',label:'ULTRAMANAGER',desc:'All managers hired',fn:()=>{ state.managers=state.managers.map(()=>true); render(); return '🤖 All managers hired!'; }},
  { code:'TIMELOCK',   label:'TIMELOCK',   desc:'All cycles instant', fn:()=>{ state.progress=state.progress.map(()=>0.999); render(); return '⏱️ Cycles near-instant!'; }},
  { code:'PRESTIGEME', label:'PRESTIGEME', desc:'Force prestige',    fn:()=>{ state.totalEarned = getPrestigeThreshold(state.prestigeLevel); doPrestige(); return `🌟 Forced prestige! Level ${state.prestigeLevel}`; }},
  { code:'EVENT',      label:'EVENT',      desc:'Trigger random event',   fn:()=>{ triggerEventById(null); return '🎲 Random event triggered!'; }},
  { code:'EVENT:solar_flare',   label:'EVENT:solar_flare',   desc:'☀️ Solar Flare',        fn:()=>{ triggerEventById('solar_flare');   return '☀️ Solar Flare triggered!'; }},
  { code:'EVENT:warp_surge',    label:'EVENT:warp_surge',    desc:'⚡ Warp Surge',          fn:()=>{ triggerEventById('warp_surge');    return '⚡ Warp Surge triggered!'; }},
  { code:'EVENT:gold_rush',     label:'EVENT:gold_rush',     desc:'🪙 Gold Rush',           fn:()=>{ triggerEventById('gold_rush');     return '🪙 Gold Rush triggered!'; }},
  { code:'EVENT:black_hole',    label:'EVENT:black_hole',    desc:'🕳️ Black Hole',          fn:()=>{ triggerEventById('black_hole');    return '🕳️ Black Hole triggered!'; }},
  { code:'EVENT:nova_burst',    label:'EVENT:nova_burst',    desc:'💥 Nova Burst',          fn:()=>{ triggerEventById('nova_burst');    return '💥 Nova Burst triggered!'; }},
  { code:'EVENT:cosmic_fortune',label:'EVENT:cosmic_fortune',desc:'🌟 Cosmic Fortune',      fn:()=>{ triggerEventById('cosmic_fortune');return '🌟 Cosmic Fortune triggered!'; }},
  { code:'EVENT:asteroid_belt', label:'EVENT:asteroid_belt', desc:'☄️ Asteroid Belt',       fn:()=>{ triggerEventById('asteroid_belt'); return '☄️ Asteroid Belt triggered!'; }},
  { code:'EVENT:market_crash',  label:'EVENT:market_crash',  desc:'📉 Market Crash',        fn:()=>{ triggerEventById('market_crash');  return '📉 Market Crash triggered!'; }},
  { code:'EVENT:space_storm',   label:'EVENT:space_storm',   desc:'🌀 Space Storm',         fn:()=>{ triggerEventById('space_storm');   return '🌀 Space Storm triggered!'; }},
  { code:'EVENT:dark_energy',   label:'EVENT:dark_energy',   desc:'🌑 Dark Energy Surge',   fn:()=>{ triggerEventById('dark_energy');   return '🌑 Dark Energy triggered!'; }},
  { code:'RAINBOW',    label:'RAINBOW',    desc:'Party mode 🎉',     fn:()=>{ enableRainbow(); return '🌈 PARTY MODE ACTIVATED!'; }},
  { code:'RESET',      label:'RESET',      desc:'⚠️ Wipe save',      fn:()=>{ openResetModal(); return null; }},
];

function addMoney(amt) {
  amt = parseFloat(amt);
  if(!isFinite(amt) || isNaN(amt) || amt <= 0) return;
  state.money += amt;
  state.totalEarned += amt;
  render();
}

let rainbowInterval = null;
function enableRainbow() {
  if(rainbowInterval) return;
  let h=0;
  rainbowInterval = setInterval(()=>{
    h=(h+2)%360;
    document.documentElement.style.setProperty('--accent',`hsl(${h},100%,60%)`);
    document.documentElement.style.setProperty('--accent3',`hsl(${(h+120)%360},100%,50%)`);
  }, 50);
}

let cheatHistory = [];
let cheatHistIdx = -1;

function openCheat() {
  document.getElementById('cheat-overlay').classList.remove('hidden');
  document.getElementById('cheat-input').focus();
  renderCodeGrid();
}
function closeCheat() {
  document.getElementById('cheat-overlay').classList.add('hidden');
}
function closeCheatOutside(e) {
  if(e.target.id==='cheat-overlay') closeCheat();
}
function cheatKeydown(e) {
  if(e.key==='Enter') { submitCheat(); return; }
  if(e.key==='Escape') { closeCheat(); return; }
  if(e.key==='ArrowUp') {
    e.preventDefault();
    if(cheatHistory.length===0) return;
    cheatHistIdx = Math.min(cheatHistIdx+1, cheatHistory.length-1);
    document.getElementById('cheat-input').value = cheatHistory[cheatHistIdx];
  }
  if(e.key==='ArrowDown') {
    e.preventDefault();
    cheatHistIdx = Math.max(cheatHistIdx-1, -1);
    document.getElementById('cheat-input').value = cheatHistIdx>=0 ? cheatHistory[cheatHistIdx] : '';
  }
}
function submitCheat(codeOverride) {
  const inp = document.getElementById('cheat-input');
  const raw = (codeOverride || inp.value).trim().toUpperCase();
  if(!raw) return;
  if(!codeOverride) { cheatHistory.unshift(raw); cheatHistIdx=-1; inp.value=''; }
  logCheat(`> ${raw}`, 'log-info');

  // GIMME:<number> — custom amount
  if(raw.startsWith('GIMME:')) {
    const numStr = raw.slice(6).replace(/,/g, '');
    const amt = parseFloat(numStr);
    if(isNaN(amt) || amt <= 0) {
      logCheat(`✗ Invalid amount. Try: GIMME:500000`, 'log-err');
      return;
    }
    addMoney(amt);
    const result = `💰 +${fmt(amt)} credited!`;
    logCheat(result, 'log-ok');
    showNotification(result);
    return;
  }

  const cheat = CHEAT_CODES.find(c=>c.code===raw);
  if(!cheat) {
    logCheat(`✗ Unknown code: "${raw}"`, 'log-err');
    return;
  }
  const result = cheat.fn();
  if(result===null) { logCheat('✗ Cancelled.', 'log-err'); return; }
  logCheat(result, 'log-ok');
  showNotification(result);
}
function logCheat(msg, cls='log-ok') {
  const log = document.getElementById('cheat-log');
  const line = document.createElement('div');
  line.className=`log-line ${cls}`; line.textContent=msg;
  log.appendChild(line);
  log.scrollTop=log.scrollHeight;
}
function renderCodeGrid() {
  const grid = document.getElementById('code-grid');
  grid.innerHTML = CHEAT_CODES.map(c=>`
    <div class="code-chip" data-action="chip" data-code="${c.code}">
      <div class="code-name">${c.label}</div>
      <div class="code-desc">${c.desc}</div>
    </div>`).join('');
}

// Konami code easter egg: ↑↑↓↓←→←→BA
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx=0;
document.addEventListener('keydown', e=>{
  if(e.key===KONAMI[konamiIdx]) { konamiIdx++; if(konamiIdx===KONAMI.length){ konamiIdx=0; openCheat(); logCheat('🎮 KONAMI CODE! Here\'s a bonus $1T...', 'log-warn'); addMoney(1e12); } }
  else konamiIdx=0;
});

// ===== INIT =====
// ── Extension startup: load from chrome.storage (async) or localStorage ──
(function() {
  function start(raw) {
    if (raw) {
      try {
        const s = JSON.parse(raw);
        state = { ...state, ...s,
          bizMult: [1,1,1,1,1,1,1,1,1,1], clickMult: 1,
          running: s.running || new Array(10).fill(false),
          purchasedUpgrades: new Set(s.purchasedUpgrades || []),
          completedMilestones: new Set(s.completedMilestones || [])
        };
        [...state.purchasedUpgrades].forEach(id => {
          const u = UPGRADES.find(u => u.id === id);
          if (u) u.effect();
        });
        if (s.savedAt) {
          const secs = (Date.now() - s.savedAt) / 1000;
          if (secs > 60) {
            cachedMilestoneMults = getMilestoneMults();
            const { incomeMult } = cachedMilestoneMults;
            const gm = (1 + state.prestigeLevel) * incomeMult;
            let earned = 0;
            const cap = 8 * 3600;
            BUSINESSES.forEach((b, i) => {
              if (state.owned[i] > 0 && state.managers[i]) {
                const ips = b.baseIncome * state.owned[i] * state.bizMult[i] * gm / b.time;
                earned += ips * Math.min(secs, cap);
                if (secs > cap) {
                  const eh = (secs - cap) / 3600;
                  earned += ips * (secs - cap) / (1 + Math.log2(1 + eh));
                }
              }
            });
            if (earned > 0) {
              state.money += earned; state.totalEarned += earned;
              const m = Math.floor(secs/60), h = Math.floor(m/60);
              setTimeout(() => showNotification('⏰ Earned ' + fmt(earned) + ' in ' + (h>0?h+'h ':'') + (m%60) + 'm offline' + (secs>cap?' (reduced)':'') + '.'), 500);
            }
          }
        }
      } catch(e) {}
    }
    render();
    gameTick();
    setInterval(saveGame, 5000);
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('cosmicVentures', r => {
      let cr = r.cosmicVentures, lr = null;
      try { lr = localStorage.getItem('cosmicVentures'); } catch(e) {}
      let raw = cr && lr ? (JSON.parse(cr).savedAt||0) >= (JSON.parse(lr).savedAt||0) ? cr : lr : cr||lr;
      start(raw);
    });
  } else {
    let raw = null;
    try { raw = localStorage.getItem('cosmicVentures'); } catch(e) {}
    start(raw);
  }
})();

// ── Attach all event listeners (no inline onclick= allowed in extensions) ──
(function bindEvents() {
  console.log("[CV] bindEvents running, readyState:", document.readyState);
  // Static elements
  function on(id, evt, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
    else console.warn('[CV] bindEvents: element not found:', id);
  }
  on('btn-open-cheat',     'click', openCheat);
  on('btn-try-prestige',   'click', tryPrestige);
  on('planet-wrap-btn',    'click', handleClick);
  on('btn-reset-x',        'click', closeResetModal);
  on('btn-reset-cancel',   'click', closeResetModal);
  on('btn-reset-confirm',  'click', confirmReset);
  on('btn-prestige-x',     'click', closePrestige);
  on('btn-prestige-cancel','click', closePrestige);
  on('prestige-confirm-btn','click', confirmPrestige);
  on('btn-cheat-x',        'click', closeCheat);
  on('btn-cheat-submit',   'click', () => submitCheat());
  on('cheat-input',        'keydown', cheatKeydown);
  on('reset-overlay',      'click', e => { if (e.target.id==='reset-overlay') closeResetModal(); });
  on('prestige-overlay',   'click', closePrestigeOutside);
  on('cheat-overlay',      'click', closeCheatOutside);

  // Qty buttons
  document.querySelectorAll('[data-qty]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-qty]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const q = this.getAttribute('data-qty');
      setQty(q === 'max' ? 'max' : parseInt(q), this);
    });
  });

  // Businesses list — event delegation (handles dynamically rendered buttons)
  on('businesses-list', 'click', function(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    const i = parseInt(el.getAttribute('data-idx'));
    if (a === 'buy')     buyBusiness(i);
    else if (a === 'collect') manualCollect(i);
    else if (a === 'start')   startBusiness(i);
    else if (a === 'mgr')     buyManager(i, e);
  });

  // Upgrades list — event delegation
  on('upgrades-list', 'click', function(e) {
    const el = e.target.closest('[data-action="upg"]');
    if (!el) return;
    buyUpgrade(parseInt(el.getAttribute('data-id')));
  });

  // Cheat chips — event delegation
  on('code-grid', 'click', function(e) {
    const el = e.target.closest('[data-action="chip"]');
    if (!el) return;
    submitCheat(el.getAttribute('data-code'));
  });
})();
