/* CONTRAIL — shared data (catalogue, liveries, airports, missions). Mirrors Claude's SPEC.md §8–§10. */
(function () {
  // fm = flight-model class (see FM below), geo = 3D/2D shape kind
  const A = (id, name, mfr, cat, sil, engines, speed, range, ceiling, seats, tags, fm, geo, extra) =>
    Object.assign({ id, name, mfr, cat, sil, engines, speed, range, ceiling, seats, tags, fm, geo }, extra || {});

  const AIRCRAFT = [
    A('b738', 'Boeing 737-800', 'Boeing', 'Airliner', 'narrowbody', '2× CFM56-7B', '453 kt', '2,935 nm', '41,000 ft', '189', ['Included', 'Study'], 'jetliner', 'airliner', { nEng: 2 }),
    A('a20n', 'Airbus A320neo', 'Airbus', 'Airliner', 'narrowbody', '2× LEAP-1A', '450 kt', '3,500 nm', '39,800 ft', '194', ['Included', 'Study'], 'jetliner', 'airliner', { nEng: 2 }),
    A('b789', 'Boeing 787-9', 'Boeing', 'Airliner', 'widebody', '2× GEnx-1B', '488 kt', '7,635 nm', '43,100 ft', '296', ['Included'], 'widebody', 'airliner', { nEng: 2, scale: 1.45 }),
    A('a359', 'Airbus A350-900', 'Airbus', 'Airliner', 'widebody', '2× Trent XWB', '488 kt', '8,100 nm', '43,100 ft', '325', ['Expansion', 'Study'], 'widebody', 'airliner', { nEng: 2, scale: 1.5 }),
    A('b748', 'Boeing 747-8', 'Boeing', 'Airliner', 'jumbo', '4× GEnx-2B', '493 kt', '7,730 nm', '43,100 ft', '410', ['Expansion'], 'jumbo', 'airliner', { nEng: 4, scale: 1.85 }),
    A('bcs3', 'Airbus A220-300', 'Airbus', 'Airliner', 'narrowbody-small', '2× PW1500G', '447 kt', '3,400 nm', '41,000 ft', '145', ['Included', 'New'], 'jetliner', 'airliner', { nEng: 2, scale: 0.9 }),
    A('e190', 'Embraer E190', 'Embraer', 'Airliner', 'narrowbody-small', '2× CF34-10E', '447 kt', '2,450 nm', '41,000 ft', '106', ['Included'], 'regionaljet', 'airliner', { nEng: 2, scale: 0.85 }),
    A('at76', 'ATR 72-600', 'ATR', 'Airliner', 'turboprop-regional', '2× PW127M', '275 kt', '825 nm', '25,000 ft', '72', ['Included'], 'turboprop', 'turboprop', { nEng: 2 }),
    A('dh8d', 'Dash 8 Q400', 'De Havilland Canada', 'Airliner', 'turboprop-regional', '2× PW150A', '360 kt', '1,100 nm', '27,000 ft', '78', ['Expansion'], 'turboprop', 'turboprop', { nEng: 2 }),
    A('c25c', 'Citation CJ4', 'Cessna', 'Business', 'bizjet', '2× FJ44-4A', '451 kt', '2,165 nm', '45,000 ft', '9', ['Included'], 'bizjet', 'bizjet', { nEng: 2 }),
    A('glf6', 'Gulfstream G650ER', 'Gulfstream', 'Business', 'bizjet', '2× BR725', '516 kt', '7,500 nm', '51,000 ft', '19', ['Expansion'], 'bizjet', 'bizjet', { nEng: 2, scale: 1.3 }),
    A('pc12', 'Pilatus PC-12 NGX', 'Pilatus', 'Business', 'single-turboprop', '1× PT6E-67XP', '290 kt', '1,803 nm', '30,000 ft', '9', ['Included'], 'sturboprop', 'ga', { nEng: 1, lowWing: true }),
    A('e55p', 'Phenom 300E', 'Embraer', 'Business', 'bizjet', '2× PW535E1', '464 kt', '2,010 nm', '45,000 ft', '10', ['Included', 'New'], 'bizjet', 'bizjet', { nEng: 2 }),
    A('f16', 'F-16C Fighting Falcon', 'Lockheed Martin', 'Military', 'fighter-single', '1× F110-GE-129', 'Mach 2.0', '2,280 nm', '50,000 ft', '1', ['Included', 'Study'], 'fighter', 'fighter', { nEng: 1 }),
    A('fa18', 'F/A-18E Super Hornet', 'Boeing', 'Military', 'fighter-twin', '2× F414-GE-400', 'Mach 1.6', '1,800 nm', '50,000 ft', '1', ['Included', 'Study'], 'fighter', 'fighter', { nEng: 2, twinTail: true }),
    A('f15e', 'F-15E Strike Eagle', 'Boeing', 'Military', 'fighter-twin', '2× F100-PW-229', 'Mach 2.5', '2,100 nm', '60,000 ft', '2', ['Expansion'], 'fighterHeavy', 'fighter', { nEng: 2, twinTail: true, scale: 1.15 }),
    A('f22', 'F-22A Raptor', 'Lockheed Martin', 'Military', 'fighter-stealth', '2× F119-PW-100', 'Mach 2.25', '1,600 nm', '65,000 ft', '1', ['Expansion'], 'fighterHeavy', 'fighter', { nEng: 2, twinTail: true, scale: 1.1 }),
    A('eufi', 'Eurofighter Typhoon', 'Airbus · BAE · Leonardo', 'Military', 'canard-delta', '2× EJ200', 'Mach 2.0', '1,840 nm', '55,000 ft', '1', ['Included'], 'fighter', 'delta', { nEng: 2 }),
    A('rfal', 'Dassault Rafale C', 'Dassault', 'Military', 'canard-delta', '2× M88-2', 'Mach 1.8', '2,000 nm', '50,000 ft', '1', ['Expansion'], 'fighter', 'delta', { nEng: 2 }),
    A('jas39', 'Saab JAS 39 Gripen E', 'Saab', 'Military', 'fighter-single', '1× F414G', 'Mach 2.0', '2,160 nm', '52,000 ft', '1', ['Included', 'New'], 'fighter', 'delta', { nEng: 1, scale: 0.9 }),
    A('su27', 'Sukhoi Su-27', 'Sukhoi', 'Military', 'fighter-twin', '2× AL-31F', 'Mach 2.35', '1,900 nm', '62,500 ft', '1', ['Expansion'], 'fighterHeavy', 'fighter', { nEng: 2, twinTail: true, scale: 1.2 }),
    A('a10', 'A-10C Thunderbolt II', 'Fairchild Republic', 'Military', 'attack', '2× TF34-GE-100', '381 kt', '2,240 nm', '45,000 ft', '1', ['Included', 'Study'], 'attack', 'attack', { nEng: 2 }),
    A('t38', 'T-38C Talon', 'Northrop', 'Military', 'trainer', '2× J85-GE-5', 'Mach 1.3', '1,140 nm', '50,000 ft', '2', ['Included'], 'trainer', 'fighter', { nEng: 2, scale: 0.8 }),
    A('c130', 'C-130J Super Hercules', 'Lockheed Martin', 'Military', 'transport', '4× AE 2100D3', '362 kt', '2,417 nm', '28,000 ft', '3', ['Expansion'], 'transport', 'turboprop', { nEng: 4, highWing: true, scale: 1.3 }),
    A('b52', 'B-52H Stratofortress', 'Boeing', 'Military', 'bomber', '8× TF33-P-3', '560 kt', '7,650 nm', '50,000 ft', '5', ['Expansion'], 'bomber', 'airliner', { nEng: 8, highWing: true, scale: 1.7 }),
    A('c172', 'Cessna 172S Skyhawk', 'Cessna', 'General Aviation', 'ga-high', '1× IO-360-L2A', '124 kt', '640 nm', '14,000 ft', '4', ['Included'], 'ga', 'ga', { nEng: 1, highWing: true }),
    A('sr22', 'Cirrus SR22 G6', 'Cirrus', 'General Aviation', 'ga-low', '1× IO-550-N', '183 kt', '1,169 nm', '17,500 ft', '5', ['Included', 'Study'], 'gaFast', 'ga', { nEng: 1, lowWing: true }),
    A('p28a', 'Piper PA-28 Archer', 'Piper', 'General Aviation', 'ga-low', '1× O-360-A4M', '128 kt', '522 nm', '13,000 ft', '4', ['Included'], 'ga', 'ga', { nEng: 1, lowWing: true }),
    A('be58', 'Beechcraft Baron G58', 'Beechcraft', 'General Aviation', 'ga-twin', '2× IO-550-C', '202 kt', '1,480 nm', '20,688 ft', '6', ['Included'], 'gaTwin', 'ga', { nEng: 2, lowWing: true }),
    A('da40', 'Diamond DA40 NG', 'Diamond', 'General Aviation', 'ga-low', '1× AE 300', '154 kt', '940 nm', '16,400 ft', '4', ['Included'], 'ga', 'ga', { nEng: 1, lowWing: true }),
    A('e300', 'Extra 330LX', 'Extra', 'General Aviation', 'aerobatic', '1× AEIO-580', '185 kt', '460 nm', '16,000 ft', '2', ['Included'], 'aerobatic', 'ga', { nEng: 1, lowWing: true, scale: 0.85 }),
    A('dhc2', 'DHC-2 Beaver (floats)', 'De Havilland Canada', 'General Aviation', 'bush-floats', '1× R-985 Wasp Jr.', '125 kt', '395 nm', '18,000 ft', '7', ['Included'], 'bush', 'ga', { nEng: 1, highWing: true, floats: true }),
    A('xcub', 'CubCrafters XCub', 'CubCrafters', 'General Aviation', 'bush', '1× CC363i', '153 kt', '800 nm', '14,000 ft', '2', ['Included', 'New'], 'bush', 'ga', { nEng: 1, highWing: true }),
    A('a5', 'Icon A5', 'Icon', 'General Aviation', 'amphibian', '1× Rotax 912 iS', '95 kt', '427 nm', '15,000 ft', '2', ['Included'], 'ga', 'ga', { nEng: 1, lowWing: true, scale: 0.8 }),
    A('h135', 'Airbus H135', 'Airbus Helicopters', 'Helicopter', 'heli', '2× PW206B3', '137 kt', '340 nm', '20,000 ft', '7', ['Included', 'Study'], 'heli', 'heli', {}),
    A('b407', 'Bell 407', 'Bell', 'Helicopter', 'heli', '1× 250-C47B', '133 kt', '324 nm', '18,690 ft', '7', ['Included'], 'heli', 'heli', {}),
    A('r44', 'Robinson R44 Raven II', 'Robinson', 'Helicopter', 'heli-light', '1× IO-540', '110 kt', '300 nm', '14,000 ft', '4', ['Included'], 'heliLight', 'heli', { scale: 0.8 }),
    A('uh60', 'UH-60M Black Hawk', 'Sikorsky', 'Helicopter', 'heli-mil', '2× T700-GE-701D', '151 kt', '320 nm', '19,000 ft', '2+11', ['Expansion'], 'heliHeavy', 'heli', { scale: 1.3 }),
    A('ask21', 'Schleicher ASK 21', 'Alexander Schleicher', 'Glider', 'glider', '—', '151 kt Vne', '34:1 glide', '20,000 ft', '2', ['Included'], 'glider', 'glider', {}),
    A('dg1001', 'DG-1001 Club', 'DG Flugzeugbau', 'Glider', 'glider', '—', '146 kt Vne', '46:1 glide', '20,000 ft', '2', ['Included'], 'gliderPerf', 'glider', {}),
    A('spit', 'Spitfire Mk IX', 'Supermarine', 'Warbird', 'warbird-elliptical', '1× Merlin 66', '350 kt', '434 nm', '43,000 ft', '1', ['Expansion'], 'warbird', 'warbird', { nEng: 1 }),
    A('p51', 'P-51D Mustang', 'North American', 'Warbird', 'warbird', '1× V-1650-7', '383 kt', '1,650 nm', '41,900 ft', '1', ['Expansion'], 'warbird', 'warbird', { nEng: 1 }),
    A('dc3', 'Douglas DC-3', 'Douglas', 'Warbird', 'vintage-airliner', '2× R-1830', '180 kt', '1,500 nm', '23,200 ft', '28', ['Included'], 'dc3', 'ga', { nEng: 2, lowWing: true, scale: 2.2 })
  ];

  // Flight model classes (SI). T = max static thrust (N). rates rad/s. vr = reference speed m/s for full control authority.
  const FM = {
    jetliner:   { m: 65000, S: 125, T: 234000, cd0: .022, k: .045, clmax: 1.5, flapCl: 1.0, stall: 15, roll: .8, pitch: .35, yaw: .2, vr: 75, gearH: 2.6, gmax: 2.5, burn: 0.75, fuelCap: 20800, vne: 180 },
    regionaljet:{ m: 45000, S: 92, T: 160000, cd0: .022, k: .045, clmax: 1.5, flapCl: 1.0, stall: 15, roll: .9, pitch: .4, yaw: .22, vr: 70, gearH: 2.2, gmax: 2.5, burn: 0.55, fuelCap: 13000, vne: 175 },
    widebody:   { m: 210000, S: 365, T: 680000, cd0: .021, k: .042, clmax: 1.5, flapCl: 1.0, stall: 15, roll: .6, pitch: .28, yaw: .15, vr: 80, gearH: 3.6, gmax: 2.5, burn: 1.9, fuelCap: 101000, vne: 185 },
    jumbo:      { m: 350000, S: 554, T: 1180000, cd0: .022, k: .045, clmax: 1.5, flapCl: 1.0, stall: 15, roll: .5, pitch: .25, yaw: .13, vr: 85, gearH: 4.2, gmax: 2.5, burn: 3.2, fuelCap: 190000, vne: 185 },
    turboprop:  { m: 21000, S: 61, T: 80000, cd0: .028, k: .045, clmax: 1.6, flapCl: .9, stall: 15, roll: 1, pitch: .45, yaw: .3, vr: 50, gearH: 1.8, gmax: 2.5, burn: .2, fuelCap: 5000, vne: 130 },
    transport:  { m: 70000, S: 162, T: 190000, cd0: .03, k: .05, clmax: 1.7, flapCl: 1.0, stall: 16, roll: .8, pitch: .4, yaw: .25, vr: 55, gearH: 2.2, gmax: 2.5, burn: .8, fuelCap: 20000, vne: 155 },
    bomber:     { m: 130000, S: 370, T: 340000, cd0: .022, k: .05, clmax: 1.4, flapCl: .8, stall: 14, roll: .45, pitch: .25, yaw: .12, vr: 85, gearH: 2.6, gmax: 2, burn: 2.5, fuelCap: 140000, vne: 200 },
    bizjet:     { m: 8000, S: 31, T: 33000, cd0: .021, k: .045, clmax: 1.5, flapCl: .8, stall: 16, roll: 1.4, pitch: .55, yaw: .3, vr: 60, gearH: 1.3, gmax: 3, burn: .12, fuelCap: 2600, vne: 180 },
    sturboprop: { m: 4700, S: 26, T: 17000, cd0: .026, k: .05, clmax: 1.6, flapCl: .9, stall: 16, roll: 1.4, pitch: .6, yaw: .35, vr: 40, gearH: 1.4, gmax: 3.5, burn: .06, fuelCap: 1200, vne: 125 },
    fighter:    { m: 12000, S: 28, T: 130000, cd0: .02, k: .12, clmax: 1.7, flapCl: .2, stall: 26, roll: 4.5, pitch: 1.3, yaw: .5, vr: 90, gearH: 1.6, gmax: 9, burn: 1.2, fuelCap: 3200, vne: 640, ab: true },
    fighterHeavy:{ m: 20000, S: 56, T: 210000, cd0: .021, k: .11, clmax: 1.7, flapCl: .2, stall: 26, roll: 3.6, pitch: 1.1, yaw: .45, vr: 95, gearH: 1.8, gmax: 9, burn: 1.8, fuelCap: 6000, vne: 700, ab: true },
    attack:     { m: 14000, S: 47, T: 80000, cd0: .032, k: .07, clmax: 1.6, flapCl: .5, stall: 18, roll: 2, pitch: .8, yaw: .4, vr: 60, gearH: 1.5, gmax: 7, burn: .5, fuelCap: 4800, vne: 230 },
    trainer:    { m: 5500, S: 16, T: 34000, cd0: .02, k: .1, clmax: 1.4, flapCl: .4, stall: 20, roll: 4, pitch: 1.2, yaw: .45, vr: 80, gearH: 1.2, gmax: 7, burn: .35, fuelCap: 1500, vne: 380, ab: true },
    ga:         { m: 1100, S: 16, T: 3800, cd0: .03, k: .055, clmax: 1.5, flapCl: .6, stall: 16, roll: 1.4, pitch: .9, yaw: .6, vr: 30, gearH: 1.1, gmax: 3.8, burn: .009, fuelCap: 150, vne: 85 },
    gaFast:     { m: 1550, S: 13.5, T: 6200, cd0: .025, k: .05, clmax: 1.5, flapCl: .6, stall: 16, roll: 1.7, pitch: 1, yaw: .6, vr: 38, gearH: 1.1, gmax: 3.8, burn: .015, fuelCap: 250, vne: 105 },
    gaTwin:     { m: 2400, S: 18.5, T: 9200, cd0: .026, k: .05, clmax: 1.5, flapCl: .6, stall: 16, roll: 1.5, pitch: .9, yaw: .5, vr: 40, gearH: 1.2, gmax: 3.8, burn: .025, fuelCap: 500, vne: 115 },
    aerobatic:  { m: 820, S: 10, T: 9000, cd0: .028, k: .08, clmax: 1.4, flapCl: 0, stall: 18, roll: 7, pitch: 2.4, yaw: 1.2, vr: 35, gearH: 1.0, gmax: 10, burn: .014, fuelCap: 120, vne: 115 },
    bush:       { m: 1150, S: 17, T: 5200, cd0: .034, k: .055, clmax: 2.0, flapCl: .8, stall: 17, roll: 1.3, pitch: .9, yaw: .6, vr: 25, gearH: 1.2, gmax: 3.8, burn: .011, fuelCap: 190, vne: 80 },
    glider:     { m: 600, S: 17.9, T: 0, cd0: .010, k: .025, clmax: 1.4, flapCl: .2, stall: 14, roll: .9, pitch: .8, yaw: .5, vr: 25, gearH: .9, gmax: 5, burn: 0, fuelCap: 0, vne: 78 },
    gliderPerf: { m: 640, S: 17.5, T: 0, cd0: .008, k: .02, clmax: 1.4, flapCl: .2, stall: 14, roll: .9, pitch: .8, yaw: .5, vr: 25, gearH: .9, gmax: 5, burn: 0, fuelCap: 0, vne: 75 },
    warbird:    { m: 4000, S: 22, T: 17000, cd0: .022, k: .06, clmax: 1.5, flapCl: .5, stall: 17, roll: 2.4, pitch: 1.1, yaw: .6, vr: 55, gearH: 1.4, gmax: 7, burn: .1, fuelCap: 600, vne: 225 },
    dc3:        { m: 11000, S: 92, T: 23000, cd0: .03, k: .05, clmax: 1.6, flapCl: .7, stall: 16, roll: 1, pitch: .5, yaw: .35, vr: 40, gearH: 1.6, gmax: 3, burn: .12, fuelCap: 2400, vne: 110 },
    heli:       { m: 2800, heli: true, lift: 1.7, roll: 1.6, pitch: 1.2, yaw: 1.4, drag: .55, gearH: .6, burn: .05, fuelCap: 560, vne: 80, gmax: 3.5 },
    heliLight:  { m: 1100, heli: true, lift: 1.6, roll: 1.9, pitch: 1.4, yaw: 1.6, drag: .5, gearH: .5, burn: .02, fuelCap: 180, vne: 66, gmax: 3.5 },
    heliHeavy:  { m: 8000, heli: true, lift: 1.65, roll: 1.3, pitch: 1.0, yaw: 1.0, drag: .65, gearH: .8, burn: .15, fuelCap: 1100, vne: 85, gmax: 3.5 }
  };

  // Livery sets. Unified paint keys: body belly accent tail engine logo wing
  const L = (id, name, c) => ({ id, name, c: { body: c[0], belly: c[1], accent: c[2], tail: c[3], engine: c[4], logo: c[5], wing: c[6] } });
  const AIRLINE = [
    L('meridian-signature', 'Meridian Air · Signature', ['#F2F4F6', '#10264A', '#F5B942', '#10264A', '#F2F4F6', '#F5B942', '#C9D0D8']),
    L('meridian-retro', "Meridian Air · Retro '68", ['#F3EBD8', '#F3EBD8', '#B8322B', '#B8322B', '#F3EBD8', '#F3EBD8', '#C9C2B0']),
    L('nordlys', 'Nordlys', ['#F7F9FA', '#0E7C86', '#58D3C7', '#0E7C86', '#0E7C86', '#F7F9FA', '#CDD6DB']),
    L('pacifica', 'Pacifica Airways', ['#1C4F9C', '#F4F6F8', '#F4F6F8', '#F28C28', '#1C4F9C', '#F4F6F8', '#B9C2CC']),
    L('austral', 'Aerolíneas Austral', ['#C8CDD3', '#C8CDD3', '#4A90D9', '#F4F6F8', '#C8CDD3', '#2A62B5', '#AEB5BD']),
    L('kestrel', 'Kestrel Cargo', ['#2B2F36', '#2B2F36', '#F26B21', '#F26B21', '#2B2F36', '#2B2F36', '#3A3F47']),
    L('sakura', 'Sakura Air', ['#FBFBFC', '#FBFBFC', '#E8739A', '#E8739A', '#FBFBFC', '#FBFBFC', '#D5D9DE']),
    L('zenith', 'Zenith Express', ['#111417', '#111417', '#D4A64A', '#111417', '#111417', '#D4A64A', '#23272C']),
    L('house', 'Contrail House Colours', ['#B9BFC7', '#B9BFC7', '#F5B942', '#0A0D12', '#B9BFC7', '#F5B942', '#9AA1A9']),
    L('clean', 'Clean Sheet', ['#F4F6F8', '#D9DEE3', '#D9DEE3', '#F4F6F8', '#F4F6F8', '#F4F6F8', '#C9D0D8']),
    L('alrimal', 'Al Rimal', ['#E9DCC3', '#E9DCC3', '#7A1F2B', '#7A1F2B', '#E9DCC3', '#E9DCC3', '#CBBFA6']),
    L('marlin', 'Marlin Pacific', ['#1F6FB2', '#0C2E57', '#5CC8F2', '#0C2E57', '#1F6FB2', '#5CC8F2', '#8FA9C2'])
  ];
  // F-16 table mapped: upper→body, lower→belly, radome→engine, fin→tail, stripe→accent, canopy→logo
  const MILITARY = [
    L('lowvis', 'Low-Vis Grey', ['#7C838A', '#9AA1A8', '#5E6469', '#7C838A', '#5E6469', '#8A7A3E', '#7C838A']),
    L('aggressor-arctic', 'Aggressor · Arctic Splinter', ['#4D6A86', '#8EA6BD', '#8EA6BD', '#2E4257', '#2E4257', '#8A7A3E', '#4D6A86']),
    L('aggressor-desert', 'Aggressor · Desert', ['#A58A5A', '#C9B894', '#C9B894', '#6B5A3C', '#6B5A3C', '#8A7A3E', '#A58A5A']),
    L('heritage-sea', 'Heritage · SEA Camo', ['#4F5E3B', '#B9B29A', '#3A3A3A', '#6E5A3B', '#3A3A3A', '#8A7A3E', '#4F5E3B']),
    L('demo-team', 'Demonstration Team', ['#F4F6F8', '#F4F6F8', '#1B3A7A', '#C8102E', '#1B3A7A', '#8A7A3E', '#F4F6F8']),
    L('black-knights', 'Black Knights · CO bird', ['#2A2D31', '#3B3F45', '#F5B942', '#141618', '#141618', '#8A7A3E', '#2A2D31'])
  ];
  const CIVIL = [
    L('factory', 'Factory White', ['#F4F6F8', '#F4F6F8', '#1C4F9C', '#F4F6F8', '#D9DEE3', '#1C4F9C', '#E6EAEE']),
    L('sport-red', 'Sport Red', ['#F4F6F8', '#B8322B', '#B8322B', '#B8322B', '#2B2F36', '#F4F6F8', '#E6EAEE']),
    L('classic-cream', 'Classic Cream', ['#F3EBD8', '#7A1F2B', '#7A1F2B', '#F3EBD8', '#3A3F47', '#7A1F2B', '#E9DCC3']),
    L('arctic-blue', 'Arctic Blue', ['#E9EEF2', '#1F6FB2', '#5CC8F2', '#1F6FB2', '#E9EEF2', '#1F6FB2', '#D8E0E6']),
    L('safety-orange', 'Safety Orange', ['#F26B21', '#F4F6F8', '#2B2F36', '#F26B21', '#2B2F36', '#F4F6F8', '#F26B21']),
    L('midnight', 'Midnight', ['#1D232B', '#111417', '#F5B942', '#1D232B', '#111417', '#F5B942', '#2B323C']),
    L('house', 'Contrail House Colours', ['#B9BFC7', '#B9BFC7', '#F5B942', '#0A0D12', '#B9BFC7', '#F5B942', '#9AA1A9'])
  ];
  const WARBIRD = [
    L('raf-day', 'RAF Day Fighter', ['#6B6E4F', '#A9B3B8', '#C8102E', '#6B6E4F', '#3A3A3A', '#F3EBD8', '#6B6E4F']),
    L('usaaf-nmf', 'USAAF Natural Metal', ['#C3C8CD', '#C3C8CD', '#F5B942', '#C3C8CD', '#1B3A7A', '#1B3A7A', '#B5BBC1']),
    L('invasion', 'Invasion Stripes', ['#58603F', '#B9B29A', '#F4F6F8', '#58603F', '#2A2D31', '#F4F6F8', '#58603F']),
    L('racer', 'Reno Racer', ['#1B3A7A', '#F4F6F8', '#F5B942', '#F5B942', '#1B3A7A', '#F4F6F8', '#1B3A7A'])
  ];
  const HELI = [
    L('ems', 'Air Ambulance', ['#F4F6F8', '#C8102E', '#F5B942', '#C8102E', '#2B2F36', '#C8102E', '#2B2F36']),
    L('police', 'Police Air Support', ['#1B3A7A', '#F4F6F8', '#F5B942', '#1B3A7A', '#2B2F36', '#F4F6F8', '#2B2F36']),
    L('olive', 'Army Olive', ['#4F5E3B', '#4F5E3B', '#2A2D31', '#4F5E3B', '#2A2D31', '#2A2D31', '#2A2D31']),
    L('news', 'Channel 9 News', ['#2B2F36', '#F4F6F8', '#57C7DB', '#2B2F36', '#2B2F36', '#57C7DB', '#2B2F36']),
    L('house', 'Contrail House Colours', ['#B9BFC7', '#B9BFC7', '#F5B942', '#0A0D12', '#B9BFC7', '#F5B942', '#2B2F36'])
  ];
  const GLIDER = [
    L('competition', 'Competition White', ['#FBFBFC', '#FBFBFC', '#C8102E', '#FBFBFC', '#FBFBFC', '#C8102E', '#FBFBFC']),
    L('club-blue', 'Club Blue Tips', ['#FBFBFC', '#FBFBFC', '#1F6FB2', '#1F6FB2', '#FBFBFC', '#1F6FB2', '#FBFBFC']),
    L('dayglo', 'Day-Glo Trainer', ['#FBFBFC', '#FBFBFC', '#F26B21', '#F26B21', '#FBFBFC', '#F26B21', '#FBFBFC'])
  ];

  function liverySetFor(ac) {
    if (ac.cat === 'Military') return MILITARY;
    if (ac.cat === 'Helicopter') return HELI;
    if (ac.cat === 'Glider') return GLIDER;
    if (ac.cat === 'Warbird' && ac.id !== 'dc3') return WARBIRD;
    if (ac.cat === 'Airliner' || ac.id === 'dc3') return AIRLINE;
    return CIVIL;
  }

  // Airports: icao, name, city, lat, lon, elevation ft, runways [{id, hdg, len ft}], terrain hint
  const AIRPORTS = [
    { icao: 'KSEA', name: 'Seattle–Tacoma Intl', city: 'Seattle, US', lat: 47.4490, lon: -122.3093, elev: 433, rwys: [{ id: '16L', hdg: 163, len: 11901 }, { id: '34R', hdg: 343, len: 11901 }], terrain: 'forest-mountain' },
    { icao: 'KSFO', name: 'San Francisco Intl', city: 'San Francisco, US', lat: 37.6188, lon: -122.3750, elev: 13, rwys: [{ id: '28R', hdg: 284, len: 11870 }, { id: '28L', hdg: 284, len: 11381 }, { id: '10L', hdg: 104, len: 11381 }], terrain: 'coast-hills' },
    { icao: 'KOAK', name: 'Oakland Intl', city: 'Oakland, US', lat: 37.7213, lon: -122.2208, elev: 9, rwys: [{ id: '30', hdg: 295, len: 10520 }, { id: '12', hdg: 115, len: 10520 }], terrain: 'coast-hills' },
    { icao: 'KLAX', name: 'Los Angeles Intl', city: 'Los Angeles, US', lat: 33.9416, lon: -118.4085, elev: 125, rwys: [{ id: '25R', hdg: 263, len: 11095 }, { id: '24L', hdg: 263, len: 10885 }], terrain: 'coast-hills' },
    { icao: 'KLAS', name: 'Harry Reid Intl', city: 'Las Vegas, US', lat: 36.0840, lon: -115.1537, elev: 2181, rwys: [{ id: '26R', hdg: 262, len: 10527 }, { id: '01L', hdg: 13, len: 8985 }], terrain: 'desert' },
    { icao: 'KLSV', name: 'Nellis AFB', city: 'Las Vegas, US', lat: 36.2362, lon: -115.0343, elev: 1870, rwys: [{ id: '03L', hdg: 31, len: 10123 }, { id: '21R', hdg: 211, len: 10123 }], terrain: 'desert' },
    { icao: 'KDEN', name: 'Denver Intl', city: 'Denver, US', lat: 39.8561, lon: -104.6737, elev: 5434, rwys: [{ id: '34R', hdg: 353, len: 12000 }, { id: '16R', hdg: 173, len: 16000 }], terrain: 'plains' },
    { icao: 'KORD', name: "Chicago O'Hare Intl", city: 'Chicago, US', lat: 41.9742, lon: -87.9073, elev: 672, rwys: [{ id: '28C', hdg: 270, len: 10801 }, { id: '10L', hdg: 90, len: 13000 }], terrain: 'plains' },
    { icao: 'KJFK', name: 'John F. Kennedy Intl', city: 'New York, US', lat: 40.6413, lon: -73.7781, elev: 13, rwys: [{ id: '31L', hdg: 314, len: 11351 }, { id: '04R', hdg: 44, len: 8400 }], terrain: 'coast-flat' },
    { icao: 'KBOS', name: 'Boston Logan Intl', city: 'Boston, US', lat: 42.3656, lon: -71.0096, elev: 20, rwys: [{ id: '04R', hdg: 35, len: 10005 }, { id: '22L', hdg: 215, len: 10005 }], terrain: 'coast-flat' },
    { icao: 'PANC', name: 'Ted Stevens Anchorage', city: 'Anchorage, US', lat: 61.1743, lon: -149.9962, elev: 152, rwys: [{ id: '15', hdg: 153, len: 10960 }, { id: '07R', hdg: 75, len: 12400 }], terrain: 'snow-mountain' },
    { icao: 'CYVR', name: 'Vancouver Intl', city: 'Vancouver, CA', lat: 49.1967, lon: -123.1815, elev: 14, rwys: [{ id: '26L', hdg: 265, len: 11500 }, { id: '08R', hdg: 85, len: 11500 }], terrain: 'forest-mountain' },
    { icao: 'EGLL', name: 'London Heathrow', city: 'London, UK', lat: 51.4700, lon: -0.4543, elev: 83, rwys: [{ id: '27R', hdg: 270, len: 12802 }, { id: '09L', hdg: 90, len: 12802 }], terrain: 'plains' },
    { icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris, FR', lat: 49.0097, lon: 2.5479, elev: 392, rwys: [{ id: '27L', hdg: 266, len: 13829 }, { id: '09R', hdg: 86, len: 8858 }], terrain: 'plains' },
    { icao: 'EDDF', name: 'Frankfurt am Main', city: 'Frankfurt, DE', lat: 50.0379, lon: 8.5622, elev: 364, rwys: [{ id: '25C', hdg: 249, len: 13123 }, { id: '07C', hdg: 69, len: 13123 }], terrain: 'forest-mountain' },
    { icao: 'EHAM', name: 'Amsterdam Schiphol', city: 'Amsterdam, NL', lat: 52.3105, lon: 4.7683, elev: -11, rwys: [{ id: '18R', hdg: 183, len: 12467 }, { id: '06', hdg: 58, len: 11483 }], terrain: 'coast-flat' },
    { icao: 'LOWI', name: 'Innsbruck', city: 'Innsbruck, AT', lat: 47.2602, lon: 11.3439, elev: 1907, rwys: [{ id: '26', hdg: 262, len: 6562 }, { id: '08', hdg: 82, len: 6562 }], terrain: 'alpine' },
    { icao: 'LSZH', name: 'Zürich', city: 'Zürich, CH', lat: 47.4582, lon: 8.5555, elev: 1416, rwys: [{ id: '14', hdg: 137, len: 10827 }, { id: '28', hdg: 278, len: 8202 }], terrain: 'alpine' },
    { icao: 'LPMA', name: 'Madeira', city: 'Funchal, PT', lat: 32.6979, lon: -16.7745, elev: 192, rwys: [{ id: '05', hdg: 50, len: 9124 }, { id: '23', hdg: 230, len: 9124 }], terrain: 'island' },
    { icao: 'TNCM', name: 'Princess Juliana Intl', city: 'Sint Maarten', lat: 18.0410, lon: -63.1089, elev: 13, rwys: [{ id: '10', hdg: 100, len: 7546 }, { id: '28', hdg: 280, len: 7546 }], terrain: 'island' },
    { icao: 'OMDB', name: 'Dubai Intl', city: 'Dubai, AE', lat: 25.2532, lon: 55.3657, elev: 62, rwys: [{ id: '30L', hdg: 300, len: 13124 }, { id: '12R', hdg: 120, len: 13124 }], terrain: 'desert' },
    { icao: 'RJTT', name: 'Tokyo Haneda', city: 'Tokyo, JP', lat: 35.5494, lon: 139.7798, elev: 35, rwys: [{ id: '34R', hdg: 337, len: 9843 }, { id: '22', hdg: 220, len: 8202 }], terrain: 'coast-flat' },
    { icao: 'VHHH', name: 'Hong Kong Intl', city: 'Hong Kong', lat: 22.3080, lon: 113.9185, elev: 28, rwys: [{ id: '07R', hdg: 73, len: 12467 }, { id: '25L', hdg: 253, len: 12467 }], terrain: 'island' },
    { icao: 'WSSS', name: 'Singapore Changi', city: 'Singapore', lat: 1.3644, lon: 103.9915, elev: 22, rwys: [{ id: '02L', hdg: 23, len: 13123 }, { id: '20C', hdg: 203, len: 13123 }], terrain: 'coast-flat' },
    { icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney, AU', lat: -33.9399, lon: 151.1753, elev: 21, rwys: [{ id: '34L', hdg: 335, len: 13000 }, { id: '16R', hdg: 155, len: 13000 }], terrain: 'coast-hills' },
    { icao: 'NZQN', name: 'Queenstown', city: 'Queenstown, NZ', lat: -45.0211, lon: 168.7392, elev: 1171, rwys: [{ id: '05', hdg: 48, len: 6204 }, { id: '23', hdg: 228, len: 6204 }], terrain: 'alpine' }
  ];

  const WEATHER_PRESETS = [
    { id: 'clear', name: 'Clear Skies', clouds: 0, vis: 60, windSpd: 4, windDir: 270, precip: 0, turb: 0, temp: 15, qnh: 1018 },
    { id: 'few', name: 'Few Clouds', clouds: 20, vis: 40, windSpd: 8, windDir: 250, precip: 0, turb: 10, temp: 14, qnh: 1015 },
    { id: 'scattered', name: 'Scattered', clouds: 45, vis: 30, windSpd: 12, windDir: 230, precip: 0, turb: 20, temp: 13, qnh: 1012 },
    { id: 'overcast', name: 'Overcast', clouds: 85, vis: 15, windSpd: 14, windDir: 200, precip: 20, turb: 30, temp: 10, qnh: 1006 },
    { id: 'storm', name: 'Thunderstorm', clouds: 100, vis: 5, windSpd: 28, windDir: 190, precip: 90, turb: 80, temp: 18, qnh: 996 },
    { id: 'fog', name: 'Fog', clouds: 60, vis: 1, windSpd: 2, windDir: 0, precip: 0, turb: 0, temp: 8, qnh: 1022 },
    { id: 'snow', name: 'Snow', clouds: 90, vis: 4, windSpd: 10, windDir: 340, precip: 70, turb: 25, temp: -4, qnh: 1009 }
  ];

  // Mission types: land, rings, survive, hover, altitude
  const MISSIONS = [
    { id: 'first-solo', name: 'First Solo', diff: 1, ac: 'c172', apt: 'KSEA', start: 'runway', type: 'altitude', target: 1500, brief: 'Take off from KSEA 16L and climb to 1,500 ft AGL without stalling.', weather: 'clear', time: 10 },
    { id: 'short-final', name: 'Short Final', diff: 2, ac: 'b738', apt: 'KSFO', start: 'final', type: 'land', limit: 600, brief: 'You are established on a 6 nm final for 28R. Touch down on the runway at under 600 fpm.', weather: 'few', time: 16 },
    { id: 'crosswind', name: 'Crosswind Challenge', diff: 3, ac: 'a20n', apt: 'EGLL', start: 'final', type: 'land', limit: 500, brief: '25 kt gusting crosswind at Heathrow 27R. Keep it on the centreline and land under 500 fpm.', weather: 'scattered', wind: { dir: 180, spd: 25 }, time: 14 },
    { id: 'canyon-run', name: 'Canyon Run', diff: 3, ac: 'f16', apt: 'KLSV', start: 'air', type: 'rings', rings: 10, brief: 'Thread 10 gates at low level out of Nellis. Every gate missed costs points.', weather: 'clear', time: 11 },
    { id: 'aerobatic', name: 'Air Show Box', diff: 4, ac: 'e300', apt: 'LSZH', start: 'air', type: 'rings', rings: 8, tight: true, brief: 'A tight aerobatic gate sequence. Big G, small gates.', weather: 'clear', time: 13 },
    { id: 'innsbruck', name: 'Innsbruck Valley', diff: 5, ac: 'e55p', apt: 'LOWI', start: 'final', type: 'land', limit: 500, brief: 'Mountain approach into Innsbruck 26 between the peaks. Land under 500 fpm.', weather: 'few', time: 9 },
    { id: 'thermal', name: 'Ridge & Thermal', diff: 3, ac: 'ask21', apt: 'NZQN', start: 'air', type: 'survive', target: 180, brief: 'You are released at 3,000 ft. Find the thermals (watch the vario) and stay airborne for 3 minutes.', weather: 'few', time: 13 },
    { id: 'hover', name: 'Precision Hover', diff: 2, ac: 'h135', apt: 'KSEA', start: 'runway', type: 'hover', target: 20, band: [30, 80], brief: 'Lift off and hold a steady hover between 30 and 80 ft AGL for 20 seconds.', weather: 'clear', time: 12 },
    { id: 'heavy', name: 'Heavy Metal', diff: 4, ac: 'b748', apt: 'VHHH', start: 'final', type: 'land', limit: 400, brief: 'Bring a 747-8 into Hong Kong 07R in rain. Land under 400 fpm.', weather: 'overcast', time: 20 },
    { id: 'night-fighter', name: 'Night Intercept', diff: 5, ac: 'eufi', apt: 'EDDF', start: 'air', type: 'rings', rings: 12, brief: 'Fly the night gate course at speed. Gates are lit; the terrain is not.', weather: 'scattered', time: 23 },
    { id: 'storm-landing', name: 'Into the Storm', diff: 5, ac: 'dh8d', apt: 'PANC', start: 'final', type: 'land', limit: 600, brief: 'Thunderstorm over Anchorage. Fight the turbulence and land on 15.', weather: 'storm', time: 17 },
    { id: 'warbird', name: 'Merlin Climb', diff: 2, ac: 'spit', apt: 'EGLL', start: 'runway', type: 'altitude', target: 10000, brief: 'Scramble! Climb the Spitfire to 10,000 ft AGL as fast as you can.', weather: 'few', time: 12 }
  ];

  // Simple scheme: WASD to fly, Space/Shift to go up/down. Arrows also pitch/roll.
  const DEFAULT_KEYS = {
    throttleUp: 'KeyW', throttleDown: 'KeyS', rollLeft: 'KeyA', rollRight: 'KeyD',
    climb: 'Space', descend: 'ShiftLeft', pitchDown: 'ArrowUp', pitchUp: 'ArrowDown',
    yawLeft: 'KeyQ', yawRight: 'KeyE', gear: 'KeyG', flapsDown: 'KeyF', flapsUp: 'KeyR',
    brakes: 'KeyB', spoilers: 'KeyX', camera: 'KeyV', pause: 'KeyP', hud: 'KeyH', timeAccel: 'KeyT', lookBack: 'KeyC'
  };
  const KEY_LABELS = {
    throttleUp: 'Speed up (throttle) · helicopter: move forward', throttleDown: 'Slow down (throttle) · helicopter: move back',
    rollLeft: 'Turn left (bank)', rollRight: 'Turn right (bank)',
    climb: 'Go up (nose up / more lift)', descend: 'Go down (nose down / less lift)',
    pitchDown: 'Nose down (fine control)', pitchUp: 'Nose up (fine control)',
    yawLeft: 'Rudder left', yawRight: 'Rudder right', gear: 'Landing gear up/down', flapsDown: 'Flaps extend', flapsUp: 'Flaps retract',
    brakes: 'Wheel brakes (hold)', spoilers: 'Speed brakes', camera: 'Change camera', pause: 'Pause', hud: 'Show/hide HUD', timeAccel: 'Sim speed ×1/×2/×4', lookBack: 'Look back (hold)'
  };
  const KEYS_VERSION = 2;

  window.CT_DATA = { AIRCRAFT, FM, AIRPORTS, WEATHER_PRESETS, MISSIONS, DEFAULT_KEYS, KEY_LABELS, KEYS_VERSION, liverySetFor,
    CATEGORIES: ['All', 'Airliner', 'Business', 'Military', 'General Aviation', 'Helicopter', 'Glider', 'Warbird'] };
})();
