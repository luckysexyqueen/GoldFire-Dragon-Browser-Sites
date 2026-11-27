import { ROYAL_NPCS,talkReply } from './palace-npc.mjs?v=patrol-paths';

export function royalGreetingUI({view,gait,onOpen,onClose}){
  const dial=document.getElementById('royal-npc-dialog');
  const form=document.getElementById('royal-npc-form');
  const input=document.getElementById('royal-npc-input');
  const log=document.getElementById('royal-npc-log');
  const name=document.getElementById('royal-npc-name');
  const title=document.getElementById('royal-npc-title');
  const portrait=document.getElementById('royal-npc-portrait');
  const about=document.getElementById('royal-npc-about');
  const quick=document.getElementById('royal-npc-quick');
  const roster=document.getElementById('royal-npc-actions');
  const markerRoot=document.getElementById('royal-npc-markers');
  const sessions=Object.fromEntries(Object.keys(ROYAL_NPCS).map(id=>[id,{memo:{},lines:[]}]));
  let active=null,nearest=null,people=[];
  const controls={},markers={};
  for(const [id,npc] of Object.entries(ROYAL_NPCS)){
    const b=document.createElement('button');
    b.type='button';b.textContent=npc.name+' · 말 걸기';
    b.setAttribute('aria-keyshortcuts','E');b.hidden=true;
    b.addEventListener('click',()=>open(id));roster.appendChild(b);controls[id]=b;
    const marker=document.createElement('button');
    marker.type='button';marker.textContent=npc.name;marker.hidden=true;marker.tabIndex=-1;
    marker.addEventListener('click',()=>open(id));
    markerRoot.appendChild(marker);markers[id]=marker;
  }
  function append(who,content){
    const bubble=document.createElement('p');
    bubble.className=who==='you'?'npc-msg-user':'npc-msg-character';
    bubble.textContent=content;log.appendChild(bubble);
  }
  function renderLog(){
    log.replaceChildren();
    for(const {who,text} of sessions[active].lines)append(who,text);
    log.scrollTop=log.scrollHeight;
  }
  function store(who,text){
    const l=sessions[active].lines;l.push({who,text});
    if(l.length>40)l.splice(0,l.length-40);
    renderLog();
  }
  function open(id){
    if(!ROYAL_NPCS[id]||!people.some(p=>p.id===id&&p.distance<1.06)||dial.open)return;
    active=id;gait.talkingTo=id;onOpen();
    const n=ROYAL_NPCS[id];
    name.textContent=n.name;title.textContent=n.title;portrait.src=n.portrait;
    portrait.alt=n.name+'의 참고 초상';about.textContent=n.family;
    if(!sessions[id].lines.length)sessions[id].lines.push({who:'npc',text:n.welcome});
    renderLog();dial.showModal();input.focus({preventScroll:true});
  }
  function send(text){
    text=text.trim().slice(0,320);
    if(!text||!active)return;
    store('you',text);
    const res=talkReply(active,text,sessions[active].memo);
    store('npc',res.line);
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();const q=input.value;input.value='';send(q);
  });
  input.addEventListener('keydown',e=>{
    if((e.isComposing||e.keyCode===229)&&e.key==='Enter')e.preventDefault();
  });
  quick.addEventListener('click',e=>{
    if(e.target.matches('button[data-npc-topic]'))send(e.target.dataset.npcTopic);
  });
  document.getElementById('royal-npc-close').addEventListener('click',()=>dial.close());
  dial.addEventListener('close',()=>{
    input.value='';active=null;gait.talkingTo=null;onClose();view.focus({preventScroll:true});
  });
  function sync(heads){
    people=heads;nearest=null;let best=1.06,enabled=0;
    for(const [id,b] of Object.entries(controls)){
      const p=heads.find(x=>x.id===id), m=markers[id];
      b.hidden=!(p&&p.distance<1.06);
      if(!b.hidden){enabled++;if(p.distance<best){best=p.distance;nearest=id;}}
      m.hidden=!(p?.visible);
      if(!m.hidden){
        m.style.left=(p.x*100).toFixed(2)+'%';m.style.top=(p.y*100).toFixed(2)+'%';
        m.disabled=b.hidden;
      }
    }
    roster.hidden=!enabled;
  }
  return {sync,openNearest(){if(!nearest)return false;open(nearest);return true;},
    get canTalk(){return !!nearest;},get opened(){return dial.open;}};
}
