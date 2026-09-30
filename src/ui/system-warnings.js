// Keyed notices allow other recoverable game warnings to share the same HUD.
export class SystemWarnings{
 constructor(element){this.element=element;this.issues=new Map();this.signature='';}
 set(id,issue){
  if(issue)this.issues.set(id,issue);else this.issues.delete(id);
  const issues=[...this.issues.values()].sort((a,b)=>(b.level==='error')-(a.level==='error'));
  const signature=JSON.stringify(issues);if(signature===this.signature)return;this.signature=signature;
  this.element.hidden=!issues.length;
  this.element.replaceChildren(...issues.map(issue=>{
   const row=document.createElement('div');row.className='system-notice';row.dataset.level=issue.level;
   if(issue.transient)row.classList.add('transient');
   const label=document.createElement('strong');label.textContent=(issue.transient?'':'⚠ ')+issue.label;
   const detail=document.createElement('span');detail.textContent=issue.detail;
   row.append(label,detail);return row;
  }));
 }
}
