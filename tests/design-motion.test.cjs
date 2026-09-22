// Behavioural tests for the new controller; legacy motion tests remain separate.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('design-motion.js','utf8');
class Events {
  constructor(){this.events=new Map()}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn)}
  emit(name,event={}){for(const fn of this.events.get(name)||[])fn({type:name,...event})}
}
function environment(opts={}){
  let now=0,seq=0;const timers=new Map(),observers=[],animations=[];
  class Element extends Events {
    constructor(top=0,left=0){super();this.children=[];this.parent=null;this.removed=false;this.rect={top,left,bottom:top+300};const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle:(x,on)=>on?set.add(x):set.delete(x)};}
    setAttribute(){}
    append(el){this.children.push(el);el.parent=this}
    remove(){this.removed=true}
    contains(el){return el===this||this.children.some(c=>c.contains(el))}
    getBoundingClientRect(){return this.rect}
    animate(frames,options){if(opts.animationError)throw Error('animate failed');const a={frames,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.()}};animations.push(a);return a}
  }
  const win=new Events(),doc=new Events(),media=new Events();
  media.matches=!!opts.reduce;doc.hidden=!!opts.hidden;doc.documentElement=new Element();doc.body=new Element();
  const canvas=new Element(100),above=new Element(200),cards=[new Element(1200,0),new Element(1200,400),new Element(1200,800)];
  const section=new Element(1100);cards.forEach(c=>section.append(c));
  doc.querySelector=()=>canvas;doc.querySelectorAll=selector=>selector==='.hero-copy > *'?Array.from({length:3},()=>new Element(100)):[above,...cards];doc.createElement=()=>new Element();doc.body.append(canvas);doc.body.append(above);doc.body.append(section);doc.getElementById=id=>id==='top'?doc.body:id==='services'?section:null;
  class Observer {
    constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this)}
    observe(el){this.targets.add(el)} unobserve(el){this.targets.delete(el)} disconnect(){this.targets.clear()}
    trigger(targets,on=true){this.callback(targets.map(target=>({target,isIntersecting:on,boundingClientRect:target.rect})))}
  }
  if(!opts.noObserver)win.IntersectionObserver=Observer;
  const ctx={document:doc,window:win,Element,IntersectionObserver:Observer,matchMedia:()=>media,location:{hash:opts.hash||''},scrollY:opts.scroll||0,innerHeight:800,performance:{getEntriesByType:type=>type==='paint'?(opts.painted?[{name:'first-contentful-paint'}]:[]):[{type:opts.navigation||'navigate'}]},getComputedStyle:()=>({getPropertyValue:k=>k==='--motion-enter'?'1100ms':'cubic-bezier(0,0,.3,1)'}),setTimeout(fn,ms){timers.set(++seq,{fn,at:now+ms});return seq},clearTimeout(id){timers.delete(id)}};
  vm.runInNewContext(source,ctx);
  function advance(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn()}}
  return {doc,win,media,canvas,above,cards,section,observers,animations,advance,opening:()=>doc.body.children.find(e=>e.className==='hero-opening'&&!e.removed)};
}
let e=environment();assert(e.opening());assert.deepEqual(e.animations.map(a=>a.options.duration),[1600,1100,1100,1100]);assert.deepEqual(e.animations.map(a=>a.options.delay),[1000,1160,1320,1480]);assert(!e.above.classList.contains('reveal-pending'));
e.observers[0].trigger([e.canvas]);assert(!e.canvas.classList.contains('is-floating'),'floating waits for the opening');
for(const event of ['pointerdown','touchstart','wheel','scroll','keydown'])e.win.emit(event);
e.doc.emit('click',{target:{closest:()=>null}});
e.doc.emit('focusin',{target:e.above});
assert(e.opening(),'user input must not cancel the opening');
e.advance(1000);assert(e.opening());e.advance(1900);assert(!e.opening(),'timer finishes even without CSS events or image decoding');assert(e.canvas.classList.contains('is-floating'));
e.observers[0].trigger([e.canvas],false);assert(!e.canvas.classList.contains('is-floating'));
e.observers[0].trigger([e.canvas]);assert(e.canvas.classList.contains('is-floating'));
e.animations.length=0;e.observers[1].trigger(e.cards);assert.equal(e.animations.length,3);assert.deepEqual(e.animations.map(a=>a.options.delay),[0,160,320]);
for(const a of e.animations){assert.equal(a.options.duration,1100);a.onfinish();assert(a.cancelled)}
assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));e.observers[1].trigger(e.cards);assert.equal(e.animations.length,3,'entrances run once');
for(const opts of [{reduce:true},{hidden:true},{hash:'#services'},{scroll:80},{navigation:'back_forward'},{painted:true}])assert(!environment(opts).opening());
e=environment({hash:'#services'});assert(e.cards.every(c=>!c.classList.contains('reveal-pending')),'deep-link content is immediately visible');
e=environment();e.doc.emit('click',{target:{closest:()=>({hash:'#services'})}});assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));assert(e.opening(),'anchor navigation does not cancel photo opening');
e=environment();e.doc.emit('focusin',{target:e.cards[1]});assert(!e.cards[1].classList.contains('reveal-pending'));
e=environment();e.media.matches=true;e.media.emit('change');assert(!e.opening());assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));assert(!e.canvas.classList.contains('is-floating'));
for(const name of ['beforeprint','pagehide','error']){e=environment();e.win.emit(name);assert(e.cards.every(c=>!c.classList.contains('reveal-pending')),name)}
e=environment();e.doc.hidden=true;e.doc.emit('visibilitychange');assert(!e.opening());assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));
e=environment({animationError:true,painted:true});e.observers[1].trigger(e.cards);assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));
e=environment({noObserver:true});e.advance(2900);assert(!e.opening());assert(e.cards.every(c=>!c.classList.contains('reveal-pending')));
e=environment({animationError:true});assert(!e.opening());
e=environment({hash:'#top'});assert(e.cards.every(c=>c.classList.contains('reveal-pending')),'top URL must retain offscreen entrances');e.animations.length=0;e.observers[1].trigger([e.cards[0]]);assert.equal(e.animations.length,1);e.doc.emit('click',{target:{closest:()=>({hash:'#top'})}});assert(e.cards[1].classList.contains('reveal-pending'),'top link must not disable unseen content');
console.log('PASS: timed opening, input non-cancellation, deep links, one-shot entrances, staggering, focus, reduced motion, visibility, print, failures and no-observer fallback.');
