// ===== Tower Defence Game =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const CW = canvas.width, CH = canvas.height;
const GRID = 40;

// Path (grid cells) the enemies follow, in pixel waypoints (cell centers)
const pathCells = [
  [0,2],[3,2],[3,5],[7,5],[7,1],[12,1],[12,7],[16,7],[16,3],[19,3]
];
const path = pathCells.map(([cx, cy]) => ({ x: cx*GRID + GRID/2, y: cy*GRID + GRID/2 }));

function cellKey(cx, cy) { return cx + ',' + cy; }
const pathBlocked = new Set();
for (let i = 0; i < path.length - 1; i++) {
  const a = pathCells[i], b = pathCells[i+1];
  const steps = Math.max(Math.abs(b[0]-a[0]), Math.abs(b[1]-a[1]));
  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(a[0] + (b[0]-a[0]) * s/steps);
    const cy = Math.round(a[1] + (b[1]-a[1]) * s/steps);
    pathBlocked.add(cellKey(cx, cy));
  }
}

const TOWER_TYPES = {
  "arrow": {name:"Arrow Tower", cat:"basic", cost:50, range:110, damage:12, rate:0.5, color:"#2a86c9", projColor:"#7fd3ff", desc:"Fast, cheap, single-target."},
  "cannon": {name:"Cannon Tower", cat:"basic", cost:100, range:90, damage:30, rate:1.1, color:"#b6431f", projColor:"#ff9d7f", desc:"Splash damage hits nearby enemies.", splash:45},
  "frost": {name:"Frost Tower", cat:"basic", cost:75, range:100, damage:6, rate:0.7, color:"#3ab6d6", projColor:"#baf3ff", desc:"Slows enemies.", slow:0.5, slowDur:1.5},
  "sniper": {name:"Sniper Tower", cat:"basic", cost:125, range:220, damage:55, rate:1.8, color:"#7a3fc9", projColor:"#d9baff", desc:"Huge range and damage."},
  "elem_fire_spark": {name:"Spark Fire Tower", cat:"elemental", cost:60, range:95, damage:14, rate:0.6, color:"#ff6b35", projColor:"#ffb27a", desc:"Fire-infused. Tier Spark. Effect: burn.", effect:"burn"},
  "elem_fire_flare": {name:"Flare Fire Tower", cat:"elemental", cost:88, range:109, damage:20, rate:0.57, color:"#ff6b35", projColor:"#ffb27a", desc:"Fire-infused. Tier Flare. Effect: burn.", effect:"burn"},
  "elem_fire_blaze": {name:"Blaze Fire Tower", cat:"elemental", cost:125, range:124, damage:27, rate:0.54, color:"#ff6b35", projColor:"#ffb27a", desc:"Fire-infused. Tier Blaze. Effect: burn.", effect:"burn"},
  "elem_fire_inferno": {name:"Inferno Fire Tower", cat:"elemental", cost:179, range:142, damage:36, rate:0.51, color:"#ff6b35", projColor:"#ffb27a", desc:"Fire-infused. Tier Inferno. Effect: burn.", effect:"burn"},
  "elem_fire_apex": {name:"Apex Fire Tower", cat:"elemental", cost:252, range:162, damage:49, rate:0.48, color:"#ff6b35", projColor:"#ffb27a", desc:"Fire-infused. Tier Apex. Effect: burn.", effect:"burn"},
  "elem_ice_spark": {name:"Spark Ice Tower", cat:"elemental", cost:75, range:95, damage:14, rate:0.6, color:"#7fd9ff", projColor:"#c9f2ff", desc:"Ice-infused. Tier Spark. Effect: slow.", effect:"slow"},
  "elem_ice_flare": {name:"Flare Ice Tower", cat:"elemental", cost:109, range:109, damage:20, rate:0.57, color:"#7fd9ff", projColor:"#c9f2ff", desc:"Ice-infused. Tier Flare. Effect: slow.", effect:"slow"},
  "elem_ice_blaze": {name:"Blaze Ice Tower", cat:"elemental", cost:154, range:124, damage:27, rate:0.54, color:"#7fd9ff", projColor:"#c9f2ff", desc:"Ice-infused. Tier Blaze. Effect: slow.", effect:"slow"},
  "elem_ice_inferno": {name:"Inferno Ice Tower", cat:"elemental", cost:218, range:142, damage:36, rate:0.51, color:"#7fd9ff", projColor:"#c9f2ff", desc:"Ice-infused. Tier Inferno. Effect: slow.", effect:"slow"},
  "elem_ice_apex": {name:"Apex Ice Tower", cat:"elemental", cost:304, range:162, damage:49, rate:0.48, color:"#7fd9ff", projColor:"#c9f2ff", desc:"Ice-infused. Tier Apex. Effect: slow.", effect:"slow"},
  "elem_lightning_spark": {name:"Spark Lightning Tower", cat:"elemental", cost:90, range:95, damage:14, rate:0.6, color:"#f4e04d", projColor:"#fff6b3", desc:"Lightning-infused. Tier Spark. Effect: chain.", effect:"chain"},
  "elem_lightning_flare": {name:"Flare Lightning Tower", cat:"elemental", cost:130, range:109, damage:20, rate:0.57, color:"#f4e04d", projColor:"#fff6b3", desc:"Lightning-infused. Tier Flare. Effect: chain.", effect:"chain"},
  "elem_lightning_blaze": {name:"Blaze Lightning Tower", cat:"elemental", cost:182, range:124, damage:27, rate:0.54, color:"#f4e04d", projColor:"#fff6b3", desc:"Lightning-infused. Tier Blaze. Effect: chain.", effect:"chain"},
  "elem_lightning_inferno": {name:"Inferno Lightning Tower", cat:"elemental", cost:257, range:142, damage:36, rate:0.51, color:"#f4e04d", projColor:"#fff6b3", desc:"Lightning-infused. Tier Inferno. Effect: chain.", effect:"chain"},
  "elem_lightning_apex": {name:"Apex Lightning Tower", cat:"elemental", cost:357, range:162, damage:49, rate:0.48, color:"#f4e04d", projColor:"#fff6b3", desc:"Lightning-infused. Tier Apex. Effect: chain.", effect:"chain"},
  "elem_poison_spark": {name:"Spark Poison Tower", cat:"elemental", cost:105, range:95, damage:14, rate:0.6, color:"#7cc242", projColor:"#c6f27a", desc:"Poison-infused. Tier Spark. Effect: dot.", effect:"dot"},
  "elem_poison_flare": {name:"Flare Poison Tower", cat:"elemental", cost:151, range:109, damage:20, rate:0.57, color:"#7cc242", projColor:"#c6f27a", desc:"Poison-infused. Tier Flare. Effect: dot.", effect:"dot"},
  "elem_poison_blaze": {name:"Blaze Poison Tower", cat:"elemental", cost:211, range:124, damage:27, rate:0.54, color:"#7cc242", projColor:"#c6f27a", desc:"Poison-infused. Tier Blaze. Effect: dot.", effect:"dot"},
  "elem_poison_inferno": {name:"Inferno Poison Tower", cat:"elemental", cost:296, range:142, damage:36, rate:0.51, color:"#7cc242", projColor:"#c6f27a", desc:"Poison-infused. Tier Inferno. Effect: dot.", effect:"dot"},
  "elem_poison_apex": {name:"Apex Poison Tower", cat:"elemental", cost:410, range:162, damage:49, rate:0.48, color:"#7cc242", projColor:"#c6f27a", desc:"Poison-infused. Tier Apex. Effect: dot.", effect:"dot"},
  "elem_earth_spark": {name:"Spark Earth Tower", cat:"elemental", cost:120, range:95, damage:14, rate:0.6, color:"#8b5a2b", projColor:"#c99a5b", desc:"Earth-infused. Tier Spark. Effect: stun.", effect:"stun"},
  "elem_earth_flare": {name:"Flare Earth Tower", cat:"elemental", cost:172, range:109, damage:20, rate:0.57, color:"#8b5a2b", projColor:"#c99a5b", desc:"Earth-infused. Tier Flare. Effect: stun.", effect:"stun"},
  "elem_earth_blaze": {name:"Blaze Earth Tower", cat:"elemental", cost:239, range:124, damage:27, rate:0.54, color:"#8b5a2b", projColor:"#c99a5b", desc:"Earth-infused. Tier Blaze. Effect: stun.", effect:"stun"},
  "elem_earth_inferno": {name:"Inferno Earth Tower", cat:"elemental", cost:335, range:142, damage:36, rate:0.51, color:"#8b5a2b", projColor:"#c99a5b", desc:"Earth-infused. Tier Inferno. Effect: stun.", effect:"stun"},
  "elem_earth_apex": {name:"Apex Earth Tower", cat:"elemental", cost:462, range:162, damage:49, rate:0.48, color:"#8b5a2b", projColor:"#c99a5b", desc:"Earth-infused. Tier Apex. Effect: stun.", effect:"stun"},
  "elem_wind_spark": {name:"Spark Wind Tower", cat:"elemental", cost:135, range:95, damage:14, rate:0.6, color:"#b8e0d2", projColor:"#e6fff5", desc:"Wind-infused. Tier Spark. Effect: knockback.", effect:"knockback"},
  "elem_wind_flare": {name:"Flare Wind Tower", cat:"elemental", cost:193, range:109, damage:20, rate:0.57, color:"#b8e0d2", projColor:"#e6fff5", desc:"Wind-infused. Tier Flare. Effect: knockback.", effect:"knockback"},
  "elem_wind_blaze": {name:"Blaze Wind Tower", cat:"elemental", cost:268, range:124, damage:27, rate:0.54, color:"#b8e0d2", projColor:"#e6fff5", desc:"Wind-infused. Tier Blaze. Effect: knockback.", effect:"knockback"},
  "elem_wind_inferno": {name:"Inferno Wind Tower", cat:"elemental", cost:374, range:142, damage:36, rate:0.51, color:"#b8e0d2", projColor:"#e6fff5", desc:"Wind-infused. Tier Inferno. Effect: knockback.", effect:"knockback"},
  "elem_wind_apex": {name:"Apex Wind Tower", cat:"elemental", cost:514, range:162, damage:49, rate:0.48, color:"#b8e0d2", projColor:"#e6fff5", desc:"Wind-infused. Tier Apex. Effect: knockback.", effect:"knockback"},
  "elem_light_spark": {name:"Spark Light Tower", cat:"elemental", cost:150, range:95, damage:14, rate:0.6, color:"#fff2a8", projColor:"#ffffff", desc:"Light-infused. Tier Spark. Effect: purebonus.", effect:"purebonus"},
  "elem_light_flare": {name:"Flare Light Tower", cat:"elemental", cost:214, range:109, damage:20, rate:0.57, color:"#fff2a8", projColor:"#ffffff", desc:"Light-infused. Tier Flare. Effect: purebonus.", effect:"purebonus"},
  "elem_light_blaze": {name:"Blaze Light Tower", cat:"elemental", cost:296, range:124, damage:27, rate:0.54, color:"#fff2a8", projColor:"#ffffff", desc:"Light-infused. Tier Blaze. Effect: purebonus.", effect:"purebonus"},
  "elem_light_inferno": {name:"Inferno Light Tower", cat:"elemental", cost:413, range:142, damage:36, rate:0.51, color:"#fff2a8", projColor:"#ffffff", desc:"Light-infused. Tier Inferno. Effect: purebonus.", effect:"purebonus"},
  "elem_light_apex": {name:"Apex Light Tower", cat:"elemental", cost:567, range:162, damage:49, rate:0.48, color:"#fff2a8", projColor:"#ffffff", desc:"Light-infused. Tier Apex. Effect: purebonus.", effect:"purebonus"},
  "elem_dark_spark": {name:"Spark Dark Tower", cat:"elemental", cost:165, range:95, damage:14, rate:0.6, color:"#4b2e83", projColor:"#8b5fd6", desc:"Dark-infused. Tier Spark. Effect: armorshred.", effect:"armorshred"},
  "elem_dark_flare": {name:"Flare Dark Tower", cat:"elemental", cost:235, range:109, damage:20, rate:0.57, color:"#4b2e83", projColor:"#8b5fd6", desc:"Dark-infused. Tier Flare. Effect: armorshred.", effect:"armorshred"},
  "elem_dark_blaze": {name:"Blaze Dark Tower", cat:"elemental", cost:325, range:124, damage:27, rate:0.54, color:"#4b2e83", projColor:"#8b5fd6", desc:"Dark-infused. Tier Blaze. Effect: armorshred.", effect:"armorshred"},
  "elem_dark_inferno": {name:"Inferno Dark Tower", cat:"elemental", cost:452, range:142, damage:36, rate:0.51, color:"#4b2e83", projColor:"#8b5fd6", desc:"Dark-infused. Tier Inferno. Effect: armorshred.", effect:"armorshred"},
  "elem_dark_apex": {name:"Apex Dark Tower", cat:"elemental", cost:620, range:162, damage:49, rate:0.48, color:"#4b2e83", projColor:"#8b5fd6", desc:"Dark-infused. Tier Apex. Effect: armorshred.", effect:"armorshred"},
  "elem_water_spark": {name:"Spark Water Tower", cat:"elemental", cost:180, range:95, damage:14, rate:0.6, color:"#3f7cac", projColor:"#a8d8ff", desc:"Water-infused. Tier Spark. Effect: slow.", effect:"slow"},
  "elem_water_flare": {name:"Flare Water Tower", cat:"elemental", cost:256, range:109, damage:20, rate:0.57, color:"#3f7cac", projColor:"#a8d8ff", desc:"Water-infused. Tier Flare. Effect: slow.", effect:"slow"},
  "elem_water_blaze": {name:"Blaze Water Tower", cat:"elemental", cost:353, range:124, damage:27, rate:0.54, color:"#3f7cac", projColor:"#a8d8ff", desc:"Water-infused. Tier Blaze. Effect: slow.", effect:"slow"},
  "elem_water_inferno": {name:"Inferno Water Tower", cat:"elemental", cost:491, range:142, damage:36, rate:0.51, color:"#3f7cac", projColor:"#a8d8ff", desc:"Water-infused. Tier Inferno. Effect: slow.", effect:"slow"},
  "elem_water_apex": {name:"Apex Water Tower", cat:"elemental", cost:672, range:162, damage:49, rate:0.48, color:"#3f7cac", projColor:"#a8d8ff", desc:"Water-infused. Tier Apex. Effect: slow.", effect:"slow"},
  "elem_nature_spark": {name:"Spark Nature Tower", cat:"elemental", cost:195, range:95, damage:14, rate:0.6, color:"#4c9a2a", projColor:"#a3e35c", desc:"Nature-infused. Tier Spark. Effect: dot.", effect:"dot"},
  "elem_nature_flare": {name:"Flare Nature Tower", cat:"elemental", cost:277, range:109, damage:20, rate:0.57, color:"#4c9a2a", projColor:"#a3e35c", desc:"Nature-infused. Tier Flare. Effect: dot.", effect:"dot"},
  "elem_nature_blaze": {name:"Blaze Nature Tower", cat:"elemental", cost:382, range:124, damage:27, rate:0.54, color:"#4c9a2a", projColor:"#a3e35c", desc:"Nature-infused. Tier Blaze. Effect: dot.", effect:"dot"},
  "elem_nature_inferno": {name:"Inferno Nature Tower", cat:"elemental", cost:530, range:142, damage:36, rate:0.51, color:"#4c9a2a", projColor:"#a3e35c", desc:"Nature-infused. Tier Inferno. Effect: dot.", effect:"dot"},
  "elem_nature_apex": {name:"Apex Nature Tower", cat:"elemental", cost:724, range:162, damage:49, rate:0.48, color:"#4c9a2a", projColor:"#a3e35c", desc:"Nature-infused. Tier Apex. Effect: dot.", effect:"dot"},
  "mech_gatling_turret_mki": {name:"Gatling Turret Mk.I", cat:"mechanical", cost:70, range:100, damage:8, rate:3.5, color:"#616161", projColor:"#c9c9c9", desc:"Very high fire rate. (Mk.I)"},
  "mech_gatling_turret_mkii": {name:"Gatling Turret Mk.II", cat:"mechanical", cost:94, range:108, damage:11, rate:3.85, color:"#616161", projColor:"#c9c9c9", desc:"Very high fire rate. (Mk.II)"},
  "mech_gatling_turret_mkiii": {name:"Gatling Turret Mk.III", cat:"mechanical", cost:119, range:116, damage:14, rate:4.2, color:"#616161", projColor:"#c9c9c9", desc:"Very high fire rate. (Mk.III)"},
  "mech_gatling_turret_mkiv": {name:"Gatling Turret Mk.IV", cat:"mechanical", cost:144, range:124, damage:16, rate:4.55, color:"#616161", projColor:"#c9c9c9", desc:"Very high fire rate. (Mk.IV)"},
  "mech_gatling_turret_mkv": {name:"Gatling Turret Mk.V", cat:"mechanical", cost:168, range:132, damage:19, rate:4.9, color:"#616161", projColor:"#c9c9c9", desc:"Very high fire rate. (Mk.V)"},
  "mech_mortar_battery_mki": {name:"Mortar Battery Mk.I", cat:"mechanical", cost:140, range:130, damage:60, rate:0.4, color:"#4a4a2a", projColor:"#d4d47a", desc:"Massive splash. (Mk.I)", splash:70},
  "mech_mortar_battery_mkii": {name:"Mortar Battery Mk.II", cat:"mechanical", cost:189, range:140, damage:81, rate:0.44, color:"#4a4a2a", projColor:"#d4d47a", desc:"Massive splash. (Mk.II)", splash:70},
  "mech_mortar_battery_mkiii": {name:"Mortar Battery Mk.III", cat:"mechanical", cost:238, range:151, damage:102, rate:0.48, color:"#4a4a2a", projColor:"#d4d47a", desc:"Massive splash. (Mk.III)", splash:70},
  "mech_mortar_battery_mkiv": {name:"Mortar Battery Mk.IV", cat:"mechanical", cost:287, range:161, damage:123, rate:0.52, color:"#4a4a2a", projColor:"#d4d47a", desc:"Massive splash. (Mk.IV)", splash:70},
  "mech_mortar_battery_mkv": {name:"Mortar Battery Mk.V", cat:"mechanical", cost:336, range:172, damage:144, rate:0.56, color:"#4a4a2a", projColor:"#d4d47a", desc:"Massive splash. (Mk.V)", splash:70},
  "mech_laser_array_mki": {name:"Laser Array Mk.I", cat:"mechanical", cost:160, range:150, damage:20, rate:4.0, color:"#e63946", projColor:"#ff7b89", desc:"Pierces a line of enemies. (Mk.I)", pierce:true},
  "mech_laser_array_mkii": {name:"Laser Array Mk.II", cat:"mechanical", cost:216, range:162, damage:27, rate:4.4, color:"#e63946", projColor:"#ff7b89", desc:"Pierces a line of enemies. (Mk.II)", pierce:true},
  "mech_laser_array_mkiii": {name:"Laser Array Mk.III", cat:"mechanical", cost:272, range:174, damage:34, rate:4.8, color:"#e63946", projColor:"#ff7b89", desc:"Pierces a line of enemies. (Mk.III)", pierce:true},
  "mech_laser_array_mkiv": {name:"Laser Array Mk.IV", cat:"mechanical", cost:328, range:186, damage:41, rate:5.2, color:"#e63946", projColor:"#ff7b89", desc:"Pierces a line of enemies. (Mk.IV)", pierce:true},
  "mech_laser_array_mkv": {name:"Laser Array Mk.V", cat:"mechanical", cost:384, range:198, damage:48, rate:5.6, color:"#e63946", projColor:"#ff7b89", desc:"Pierces a line of enemies. (Mk.V)", pierce:true},
  "mech_tesla_coil_mki": {name:"Tesla Coil Mk.I", cat:"mechanical", cost:130, range:120, damage:18, rate:1.5, color:"#00b4d8", projColor:"#90e0ef", desc:"Arcs lightning. (Mk.I)", effect:"chain"},
  "mech_tesla_coil_mkii": {name:"Tesla Coil Mk.II", cat:"mechanical", cost:176, range:130, damage:24, rate:1.65, color:"#00b4d8", projColor:"#90e0ef", desc:"Arcs lightning. (Mk.II)", effect:"chain"},
  "mech_tesla_coil_mkiii": {name:"Tesla Coil Mk.III", cat:"mechanical", cost:221, range:139, damage:31, rate:1.8, color:"#00b4d8", projColor:"#90e0ef", desc:"Arcs lightning. (Mk.III)", effect:"chain"},
  "mech_tesla_coil_mkiv": {name:"Tesla Coil Mk.IV", cat:"mechanical", cost:266, range:149, damage:37, rate:1.95, color:"#00b4d8", projColor:"#90e0ef", desc:"Arcs lightning. (Mk.IV)", effect:"chain"},
  "mech_tesla_coil_mkv": {name:"Tesla Coil Mk.V", cat:"mechanical", cost:312, range:158, damage:43, rate:2.1, color:"#00b4d8", projColor:"#90e0ef", desc:"Arcs lightning. (Mk.V)", effect:"chain"},
  "mech_rocket_pod_mki": {name:"Rocket Pod Mk.I", cat:"mechanical", cost:150, range:140, damage:45, rate:0.8, color:"#8d5524", projColor:"#e0a96d", desc:"Homing rockets. (Mk.I)", splash:55},
  "mech_rocket_pod_mkii": {name:"Rocket Pod Mk.II", cat:"mechanical", cost:202, range:151, damage:61, rate:0.88, color:"#8d5524", projColor:"#e0a96d", desc:"Homing rockets. (Mk.II)", splash:55},
  "mech_rocket_pod_mkiii": {name:"Rocket Pod Mk.III", cat:"mechanical", cost:255, range:162, damage:76, rate:0.96, color:"#8d5524", projColor:"#e0a96d", desc:"Homing rockets. (Mk.III)", splash:55},
  "mech_rocket_pod_mkiv": {name:"Rocket Pod Mk.IV", cat:"mechanical", cost:308, range:174, damage:92, rate:1.04, color:"#8d5524", projColor:"#e0a96d", desc:"Homing rockets. (Mk.IV)", splash:55},
  "mech_rocket_pod_mkv": {name:"Rocket Pod Mk.V", cat:"mechanical", cost:360, range:185, damage:108, rate:1.12, color:"#8d5524", projColor:"#e0a96d", desc:"Homing rockets. (Mk.V)", splash:55},
  "mech_railgun_platform_mki": {name:"Railgun Platform Mk.I", cat:"mechanical", cost:220, range:260, damage:90, rate:0.6, color:"#3d5a80", projColor:"#98c1d9", desc:"Extreme range one-shots. (Mk.I)"},
  "mech_railgun_platform_mkii": {name:"Railgun Platform Mk.II", cat:"mechanical", cost:297, range:281, damage:122, rate:0.66, color:"#3d5a80", projColor:"#98c1d9", desc:"Extreme range one-shots. (Mk.II)"},
  "mech_railgun_platform_mkiii": {name:"Railgun Platform Mk.III", cat:"mechanical", cost:374, range:302, damage:153, rate:0.72, color:"#3d5a80", projColor:"#98c1d9", desc:"Extreme range one-shots. (Mk.III)"},
  "mech_railgun_platform_mkiv": {name:"Railgun Platform Mk.IV", cat:"mechanical", cost:451, range:322, damage:184, rate:0.78, color:"#3d5a80", projColor:"#98c1d9", desc:"Extreme range one-shots. (Mk.IV)"},
  "mech_railgun_platform_mkv": {name:"Railgun Platform Mk.V", cat:"mechanical", cost:528, range:343, damage:216, rate:0.84, color:"#3d5a80", projColor:"#98c1d9", desc:"Extreme range one-shots. (Mk.V)"},
  "mech_flak_cannon_mki": {name:"Flak Cannon Mk.I", cat:"mechanical", cost:110, range:100, damage:25, rate:1.2, color:"#606c38", projColor:"#dda15e", desc:"Anti-swarm flak. (Mk.I)", splash:60},
  "mech_flak_cannon_mkii": {name:"Flak Cannon Mk.II", cat:"mechanical", cost:148, range:108, damage:34, rate:1.32, color:"#606c38", projColor:"#dda15e", desc:"Anti-swarm flak. (Mk.II)", splash:60},
  "mech_flak_cannon_mkiii": {name:"Flak Cannon Mk.III", cat:"mechanical", cost:187, range:116, damage:42, rate:1.44, color:"#606c38", projColor:"#dda15e", desc:"Anti-swarm flak. (Mk.III)", splash:60},
  "mech_flak_cannon_mkiv": {name:"Flak Cannon Mk.IV", cat:"mechanical", cost:225, range:124, damage:51, rate:1.56, color:"#606c38", projColor:"#dda15e", desc:"Anti-swarm flak. (Mk.IV)", splash:60},
  "mech_flak_cannon_mkv": {name:"Flak Cannon Mk.V", cat:"mechanical", cost:264, range:132, damage:60, rate:1.68, color:"#606c38", projColor:"#dda15e", desc:"Anti-swarm flak. (Mk.V)", splash:60},
  "mech_drone_swarm_bay_mki": {name:"Drone Swarm Bay Mk.I", cat:"mechanical", cost:175, range:130, damage:10, rate:2.5, color:"#adb5bd", projColor:"#f8f9fa", desc:"Deploys 3 drones. (Mk.I)", multishot:3},
  "mech_drone_swarm_bay_mkii": {name:"Drone Swarm Bay Mk.II", cat:"mechanical", cost:236, range:140, damage:14, rate:2.75, color:"#adb5bd", projColor:"#f8f9fa", desc:"Deploys 3 drones. (Mk.II)", multishot:3},
  "mech_drone_swarm_bay_mkiii": {name:"Drone Swarm Bay Mk.III", cat:"mechanical", cost:298, range:151, damage:17, rate:3.0, color:"#adb5bd", projColor:"#f8f9fa", desc:"Deploys 3 drones. (Mk.III)", multishot:3},
  "mech_drone_swarm_bay_mkiv": {name:"Drone Swarm Bay Mk.IV", cat:"mechanical", cost:359, range:161, damage:20, rate:3.25, color:"#adb5bd", projColor:"#f8f9fa", desc:"Deploys 3 drones. (Mk.IV)", multishot:3},
  "mech_drone_swarm_bay_mkv": {name:"Drone Swarm Bay Mk.V", cat:"mechanical", cost:420, range:172, damage:24, rate:3.5, color:"#adb5bd", projColor:"#f8f9fa", desc:"Deploys 3 drones. (Mk.V)", multishot:3},
  "mech_emp_turret_mki": {name:"EMP Turret Mk.I", cat:"mechanical", cost:145, range:110, damage:5, rate:1.0, color:"#7209b7", projColor:"#c77dff", desc:"Disables abilities. (Mk.I)", effect:"stun"},
  "mech_emp_turret_mkii": {name:"EMP Turret Mk.II", cat:"mechanical", cost:196, range:119, damage:7, rate:1.1, color:"#7209b7", projColor:"#c77dff", desc:"Disables abilities. (Mk.II)", effect:"stun"},
  "mech_emp_turret_mkiii": {name:"EMP Turret Mk.III", cat:"mechanical", cost:246, range:128, damage:8, rate:1.2, color:"#7209b7", projColor:"#c77dff", desc:"Disables abilities. (Mk.III)", effect:"stun"},
  "mech_emp_turret_mkiv": {name:"EMP Turret Mk.IV", cat:"mechanical", cost:297, range:136, damage:10, rate:1.3, color:"#7209b7", projColor:"#c77dff", desc:"Disables abilities. (Mk.IV)", effect:"stun"},
  "mech_emp_turret_mkv": {name:"EMP Turret Mk.V", cat:"mechanical", cost:348, range:145, damage:12, rate:1.4, color:"#7209b7", projColor:"#c77dff", desc:"Disables abilities. (Mk.V)", effect:"stun"},
  "mech_plasma_cutter_mki": {name:"Plasma Cutter Mk.I", cat:"mechanical", cost:165, range:115, damage:35, rate:1.3, color:"#f72585", projColor:"#ff9edb", desc:"Melts armor. (Mk.I)", effect:"armorshred"},
  "mech_plasma_cutter_mkii": {name:"Plasma Cutter Mk.II", cat:"mechanical", cost:223, range:124, damage:47, rate:1.43, color:"#f72585", projColor:"#ff9edb", desc:"Melts armor. (Mk.II)", effect:"armorshred"},
  "mech_plasma_cutter_mkiii": {name:"Plasma Cutter Mk.III", cat:"mechanical", cost:280, range:133, damage:60, rate:1.56, color:"#f72585", projColor:"#ff9edb", desc:"Melts armor. (Mk.III)", effect:"armorshred"},
  "mech_plasma_cutter_mkiv": {name:"Plasma Cutter Mk.IV", cat:"mechanical", cost:338, range:143, damage:72, rate:1.69, color:"#f72585", projColor:"#ff9edb", desc:"Melts armor. (Mk.IV)", effect:"armorshred"},
  "mech_plasma_cutter_mkv": {name:"Plasma Cutter Mk.V", cat:"mechanical", cost:396, range:152, damage:84, rate:1.82, color:"#f72585", projColor:"#ff9edb", desc:"Melts armor. (Mk.V)", effect:"armorshred"},
  "halo_ma5b_assault_rifle_recruit": {name:"MA5B Assault Rifle \u2014 Recruit", cat:"halo", cost:65, range:95, damage:9, rate:3.2, color:"#4a5240", projColor:"#d4e09b", desc:"UNSC rifle, rapid bursts. (Recruit grade)"},
  "halo_ma5b_assault_rifle_marine": {name:"MA5B Assault Rifle \u2014 Marine", cat:"halo", cost:91, range:105, damage:13, rate:3.46, color:"#4a5240", projColor:"#d4e09b", desc:"UNSC rifle, rapid bursts. (Marine grade)"},
  "halo_ma5b_assault_rifle_odst": {name:"MA5B Assault Rifle \u2014 ODST", cat:"halo", cost:117, range:114, damage:16, rate:3.71, color:"#4a5240", projColor:"#d4e09b", desc:"UNSC rifle, rapid bursts. (ODST grade)"},
  "halo_ma5b_assault_rifle_spartan": {name:"MA5B Assault Rifle \u2014 Spartan", cat:"halo", cost:143, range:124, damage:20, rate:3.97, color:"#4a5240", projColor:"#d4e09b", desc:"UNSC rifle, rapid bursts. (Spartan grade)"},
  "halo_ma5b_assault_rifle_legendary": {name:"MA5B Assault Rifle \u2014 Legendary", cat:"halo", cost:169, range:133, damage:23, rate:4.22, color:"#4a5240", projColor:"#d4e09b", desc:"UNSC rifle, rapid bursts. (Legendary grade)"},
  "halo_m6d_pistol_recruit": {name:"M6D Pistol \u2014 Recruit", cat:"halo", cost:55, range:105, damage:16, rate:1.4, color:"#3d3d3d", projColor:"#e8e8e8", desc:"Scoped sidearm. (Recruit grade)"},
  "halo_m6d_pistol_marine": {name:"M6D Pistol \u2014 Marine", cat:"halo", cost:77, range:116, damage:22, rate:1.51, color:"#3d3d3d", projColor:"#e8e8e8", desc:"Scoped sidearm. (Marine grade)"},
  "halo_m6d_pistol_odst": {name:"M6D Pistol \u2014 ODST", cat:"halo", cost:99, range:126, damage:29, rate:1.62, color:"#3d3d3d", projColor:"#e8e8e8", desc:"Scoped sidearm. (ODST grade)"},
  "halo_m6d_pistol_spartan": {name:"M6D Pistol \u2014 Spartan", cat:"halo", cost:121, range:136, damage:35, rate:1.74, color:"#3d3d3d", projColor:"#e8e8e8", desc:"Scoped sidearm. (Spartan grade)"},
  "halo_m6d_pistol_legendary": {name:"M6D Pistol \u2014 Legendary", cat:"halo", cost:143, range:147, damage:42, rate:1.85, color:"#3d3d3d", projColor:"#e8e8e8", desc:"Scoped sidearm. (Legendary grade)"},
  "halo_m90_shotgun_recruit": {name:"M90 Shotgun \u2014 Recruit", cat:"halo", cost:90, range:65, damage:55, rate:0.8, color:"#5a3e2b", projColor:"#e0c097", desc:"Devastating up close. (Recruit grade)", splash:25},
  "halo_m90_shotgun_marine": {name:"M90 Shotgun \u2014 Marine", cat:"halo", cost:126, range:72, damage:77, rate:0.86, color:"#5a3e2b", projColor:"#e0c097", desc:"Devastating up close. (Marine grade)", splash:25},
  "halo_m90_shotgun_odst": {name:"M90 Shotgun \u2014 ODST", cat:"halo", cost:162, range:78, damage:99, rate:0.93, color:"#5a3e2b", projColor:"#e0c097", desc:"Devastating up close. (ODST grade)", splash:25},
  "halo_m90_shotgun_spartan": {name:"M90 Shotgun \u2014 Spartan", cat:"halo", cost:198, range:84, damage:121, rate:0.99, color:"#5a3e2b", projColor:"#e0c097", desc:"Devastating up close. (Spartan grade)", splash:25},
  "halo_m90_shotgun_legendary": {name:"M90 Shotgun \u2014 Legendary", cat:"halo", cost:234, range:91, damage:143, rate:1.06, color:"#5a3e2b", projColor:"#e0c097", desc:"Devastating up close. (Legendary grade)", splash:25},
  "halo_s2_am_sniper_rifle_recruit": {name:"S2 AM Sniper Rifle \u2014 Recruit", cat:"halo", cost:180, range:260, damage:95, rate:0.7, color:"#2b2b2b", projColor:"#ffffff", desc:"One shot, one kill. (Recruit grade)"},
  "halo_s2_am_sniper_rifle_marine": {name:"S2 AM Sniper Rifle \u2014 Marine", cat:"halo", cost:252, range:286, damage:133, rate:0.76, color:"#2b2b2b", projColor:"#ffffff", desc:"One shot, one kill. (Marine grade)"},
  "halo_s2_am_sniper_rifle_odst": {name:"S2 AM Sniper Rifle \u2014 ODST", cat:"halo", cost:324, range:312, damage:171, rate:0.81, color:"#2b2b2b", projColor:"#ffffff", desc:"One shot, one kill. (ODST grade)"},
  "halo_s2_am_sniper_rifle_spartan": {name:"S2 AM Sniper Rifle \u2014 Spartan", cat:"halo", cost:396, range:338, damage:209, rate:0.87, color:"#2b2b2b", projColor:"#ffffff", desc:"One shot, one kill. (Spartan grade)"},
  "halo_s2_am_sniper_rifle_legendary": {name:"S2 AM Sniper Rifle \u2014 Legendary", cat:"halo", cost:468, range:364, damage:247, rate:0.92, color:"#2b2b2b", projColor:"#ffffff", desc:"One shot, one kill. (Legendary grade)"},
  "halo_m41_rocket_launcher_recruit": {name:"M41 Rocket Launcher \u2014 Recruit", cat:"halo", cost:200, range:150, damage:120, rate:0.35, color:"#333d29", projColor:"#ffb703", desc:"Anti-vehicle warhead. (Recruit grade)", splash:80},
  "halo_m41_rocket_launcher_marine": {name:"M41 Rocket Launcher \u2014 Marine", cat:"halo", cost:280, range:165, damage:168, rate:0.38, color:"#333d29", projColor:"#ffb703", desc:"Anti-vehicle warhead. (Marine grade)", splash:80},
  "halo_m41_rocket_launcher_odst": {name:"M41 Rocket Launcher \u2014 ODST", cat:"halo", cost:360, range:180, damage:216, rate:0.41, color:"#333d29", projColor:"#ffb703", desc:"Anti-vehicle warhead. (ODST grade)", splash:80},
  "halo_m41_rocket_launcher_spartan": {name:"M41 Rocket Launcher \u2014 Spartan", cat:"halo", cost:440, range:195, damage:264, rate:0.43, color:"#333d29", projColor:"#ffb703", desc:"Anti-vehicle warhead. (Spartan grade)", splash:80},
  "halo_m41_rocket_launcher_legendary": {name:"M41 Rocket Launcher \u2014 Legendary", cat:"halo", cost:520, range:210, damage:312, rate:0.46, color:"#333d29", projColor:"#ffb703", desc:"Anti-vehicle warhead. (Legendary grade)", splash:80},
  "halo_plasma_pistol_recruit": {name:"Plasma Pistol \u2014 Recruit", cat:"halo", cost:60, range:100, damage:8, rate:1.6, color:"#7209b7", projColor:"#c77dff", desc:"Overcharge drains shields. (Recruit grade)", effect:"stun"},
  "halo_plasma_pistol_marine": {name:"Plasma Pistol \u2014 Marine", cat:"halo", cost:84, range:110, damage:11, rate:1.73, color:"#7209b7", projColor:"#c77dff", desc:"Overcharge drains shields. (Marine grade)", effect:"stun"},
  "halo_plasma_pistol_odst": {name:"Plasma Pistol \u2014 ODST", cat:"halo", cost:108, range:120, damage:14, rate:1.86, color:"#7209b7", projColor:"#c77dff", desc:"Overcharge drains shields. (ODST grade)", effect:"stun"},
  "halo_plasma_pistol_spartan": {name:"Plasma Pistol \u2014 Spartan", cat:"halo", cost:132, range:130, damage:18, rate:1.98, color:"#7209b7", projColor:"#c77dff", desc:"Overcharge drains shields. (Spartan grade)", effect:"stun"},
  "halo_plasma_pistol_legendary": {name:"Plasma Pistol \u2014 Legendary", cat:"halo", cost:156, range:140, damage:21, rate:2.11, color:"#7209b7", projColor:"#c77dff", desc:"Overcharge drains shields. (Legendary grade)", effect:"stun"},
  "halo_plasma_rifle_recruit": {name:"Plasma Rifle \u2014 Recruit", cat:"halo", cost:85, range:95, damage:11, rate:3.0, color:"#3a0ca3", projColor:"#8ecae6", desc:"Covenant rapid-fire. (Recruit grade)"},
  "halo_plasma_rifle_marine": {name:"Plasma Rifle \u2014 Marine", cat:"halo", cost:119, range:105, damage:15, rate:3.24, color:"#3a0ca3", projColor:"#8ecae6", desc:"Covenant rapid-fire. (Marine grade)"},
  "halo_plasma_rifle_odst": {name:"Plasma Rifle \u2014 ODST", cat:"halo", cost:153, range:114, damage:20, rate:3.48, color:"#3a0ca3", projColor:"#8ecae6", desc:"Covenant rapid-fire. (ODST grade)"},
  "halo_plasma_rifle_spartan": {name:"Plasma Rifle \u2014 Spartan", cat:"halo", cost:187, range:124, damage:24, rate:3.72, color:"#3a0ca3", projColor:"#8ecae6", desc:"Covenant rapid-fire. (Spartan grade)"},
  "halo_plasma_rifle_legendary": {name:"Plasma Rifle \u2014 Legendary", cat:"halo", cost:221, range:133, damage:29, rate:3.96, color:"#3a0ca3", projColor:"#8ecae6", desc:"Covenant rapid-fire. (Legendary grade)"},
  "halo_needler_recruit": {name:"Needler \u2014 Recruit", cat:"halo", cost:95, range:85, damage:7, rate:4.0, color:"#c9184a", projColor:"#ff8fa3", desc:"Homing shards. (Recruit grade)", effect:"dot"},
  "halo_needler_marine": {name:"Needler \u2014 Marine", cat:"halo", cost:133, range:94, damage:10, rate:4.32, color:"#c9184a", projColor:"#ff8fa3", desc:"Homing shards. (Marine grade)", effect:"dot"},
  "halo_needler_odst": {name:"Needler \u2014 ODST", cat:"halo", cost:171, range:102, damage:13, rate:4.64, color:"#c9184a", projColor:"#ff8fa3", desc:"Homing shards. (ODST grade)", effect:"dot"},
  "halo_needler_spartan": {name:"Needler \u2014 Spartan", cat:"halo", cost:209, range:110, damage:15, rate:4.96, color:"#c9184a", projColor:"#ff8fa3", desc:"Homing shards. (Spartan grade)", effect:"dot"},
  "halo_needler_legendary": {name:"Needler \u2014 Legendary", cat:"halo", cost:247, range:119, damage:18, rate:5.28, color:"#c9184a", projColor:"#ff8fa3", desc:"Homing shards. (Legendary grade)", effect:"dot"},
  "halo_fuel_rod_gun_recruit": {name:"Fuel Rod Gun \u2014 Recruit", cat:"halo", cost:175, range:140, damage:70, rate:0.5, color:"#588157", projColor:"#a7c957", desc:"Radioactive rounds. (Recruit grade)", splash:65},
  "halo_fuel_rod_gun_marine": {name:"Fuel Rod Gun \u2014 Marine", cat:"halo", cost:245, range:154, damage:98, rate:0.54, color:"#588157", projColor:"#a7c957", desc:"Radioactive rounds. (Marine grade)", splash:65},
  "halo_fuel_rod_gun_odst": {name:"Fuel Rod Gun \u2014 ODST", cat:"halo", cost:315, range:168, damage:126, rate:0.58, color:"#588157", projColor:"#a7c957", desc:"Radioactive rounds. (ODST grade)", splash:65},
  "halo_fuel_rod_gun_spartan": {name:"Fuel Rod Gun \u2014 Spartan", cat:"halo", cost:385, range:182, damage:154, rate:0.62, color:"#588157", projColor:"#a7c957", desc:"Radioactive rounds. (Spartan grade)", splash:65},
  "halo_fuel_rod_gun_legendary": {name:"Fuel Rod Gun \u2014 Legendary", cat:"halo", cost:455, range:196, damage:182, rate:0.66, color:"#588157", projColor:"#a7c957", desc:"Radioactive rounds. (Legendary grade)", splash:65},
  "weap_combat_knife_basic": {name:"Combat Knife Basic", cat:"weapon", cost:30, range:50, damage:6, rate:5.0, color:"#8d99ae", projColor:"#edf2f4", desc:"Cheap melee turret, extremely fast strikes. (Basic)"},
  "weap_combat_knife_reinforced": {name:"Combat Knife Reinforced", cat:"weapon", cost:42, range:54, damage:8, rate:5.4, color:"#8d99ae", projColor:"#edf2f4", desc:"Cheap melee turret, extremely fast strikes. (Reinforced)"},
  "weap_combat_knife_tactical": {name:"Combat Knife Tactical", cat:"weapon", cost:54, range:58, damage:11, rate:5.8, color:"#8d99ae", projColor:"#edf2f4", desc:"Cheap melee turret, extremely fast strikes. (Tactical)"},
  "weap_combat_knife_elite": {name:"Combat Knife Elite", cat:"weapon", cost:66, range:62, damage:13, rate:6.2, color:"#8d99ae", projColor:"#edf2f4", desc:"Cheap melee turret, extremely fast strikes. (Elite)"},
  "weap_combat_knife_prototype": {name:"Combat Knife Prototype", cat:"weapon", cost:78, range:66, damage:16, rate:6.6, color:"#8d99ae", projColor:"#edf2f4", desc:"Cheap melee turret, extremely fast strikes. (Prototype)"},
  "weap_katana_blade_basic": {name:"Katana Blade Basic", cat:"weapon", cost:45, range:55, damage:10, rate:4.5, color:"#e63946", projColor:"#f1faee", desc:"Sharp, fast, elegant. (Basic)"},
  "weap_katana_blade_reinforced": {name:"Katana Blade Reinforced", cat:"weapon", cost:63, range:59, damage:14, rate:4.86, color:"#e63946", projColor:"#f1faee", desc:"Sharp, fast, elegant. (Reinforced)"},
  "weap_katana_blade_tactical": {name:"Katana Blade Tactical", cat:"weapon", cost:81, range:64, damage:18, rate:5.22, color:"#e63946", projColor:"#f1faee", desc:"Sharp, fast, elegant. (Tactical)"},
  "weap_katana_blade_elite": {name:"Katana Blade Elite", cat:"weapon", cost:99, range:68, damage:22, rate:5.58, color:"#e63946", projColor:"#f1faee", desc:"Sharp, fast, elegant. (Elite)"},
  "weap_katana_blade_prototype": {name:"Katana Blade Prototype", cat:"weapon", cost:117, range:73, damage:26, rate:5.94, color:"#e63946", projColor:"#f1faee", desc:"Sharp, fast, elegant. (Prototype)"},
  "weap_crossbow_basic": {name:"Crossbow Basic", cat:"weapon", cost:55, range:120, damage:20, rate:1.2, color:"#6a4c93", projColor:"#c9ada7", desc:"Silent, precise bolts. (Basic)"},
  "weap_crossbow_reinforced": {name:"Crossbow Reinforced", cat:"weapon", cost:77, range:130, damage:28, rate:1.3, color:"#6a4c93", projColor:"#c9ada7", desc:"Silent, precise bolts. (Reinforced)"},
  "weap_crossbow_tactical": {name:"Crossbow Tactical", cat:"weapon", cost:99, range:139, damage:36, rate:1.39, color:"#6a4c93", projColor:"#c9ada7", desc:"Silent, precise bolts. (Tactical)"},
  "weap_crossbow_elite": {name:"Crossbow Elite", cat:"weapon", cost:121, range:149, damage:44, rate:1.49, color:"#6a4c93", projColor:"#c9ada7", desc:"Silent, precise bolts. (Elite)"},
  "weap_crossbow_prototype": {name:"Crossbow Prototype", cat:"weapon", cost:143, range:158, damage:52, rate:1.58, color:"#6a4c93", projColor:"#c9ada7", desc:"Silent, precise bolts. (Prototype)"},
  "weap_grenade_launcher_basic": {name:"Grenade Launcher Basic", cat:"weapon", cost:130, range:110, damage:50, rate:0.9, color:"#3a5a40", projColor:"#a3b18a", desc:"Lobs explosive grenades. (Basic)", splash:60},
  "weap_grenade_launcher_reinforced": {name:"Grenade Launcher Reinforced", cat:"weapon", cost:182, range:119, damage:70, rate:0.97, color:"#3a5a40", projColor:"#a3b18a", desc:"Lobs explosive grenades. (Reinforced)", splash:60},
  "weap_grenade_launcher_tactical": {name:"Grenade Launcher Tactical", cat:"weapon", cost:234, range:128, damage:90, rate:1.04, color:"#3a5a40", projColor:"#a3b18a", desc:"Lobs explosive grenades. (Tactical)", splash:60},
  "weap_grenade_launcher_elite": {name:"Grenade Launcher Elite", cat:"weapon", cost:286, range:136, damage:110, rate:1.12, color:"#3a5a40", projColor:"#a3b18a", desc:"Lobs explosive grenades. (Elite)", splash:60},
  "weap_grenade_launcher_prototype": {name:"Grenade Launcher Prototype", cat:"weapon", cost:338, range:145, damage:130, rate:1.19, color:"#3a5a40", projColor:"#a3b18a", desc:"Lobs explosive grenades. (Prototype)", splash:60},
  "weap_flamethrower_basic": {name:"Flamethrower Basic", cat:"weapon", cost:100, range:70, damage:10, rate:6.0, color:"#f77f00", projColor:"#fcbf49", desc:"Continuous burning stream. (Basic)", effect:"burn"},
  "weap_flamethrower_reinforced": {name:"Flamethrower Reinforced", cat:"weapon", cost:140, range:76, damage:14, rate:6.48, color:"#f77f00", projColor:"#fcbf49", desc:"Continuous burning stream. (Reinforced)", effect:"burn"},
  "weap_flamethrower_tactical": {name:"Flamethrower Tactical", cat:"weapon", cost:180, range:81, damage:18, rate:6.96, color:"#f77f00", projColor:"#fcbf49", desc:"Continuous burning stream. (Tactical)", effect:"burn"},
  "weap_flamethrower_elite": {name:"Flamethrower Elite", cat:"weapon", cost:220, range:87, damage:22, rate:7.44, color:"#f77f00", projColor:"#fcbf49", desc:"Continuous burning stream. (Elite)", effect:"burn"},
  "weap_flamethrower_prototype": {name:"Flamethrower Prototype", cat:"weapon", cost:260, range:92, damage:26, rate:7.92, color:"#f77f00", projColor:"#fcbf49", desc:"Continuous burning stream. (Prototype)", effect:"burn"},
  "weap_c4_charge_basic": {name:"C4 Charge Basic", cat:"weapon", cost:160, range:80, damage:100, rate:0.3, color:"#d62828", projColor:"#f77f00", desc:"Remote detonated explosive. (Basic)", splash:90},
  "weap_c4_charge_reinforced": {name:"C4 Charge Reinforced", cat:"weapon", cost:224, range:86, damage:140, rate:0.32, color:"#d62828", projColor:"#f77f00", desc:"Remote detonated explosive. (Reinforced)", splash:90},
  "weap_c4_charge_tactical": {name:"C4 Charge Tactical", cat:"weapon", cost:288, range:93, damage:180, rate:0.35, color:"#d62828", projColor:"#f77f00", desc:"Remote detonated explosive. (Tactical)", splash:90},
  "weap_c4_charge_elite": {name:"C4 Charge Elite", cat:"weapon", cost:352, range:99, damage:220, rate:0.37, color:"#d62828", projColor:"#f77f00", desc:"Remote detonated explosive. (Elite)", splash:90},
  "weap_c4_charge_prototype": {name:"C4 Charge Prototype", cat:"weapon", cost:416, range:106, damage:260, rate:0.4, color:"#d62828", projColor:"#f77f00", desc:"Remote detonated explosive. (Prototype)", splash:90},
  "weap_crossbow_ballista_basic": {name:"Crossbow Ballista Basic", cat:"weapon", cost:180, range:190, damage:70, rate:0.6, color:"#4a4e69", projColor:"#9a8c98", desc:"Siege-grade giant bolts. (Basic)"},
  "weap_crossbow_ballista_reinforced": {name:"Crossbow Ballista Reinforced", cat:"weapon", cost:252, range:205, damage:98, rate:0.65, color:"#4a4e69", projColor:"#9a8c98", desc:"Siege-grade giant bolts. (Reinforced)"},
  "weap_crossbow_ballista_tactical": {name:"Crossbow Ballista Tactical", cat:"weapon", cost:324, range:220, damage:126, rate:0.7, color:"#4a4e69", projColor:"#9a8c98", desc:"Siege-grade giant bolts. (Tactical)"},
  "weap_crossbow_ballista_elite": {name:"Crossbow Ballista Elite", cat:"weapon", cost:396, range:236, damage:154, rate:0.74, color:"#4a4e69", projColor:"#9a8c98", desc:"Siege-grade giant bolts. (Elite)"},
  "weap_crossbow_ballista_prototype": {name:"Crossbow Ballista Prototype", cat:"weapon", cost:468, range:251, damage:182, rate:0.79, color:"#4a4e69", projColor:"#9a8c98", desc:"Siege-grade giant bolts. (Prototype)"},
  "weap_molotov_thrower_basic": {name:"Molotov Thrower Basic", cat:"weapon", cost:90, range:90, damage:15, rate:1.0, color:"#bc6c25", projColor:"#dda15e", desc:"Fire bombs with burn dot. (Basic)", splash:40, effect:"burn"},
  "weap_molotov_thrower_reinforced": {name:"Molotov Thrower Reinforced", cat:"weapon", cost:126, range:97, damage:21, rate:1.08, color:"#bc6c25", projColor:"#dda15e", desc:"Fire bombs with burn dot. (Reinforced)", splash:40, effect:"burn"},
  "weap_molotov_thrower_tactical": {name:"Molotov Thrower Tactical", cat:"weapon", cost:162, range:104, damage:27, rate:1.16, color:"#bc6c25", projColor:"#dda15e", desc:"Fire bombs with burn dot. (Tactical)", splash:40, effect:"burn"},
  "weap_molotov_thrower_elite": {name:"Molotov Thrower Elite", cat:"weapon", cost:198, range:112, damage:33, rate:1.24, color:"#bc6c25", projColor:"#dda15e", desc:"Fire bombs with burn dot. (Elite)", splash:40, effect:"burn"},
  "weap_molotov_thrower_prototype": {name:"Molotov Thrower Prototype", cat:"weapon", cost:234, range:119, damage:39, rate:1.32, color:"#bc6c25", projColor:"#dda15e", desc:"Fire bombs with burn dot. (Prototype)", splash:40, effect:"burn"},
  "veh_battle_tank_i": {name:"Battle Tank I", cat:"vehicle", cost:150, range:100, damage:45, rate:1.0, color:"#4b5320", projColor:"#8a9a5b", desc:"Heavy armor, cannon rounds. (Tier I)", splash:55},
  "veh_battle_tank_ii": {name:"Battle Tank II", cat:"vehicle", cost:207, range:109, damage:62, rate:1.1, color:"#4b5320", projColor:"#8a9a5b", desc:"Heavy armor, cannon rounds. (Tier II)", splash:55},
  "veh_battle_tank_iii": {name:"Battle Tank III", cat:"vehicle", cost:264, range:118, damage:79, rate:1.2, color:"#4b5320", projColor:"#8a9a5b", desc:"Heavy armor, cannon rounds. (Tier III)", splash:55},
  "veh_battle_tank_iv": {name:"Battle Tank IV", cat:"vehicle", cost:321, range:127, damage:96, rate:1.3, color:"#4b5320", projColor:"#8a9a5b", desc:"Heavy armor, cannon rounds. (Tier IV)", splash:55},
  "veh_battle_tank_v": {name:"Battle Tank V", cat:"vehicle", cost:378, range:136, damage:113, rate:1.4, color:"#4b5320", projColor:"#8a9a5b", desc:"Heavy armor, cannon rounds. (Tier V)", splash:55},
  "veh_apc_turret_i": {name:"APC Turret I", cat:"vehicle", cost:95, range:110, damage:15, rate:2.6, color:"#5b6b73", projColor:"#a9c0c9", desc:"Fast autocannon. (Tier I)"},
  "veh_apc_turret_ii": {name:"APC Turret II", cat:"vehicle", cost:131, range:120, damage:21, rate:2.86, color:"#5b6b73", projColor:"#a9c0c9", desc:"Fast autocannon. (Tier II)"},
  "veh_apc_turret_iii": {name:"APC Turret III", cat:"vehicle", cost:167, range:130, damage:26, rate:3.12, color:"#5b6b73", projColor:"#a9c0c9", desc:"Fast autocannon. (Tier III)"},
  "veh_apc_turret_iv": {name:"APC Turret IV", cat:"vehicle", cost:203, range:140, damage:32, rate:3.38, color:"#5b6b73", projColor:"#a9c0c9", desc:"Fast autocannon. (Tier IV)"},
  "veh_apc_turret_v": {name:"APC Turret V", cat:"vehicle", cost:239, range:150, damage:38, rate:3.64, color:"#5b6b73", projColor:"#a9c0c9", desc:"Fast autocannon. (Tier V)"},
  "veh_fighter_jet_strafe_i": {name:"Fighter Jet Strafe I", cat:"vehicle", cost:240, range:250, damage:40, rate:2.2, color:"#2e4057", projColor:"#8bd3dd", desc:"Sky sweep, huge range. (Tier I)"},
  "veh_fighter_jet_strafe_ii": {name:"Fighter Jet Strafe II", cat:"vehicle", cost:331, range:272, damage:55, rate:2.42, color:"#2e4057", projColor:"#8bd3dd", desc:"Sky sweep, huge range. (Tier II)"},
  "veh_fighter_jet_strafe_iii": {name:"Fighter Jet Strafe III", cat:"vehicle", cost:422, range:295, damage:70, rate:2.64, color:"#2e4057", projColor:"#8bd3dd", desc:"Sky sweep, huge range. (Tier III)"},
  "veh_fighter_jet_strafe_iv": {name:"Fighter Jet Strafe IV", cat:"vehicle", cost:514, range:318, damage:86, rate:2.86, color:"#2e4057", projColor:"#8bd3dd", desc:"Sky sweep, huge range. (Tier IV)"},
  "veh_fighter_jet_strafe_v": {name:"Fighter Jet Strafe V", cat:"vehicle", cost:605, range:340, damage:101, rate:3.08, color:"#2e4057", projColor:"#8bd3dd", desc:"Sky sweep, huge range. (Tier V)"},
  "veh_attack_helicopter_i": {name:"Attack Helicopter I", cat:"vehicle", cost:200, range:175, damage:24, rate:3.2, color:"#3f4238", projColor:"#c9d15c", desc:"Twin rocket pods. (Tier I)", multishot:2},
  "veh_attack_helicopter_ii": {name:"Attack Helicopter II", cat:"vehicle", cost:276, range:191, damage:33, rate:3.52, color:"#3f4238", projColor:"#c9d15c", desc:"Twin rocket pods. (Tier II)", multishot:2},
  "veh_attack_helicopter_iii": {name:"Attack Helicopter III", cat:"vehicle", cost:352, range:206, damage:42, rate:3.84, color:"#3f4238", projColor:"#c9d15c", desc:"Twin rocket pods. (Tier III)", multishot:2},
  "veh_attack_helicopter_iv": {name:"Attack Helicopter IV", cat:"vehicle", cost:428, range:222, damage:51, rate:4.16, color:"#3f4238", projColor:"#c9d15c", desc:"Twin rocket pods. (Tier IV)", multishot:2},
  "veh_attack_helicopter_v": {name:"Attack Helicopter V", cat:"vehicle", cost:504, range:238, damage:60, rate:4.48, color:"#3f4238", projColor:"#c9d15c", desc:"Twin rocket pods. (Tier V)", multishot:2},
  "veh_artillery_truck_i": {name:"Artillery Truck I", cat:"vehicle", cost:170, range:155, damage:78, rate:0.5, color:"#6b4226", projColor:"#d9a441", desc:"Self-propelled howitzer. (Tier I)", splash:85},
  "veh_artillery_truck_ii": {name:"Artillery Truck II", cat:"vehicle", cost:235, range:169, damage:108, rate:0.55, color:"#6b4226", projColor:"#d9a441", desc:"Self-propelled howitzer. (Tier II)", splash:85},
  "veh_artillery_truck_iii": {name:"Artillery Truck III", cat:"vehicle", cost:299, range:183, damage:137, rate:0.6, color:"#6b4226", projColor:"#d9a441", desc:"Self-propelled howitzer. (Tier III)", splash:85},
  "veh_artillery_truck_iv": {name:"Artillery Truck IV", cat:"vehicle", cost:364, range:197, damage:167, rate:0.65, color:"#6b4226", projColor:"#d9a441", desc:"Self-propelled howitzer. (Tier IV)", splash:85},
  "veh_artillery_truck_v": {name:"Artillery Truck V", cat:"vehicle", cost:428, range:211, damage:197, rate:0.7, color:"#6b4226", projColor:"#d9a441", desc:"Self-propelled howitzer. (Tier V)", splash:85},
  "veh_drone_carrier_i": {name:"Drone Carrier I", cat:"vehicle", cost:210, range:135, damage:16, rate:3.0, color:"#495867", projColor:"#bdd5ea", desc:"Launches 4 armed drones. (Tier I)", multishot:4},
  "veh_drone_carrier_ii": {name:"Drone Carrier II", cat:"vehicle", cost:290, range:147, damage:22, rate:3.3, color:"#495867", projColor:"#bdd5ea", desc:"Launches 4 armed drones. (Tier II)", multishot:4},
  "veh_drone_carrier_iii": {name:"Drone Carrier III", cat:"vehicle", cost:370, range:159, damage:28, rate:3.6, color:"#495867", projColor:"#bdd5ea", desc:"Launches 4 armed drones. (Tier III)", multishot:4},
  "veh_drone_carrier_iv": {name:"Drone Carrier IV", cat:"vehicle", cost:449, range:171, damage:34, rate:3.9, color:"#495867", projColor:"#bdd5ea", desc:"Launches 4 armed drones. (Tier IV)", multishot:4},
  "veh_drone_carrier_v": {name:"Drone Carrier V", cat:"vehicle", cost:529, range:184, damage:40, rate:4.2, color:"#495867", projColor:"#bdd5ea", desc:"Launches 4 armed drones. (Tier V)", multishot:4},
  "veh_stealth_bomber_i": {name:"Stealth Bomber I", cat:"vehicle", cost:280, range:220, damage:150, rate:0.25, color:"#1b1b1b", projColor:"#4a4a4a", desc:"Rare devastating payload. (Tier I)", splash:100},
  "veh_stealth_bomber_ii": {name:"Stealth Bomber II", cat:"vehicle", cost:386, range:240, damage:207, rate:0.28, color:"#1b1b1b", projColor:"#4a4a4a", desc:"Rare devastating payload. (Tier II)", splash:100},
  "veh_stealth_bomber_iii": {name:"Stealth Bomber III", cat:"vehicle", cost:493, range:260, damage:264, rate:0.3, color:"#1b1b1b", projColor:"#4a4a4a", desc:"Rare devastating payload. (Tier III)", splash:100},
  "veh_stealth_bomber_iv": {name:"Stealth Bomber IV", cat:"vehicle", cost:599, range:279, damage:321, rate:0.33, color:"#1b1b1b", projColor:"#4a4a4a", desc:"Rare devastating payload. (Tier IV)", splash:100},
  "veh_stealth_bomber_v": {name:"Stealth Bomber V", cat:"vehicle", cost:706, range:299, damage:378, rate:0.35, color:"#1b1b1b", projColor:"#4a4a4a", desc:"Rare devastating payload. (Tier V)", splash:100},
};

const ENEMY_TYPES = {
  grunt: { hp: 40, speed: 55, reward: 16, color: '#6de08a', radius: 10 },
  runner: { hp: 25, speed: 100, reward: 18, color: '#ffe066', radius: 8 },
  tank: { hp: 160, speed: 32, reward: 40, color: '#c04f4f', radius: 14 },
  boss: { hp: 600, speed: 28, reward: 180, color: '#ff3fae', radius: 20 },
};

const HOTKEY_TOWERS = ['arrow', 'cannon', 'frost', 'sniper'];

const PET_TYPES = {
  wolf: { name: 'Wolf Pup', cost: 90, dmg: 14, rate: 1.4, heal: 0, range: 90, color: '#a0785a', desc: 'Guards the base entrance, bites nearby enemies.' },
  phoenix: { name: 'Phoenix', cost: 160, dmg: 10, rate: 1.0, heal: 1, range: 110, color: '#ff7a3c', desc: 'Heals 1 life every few seconds and scorches enemies.' },
  golem: { name: 'Stone Golem', cost: 220, dmg: 26, rate: 0.6, heal: 0.5, range: 80, color: '#8a8f99', desc: 'Slow but hits hard, slowly mends the base.' },
};

const BEST_KEY = 'td_best_score_v1';
const MAX_LIVES = 15;

let state = {};
function freshState() {
  return {
    gold: 200,
    lives: MAX_LIVES,
    wave: 0,
    waveTotal: 100,
    score: 0,
    towers: [],
    pets: [],
    enemies: [],
    projectiles: [],
    particles: [],
    selectedTowerType: null,
    selectedTower: null,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    speed: 1,
    paused: false,
    gameOver: false,
    won: false,
    occupied: new Set(),
    autoWave: false,
    muted: false,
    hoverCell: null,
    movingTower: null,
  };
}
state = freshState();

// ---------- UI refs ----------
const goldEl = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const waveTotalEl = document.getElementById('waveTotal');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const logEl = document.getElementById('log');
const startWaveBtn = document.getElementById('startWaveBtn');
const speedBtn = document.getElementById('speedBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const helpBtn = document.getElementById('helpBtn');
const restartBtn = document.getElementById('restartBtn');
const selectedPanel = document.getElementById('selected-panel');
const selectedInfo = document.getElementById('selected-info');
const upgradeBtn = document.getElementById('upgradeBtn');
const sellBtn = document.getElementById('sellBtn');
const moveBtn = document.getElementById('moveBtn');
const upgradeCostEl = document.getElementById('upgradeCost');
const sellValueEl = document.getElementById('sellValue');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayBtn = document.getElementById('overlay-btn');
const helpOverlay = document.getElementById('help-overlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const cancelPlaceBtn = document.getElementById('cancelPlaceBtn');
const towerListEl = document.getElementById('tower-list');
const towerSearchEl = document.getElementById('towerSearch');
const catTabs = document.querySelectorAll('.cat-tab');
const nextWavePreviewEl = document.getElementById('next-wave-preview');
const autoWaveChk = document.getElementById('autoWaveChk');
const toastWrap = document.getElementById('toast-wrap');
const petsListEl = document.getElementById('pets-list');
const ownedPetsEl = document.getElementById('owned-pets');

waveTotalEl.textContent = state.waveTotal;
bestEl.textContent = localStorage.getItem(BEST_KEY) || '0';

function log(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  logEl.prepend(div);
  while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
}

function toast(msg, kind) {
  const div = document.createElement('div');
  div.className = 'toast' + (kind ? ' toast-' + kind : '');
  div.textContent = msg;
  toastWrap.appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 300);
  }, 2200);
}

// ---------- Simple sound (WebAudio beeps, no assets needed) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  return audioCtx;
}
function beep(freq, dur, type, vol) {
  if (state.muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  gain.gain.value = (vol || 0.05);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.stop(ac.currentTime + dur);
}
const sfx = {
  place: () => beep(440, 0.08, 'triangle', 0.06),
  shoot: () => beep(880, 0.03, 'square', 0.02),
  hit: () => beep(220, 0.04, 'sawtooth', 0.02),
  kill: () => beep(660, 0.12, 'triangle', 0.05),
  leak: () => beep(120, 0.25, 'sawtooth', 0.07),
  wave: () => beep(550, 0.15, 'sine', 0.06),
  upgrade: () => beep(700, 0.1, 'triangle', 0.05),
  sell: () => beep(330, 0.1, 'sine', 0.05),
  win: () => { beep(660,0.15,'triangle',0.07); setTimeout(()=>beep(880,0.2,'triangle',0.07),150); },
  lose: () => { beep(200,0.3,'sawtooth',0.08); setTimeout(()=>beep(120,0.4,'sawtooth',0.08),200); },
};

// ---------- Tower shop rendering ----------
let currentFilter = { cat: 'all', search: '' };

function renderTowerList() {
  const q = currentFilter.search.trim().toLowerCase();
  const ids = Object.keys(TOWER_TYPES).filter(id => {
    const def = TOWER_TYPES[id];
    if (currentFilter.cat !== 'all' && def.cat !== currentFilter.cat) return false;
    if (q && !def.name.toLowerCase().includes(q) && !def.cat.toLowerCase().includes(q)) return false;
    return true;
  });
  towerListEl.innerHTML = '';
  if (ids.length === 0) {
    towerListEl.innerHTML = '<div class="empty-msg">No towers match.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  ids.forEach(id => {
    const def = TOWER_TYPES[id];
    const card = document.createElement('div');
    card.className = 'tower-card cat-' + def.cat;
    card.dataset.tower = id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Select ${def.name}, costs ${def.cost} galleons`);
    const hotIdx = HOTKEY_TOWERS.indexOf(id);
    let extraTags = '';
    if (def.splash) extraTags += `<span class="tag">splash</span>`;
    if (def.slow) extraTags += `<span class="tag">slow</span>`;
    if (def.effect) extraTags += `<span class="tag">${def.effect}</span>`;
    if (def.pierce) extraTags += `<span class="tag">pierce</span>`;
    if (def.multishot) extraTags += `<span class="tag">x${def.multishot}</span>`;
    card.innerHTML = `
      ${hotIdx >= 0 ? `<div class="hotkey">${hotIdx+1}</div>` : ''}
      <div class="tower-icon" style="background: radial-gradient(circle at 35% 35%, ${def.projColor}, ${def.color});"></div>
      <div class="tower-info">
        <div class="tower-name">${def.name}</div>
        <div class="tower-cost">\ud83d\udcb0 ${def.cost} <span class="tower-cat-badge">${def.cat}</span></div>
        <div class="tower-tags">${extraTags}</div>
      </div>
      <div class="tower-tip">${def.desc || ''}<br>Dmg ${def.damage} \u00b7 Range ${def.range} \u00b7 Rate ${def.rate}/s</div>
    `;
    card.addEventListener('click', () => selectTowerType(id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTowerType(id); }
    });
    frag.appendChild(card);
  });
  towerListEl.appendChild(frag);
  syncShopAffordability();
}

function selectTowerType(id) {
  if (state.gold < TOWER_TYPES[id].cost) { toast("Not enough galleons", 'warn'); return; }
  if (state.selectedTowerType === id) {
    state.selectedTowerType = null;
  } else {
    state.selectedTowerType = id;
    state.selectedTower = null;
    selectedPanel.classList.add('hidden');
  }
  cancelPlaceBtn.classList.toggle('hidden', !state.selectedTowerType);
  document.querySelectorAll('.tower-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.tower === state.selectedTowerType);
  });
}

towerSearchEl.addEventListener('input', () => {
  currentFilter.search = towerSearchEl.value;
  renderTowerList();
});

catTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    catTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter.cat = tab.dataset.cat;
    renderTowerList();
  });
});

cancelPlaceBtn.addEventListener('click', () => {
  state.selectedTowerType = null;
  state.movingTower = null;
  moveBtn.classList.remove('active');
  cancelPlaceBtn.classList.add('hidden');
  cancelPlaceBtn.textContent = '\u2715 Cancel Placement (Esc)';
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
});

// ---------- Canvas interaction ----------
function canvasCoordsFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
  const mx = (clientX - rect.left) * (CW / rect.width);
  const my = (clientY - rect.top) * (CH / rect.height);
  return { mx, my, cx: Math.floor(mx / GRID), cy: Math.floor(my / GRID) };
}

canvas.addEventListener('mousemove', (e) => {
  const { cx, cy } = canvasCoordsFromEvent(e);
  state.hoverCell = { cx, cy };
});
canvas.addEventListener('mouseleave', () => { state.hoverCell = null; });

canvas.addEventListener('click', (e) => {
  const { cx, cy } = canvasCoordsFromEvent(e);
  if (state.movingTower) {
    tryMoveTower(cx, cy);
    return;
  }
  if (state.selectedTowerType) {
    tryPlaceTower(cx, cy);
    return;
  }
  const clicked = state.towers.find(t => t.cx === cx && t.cy === cy);
  if (clicked) {
    selectTower(clicked);
  } else {
    state.selectedTower = null;
    selectedPanel.classList.add('hidden');
  }
});

function tryMoveTower(cx, cy) {
  const t = state.movingTower;
  const key = cellKey(cx, cy);
  if (cx < 0 || cy < 0 || cx >= CW/GRID || cy >= CH/GRID) return;
  if (pathBlocked.has(key) || (state.occupied.has(key) && key !== cellKey(t.cx, t.cy))) {
    toast('Cannot move there', 'warn');
    return;
  }
  state.occupied.delete(cellKey(t.cx, t.cy));
  t.cx = cx; t.cy = cy;
  t.x = cx*GRID + GRID/2; t.y = cy*GRID + GRID/2;
  state.occupied.add(key);
  log(`Moved ${TOWER_TYPES[t.type].name} to (${cx},${cy})`);
  sfx.place();
  state.movingTower = null;
  moveBtn.classList.remove('active');
  updateHUD();
}

function tryPlaceTower(cx, cy) {
  const key = cellKey(cx, cy);
  if (cx < 0 || cy < 0 || cx >= CW/GRID || cy >= CH/GRID) return;
  if (pathBlocked.has(key) || state.occupied.has(key)) {
    toast('Cannot build there', 'warn');
    return;
  }
  const def = TOWER_TYPES[state.selectedTowerType];
  if (state.gold < def.cost) { toast('Not enough galleons', 'warn'); return; }
  state.gold -= def.cost;
  const tower = {
    id: Math.random().toString(36).slice(2),
    type: state.selectedTowerType,
    cx, cy,
    x: cx*GRID + GRID/2, y: cy*GRID + GRID/2,
    level: 1,
    cooldown: 0,
    totalCost: def.cost,
  };
  state.towers.push(tower);
  state.occupied.add(key);
  log(`Built ${def.name} at (${cx},${cy})`);
  sfx.place();
  state.selectedTowerType = null;
  cancelPlaceBtn.classList.add('hidden');
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
  updateHUD();
  renderTowerList();
}

function selectTower(t) {
  state.selectedTower = t;
  state.selectedTowerType = null;
  cancelPlaceBtn.classList.add('hidden');
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
  selectedPanel.classList.remove('hidden');
  renderSelected();
}

function towerStats(t) {
  const def = TOWER_TYPES[t.type];
  const mult = 1 + (t.level - 1) * 0.5;
  return {
    range: def.range * (1 + (t.level-1)*2.5),
    damage: def.damage * mult,
    rate: def.rate,
    splash: def.splash,
    slow: def.slow,
    slowDur: def.slowDur,
    effect: def.effect,
    pierce: def.pierce,
    multishot: def.multishot,
  };
}

function upgradeCost(t) { return Math.round(TOWER_TYPES[t.type].cost * 0.75 * t.level); }
function sellValue(t) { return Math.round(t.totalCost * 0.8); }

function renderSelected() {
  const t = state.selectedTower;
  if (!t) return;
  const def = TOWER_TYPES[t.type];
  const st = towerStats(t);
  let extra = '';
  if (st.splash) extra += `Splash: ${st.splash}<br>`;
  if (st.slow) extra += `Slow: ${Math.round(st.slow*100)}%<br>`;
  if (st.effect) extra += `Effect: ${st.effect}<br>`;
  if (st.pierce) extra += `Pierce: yes<br>`;
  if (st.multishot) extra += `Multishot: x${st.multishot}<br>`;
  selectedInfo.innerHTML = `<b>${def.name}</b> (Lv ${t.level})<br>
    Damage: ${st.damage.toFixed(0)}<br>
    Range: ${st.range.toFixed(0)}<br>
    Rate: ${st.rate.toFixed(2)}/s<br>${extra}`;
  upgradeCostEl.textContent = upgradeCost(t);
  sellValueEl.textContent = sellValue(t);
  upgradeBtn.disabled = state.gold < upgradeCost(t);
}

upgradeBtn.addEventListener('click', () => {
  const t = state.selectedTower;
  if (!t) return;
  const cost = upgradeCost(t);
  if (state.gold < cost) { toast('Not enough galleons', 'warn'); return; }
  state.gold -= cost;
  t.totalCost += cost;
  t.level += 1;
  log(`Upgraded ${TOWER_TYPES[t.type].name} to Lv ${t.level}`);
  sfx.upgrade();
  renderSelected();
  updateHUD();
});

sellBtn.addEventListener('click', () => {
  const t = state.selectedTower;
  if (!t) return;
  state.gold += sellValue(t);
  state.towers = state.towers.filter(x => x.id !== t.id);
  state.occupied.delete(cellKey(t.cx, t.cy));
  log(`Sold ${TOWER_TYPES[t.type].name}`);
  sfx.sell();
  state.selectedTower = null;
  selectedPanel.classList.add('hidden');
  updateHUD();
  renderTowerList();
});

moveBtn.addEventListener('click', () => {
  const t = state.selectedTower;
  if (!t) return;
  state.movingTower = t;
  state.selectedTowerType = null;
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
  cancelPlaceBtn.classList.remove('hidden');
  cancelPlaceBtn.textContent = '\u2715 Cancel Move (Esc)';
  moveBtn.classList.add('active');
});

// ---------- Pets ----------
function renderPetsList() {
  petsListEl.innerHTML = '';
  Object.keys(PET_TYPES).forEach(id => {
    const def = PET_TYPES[id];
    const card = document.createElement('div');
    card.className = 'tower-card';
    card.innerHTML = `<div class="tower-icon" style="background:${def.color};border-radius:50%;"></div>
      <div class="tower-info">
        <div class="tower-name">${def.name}</div>
        <div class="tower-cost">\ud83d\udcb0 ${def.cost}</div>
        <div class="tower-tags"><span class="tag">dmg ${def.dmg}</span>${def.heal ? `<span class="tag">heal +${def.heal}/4s</span>` : ''}</div>
      </div>
      <div class="tower-tip">${def.desc}</div>`;
    card.addEventListener('click', () => buyPet(id));
    petsListEl.appendChild(card);
  });
  renderOwnedPets();
}

function renderOwnedPets() {
  ownedPetsEl.innerHTML = state.pets.length
    ? `<div class="hint">Guarding: ${state.pets.map(p => PET_TYPES[p.type].name).join(', ')}</div>`
    : `<div class="hint">No pets yet.</div>`;
}

function buyPet(id) {
  const def = PET_TYPES[id];
  if (state.gold < def.cost) { toast('Not enough galleons', 'warn'); return; }
  state.gold -= def.cost;
  state.pets.push({ type: id, cooldown: 0, healCooldown: 0 });
  log(`Adopted a ${def.name} to guard the base!`);
  sfx.place();
  updateHUD();
  renderOwnedPets();
}

// ---------- Waves ----------
// Difficulty scaling: harder from wave 1, and escalates faster each wave.
function enemyHpMult(n) { return 1 + (n - 1) * 0.35; }
function enemySpeedMult(n) { return 1 + Math.min((n - 1) * 0.06, 1.2); }
function waveSpawnDelay(n) { return Math.max(0.18, 0.55 - n * 0.03); }

function buildWave(n) {
  const queue = [];
  const count = 8 + Math.round(n * 2.6); // more enemies per wave, from the start
  for (let i = 0; i < count; i++) {
    let type = 'grunt';
    const r = Math.random();
    if (n >= 1 && r < 0.15) type = 'runner';       // runners appear immediately
    if (n >= 2 && r > 0.82) type = 'tank';          // tanks appear earlier
    queue.push({ type, delay: waveSpawnDelay(n) });
  }
  if (n % 4 === 0) queue.push({ type: 'boss', delay: 1 }); // bosses more frequent
  return queue;
}

function describeWave(n) {
  if (n > state.waveTotal) return 'All waves complete';
  const q = buildWave(n);
  const counts = {};
  q.forEach(e => counts[e.type] = (counts[e.type]||0) + 1);
  return Object.entries(counts).map(([t,c]) => `${c}x ${t}`).join(', ');
}

function updateNextWavePreview() {
  const n = state.wave + 1;
  if (state.gameOver) { nextWavePreviewEl.textContent = '\u2014'; return; }
  if (n > state.waveTotal) { nextWavePreviewEl.textContent = 'No more waves'; return; }
  nextWavePreviewEl.textContent = `Wave ${n}: ${describeWave(n)}`;
}

function startNextWave() {
  if (state.waveActive || state.gameOver) return;
  state.wave += 1;
  if (state.wave > state.waveTotal) return;
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = 0;
  state.waveActive = true;
  startWaveBtn.disabled = true;
  log(`Wave ${state.wave} started!`);
  sfx.wave();
  updateHUD();
  updateNextWavePreview();
}
startWaveBtn.addEventListener('click', startNextWave);

speedBtn.addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
  speedBtn.textContent = `Speed: ${state.speed}x`;
});

pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? '\u25b6 Resume' : '\u23f8 Pause';
});

muteBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  muteBtn.textContent = state.muted ? '\ud83d\udd07' : '\ud83d\udd0a';
});

helpBtn.addEventListener('click', () => helpOverlay.classList.remove('hidden'));
closeHelpBtn.addEventListener('click', () => helpOverlay.classList.add('hidden'));

autoWaveChk.addEventListener('change', () => { state.autoWave = autoWaveChk.checked; });

function resetGame() {
  state = freshState();
  waveTotalEl.textContent = state.waveTotal;
  document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
  selectedPanel.classList.add('hidden');
  overlay.classList.add('hidden');
  cancelPlaceBtn.classList.add('hidden');
  startWaveBtn.disabled = false;
  pauseBtn.textContent = '\u23f8 Pause';
  speedBtn.textContent = 'Speed: 1x';
  autoWaveChk.checked = false;
  logEl.innerHTML = '';
  log('Game restarted.');
  updateHUD();
  updateNextWavePreview();
  renderTowerList();
  renderPetsList();
}
restartBtn.addEventListener('click', resetGame);
overlayBtn.addEventListener('click', resetGame);

function syncShopAffordability() {
  document.querySelectorAll('#tower-list .tower-card').forEach(card => {
    const type = card.dataset.tower;
    if (!type || !TOWER_TYPES[type]) return;
    card.classList.toggle('disabled', state.gold < TOWER_TYPES[type].cost);
  });
  document.querySelectorAll('#pets-list .tower-card').forEach((card, idx) => {
    const id = Object.keys(PET_TYPES)[idx];
    if (!id) return;
    card.classList.toggle('disabled', state.gold < PET_TYPES[id].cost);
  });
}

function updateHUD() {
  goldEl.textContent = state.gold;
  livesEl.textContent = state.lives;
  waveEl.textContent = state.wave;
  scoreEl.textContent = state.score;
  document.getElementById('stat-lives').classList.toggle('low', state.lives <= 5);
  syncShopAffordability();
  if (state.selectedTower) renderSelected();
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  if (state.score > best) {
    localStorage.setItem(BEST_KEY, String(state.score));
    bestEl.textContent = state.score;
  }
}

function endGame(won) {
  state.gameOver = true;
  state.won = won;
  overlay.classList.remove('hidden');
  overlayTitle.textContent = won ? 'Victory!' : 'Game Over';
  overlayText.textContent = won
    ? `You survived all ${state.waveTotal} waves! Score: ${state.score}`
    : `Your base fell on wave ${state.wave}. Score: ${state.score}`;
  if (won) sfx.win(); else sfx.lose();
  updateNextWavePreview();
}

// ---------- Game loop ----------
function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const hpMult = enemyHpMult(state.wave);
  const spdMult = enemySpeedMult(state.wave);
  const hp = Math.round(def.hp * hpMult);
  state.enemies.push({
    type, hp, maxHp: hp, speed: def.speed * spdMult, reward: def.reward,
    color: def.color, radius: def.radius,
    x: path[0].x, y: path[0].y, seg: 0, slowUntil: 0, slowFactor: 1,
    dotUntil: 0, dotDps: 0, armorShredUntil: 0, stunUntil: 0,
  });
}

function updateSpawning(dt) {
  if (!state.waveActive) return;
  if (state.spawnQueue.length === 0) {
    if (state.enemies.length === 0) {
      state.waveActive = false;
      state.gold += 50 + state.wave * 8;
      log(`Wave ${state.wave} cleared! Bonus galleons awarded.`);
      if (state.wave >= state.waveTotal) {
        endGame(true);
      } else {
        startWaveBtn.disabled = false;
        if (state.autoWave) setTimeout(() => { if (!state.gameOver) startNextWave(); }, 1200);
      }
      updateHUD();
      updateNextWavePreview();
    }
    return;
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const next = state.spawnQueue.shift();
    spawnEnemy(next.type);
    state.spawnTimer = next.delay;
  }
}

function updateEnemies(dt, now) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    let spd = e.speed;
    if (now < e.slowUntil) spd *= e.slowFactor;
    if (now < e.stunUntil) spd = 0;
    if (now < e.dotUntil) {
      e.hp -= e.dotDps * dt;
    }
    const target = path[e.seg + 1];
    if (!target) {
      state.enemies.splice(i, 1);
      state.lives -= 1;
      log(`${e.type} reached the base!`);
      sfx.leak();
      if (state.lives <= 0) { state.lives = 0; endGame(false); }
      updateHUD();
      continue;
    }
    const dx = target.x - e.x, dy = target.y - e.y;
    const dist = Math.hypot(dx, dy);
    const move = spd * dt;
    if (move >= dist) {
      e.x = target.x; e.y = target.y; e.seg += 1;
    } else if (move > 0) {
      e.x += dx/dist * move;
      e.y += dy/dist * move;
    }
    if (e.hp <= 0) {
      state.enemies.splice(i, 1);
      state.gold += e.reward;
      state.score += e.reward * 2;
      spawnParticles(e.x, e.y, e.color);
      sfx.kill();
      updateHUD();
    }
  }
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x, y, color,
      vx: (Math.random()-0.5)*140, vy: (Math.random()-0.5)*140,
      life: 0.4,
    });
  }
}

function applyEffect(target, st, now) {
  if (!st.effect) return;
  switch (st.effect) {
    case 'burn':
    case 'dot':
      target.dotUntil = now + 2;
      target.dotDps = Math.max(target.dotDps, st.damage * 0.25);
      break;
    case 'stun':
      target.stunUntil = now + 0.6;
      break;
    case 'armorshred':
      target.armorShredUntil = now + 3;
      target.armorShredMult = 1.25;
      break;
    case 'chain':
      break;
    case 'knockback':
      target.seg = Math.max(0, target.seg - 0.15);
      break;
    default: break;
  }
}

function findTarget(t, st) {
  let target = null, bestProg = -1;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d <= st.range && e.seg > bestProg) { bestProg = e.seg; target = e; }
  }
  return target;
}

function updatePets(dt, now) {
  const base = path[path.length - 1];
  for (const p of state.pets) {
    p.cooldown -= dt;
    p.healCooldown = (p.healCooldown || 0) - dt;
    const def = PET_TYPES[p.type];
    if (def.heal > 0 && p.healCooldown <= 0 && state.lives < MAX_LIVES && state.lives > 0) {
      state.lives = Math.min(MAX_LIVES, state.lives + def.heal);
      p.healCooldown = 4;
      updateHUD();
    }
    if (p.cooldown > 0) continue;
    let target = null, bestProg = -1;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - base.x, e.y - base.y);
      if (d <= def.range && e.seg > bestProg) { bestProg = e.seg; target = e; }
    }
    if (target) {
      p.cooldown = 1 / def.rate;
      target.hp -= def.dmg;
      sfx.hit();
    }
  }
}

function updateTowers(dt, now) {
  for (const t of state.towers) {
    t.cooldown -= dt;
    const st = towerStats(t);
    if (t.cooldown > 0) continue;
    const target = findTarget(t, st);
    if (target) {
      t.cooldown = 1 / st.rate;
      const def = TOWER_TYPES[t.type];
      const shots = st.multishot || 1;
      for (let s = 0; s < shots; s++) {
        state.projectiles.push({
          x: t.x, y: t.y, target, damage: st.damage, speed: 420,
          color: def.projColor, splash: st.splash, slow: st.slow, slowDur: st.slowDur,
          effect: st.effect, pierce: st.pierce, spread: s,
        });
      }
      sfx.shoot();
    }
  }
}

function updateProjectiles(dt, now) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (!state.enemies.includes(p.target)) { state.projectiles.splice(i,1); continue; }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (move >= dist) {
      let dmg = p.damage;
      if (p.target.armorShredUntil > now) dmg *= (p.target.armorShredMult || 1);
      p.target.hp -= dmg;
      sfx.hit();
      if (p.slow) { p.target.slowUntil = now + p.slowDur; p.target.slowFactor = p.slow; }
      applyEffect(p.target, p, now);
      if (p.effect === 'chain') {
        let chained = 0;
        for (const e of state.enemies) {
          if (e === p.target || chained >= 2) continue;
          if (Math.hypot(e.x - p.target.x, e.y - p.target.y) <= 90) {
            e.hp -= dmg * 0.5;
            chained++;
          }
        }
      }
      if (p.splash > 0) {
        for (const e of state.enemies) {
          if (e === p.target) continue;
          if (Math.hypot(e.x - p.target.x, e.y - p.target.y) <= p.splash) e.hp -= dmg * 0.5;
        }
      }
      state.projectiles.splice(i, 1);
    } else {
      p.x += dx/dist*move; p.y += dy/dist*move;
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { state.particles.splice(i,1); continue; }
    pt.x += pt.vx*dt; pt.y += pt.vy*dt;
  }
}

// ---------- Rendering ----------
function draw() {
  ctx.clearRect(0,0,CW,CH);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let x=0;x<=CW;x+=GRID){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke(); }
  for (let y=0;y<=CH;y+=GRID){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke(); }

  ctx.strokeStyle = '#3a4666';
  ctx.lineWidth = GRID*0.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.strokeStyle = '#4c5a80';
  ctx.lineWidth = 2;
  ctx.setLineDash([8,6]);
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const last = path[path.length-1];
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath(); ctx.arc(last.x, last.y, 14, 0, Math.PI*2); ctx.fill();

  // pets rendered around the base
  state.pets.forEach((p, i) => {
    const def = PET_TYPES[p.type];
    const angle = (i / Math.max(1, state.pets.length)) * Math.PI * 2;
    const px = last.x + Math.cos(angle) * 24;
    const py = last.y + Math.sin(angle) * 24;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI*2); ctx.fill();
  });

  if ((state.selectedTowerType || state.movingTower) && state.hoverCell) {
    const { cx, cy } = state.hoverCell;
    const key = cellKey(cx, cy);
    const def = state.movingTower ? TOWER_TYPES[state.movingTower.type] : TOWER_TYPES[state.selectedTowerType];
    const ownKey = state.movingTower ? cellKey(state.movingTower.cx, state.movingTower.cy) : null;
    const valid = !pathBlocked.has(key) && (!state.occupied.has(key) || key === ownKey) &&
      cx >= 0 && cy >= 0 && cx < CW/GRID && cy < CH/GRID;
    const px = cx*GRID + GRID/2, py = cy*GRID + GRID/2;
    ctx.strokeStyle = valid ? 'rgba(110,224,138,0.5)' : 'rgba(255,92,92,0.5)';
    ctx.fillStyle = valid ? 'rgba(110,224,138,0.15)' : 'rgba(255,92,92,0.15)';
    ctx.beginPath(); ctx.arc(px, py, def.range, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = valid ? 'rgba(110,224,138,0.6)' : 'rgba(255,92,92,0.6)';
    ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI*2); ctx.fill();
  }

  for (const t of state.towers) {
    const def = TOWER_TYPES[t.type];
    const st = towerStats(t);
    if (state.selectedTower === t) {
      ctx.strokeStyle = 'rgba(255,209,102,0.4)';
      ctx.beginPath(); ctx.arc(t.x, t.y, st.range, 0, Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('L'+t.level, t.x, t.y+3);
  }

  for (const e of state.enemies) {
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2); ctx.fill();
    const w = e.radius*2;
    ctx.fillStyle = '#000';
    ctx.fillRect(e.x-w/2, e.y-e.radius-8, w, 4);
    ctx.fillStyle = '#6de08a';
    ctx.fillRect(e.x-w/2, e.y-e.radius-8, w*Math.max(0,e.hp/e.maxHp), 4);
  }

  for (const p of state.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
  }

  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life/0.4);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

let lastTime = performance.now();
function loop(now) {
  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (!state.paused && !state.gameOver) {
    const dt = rawDt * state.speed;
    const simNow = now/1000;
    updateSpawning(dt);
    updateTowers(dt, simNow);
    updateProjectiles(dt, simNow);
    updateEnemies(dt, simNow);
    updateParticles(dt);
    updatePets(dt, simNow);
  }
  draw();
  requestAnimationFrame(loop);
}

// ---------- Keyboard shortcuts ----------
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  switch (e.key) {
    case '1': case '2': case '3': case '4': {
      const idx = parseInt(e.key, 10) - 1;
      if (HOTKEY_TOWERS[idx]) selectTowerType(HOTKEY_TOWERS[idx]);
      break;
    }
    case 'Escape':
      state.selectedTowerType = null;
      state.movingTower = null;
      moveBtn.classList.remove('active');
      cancelPlaceBtn.classList.add('hidden');
      cancelPlaceBtn.textContent = '\u2715 Cancel Placement (Esc)';
      document.querySelectorAll('.tower-card').forEach(c => c.classList.remove('selected'));
      helpOverlay.classList.add('hidden');
      break;
    case 'Enter':
      startNextWave();
      break;
    case ' ':
      e.preventDefault();
      pauseBtn.click();
      break;
    case 's': case 'S':
      speedBtn.click();
      break;
    case 'm': case 'M':
      muteBtn.click();
      break;
    case 'h': case 'H':
      helpOverlay.classList.toggle('hidden');
      break;
    case 'Delete': case 'Backspace':
      if (state.selectedTower) sellBtn.click();
      break;
    default: break;
  }
});

// ---------- Init ----------
renderTowerList();
renderPetsList();
updateHUD();
updateNextWavePreview();
log('Welcome! Build towers and start the first wave. Press H for help.');
requestAnimationFrame(loop);
