/* Original vector illustration: judge chambers, no external assets or player data. */
(()=>{'use strict';
function scene(){
 return `<div class="chambers-art" aria-hidden="true">
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 455" preserveAspectRatio="xMidYMid slice">
 <defs>
  <linearGradient id="caWall" x2="0" y2="1"><stop stop-color="#293e49"/><stop offset="1" stop-color="#152630"/></linearGradient>
  <linearGradient id="caWood" x2="0" y2="1"><stop stop-color="#936e46"/><stop offset=".4" stop-color="#67462d"/><stop offset="1" stop-color="#34261e"/></linearGradient>
  <linearGradient id="caGlass" x2="0" y2="1"><stop stop-color="#b1d0cc"/><stop offset="1" stop-color="#6c9295"/></linearGradient>
  <linearGradient id="caBrass" x2="0" y2="1"><stop stop-color="#f2d89f"/><stop offset="1" stop-color="#af7d3d"/></linearGradient>
  <radialGradient id="caGlow"><stop stop-color="#f4dfad" stop-opacity=".45"/><stop offset="1" stop-color="#f4dfad" stop-opacity="0"/></radialGradient>
  <pattern id="caLine" width="24" height="22" patternUnits="userSpaceOnUse"><path d="M0 21H24" stroke="#ffffff" opacity=".05"/></pattern>
 </defs>
 <rect width="1040" height="455" fill="url(#caWall)"/><rect width="1040" height="455" fill="url(#caLine)"/>
 <rect x="12" y="16" width="1016" height="423" rx="8" fill="none" stroke="#9d8561" stroke-opacity=".22" stroke-width="3"/>
 <path d="M0 350H1040V455H0Z" fill="#25313a"/><path d="M0 355H1040" stroke="#ae8352" stroke-width="8"/>
 <!-- Sunlit tall window -->
 <rect x="56" y="44" width="243" height="272" rx="6" fill="#111d27" stroke="#715d47" stroke-width="12"/>
 <rect x="75" y="61" width="205" height="237" fill="url(#caGlass)"/>
 <path d="M75 260L132 196L176 235L221 165L280 231V298H75" fill="#4b7176" opacity=".48"/>
 <path d="M75 273L120 226L169 261L219 214L280 276V298H75" fill="#3c6168" opacity=".7"/>
 <path d="M177 61V298M75 174H280" stroke="#594b3c" stroke-width="10"/>
 <path d="M89 67L126 67L90 281" fill="#fff" opacity=".10"/>
 <ellipse cx="174" cy="160" rx="320" ry="300" fill="url(#caGlow)"/>
 <!-- Law bookcase -->
 <rect x="345" y="42" width="326" height="303" rx="6" fill="#302820" stroke="#ad8357" stroke-width="10"/>
 <rect x="364" y="61" width="288" height="264" fill="#1a2930"/>
 <path d="M363 151H652M363 241H652M363 324H652" stroke="#8d6543" stroke-width="11"/>
 ${Array.from({length:16},(_,i)=>{const x=373+i*17;const h=53+(i%4)*4;const y=144-h;return '<rect x="'+x+'" y="'+y+'" width="13" height="'+h+'" rx="2" fill="'+['#536877','#736b58','#9b7052','#405a61'][i%4]+'"/><path d="M'+(x+3)+' '+(y+10)+'h7M'+(x+3)+' '+(y+42)+'h7" stroke="#d6ba87" stroke-opacity=".65" stroke-width="2"/>'}).join('')}
 ${Array.from({length:15},(_,i)=>{const x=373+i*18;const h=52+(i%5)*5;const y=234-h;return '<rect x="'+x+'" y="'+y+'" width="15" height="'+h+'" rx="1" fill="'+['#8f7655','#3e5860','#6d4c42','#5b6872'][i%4]+'"/><path d="M'+(x+4)+' '+(y+9)+'h7" stroke="#dfc38b" stroke-opacity=".58" stroke-width="2"/>'}).join('')}
 <rect x="395" y="264" width="93" height="38" rx="3" fill="#9b7a4d"/><rect x="401" y="270" width="81" height="26" fill="#e0cba1"/>
 <rect x="504" y="258" width="81" height="45" rx="2" fill="#34505a"/><path d="M509 268H579M509 289H579" stroke="#dbca99" stroke-width="2"/>
 <!-- Wall clock -->
 <circle cx="838" cy="114" r="65" fill="#101f28" stroke="#b99a69" stroke-width="9"/>
 <circle cx="838" cy="114" r="52" fill="#d7c6a1"/>
 ${Array.from({length:12},(_,i)=>{const ang=i*Math.PI/6;const x1=838+42*Math.sin(ang),y1=114-42*Math.cos(ang),x2=838+48*Math.sin(ang),y2=114-48*Math.cos(ang);return '<path d="M'+x1.toFixed(2)+' '+y1.toFixed(2)+'L'+x2.toFixed(2)+' '+y2.toFixed(2)+'" stroke="#48515a" stroke-width="3"/>'}).join('')}
 <path d="M838 114v-27M838 114l24 13" stroke="#273d48" stroke-width="5" stroke-linecap="round"/><circle cx="838" cy="114" r="5" fill="#a88350"/>
 <!-- framed seal -->
 <rect x="725" y="213" width="208" height="124" rx="4" fill="#17252d" stroke="#987855" stroke-width="8"/>
 <circle cx="828" cy="270" r="40" fill="none" stroke="url(#caBrass)" stroke-width="3"/>
 <path d="M828 241V298M800 254H856M802 253l-9 25h18Zm52 0-9 25h18ZM808 294h40" fill="none" stroke="#d5b47f" stroke-width="4" stroke-linecap="round"/>
 <!-- desk shadow, wooden desk -->
 <ellipse cx="544" cy="413" rx="440" ry="31" fill="#09141a" opacity=".7"/>
 <path d="M136 342L845 338L942 389L71 392Z" fill="url(#caWood)" stroke="#d0a575" stroke-width="5"/>
 <path d="M92 392H924L903 454H114Z" fill="#573923" stroke="#a67a4d" stroke-width="4"/>
 <path d="M127 407H882" stroke="#c19360" stroke-width="3" opacity=".7"/>
 <rect x="228" y="398" width="235" height="53" fill="#422d23" stroke="#b68a51" stroke-width="3"/>
 <rect x="540" y="398" width="230" height="53" fill="#422d23" stroke="#b68a51" stroke-width="3"/>
 <circle cx="347" cy="425" r="5" fill="#e0ba7d"/><circle cx="655" cy="425" r="5" fill="#e0ba7d"/>
 <!-- lamp -->
 <ellipse cx="218" cy="351" rx="46" ry="10" fill="#c99f64"/>
 <path d="M218 345L240 276L281 255" stroke="#d2b47b" stroke-width="9" fill="none"/>
 <path d="M252 245L303 249L286 285L237 268Z" fill="#bd985e" stroke="#e5cb8c" stroke-width="4"/>
 <ellipse cx="272" cy="294" rx="100" ry="65" fill="url(#caGlow)" opacity=".85"/>
 <!-- organized case folders -->
 <path d="M363 340L524 329L545 348L382 360Z" fill="#d3bd90" stroke="#9f825b" stroke-width="3"/>
 <path d="M378 334L528 327L547 338L390 348Z" fill="#ede2c9"/>
 <path d="M394 333l111-5" stroke="#988874" stroke-width="2"/>
 <path d="M563 345L720 334L732 354L573 365Z" fill="#94744d" stroke="#d6b074" stroke-width="4"/>
 <path d="M568 341L706 332L726 341L585 354Z" fill="#e1d4af"/>
 <!-- brass scales -->
 <path d="M783 328V261M753 329H812M784 264L758 278L811 278Z" fill="none" stroke="url(#caBrass)" stroke-width="7" stroke-linecap="round"/>
 <path d="M735 279L758 309L780 279M789 279L813 309L837 279" fill="none" stroke="#dbb779" stroke-width="2"/>
 <path d="M739 310Q758 333 778 310ZM793 310Q813 333 833 310Z" fill="#d3ab72"/>
 <!-- gavel -->
 <path d="M642 325l-43-30" stroke="#986b46" stroke-width="10" stroke-linecap="round"/>
 <rect x="567" y="277" width="60" height="22" rx="5" fill="#6c452e" stroke="#ba8e5e" stroke-width="4" transform="rotate(36 597 288)"/>
 <ellipse cx="658" cy="347" rx="38" ry="10" fill="#a27a4e"/>
 </svg></div>`;
}
window.VerdictChambersArt=Object.freeze({scene});
})();