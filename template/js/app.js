document.documentElement.dir='rtl';document.documentElement.lang='fa';
var fa=function(n,o){return Number(n).toLocaleString('fa-IR',o)};
var I={
 heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
 plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
 star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
};
var ic=function(n,c){return '<svg class="i '+(c||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>'};
var BADGE={new:['جدید','b-new'],best:['پرفروش','b-best'],promo:['تخفیف ویژه','b-promo']};
function card(p){
  var off=p.old?Math.round((1-p.price/p.old)*100):0;
  var sold=p.stock===0,low=p.stock>0&&p.stock<=5;
  var b=p.badge&&BADGE[p.badge];
  return '<article class="card'+(sold?' sold':'')+'">'+
   '<div class="media">'+(b?'<span class="badge '+b[1]+'">'+b[0]+'</span>':'')+
   '<button class="wish" aria-pressed="false" aria-label="افزودن «'+p.name+'» به علاقه‌مندی‌ها">'+ic('heart')+'</button>'+
   '<svg class="art" viewBox="0 0 200 200" role="img" aria-label="'+p.name+'"><use href="#'+p.art+'"/></svg>'+
   '<button class="quick" '+(sold?'data-notify':'data-add="'+p.id+'"')+' aria-label="'+(sold?'ناموجود':'افزودن به سبد')+'">'+(sold?'<span>خبرم کن</span>'+ic('bell'):'<span>افزودن به سبد</span>'+ic('plus'))+'</button></div>'+
   '<div class="meta"><span class="brand" dir="ltr" style="text-align:start">'+p.brand+'</span>'+
   '<h3 class="name"><a href="#">'+p.name.replace(/([A-Za-z][A-Za-z0-9 .+\-]*[A-Za-z0-9])/g,'<bdi>$1</bdi>')+'</a></h3>'+
   '<div class="rate">'+ic('star')+'<b class="num">'+fa(p.rating,{minimumFractionDigits:1})+'</b><span class="num">('+fa(p.n)+')</span></div>'+
   (p.sw?'<div class="sw" aria-hidden="true">'+p.sw.map(function(c,i){return '<i'+(i===0?' class="on"':'')+' style="background:'+c+'"></i>'}).join('')+'</div>':'')+
   '<div class="price'+(off?' off':'')+'">'+
     '<span class="now">'+fa(p.price)+' <span class="unit">تومان</span></span>'+
     (off?'<s><span class="sr">قیمت قبل از تخفیف: </span>'+fa(p.old)+'</s><span class="pct">−'+fa(off)+'٪</span>':'')+
   '</div>'+
   '<span class="stock'+(sold?' out':low?' low':'')+'">'+(sold?'ناموجود':low?'تنها '+fa(p.stock)+' عدد':'موجود در انبار')+'</span></div></article>';
}
var by=function(ids){return ids.map(function(i){return P.filter(function(p){return p.id===i})[0]})};
var $=function(s){return document.querySelector(s)};
function render(id,list){$(id).innerHTML=list.map(card).join('')}

$('#cats').innerHTML=CATS.map(function(c){return '<a class="cat" href="#"><svg class="art" viewBox="0 0 200 200" aria-hidden="true"><use href="#'+ART[c[0]]+'"/></svg><span>'+c[1]+'</span></a>'}).join('');

var chipList=[['all','همه'],['case','قاب'],['charger','شارژر'],['cable','کابل'],['bank','پاوربانک'],['buds','هندزفری'],['glass','گلس']];
var cur='all';
function feat(){
  var l=P.filter(function(p){return cur==='all'||p.cat===cur});
  if(cur==='all')l=by([1,3,4,5,2,8,7,6]).slice(0,4);
  render('#featGrid',l);
}
$('#chips').innerHTML=chipList.map(function(c){return '<button class="chip" data-c="'+c[0]+'" aria-pressed="'+(c[0]==='all')+'">'+c[1]+'</button>'}).join('');
$('#chips').addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;cur=b.dataset.c;[].forEach.call(document.querySelectorAll('.chip'),function(x){x.setAttribute('aria-pressed',x===b)});feat()});
feat();
render('#dealGrid',by([3,4,7]));
render('#newGrid',by([5,3,8,2]));

// states review
var sample=Object.assign({},P[1]);
$('#states').innerHTML=[
 ['عادی',card(Object.assign({},P[7],{badge:null}))],
 ['تخفیف‌دار',card(P[3])],
 ['رو به اتمام',card(Object.assign({},P[3],{old:null,price:2650000,badge:null}))],
 ['ناموجود',card(P[5])],
 ['در حال بارگذاری','<article class="card"><div class="media sk" style="border-radius:var(--r-lg)"></div><div class="meta"><span class="sk" style="width:36%;height:12px"></span><span class="sk" style="width:90%;height:16px"></span><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:46%;height:20px;margin-top:4px"></span></div></article>']
].map(function(s){return '<div><div class="lbl">'+s[0]+'</div>'+s[1]+'</div>'}).join('');

// interactions
var cart=2,wish=0;
function bump(el){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}
function toast(msg,link){
  var t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  t.innerHTML=ic('check')+'<span>'+msg+'</span>'+(link?'<a href="#">'+link+'</a>':'');
  $('#toasts').appendChild(t);while($('#toasts').children.length>2)$('#toasts').firstChild.remove();
  setTimeout(function(){t.remove()},4000);
}
document.addEventListener('click',function(e){
  var a=e.target.closest('[data-add]');
  if(e.target.closest('[data-notify]')){e.preventDefault();toast('وقتی موجود شد خبرتان می‌کنیم')}
  if(a){e.preventDefault();cart++;['#ccount','#bcount'].forEach(function(s){$(s).textContent=fa(cart);bump($(s))});toast('به سبد خرید اضافه شد','مشاهده‌ی سبد')}
  var w=e.target.closest('.wish');
  if(w){e.preventDefault();var on=w.getAttribute('aria-pressed')!=='true';w.setAttribute('aria-pressed',on);wish+=on?1:-1;var c=$('#wcount');c.hidden=wish<=0;c.textContent=fa(wish);if(on)toast('به علاقه‌مندی‌ها اضافه شد')}
  if(e.target.closest('a[href="#"]'))e.preventDefault();
});
$('#theme').addEventListener('click',function(){
  var r=document.documentElement,d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);
  r.dataset.theme=d?'light':'dark';
});
document.addEventListener('keydown',function(e){if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();$('#q').focus()}});
// countdown
var end=Date.now()+(5*3600+42*60+18)*1000;
function tick(){var s=Math.max(0,Math.floor((end-Date.now())/1000));var z=function(n){return fa(String(n).padStart(2,'0')).length<2?'۰'+fa(n):fa(n)};
 $('#ch').textContent=z(Math.floor(s/3600));$('#cm').textContent=z(Math.floor(s%3600/60));$('#cs').textContent=z(s%60)}
tick();setInterval(tick,1000);
