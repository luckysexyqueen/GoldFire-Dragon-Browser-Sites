// 질량·스프링·감쇠 계를 해석적으로 적분해 주사율과 무관하게 원위치로 돌아오게 한다.
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function spring(decay, frequency) {
  let position=0, velocity=0;
  return {
    get position(){return position;},
    get active(){return position!==0 || velocity!==0;},
    kick(speed){velocity+=speed;},
    advance(target,dt,reset) {
      if (reset) {position=velocity=0;return 0;}
      const c=Math.cos(frequency*dt),s=Math.sin(frequency*dt),fade=Math.exp(-decay*dt);
      const x=position-target, slope=(velocity+decay*x)/frequency;
      position=target+fade*(x*c+slope*s);
      velocity=fade*(velocity*c-(decay*slope+frequency*x)*s);
      if (target===0 && Math.abs(position)<.0025 && Math.abs(velocity)<.045) position=velocity=0;
      return clamp(position,-1.45,1.45);
    }
  };
}

export function softMotion(kind, apply, now=()=>performance.now()) {
  const chest=kind==='chest';
  const points=[1,-1].map(sign=>({sign,bounce:spring(chest?6.8:7.9,chest?14.1:15.8), lag:spring(chest?7.5:8.6,chest?12.2:13.3)}));
  let prior=now(), wasMoving=false, wasRun=false, previousSeat=0, settling=false;
  return {
    get settling(){return settling;},
    pose(gait,seat) {
      const time=now(), elapsed=Math.max(0,(time-prior)/1000);
      prior=time;settling=false;
      const reset=!!(gait?.reducedMotion || gait?.recenter || elapsed>.4);
      const moving=!!(gait?.moving&&!gait.seatActive&&!reset);
      const run=!!gait?.running;
      if (!reset && (wasMoving!==moving || (moving&&run!==wasRun))) {
        for (const {bounce,lag} of points) {
          bounce.kick((moving?-1:1)*(wasRun||run?10.2:6.2));
          lag.kick((moving?1:-1)*(wasRun||run?14:8.0));
        }
      }
      if (!reset && seat-previousSeat>.028) for (const {bounce} of points) bounce.kick(-2.3);
      const phase=(gait?.distance||0)*2*Math.PI/.31,dt=Math.min(.08,elapsed),strength=run?1.54:.81;
      const forward=gait?.forward||0,side=gait?.side||0;
      points.forEach(({sign,bounce,lag},i)=>{
        const y=moving?strength*(.57*Math.sin(2*phase-.1)+.38*sign*Math.sin(phase)):0;
        const z=moving?strength*(.55*forward*Math.sin(2*phase-.7)+.39*sign*(side+.25)*Math.cos(phase)):0;
        apply(i,bounce.advance(y,dt,reset),lag.advance(z,dt,reset),seat,reset);
        settling ||= bounce.active||lag.active;
      });
      wasMoving=moving;wasRun=run;previousSeat=seat;
    }
  };
}

function chestEnvelope(x,y) {
  const q=((Math.abs(x)-.231)/.207)**2+((y-1.209)/.217)**2;
  const t=Math.max(0,1-q);
  return t*t;
}
export function chestOffset(x,y,amplitude,vertical) {
  return Math.max(-.030,chestEnvelope(x,y)*(amplitude+(y-1.209)*vertical));
}
export function chestVertical(x,y,z,amount) {
  if(!amount||z>=-.13)return 0;
  const u=clamp((-.13-z)/.20,0,1);
  return chestEnvelope(x,y)*u*u*(3-2*u)*amount;
}
