(()=>{
 if(!document.documentElement.hasAttribute('data-voxi-home'))return;
 const labels=()=>{const kk=document.documentElement.lang==='kk',key=kk?'homeKk':'homeRu';document.querySelectorAll('[data-home-ru]').forEach(node=>{node.textContent=node.dataset[key];});document.getElementById('how')?.setAttribute('aria-label',kk?'Жазба қалай өтеді':'Как проходит запись');};
 new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});labels();
})();
