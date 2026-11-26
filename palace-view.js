import { royalGreetingUI } from "./palace-npc-ui.mjs?v=patrol-paths";
import { DOOR, PASSAGE, passageEntry, editionStep, insideDoorAt, passageOffset } from './palace-passage.mjs?v=upper-door';
import { CASTLE_SPAWNS, isCastle, stepInCastle, crossedWallGate, nearbyCastleGate, ENTRY, nearMainEntry, stepAtMainEntry } from './palace-castle.mjs?v=main-entry';
import { BEDROOM, BED, ROOM_NAMES, stepInBedroom, canRestOnBed } from './palace-locations.mjs?v=upper-door';
import { KEY_MODE_STORAGE, validateKeyMode, movementDirection, movementAxes } from './palace-movement-keys.mjs';
import { hall, entranceZ, floorHeight, moveOnFloor, throneSeat, canSitAtThrone } from "./palace-floor.mjs?v=throne-seat";

(() => {
  const view = document.getElementById("xr-bg-container");
  const locationControl=document.getElementById('palace-locations');
  const locationStatus=document.getElementById('palace-location-status');
  const frontButton=document.getElementById('palace-front');
  const palaceDescription=view.getAttribute('aria-label');
  const placeButtons=[...(locationControl?.querySelectorAll('button[data-place]')??[])];
  let place='palace';
  const cube = document.getElementById("palace-cube");
  const stick = document.getElementById("joystick-zone");
  const cameraControls = document.getElementById("palace-camera");
  const firstPersonControl = cameraControls.querySelector('input[value="first"]');
  const thirdPersonControl = cameraControls.querySelector('input[value="third"]');
  const thirdOptions = document.getElementById("palace-third-options");
  const frontControl = cameraControls.querySelector('input[value="front"]');
  const backControl = cameraControls.querySelector('input[value="back"]');
  const distanceControl = document.getElementById("palace-distance");
  const keyModeControl = document.getElementById("palace-move-keys");
  const seatControl = document.getElementById("palace-seat");
  const bedControl = document.getElementById("palace-bed-action");
  const upperDoorControl=document.getElementById('palace-interior-door');
  const gateControl=document.getElementById('palace-gate-action');
  const castleNote=document.getElementById('palace-castle-note');
  const curtainControl=document.getElementById("palace-curtain");
  const knob = stick.querySelector(".palace-stick-knob");
  const radians = Math.PI / 180;
  let yaw = 0;
  let pitch = 0;
  const orbit = { yaw: 0, pitch: 0 };
  let walkHeadingLocked = false;
  function selectedPreset() {
    return thirdPersonControl.checked ? (frontControl.checked ? "front" : "back") : "first";
  }
  let preset = selectedPreset();
  let floorX = 0;
  let floorZ = entranceZ;
  const gait = { location:'palace', distance: 0, forward: 0, side: 0, moving: false, running: false, seatActive: false, seatAmount: 0, sleepAmount:0, sleeping:false, curtainAmount:0, doors:{lower:0,upper:0}, mainEntry:0, talkingTo:null };
  let seatState = "standing";
  let seatStart = 0, standX = 0, standZ = 0;
  let entryYaw = 0, turnDegrees = 0, previousTurn = 0;
  let seatFrame = 0;
  let curtainClosed=false,curtainFrame=0;
  let entryOpen=false,entryFrame=0;
  const doorsOpen={lower:false,upper:false}, doorFrames={lower:0,upper:0};
  let sleepState='standing',sleepFrame=0,sleepStart=0;
  let sleepEntry={x:0,z:0,yaw:0,pillowX:.216},sleepCamera=null;
  let focal = 0;
  let width = 0;
  let height = 0;
  let drag = null;
  let stickPointer = null;
  let stickX = 0;
  let stickY = 0;
  let stickRun = false;
  let frame = 0;
  let previousTime = 0;
  let keyMode=validateKeyMode(null);
  try {keyMode=validateKeyMode(localStorage.getItem(KEY_MODE_STORAGE));} catch {}
  if(keyModeControl)keyModeControl.value=keyMode;
  const heldKeys=new Set();
  let keyFrame=0,keyTime=0,keySprint=false;

  const canvas = document.getElementById("palace-relief");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let scene = null;
  let loading = false;
  let contextLost = false;
  let generation = 0;
  let attempted = false;
  let visible = !("IntersectionObserver" in window);
  let leanX = 0, leanY = 0, targetX = 0, targetY = 0;
  let motionFrame = 0, lastMotion = 0;
  let interacted = false;
  let settleFrame = 0, npcFrame=0,lastNpcDraw=0;
  const npcUI=royalGreetingUI({view,gait,
    onOpen(){stopKeyboard();stopStick();stopMotion();paint();},
    onClose(){paint();}});
  function npcTick(now){
    npcFrame=0;
    if(!scene||!scene.npcHeads.length||!visible||document.hidden||reducedMotion.matches)return;
    if(!gait.moving&&!drag&&!npcUI.opened&&now-lastNpcDraw>=(scene.npcHeads.some(actor=>actor.visible)?scene.npcCadence:220)){
      lastNpcDraw=now;paint();
    }
    if(!npcFrame)npcFrame=requestAnimationFrame(npcTick);
  }
  function settleAvatar() {
    settleFrame = 0;
    if (!document.hidden && visible && !gait.moving) paint();
  }

  function paint() {
    if (!focal) return;
    yaw = ((yaw % 360) + 360) % 360;
    pitch = Math.max(-90, Math.min(90, pitch));
    gait.reducedMotion = reducedMotion.matches;
    if (scene && visible && !document.hidden &&
        scene.draw(width, height, focal, yaw * radians, pitch * radians, leanX, leanY, floorX, floorZ, gait,
          thirdPersonControl.checked, frontControl.checked, Number(distanceControl.value) || 1, orbit)) {
      if (!gait.moving && !seatFrame && !sleepFrame && !settleFrame && scene.settling && !gait.reducedMotion) {
        settleFrame=requestAnimationFrame(settleAvatar);
      }
      cameraControls.disabled = false;
      syncSeatControl(true);
      npcUI.sync(scene.npcHeads);
      if(scene.npcHeads.length&&!npcFrame&&!reducedMotion.matches)npcFrame=requestAnimationFrame(npcTick);
      if (!view.hasAttribute("data-relief-ready")) view.setAttribute("data-relief-ready", "");
      return;
    }
    view.removeAttribute("data-relief-ready");
    cameraControls.disabled = true;
    syncSeatControl(false);
    npcUI.sync([]);
    if(place!=='palace')return;
    const cx = floorX/hall.halfWidth, travelZ = floorZ-entranceZ;
    const cz = travelZ/(travelZ >= 0 ? hall.front-entranceZ : hall.back+entranceZ);
    const rise = floorHeight(floorX,floorZ)-hall.floor;
    cube.style.transform = `translateZ(${focal}px) rotateX(${pitch}deg) rotateY(${yaw}deg) translate3d(${-512*cx}px,${512*rise}px,${512*cz}px)`;
    const angle = yaw * radians;
    const ahead = cx * Math.sin(angle) + cz * Math.cos(angle);
    const across = cx * Math.cos(angle) - cz * Math.sin(angle);
    const bearing = angle + Math.asin(across / Math.SQRT2);
    const distance = Math.sqrt(2 - across * across) - ahead;
    const tileWidth = Math.max(2 * height, 2 * Math.PI * focal * Math.SQRT2 / distance);
    const tileHeight = tileWidth / 2;
    const left = width / 2 - (0.5 + bearing / (2 * Math.PI)) * tileWidth;
    const top = Math.max(height - tileHeight, Math.min(0, height / 2 - (0.5 - pitch / 180) * tileHeight));
    view.style.backgroundSize = tileWidth + 'px ' + tileHeight + 'px';
    view.style.backgroundPosition = left + 'px ' + top + 'px';
  }

  function syncSeatControl(ready) {
    const door=ready&&!gait.seatActive&&!gait.sleeping&&insideDoorAt(place,floorX,floorZ);
    upperDoorControl.hidden=!door;upperDoorControl.disabled=!door;
    if(door){
      const label=DOOR[door].name+(doorsOpen[door]?' 닫기':' 열기');
      if(upperDoorControl.textContent!==label)upperDoorControl.textContent=label;
      upperDoorControl.setAttribute('aria-expanded',String(doorsOpen[door]));
    }
    const nearEntry=nearMainEntry(place,floorX,floorZ);
    const entryLabel=entryOpen?'성문 닫기':place==='palace'?'성문 열기 · 안뜰':'성문 열기 · 왕좌의 방';
    const gate=ready&&!gait.seatActive&&(nearEntry?{label:entryLabel}:nearbyCastleGate(place,floorX,floorZ));
    gateControl.hidden=!gate;gateControl.disabled=!gate;
    if(gate&&gateControl.textContent!==gate.label)gateControl.textContent=gate.label;
    if(place==='bedroom') {
      seatControl.hidden=true;seatControl.disabled=true;
      syncBedControl(ready);return;
    }
    if(isCastle(place)||place==='passage'){
      seatControl.hidden=true;seatControl.disabled=true;
      bedControl.hidden=true;curtainControl.hidden=true;return;
    }
    bedControl.hidden=true;curtainControl.hidden=true;
    seatControl.hidden=false;
    const near = canSitAtThrone(floorX, floorZ);
    const resting = seatState === "seated";
    const canToggle = resting || (seatState === "standing" && near);
    const disabled = !ready || !canToggle;
    if (seatControl.disabled !== disabled) seatControl.disabled = disabled;
    const label = resting ? "일어서기" : seatState === "sittingDown" ? "앉는 중…" :
      seatState === "standingUp" ? "일어서는 중…" : near ? "왕좌에 앉기" : "왕좌 앞에서 앉기";
    if (seatControl.textContent !== label) {
      seatControl.textContent = label;
      seatControl.title = canToggle ? label + " (E)" : seatState === "standing" ? "조이스틱으로 왕좌 앞에 다가가세요." : label;
    }
  }

  const smooth = value => {
    const t = Math.max(0, Math.min(1, value));
    return t*t*(3-2*t);
  };
  function syncBedControl(ready) {
    bedControl.hidden=false;
    curtainControl.hidden=false;curtainControl.disabled=!ready;
    const near=canRestOnBed(floorX,floorZ);
    bedControl.disabled=!ready || (sleepState!=='resting'&&(sleepState!=='standing'||!near));
    const label=sleepState==='resting'?'일어나기':sleepState==='lying'?'눕는 중…':
      sleepState==='waking'?'일어나는 중…':near?'침대에 눕기':'침대 가까이 가기';
    if(bedControl.textContent!==label)bedControl.textContent=label;
    bedControl.title=bedControl.disabled?'키보드나 조이스틱으로 침대 발치에 다가가세요.':label+' (E)';
  }
  function toggleCurtain() {
    if(place!=='bedroom'||curtainControl.disabled)return;
    curtainClosed=!curtainClosed;
    curtainControl.setAttribute('aria-pressed',String(curtainClosed));
    curtainControl.textContent=curtainClosed?'커튼 열기':'커튼 닫기';
    if(curtainFrame)cancelAnimationFrame(curtainFrame);
    const from=gait.curtainAmount,to=curtainClosed?1:0,start=performance.now();
    function slide(now) {
      const t=reducedMotion.matches?1:Math.min(1,(now-start)/420);
      gait.curtainAmount=from+(to-from)*smooth(t);
      curtainFrame=t<1&&place==='bedroom'?requestAnimationFrame(slide):0;
      paint();
    }
    slide(start);
  }
  curtainControl.addEventListener('click',toggleCurtain);

  function clearSleep(restore) {
    if(sleepFrame)cancelAnimationFrame(sleepFrame);
    sleepFrame=0;sleepState='standing';gait.sleeping=false;gait.sleepAmount=0;
    if(restore&&sleepCamera){
      firstPersonControl.checked=sleepCamera.first;
      thirdPersonControl.checked=!sleepCamera.first;
      frontControl.checked=sleepCamera.front;
      backControl.checked=!sleepCamera.front;
      changeCamera();
    }
    sleepCamera=null;
  }
  function animateSleep(now) {
    const lying=sleepState==='lying';
    const elapsed=reducedMotion.matches?1:Math.min(1,(now-sleepStart)/(lying?660:500));
    const t=smooth(elapsed);
    const progress=lying?t:1-t;
    gait.sleepAmount=progress;
    floorX=sleepEntry.x*(1-progress)+sleepEntry.pillowX*progress;
    floorZ=sleepEntry.z+(BED.sleepZ-sleepEntry.z)*progress;
    if(elapsed===1) {
      sleepFrame=0;
      if(lying) {
        sleepState='resting';gait.sleeping=true;
        if(locationStatus)locationStatus.value='침대에서 쉬는 중입니다. 일어나기 버튼이나 E를 누르세요.';
      } else {
        clearSleep(true);
        gait.recenter=true;
        if(locationStatus)locationStatus.value='침대에서 일어났습니다.';
      }
    } else sleepFrame=requestAnimationFrame(animateSleep);
    paint();gait.recenter=false;
  }
  function toggleBed() {
    if(place!=='bedroom'||bedControl.disabled||cameraControls.disabled)return;
    stopKeyboard();stopStick();stopMotion();
    interacted=true;
    if(sleepState==='standing'){
      sleepEntry={x:floorX,z:floorZ,yaw:scene?.headingYaw??yaw*radians,pillowX:floorX<0?-.216:.216};
      gait.sleepStartYaw=sleepEntry.yaw;
      sleepCamera={first:firstPersonControl.checked,front:frontControl.checked};
      thirdPersonControl.checked=true;firstPersonControl.checked=false;frontControl.checked=false;backControl.checked=true;
      changeCamera();
      orbit.yaw=1.06;orbit.pitch=.34;
      sleepState='lying';gait.sleeping=true;
    } else if(sleepState==='resting')sleepState='waking';
    else return;
    sleepStart=performance.now();
    animateSleep(sleepStart);
  }
  bedControl.addEventListener('click',toggleBed);

  function animateSeat(time) {
    const sittingDown = seatState === "sittingDown";
    const elapsed = reducedMotion.matches ? 1 : Math.min(1, (time-seatStart)/(sittingDown ? 880 : 600));
    const travel = smooth(sittingDown ? (elapsed-0.20)/0.80 : 1-elapsed);
    floorX = standX + (throneSeat.x-standX)*travel;
    floorZ = standZ + (throneSeat.z-standZ)*travel;
    gait.seatAmount = smooth(sittingDown ? (elapsed-0.33)/0.67 : 1-elapsed);
    if (sittingDown) {
      const turned = turnDegrees*smooth(elapsed/0.60);
      yaw += turned-previousTurn;
      gait.seatYaw = (entryYaw + turned)*radians;
      previousTurn = turned;
    }
    if (elapsed >= 1) {
      seatState = sittingDown ? "seated" : "standing";
      gait.seatActive = sittingDown;
      seatFrame = 0;
    } else {
      seatFrame = requestAnimationFrame(animateSeat);
    }
    paint();
  }

  function toggleSeat() {
    if (seatControl.disabled || cameraControls.disabled) return;
    stopStick();
    stopMotion();
    interacted = true;
    if (seatState === "standing") {
      standX = floorX; standZ = floorZ;
      if (thirdPersonControl.checked && scene?.headingYaw != null) yaw = scene.headingYaw/radians;
      entryYaw = yaw;
      const diff = throneSeat.yaw - entryYaw*radians;
      turnDegrees = Math.atan2(Math.sin(diff),Math.cos(diff))/radians;
      previousTurn = 0;
      gait.standHeight = floorHeight(standX, standZ);
      gait.seatYaw = entryYaw*radians;
      gait.seatActive = true;
      seatState = "sittingDown";
    } else if (seatState === "seated") {
      seatState = "standingUp";
    } else return;
    seatStart = performance.now();
    animateSeat(seatStart);
  }
  seatControl.addEventListener("click", toggleSeat);

  function stopMotion() {
    cancelAnimationFrame(motionFrame);
    motionFrame = lastMotion = 0;
    leanX = leanY = targetX = targetY = 0;
  }

  function easeLean(time) {
    motionFrame = 0;
    const dt = lastMotion ? Math.min(64, time - lastMotion) : 16;
    lastMotion = time;
    const blend = 1 - Math.exp(-dt / 160);
    leanX += (targetX - leanX) * blend;
    leanY += (targetY - leanY) * blend;
    if (Math.max(Math.abs(targetX - leanX), Math.abs(targetY - leanY)) < 0.00015) {
      leanX = targetX;
      leanY = targetY;
      lastMotion = 0;
    } else {
      motionFrame = requestAnimationFrame(easeLean);
    }
    paint();
  }

  function leanToward(x, y) {
    if (!scene || reducedMotion.matches || !visible || document.hidden) return;
    targetX = x;
    targetY = y;
    if (!motionFrame) motionFrame = requestAnimationFrame(easeLean);
  }

  async function startScene() {
    if (attempted || loading || !visible || document.hidden || !width || !height) return;
    attempted = loading = true;
    const version = ++generation;
    try {
      let result;
      if (!contextLost) {
        const { createPalaceRelief } = await import("./palace-relief.mjs?v=patrol-paths");
        try { result = await createPalaceRelief(canvas); }
        catch { if (version !== generation) return; }
      }
      if (!result && version === generation) {
        const { createPalaceFallback } = await import("./palace-fallback.mjs?v=patrol-paths");
        result = await createPalaceFallback(canvas);
      }
      if (version !== generation) { result?.release(); return; }
      scene = result;
      if(place!=='palace')prepareRoom();
      if (scene && !interacted && !reducedMotion.matches && visible && !document.hidden) {
        leanX = -0.038;
        leanY = 0.008;
        leanToward(0, 0);
      }
      paint();
    } catch (error) {
      if (version === generation) console.warn("궁전의 기본 파노라마를 표시합니다.", error);
    } finally {
      if (version === generation) loading = false;
    }
  }

  canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    stopKeyboard();
    contextLost = true;
    generation++;
    attempted = loading = false;
    scene?.release();
    scene = null;
    stopMotion();
    paint();
    startScene();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    generation++;
    attempted = loading = false;
    scene?.release();
    scene = null;
    startScene();
  });
  function visibilityChanged() {
    if (document.hidden || !visible) {
      stopMotion();
      stopStick();
      stopKeyboard();
      drag = null;
    } else {
      resize();
    }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visibilityChanged();
    }).observe(view);
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  reducedMotion.addEventListener("change", () => {
    stopMotion();
    if (seatFrame && reducedMotion.matches) {
      cancelAnimationFrame(seatFrame);
      animateSeat(performance.now());
    } else if(sleepFrame&&reducedMotion.matches) {
      cancelAnimationFrame(sleepFrame);animateSleep(performance.now());
    } else paint();
  });
  function resize() {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w || !h) return;
    width = w;
    height = h;
    focal = Math.min(h / (2 * Math.tan(40 * radians)), w / (2 * Math.tan(32 * radians)));
    view.style.perspective = focal + 'px';
    paint();
    startScene();
  }

  function recenter(entry) {
    if(gait.sleeping){orbit.yaw=1.06;orbit.pitch=.34;paint();return;}
    interacted = true;
    stopMotion();
    stopStick();
    orbit.yaw = orbit.pitch = 0;
    if (gait.seatActive) {
      yaw = gait.seatYaw/radians;
      pitch = 0;
      paint();
      return;
    }
    const start=entry?.z!==undefined?entry:place==='passage'?passageEntry:CASTLE_SPAWNS[place];
    floorX = start?.x??0;
    floorZ = start?.z??(place==='bedroom'?BEDROOM.spawnZ:entranceZ);
    gait.distance = 0;
    yaw = start?.yaw??0;
    pitch = 0;
    gait.recenter = true;
    paint();
    gait.recenter = false;
  }

  function turnView(horizontal, vertical) {
    if (thirdPersonControl.checked && scene) {
      orbit.yaw = (orbit.yaw + horizontal*radians) % (2*Math.PI);
      orbit.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, orbit.pitch + vertical*radians));
    } else {
      yaw += horizontal;
      pitch += vertical;
    }
  }

  view.addEventListener("pointerdown", e => {
    if (e.button !== 0 || drag) return;
    interacted = true;
    leanToward(0, 0);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove", e => {
    if (!drag && e.pointerType === "mouse" && width && height) {
      const clamp = value => Math.max(-1, Math.min(1, value));
      leanToward(0.046 * clamp(2 * e.clientX / width - 1), 0.020 * clamp(1 - 2 * e.clientY / height));
      return;
    }
    if (!drag || e.pointerId !== drag.id || !focal) return;
    const shortEdge = Math.max(1,Math.min(width,height));
    const horizontal = e.pointerType === "touch" ? 180/shortEdge : 180/(Math.PI*focal);
    const vertical = e.pointerType === "touch" ? 145/shortEdge : horizontal;
    const dy = e.clientY - drag.y;
    turnView((drag.x-e.clientX)*horizontal, (thirdPersonControl.checked ? -dy : dy)*vertical);
    drag.x = e.clientX;
    drag.y = e.clientY;
    paint();
  });
  view.addEventListener("pointerleave", () => leanToward(0, 0));
  function releaseDrag(e) {
    if (drag && drag.id === e.pointerId) drag = null;
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    view.addEventListener(event, releaseDrag);
  }

  function moveStick(e) {
    if (e.pointerId !== stickPointer) return;
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.32);
    const dx = (e.clientX - rect.left - rect.width / 2) / radius;
    const dy = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(dx, dy));
    stickRun = Math.hypot(dx,dy)>1.12;
    stickX = dx / length;
    stickY = dy / length;
    knob.style.transform = 'translate(' + stickX * radius + 'px,' + stickY * radius + 'px)';
    Object.assign(window.globalJoystickData, { x: stickX, y: -stickY, isMoving: !!(stickX || stickY) });
  }
  function walk(sideways, forward, running=false) {
    if (gait.seatActive||gait.sleeping) return;
    if (!sideways && !forward) {
      walkHeadingLocked = false;
      if (gait.moving) { gait.moving = false; paint(); }
      return;
    }
    // 한 번의 조이스틱 이동 중에는 다른 손으로 카메라를 돌려도 진행 방향이 유지된다.
    const align = thirdPersonControl.checked && scene && !walkHeadingLocked;
    const heading = align ? (scene.headingYaw ?? yaw*radians) + orbit.yaw : yaw*radians;
    const sin = Math.sin(heading), cos = Math.cos(heading);
    const step=isCastle(place)?stepInCastle:place==='bedroom'?stepInBedroom:moveOnFloor;
    const lateral=sideways*cos+forward*sin,longitudinal=-sideways*sin+forward*cos;
    const next=stepAtMainEntry(place,floorX,floorZ,lateral,longitudinal,gait.mainEntry)
      ?? editionStep(place,floorX,floorZ,lateral,longitudinal,step,gait.doors);
    const dx=next.x-floorX;
    const dz=next.deltaZ??(next.z-floorZ+(next.place?passageOffset(place)[2]-passageOffset(next.place)[2]:0));
    const distance = Math.hypot(dx, dz);
    if (align && distance > 0) {
      yaw = heading/radians;
      orbit.yaw = 0;
      walkHeadingLocked = true;
    }
    gait.distance += distance;
    gait.running = running && distance>0.000001;
    gait.moving = distance > 0.000001 && !reducedMotion.matches;
    gait.forward = distance ? (dx * sin + dz * cos) / distance : 0;
    gait.side = distance ? (dx * cos - dz * sin) / distance : 0;
    if(isCastle(place)&&crossedWallGate(floorX,floorZ,next)){
      describePlace(next.z<-4.17?'exterior':'courtyard');
      prepareRoom();
    }
    if(next.place){
      describePlace(next.place);prepareRoom();
    }
    floorX = next.x;
    floorZ = next.z;
    paint();
  }
  function tick(time) {
    const seconds = Math.max(0, Math.min(0.05, (time - previousTime) / 1000));
    previousTime = time;
    const stride = (stickRun ? 0.56 : 0.30) * seconds * (isCastle(place)?2.6:place==='passage'?2.15:1);
    walk(stickX * stride, -stickY * stride, stickRun);
    frame = requestAnimationFrame(tick);
  }
  function stopStick() {
    cancelAnimationFrame(frame);
    walkHeadingLocked = false;
    stickPointer = null;
    stickX = stickY = 0;
    stickRun = false;
    knob.style.transform = '';
    if (gait.moving) { gait.moving = false; paint(); }
    Object.assign(window.globalJoystickData, { x: 0, y: 0, isMoving: false });
  }
  window.globalJoystickData ||= { x: 0, y: 0, isMoving: false };
  stick.addEventListener("pointerdown", e => {
    if (e.button !== 0 || stickPointer !== null || gait.seatActive || gait.sleeping) return;
    interacted = true;
    leanToward(0, 0);
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
    previousTime = performance.now();
    frame = requestAnimationFrame(tick);
  });
  stick.addEventListener("pointermove", moveStick);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    stick.addEventListener(event, e => { if (e.pointerId === stickPointer) stopStick(); });
  }
  function playbackTarget(target) {
    if (!target || target===document.body || target===document.documentElement) return true;
    if (target.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],iframe')) return false;
    return view.contains(target) || stick.contains(target);
  }
  function stopKeyboard() {
    if(keyFrame)cancelAnimationFrame(keyFrame);
    if(!keyFrame&&!heldKeys.size)return;
    keyFrame=0;heldKeys.clear();keySprint=false;
    if(stickPointer===null) {
      walkHeadingLocked=false;
      if(gait.moving){gait.moving=false;paint();}
    }
  }
  function keyboardTick(time) {
    keyFrame=0;
    if(!heldKeys.size||document.hidden||!visible||gait.seatActive||gait.sleeping||!playbackTarget(document.activeElement)) {
      stopKeyboard();return;
    }
    const elapsed=Math.max(0,Math.min(.05,(time-keyTime)/1000));
    keyTime=time;
    if(stickPointer===null) {
      const [side,forward]=movementAxes(heldKeys,keyMode);
      const stride=(keySprint?.56:.30)*elapsed*(isCastle(place)?2.6:place==='passage'?2.15:1);
      walk(side*stride,forward*stride,keySprint);
    }
    keyFrame=requestAnimationFrame(keyboardTick);
  }
  keyModeControl?.addEventListener("change",()=>{
    stopKeyboard();
    keyMode=validateKeyMode(keyModeControl.value);
    try {localStorage.setItem(KEY_MODE_STORAGE,keyMode);} catch {}
  });
  document.addEventListener("focusin",e=>{if(!playbackTarget(e.target))stopKeyboard();});
  window.addEventListener("keydown",e=>{
    if(!visible||document.hidden||e.defaultPrevented||e.isComposing||
       e.altKey||e.ctrlKey||e.metaKey||gait.seatActive||gait.sleeping||
       !playbackTarget(e.target)||!playbackTarget(document.activeElement))return;
    if(e.key==="Home" && view.contains(e.target)){e.preventDefault();if(!e.repeat)recenter();return;}
    const code=e.code||e.key;
    if(!movementDirection(code,keyMode)) {
      if(e.key==="Shift")keySprint=true;
      return;
    }
    e.preventDefault();
    keySprint=e.shiftKey;
    heldKeys.add(code);
    interacted=true;
    if(!keyFrame){
      keyTime=performance.now();
      leanToward(0,0);
      keyFrame=requestAnimationFrame(keyboardTick);
    }
  });
  window.addEventListener("keyup",e=>{
    keySprint=e.shiftKey;
    if(heldKeys.delete(e.code||e.key)&&!heldKeys.size){
      // 예약된 프레임이 있어야 stopKeyboard에서 걸음과 탄성도 함께 정리된다.
      stopKeyboard();
    }
  });
  function prepareRoom(){
    if(!scene)return;
    const active=scene, requested=place;
    Promise.resolve(scene.changePlace?.(place)).then(()=>{
      if(scene===active&&place===requested)paint();
    }).catch(()=>{if(scene===active&&place===requested)paint();});
  }
  function describePlace(next) {
    place=next;gait.location=next;
    view.dataset.place=next;
    view.setAttribute('aria-label',next==='palace'?palaceDescription:
      ROOM_NAMES[next]+'. 화면을 드래그해 360도로 둘러보거나 조이스틱과 PC 이동키로 걸을 수 있습니다.');
    frontButton.textContent={bedroom:'침실 정면',courtyard:'안뜰 시작점',exterior:'전망대 시작점',passage:'통로 가운데',palace:'왕좌 정면'}[next];
    castleNote.hidden=!isCastle(next)&&next!=='passage';
    if(!castleNote.hidden)castleNote.textContent=next==='courtyard'?'성 안뜰 · 성문과 성벽 문':next==='passage'?'오르막: 꼭대기층 침실 · 내리막: 왕좌의 방. 가운데 경사로 · 양옆 계단':'성 밖 · 구름 전망대';
    for(const b of placeButtons)b.setAttribute('aria-pressed',String(b.dataset.place===next));
    if(locationStatus)locationStatus.value=ROOM_NAMES[next]+(next==='exterior'?'로 이동했습니다.':'으로 이동했습니다.');
  }
  function choosePlace(next,entry) {
    if(!Object.hasOwn(ROOM_NAMES,next))return;
    locationControl.open=false;
    if(next!==place){
      describePlace(next);
      cancelAnimationFrame(seatFrame);seatFrame=0;seatState='standing';
      gait.seatActive=false;gait.seatAmount=0;
      clearSleep(true);
      if(curtainFrame){cancelAnimationFrame(curtainFrame);curtainFrame=0;gait.curtainAmount=curtainClosed?1:0;}
      stopKeyboard();prepareRoom();recenter(entry);
    }
    view.focus({preventScroll:true});
  }
  function toggleInteriorDoor(){
    if(upperDoorControl.disabled)return;
    const side=insideDoorAt(place,floorX,floorZ);
    if(!side)return;
    // 문턱 위에서는 닫을 수 없게 하여 통과 중 문짝에 갇히지 않는다.
    if(doorsOpen[side]){
      const d=place==='passage'?(side==='lower'?floorZ:PASSAGE.length-floorZ):
        side==='lower'?hall.front-floorZ:floorZ+BEDROOM.back;
      if(d<.28){if(locationStatus)locationStatus.value='문에서 한 걸음 물러나 닫아 주세요.';return;}
    }
    doorsOpen[side]=!doorsOpen[side];
    cancelAnimationFrame(doorFrames[side]);
    const from=gait.doors[side],to=Number(doorsOpen[side]),start=performance.now();
    if(reducedMotion.matches){gait.doors[side]=to;paint();return;}
    const update=now=>{
      const t=Math.min(1,(now-start)/380);
      gait.doors[side]=from+(to-from)*smooth(t);
      paint();
      doorFrames[side]=t<1?requestAnimationFrame(update):0;
    };
    doorFrames[side]=requestAnimationFrame(update);
  }
  upperDoorControl.addEventListener('click',()=>{
    toggleInteriorDoor();view.focus({preventScroll:true});
  });
  function enterGate(){
    if(cameraControls.disabled||gait.seatActive)return;
    if(nearMainEntry(place,floorX,floorZ)){
      const distance=place==='palace'?floorZ+ENTRY.hallZ:-ENTRY.yardZ-floorZ;
      if(entryOpen&&distance<.27){
        if(locationStatus)locationStatus.value='성문에서 한 걸음 물러나 닫아 주세요.';
        return;
      }
      entryOpen=!entryOpen;
      cancelAnimationFrame(entryFrame);
      const from=gait.mainEntry,to=Number(entryOpen),begin=performance.now();
      if(locationStatus)locationStatus.value=entryOpen?'성문이 열립니다. 문 앞으로 걸어가면 통과합니다.':'성문을 닫았습니다.';
      if(reducedMotion.matches){gait.mainEntry=to;paint();return;}
      const motion=now=>{
        const t=Math.min(1,(now-begin)/420);
        gait.mainEntry=from+(to-from)*smooth(t);
        paint();
        entryFrame=t<1?requestAnimationFrame(motion):0;
      };
      entryFrame=requestAnimationFrame(motion);
      return;
    }
    const g=nearbyCastleGate(place,floorX,floorZ);
    if(g)choosePlace(g.to,g.entry);
  }
  gateControl.addEventListener('click',()=>{
    enterGate();view.focus({preventScroll:true});
  });
  for(const b of placeButtons)b.addEventListener('click',()=>choosePlace(b.dataset.place));
  locationControl?.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&locationControl.open){e.preventDefault();locationControl.open=false;locationControl.querySelector('summary')?.focus();}
  });
  document.addEventListener('pointerdown',e=>{
    if(locationControl?.open&&!locationControl.contains(e.target))locationControl.open=false;
  });
  frontButton.addEventListener("click", recenter);
  function changeCamera() {
    thirdOptions.hidden = !thirdPersonControl.checked;
    if (!scene || cameraControls.disabled) return;
    const next = selectedPreset();
    if (next !== preset) {
      orbit.yaw = 0;
      if (next === "first" || preset === "first") orbit.pitch = 0;
      walkHeadingLocked = false;
      preset = next;
    }
    interacted = true;
    stopMotion();
    paint();
  }
  cameraControls.addEventListener("change", e=>{if(e.target!==keyModeControl)changeCamera();});
  distanceControl.addEventListener("input", paint);
  thirdOptions.hidden = !thirdPersonControl.checked;
  window.addEventListener("keydown", event => {
    if (event.key !== "F5" && event.key?.toLowerCase() !== "e") return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing || cameraControls.disabled||npcUI.opened) return;
    const focus = document.activeElement;
    if (focus && focus !== document.body && !view.contains(focus) && !stick.contains(focus) && !cameraControls.contains(focus)) return;
    const restingControl=place==='bedroom'?bedControl:seatControl;
    const canPass=!gateControl.disabled, canToggleDoor=!upperDoorControl.disabled;
    if (event.key !== 'F5' && !canPass && !canToggleDoor && !npcUI.canTalk && (isCastle(place)||place==='passage'||restingControl.disabled)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.key !== 'F5') { if(canToggleDoor)toggleInteriorDoor();else if(canPass)enterGate();else if(place==='bedroom')toggleBed();else if(place==='palace'&&!seatControl.disabled)toggleSeat();else npcUI.openNearest();return; }
    if (!thirdPersonControl.checked) {
      thirdPersonControl.checked = true;
      backControl.checked = true;
    } else if (!frontControl.checked) {
      frontControl.checked = true;
    } else {
      firstPersonControl.checked = true;
    }
    changeCamera();
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(view);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  window.addEventListener("pageshow", resize);
  for (const event of ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]) {
    document.addEventListener(event, () => { resize(); requestAnimationFrame(resize); });
  }
  window.addEventListener("blur", () => { drag = null; stopStick(); stopKeyboard(); });
  resize();
})();
