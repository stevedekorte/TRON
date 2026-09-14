// Static access text; the opening dissolve is handled by the main view.
export class Terminal {
 constructor(text,actions){this.text=text;this.actions=actions;this.done=true;}
 finish(){this.done=true;this.actions.hidden=false;this.text.parentElement.classList.add('complete');}
}
