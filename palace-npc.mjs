import { makeRoyalModel, npcAtlas } from './palace-npc-model.mjs?v=royal-depth';
import { floorHeight, hall } from './palace-floor.mjs';
import { castleFloor, castleWalkable } from './palace-castle.mjs?v=patrol-paths';

export const ACTIVE_NPC_ROOMS=['palace','courtyard'];
export const ROYAL_NPCS={
  rogarder:{
    name:'로가더 하프에일', title:'왕실 최고위 근위 기사단장 · 제1등급 탱커 겸 검사',
    family:'에일리언 퀸과 킹 사이에서 태어난 인간형 헌터. 마도여왕님의 남편이자 로얄이의 아버지, 마음을 돌보는 가장 가까운 수호자.',
    welcome:'잘 오셨습니다, 폐하. 왕실의 길은 제가 지키지요. 로얄이는 오늘도 제 몫 이상을 해내더군요.',
    portrait:'./img/royal-npc/rogarder.webp?v=royal-human', surface:'./img/royal-npc/rogarder-details.webp', royal:false,
    routes:{palace:[[-.53,.055],[-1.30,.055],[-1.98,.055],[-2.17,-.35],[-1.75,-.86],[-1.03,-.91],[-.60,-.60]],
      courtyard:[[-1.17,-1.35],[-1.80,-1.76],[-2.03,-2.20],[-1.60,-2.59],[-.79,-2.79],[-.76,-2.00]]}
  },
  royal:{
    name:'로얄이',title:'왕실 공주 · 메이드 수호 기사 · 차세대 기사',
    family:'마도여왕님과 로가더 하프에일의 딸. 메이드로서 성을 관리하고 기사로서 왕실을 지킨다. 아버지가 인정하는 기사단의 최강자.',
    welcome:'어마마마, 오셨어요? 순찰도 끝냈고 성 관리도 보고드릴 준비가 됐답니다. 그런데 먼저 잠깐 같이 있어 주시면 안 돼요?',
    portrait:'./img/royal-npc/royal.webp?v=royal-human', surface:'./img/royal-npc/royal-details.webp', royal:true,
    routes:{palace:[[.53,.055],[1.27,.055],[1.91,.055],[2.14,-.38],[1.71,-.89],[.96,-.95],[.59,-.63]],
      courtyard:[[1.21,-1.42],[1.84,-1.80],[2.04,-2.25],[1.54,-2.57],[.83,-2.77],[.77,-2.02]]}
  }
};
export const NPC_TOPICS={
  appearance:/(에일리언|크레스트|로물루스|조물루스|꼬리|외모|갑각)/,
  family:/(가족|아버지|아빠|딸|남편|부모|어마마마|엄마|아버님|하프에일|로얄이)/,
  rank:/(최강|기사|계급|등급|단장|수호|검사|탱커|직책|순찰|임무|전투|훈련)/,
  comfort:/(힘들|힘드|지쳐|지쳤|울고|슬프|슬퍼|불안|무섭|속상|피곤|우울|마음|걱정|따뜻|위로|상담|휴식)/,
  castle:/(성문|성벽|전망대|안뜰|왕좌|침실|통로|성\s*안|청소|커튼|카펫|관리|길\s*안내|어디)/,
  origin:/(태어|종족|혈통|킹과|퀸과|왕가|기원|세계관|자기소개|이름이)/,
  thanks:/(고마|감사|수고|좋아해|사랑해)/,
  greeting:/(안녕|반가|여보|하이|좋은\s*(아침|밤|저녁))/,
  fun:/(웃겨|웃어|놀자|농담|재밌|간식|차\s*마|좋아하는|취미)/,
};
const LINES={
  rogarder:{
    appearance:['제 갑각과 문장은 가문의 것, 꼬리와 크레스트는 헌터의 혈통입니다. 위압은 적에게만 향해야지요.'],
    family:['로얄이는 제가 쌓아 온 기록을 이미 여럿 앞질렀습니다. 그래도 딸이 힘든 날엔 기록이 아니라 마음부터 살펴야지요.','폐하는 저의 주군이자 배우자입니다. 로얄이는 우리 딸이고요. 기사단 제1등급이라는 자부심도, 그 아이 앞에선 아버지라는 이름보다 앞서지 않습니다.'],
    rank:['저는 가문에 직속된 근위 기사단장입니다. 검사이기 전에 탱커지요. 동료가 안전하게 움직일 자리를 먼저 만드는 것이 제 일입니다.','제 서열은 제1등급입니다. 그러나 가장 강한 기사를 물으신다면 로얄이입니다. 그건 아비의 사심만으로 하는 말이 아닙니다.'],
    comfort:['괜찮다고 서둘러 말하지 않으셔도 됩니다, 폐하. 어떤 일이 제일 무겁게 느껴졌는지부터 들려주세요.','로얄이에게도 늘 하는 말이 있습니다. 마음을 추스를 때는 해결보다 숨을 고를 여유가 먼저라고요. 지금은 제가 함께 있겠습니다.'],
    castle:['왕좌 등받이 뒤 중앙문으로 가면 침실 방향입니다. 천장이 높은 직선 통로 가운데의 경사로가 가장 걷기 편하지요.','성 밖으로 가시려면 왕좌 맞은편 성문을 여십시오. 안뜰을 곧장 지나면 바깥 성벽 문과 전망대가 나옵니다.'],
    origin:['에일리언 퀸과 에일리언 킹 사이에서 태어났습니다. 제 모습은 인간형에 가깝지만 헌터 혈통은 감추지 않습니다. 러브바운드 왕실을 섬기는 것은 제가 선택한 일입니다.','저는 로가더 하프에일입니다. 폐하의 남편이자 왕실 수호자이지요. 로얄이에게는 그저 아버지이고 싶습니다.'],
    thanks:['과분한 말씀입니다, 폐하. 오늘도 제 자리를 지키겠습니다.','마음은 제가 더 고맙습니다. 가족에게 듣는 한마디는 훈장과는 다르지요.'],
    greeting:['폐하, 뵙게 되어 기쁩니다. 성 안에 특별한 일은 없었습니다.','어서 오십시오, 폐하. 곁에서 호위할까요, 아니면 잠시 이야기를 나눌까요?'],
    fun:['로얄이가 “휴식도 명령입니다”라며 홍차를 놓고 간 적이 있습니다. 그 명령에는 제가 아직 한 번도 반항한 적이 없지요.'],
    default:['말씀 잘 들었습니다, 폐하. 그 일에서 폐하께 가장 중요한 건 무엇인지 듣고 싶습니다.','폐하의 말씀을 더 듣겠습니다. 기사단의 일인지 가족의 이야기인지 알려 주시면 제 생각을 말씀드리지요.','제가 앞서 결론을 내리지는 않겠습니다. 편히 말씀해 주십시오.']
  },
  royal:{
    appearance:['보라색 크레스트도 꼬리도 제가 물려받은 특징이에요. 그래도 흰 러플과 왕실 금장은 절대 빼면 안 돼요. 제 표식인걸요.'],
    family:['아빠는 단장님일 땐 아주 엄격한데 제 얘기만 나오면 표정이 풀려요. 어마마마도 보셨죠? 저도 아빠와 엄마가 정말 좋아요.','아버지는 제 마음을 가장 먼저 알아봐 주세요. 저는 우리 가족을 지킬 수 있도록 공주와 기사, 두 자리 모두 열심히 하고 싶어요.'],
    rank:['로얄이는 공주이자 메이드 기사랍니다. 순찰하고 성을 돌보는 일도 다 임무예요. 다음 세대 기사도 제가 책임지고 싶어요!','아빠가 제가 최강이라 했다구요? 에헤헤. 그래도 당직표를 끝까지 지켜야 진짜 좋은 기사인걸요.'],
    comfort:['어마마마, 오늘만큼은 저한테 조금 기대도 돼요. 무슨 일이 있었는지 천천히 얘기해 주실래요?','저도 마음이 복잡할 때는 아빠와 조용히 앉아 있어요. 지금은 해결책이 필요하세요, 아니면 제가 그냥 들어 드릴까요?'],
    castle:['침실 계단과 경사로는 열어 둔 문을 통해 쭉 이어져요. 침대 맞은편 갈색문을 열어 내려오면 왕좌 뒤예요. 제가 통로 벽등도 살펴봤답니다.','안뜰과 성문은 제 순찰 구역이에요. 바깥 전망대로 가시려면 안뜰을 건너 성벽 문까지 곧장 걸으시면 돼요.'],
    origin:['저는 어마마마와 로가더 하프에일 아버지 사이에서 태어난 로얄이예요. 왕실 공주이고, 성을 돌보는 메이드 기사랍니다.','외모는 가족에게 물려받았지만 메이드 기사를 택한 건 저예요. 성과 식구들을 모두 돌보고 싶었거든요.'],
    thanks:['에헤헤, 어마마마한테 칭찬받으면 내일 순찰까지 더 힘이 나요!','제가 더 고마워요. 다만 오늘 저, 쓰담쓰담 한 번 받아도 돼요?'],
    greeting:['어마마마, 안녕하세요! 순찰은 끝났으니까 이제 제 얘기도 조금 들어 주실래요?','반가워요, 어마마마. 기사 로얄이, 메이드 업무와 경비 이상 없다고 보고드려요!'],
    fun:['궁전에서 제일 조용한 복도를 알아요. 하지만 간식 얘기를 하면 아빠가 거기서도 듣나 봐요. 신기하죠?','차를 가져올 땐 메이드, 지킬 땐 기사, 칭찬을 받을 땐 어마마마 딸! 세 역할 중 마지막이 제일 어려워요.'],
    default:['응, 듣고 있어요, 어마마마. 조금 더 자세히 말해 주실래요?','그건 어마마마에게 어떤 일이었어요? 제가 기사로서 도울지, 딸로서 들어드릴지 먼저 알고 싶어요.','저라면 씩씩하게 해보고 모르겠으면 다시 여쭤볼래요. 어마마마 생각도 듣고 싶어요.']
  }
};
export function talkReply(id,sentence,memo={}){
  const t=sentence.normalize('NFKC').replace(/\s+/g,' ').trim();
  const intent=['comfort','origin','appearance','castle','rank','family','thanks','greeting','fun'];
  let kind=intent.find(key=>NPC_TOPICS[key].test(t))??'default';
  if(kind==='default'&&memo.lastTopic&&/^(그래|응|맞아|더\s*말해|계속|어떻게|왜[?？!！]*)[.!?？ ]{0,6}$/.test(t))kind=memo.lastTopic;
  const lines=LINES[id]?.[kind]??LINES.royal.default;
  memo.counts??={};let index=memo.counts[kind]??0;memo.counts[kind]=index+1;
  if(kind!=='default')memo.lastTopic=kind;
  if(kind==='rank'&&/최강|제일\s*(강|센)|가장\s*강|누가\s*더\s*(세|강)/.test(t))index=1;
  if(kind==='castle'){
    if(/성문|성벽|전망대|안뜰/.test(t))index=1;
    if(/침실|왕좌|경사로|통로/.test(t))index=0;
  }
  return {line:lines[index%lines.length]};
}

export function makePatrol(id,room){
  const route=ROYAL_NPCS[id].routes[room];
  return {room,x:route[0][0],z:route[0][1],index:1,heading:0,look:0,wait:id==='rogarder'?8:9.4,phase:.11,ramp:0,route};
}
// 보행 중 몸통뿐 아니라 뒤로 뻗은 꼬리와 회전하는 망토에도 폭을 남긴다.
export const NPC_CLEARANCE=.32;
export function npcWalkable(room,x,z){
  if(room==='courtyard')return z<-.68 && Math.hypot(x,z)<3.40 && castleWalkable(x,z,NPC_CLEARANCE);
  // 왕좌와 양쪽 기사상/수정, 앞 계단 전체를 우회하는 입구 쪽 순찰 구역.
  return room==='palace' && Math.abs(x)<=hall.halfWidth-NPC_CLEARANCE &&
    z>=-hall.back+NPC_CLEARANCE && z<=.393-NPC_CLEARANCE;
}
export function npcCanStep(room,x,z,nx,nz){
  // 시작점과 도착점 사이도 확인해서 큰 프레임 이동이 장애물을 건너뛰지 않게 한다.
  const cuts=Math.max(1,Math.ceil(Math.hypot(nx-x,nz-z)/.025));
  for(let i=0;i<=cuts;i++) if(!npcWalkable(room,x+(nx-x)*i/cuts,z+(nz-z)*i/cuts))return false;
  return true;
}
const wrap=r=>Math.atan2(Math.sin(r),Math.cos(r));
export function updatePatrol(p,sec,playerX,playerZ,paused=false){
  const userDist=Math.hypot(playerX-p.x,playerZ-p.z);
  const [tx,tz]=p.route[p.index],dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
  const stop=paused||userDist<.48||p.wait>0;
  if(p.wait>0&&!paused)p.wait=Math.max(0,p.wait-sec);
  const desired=stop? (userDist<.96||paused?Math.atan2(playerX-p.x,-(playerZ-p.z)):p.heading):Math.atan2(dx,-dz);
  const turn=wrap(desired-p.heading);
  p.heading+=Math.max(-sec*2.5,Math.min(sec*2.5,turn));
  p.look+=(Math.max(-.62,Math.min(.62,turn))-p.look)*Math.min(1,sec*7);
  const go=!stop&&Math.abs(turn)<1.17;
  p.ramp+=(Number(go)-p.ramp)*Math.min(1,sec*(go?6:8));
  if(stop)return;
  if(d<.036){p.index=(p.index+1)%p.route.length;p.wait=.36+(p.index%3)*.12;return;}
  if(!go)return;
  const speed=.208, dist=Math.min(d,speed*sec);
  const nx=p.x+dx/d*dist,nz=p.z+dz/d*dist;
  if(!npcCanStep(p.room,p.x,p.z,nx,nz)||Math.hypot(playerX-nx,playerZ-nz)<.48){
    p.ramp=Math.max(0,p.ramp-sec*6);
    return;
  }
  p.x=nx;p.z=nz;
  p.phase+=dist/.177;
}
export async function createRoyalPatrol(THREE,world){
  const texture=npcAtlas(THREE), loader=new THREE.TextureLoader();
  const root=new THREE.Group();root.name='CastleRoyalFamily';world.add(root);root.visible=false;
  const entries=Object.fromEntries(await Promise.all(Object.entries(ROYAL_NPCS).map(async ([id,desc])=>{
    let details;
    try{
      details=await loader.loadAsync(desc.surface);
      details.flipY=false;details.generateMipmaps=false;details.minFilter=THREE.LinearFilter;
    }catch{
      console.warn(desc.name+' 설정화 표면을 불러오지 못해 기본 모델을 사용합니다.');
    }
    const model=makeRoyalModel(THREE,texture,desc.royal,details);
    model.mesh.name=desc.name;root.add(model.mesh);
    return [id,{id,model,details,rooms:Object.fromEntries(ACTIVE_NPC_ROOMS.map(room=>[room,makePatrol(id,room)]))}];
  })));
  let previous=0,lastRoom=null,heads=[];
  const point=new THREE.Vector3();
  function pose(room,playerX,playerZ,gait={},camera){
    root.visible=ACTIVE_NPC_ROOMS.includes(room);
    if(!root.visible){previous=0;lastRoom=null;heads=[];return;}
    const now=performance.now(),seconds=previous&&room===lastRoom?Math.max(0,Math.min(.14,(now-previous)/1000)):0;
    previous=now;lastRoom=room;
    heads=[];
    camera.updateWorldMatrix(true,false);
    for(const {id,model,rooms} of Object.values(entries)){
      const p=rooms[room];
      if(!gait.reducedMotion)updatePatrol(p,seconds,playerX,playerZ,gait.talkingTo===id);
      const ground=room==='palace'?floorHeight(p.x,p.z):castleFloor(p.x,p.z);
      model.mesh.position.set(p.x,ground,-p.z);model.mesh.rotation.y=p.heading;
      model.pose(p.phase,gait.reducedMotion?0:p.ramp,p.look);
      const afstand=Math.hypot(playerX-p.x,playerZ-p.z);
      point.set(p.x,ground+model.headHeight,-p.z).project(camera);
      heads.push({id,distance:afstand,x:(point.x*.5+.5),y:(1-point.y)*.5,
        visible:point.z>-1&&point.z<1&&Math.abs(point.x)<.94&&Math.abs(point.y)<.90&&afstand<3.5});
    }
  }
  return {pose,get heads(){return heads;},dispose(){world.remove(root);texture.dispose();for(const {details,model} of Object.values(entries)){details?.dispose();model.dispose();}}};
}
