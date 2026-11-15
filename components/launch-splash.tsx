/**
 * Animated Fico logo shown while the app opens.
 *
 * It is plain HTML + CSS inside the static page, so it paints on the very first frame, before any
 * JavaScript has loaded, and React never touches it (it lives inside dangerouslySetInnerHTML).
 * The small inline script dismisses it once the app says it is ready (`fico:ready`, sent from
 * AppShell), but never before the intro has played and never later than MAX_MS.
 *
 * Storyboard (ms from first paint; CSS in globals.css under "Launch splash"):
 *    0  tile scales in (0.82 -> 1) and fades in            380 ms, appear curve
 *  140  tail feathers fan open from the centre outwards    420 ms each, 30 ms apart
 *  220  head rises into place                              380 ms
 *  420  crest pops up                                      260 ms
 *  520  "Fico" wordmark fades up 8 px                       300 ms
 *  560  coin drops in with a small settle                  460 ms
 *  980  eyes blink once                                    200 ms
 * 1100  intro done: leaves as soon as the app is ready     220 ms fade, leave curve
 * Reduced motion: the finished logo shows with no movement and leaves the moment the app is ready.
 */

const TIMING = { minMs: 1100, maxMs: 4000, exitMs: 220 }

// The tail feathers, centre pair first so the fan opens outwards. [angle, scale]
const PLUMES: Array<[number, number]> = [
  [-12, 1.22], [12, 1.22],
  [-30, 1.18], [30, 1.18],
  [-48, 1.1], [48, 1.1],
  [-66, 0.98], [66, 0.98],
  [-84, 0.8], [84, 0.8],
]

const plumes = PLUMES.map(
  ([angle, scale], i) =>
    `<g class="fs-plume" style="--a:${angle}deg;--s:${scale};--i:${Math.floor(i / 2)}"><use href="#fs-plume"/></g>`
).join('')

const LOGO_SVG = `<svg class="fs-logo" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
<defs>
<clipPath id="fs-clip"><rect width="512" height="512" rx="116"/></clipPath>
<linearGradient id="fs-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DF8EC"/><stop offset=".5" stop-color="#1FD2D8"/><stop offset="1" stop-color="#16A5E6"/></linearGradient>
<radialGradient id="fs-glow" cx=".3" cy=".08" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="fs-feather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E8F98"/><stop offset="1" stop-color="#075E86"/></linearGradient>
<linearGradient id="fs-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FE8C9"/><stop offset="1" stop-color="#1AA3A8"/></linearGradient>
<radialGradient id="fs-spot" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#3DE0FF"/><stop offset=".6" stop-color="#0A86E0"/><stop offset="1" stop-color="#064FB0"/></radialGradient>
<radialGradient id="fs-head" cx=".32" cy=".18" r=".95"><stop offset="0" stop-color="#58B0FF"/><stop offset=".45" stop-color="#1676E6"/><stop offset="1" stop-color="#0A47B0"/></radialGradient>
<linearGradient id="fs-beak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD66B"/><stop offset="1" stop-color="#F28A18"/></linearGradient>
<linearGradient id="fs-coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE98A"/><stop offset=".5" stop-color="#FFC531"/><stop offset="1" stop-color="#E08A00"/></linearGradient>
<linearGradient id="fs-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></linearGradient>
<filter id="fs-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
<g id="fs-plume">
<path d="M0 0C-46 -70 -62 -200 0 -310C62 -200 46 -70 0 0Z" fill="url(#fs-feather)"/>
<path d="M0 -20C-30 -90 -40 -200 0 -296C40 -200 30 -90 0 -20Z" fill="none" stroke="url(#fs-edge)" stroke-width="3" opacity=".6"/>
<path d="M0 0V-250" stroke="#7FF2D6" stroke-width="2" opacity=".5"/>
<ellipse cx="0" cy="-236" rx="34" ry="43" fill="#0A5E96"/><ellipse cx="0" cy="-236" rx="27" ry="35" fill="url(#fs-spot)"/>
<ellipse cx="0" cy="-232" rx="14" ry="18" fill="#22D3A0"/><ellipse cx="-4" cy="-240" rx="5" ry="7" fill="#fff" opacity=".8"/>
</g>
</defs>
<g clip-path="url(#fs-clip)">
<rect width="512" height="512" fill="url(#fs-bg)"/><rect width="512" height="512" fill="url(#fs-glow)"/>
<g transform="translate(256 452)">${plumes}</g>
<g class="fs-head">
<ellipse cx="256" cy="440" rx="200" ry="170" fill="#042B5E" opacity=".45" filter="url(#fs-soft)"/>
<circle cx="256" cy="476" r="192" fill="url(#fs-head)"/>
<path d="M92 400C120 330 190 290 256 290" fill="none" stroke="#9AD3FF" stroke-width="7" stroke-linecap="round" opacity=".45"/>
<g class="fs-crest">
<g stroke="#0E5ACB" stroke-width="13" stroke-linecap="round" fill="none"><path d="M256 296V238"/><path d="M226 300C214 276 206 258 198 242"/><path d="M286 300C298 276 306 258 314 242"/></g>
<ellipse cx="256" cy="222" rx="19" ry="24" fill="#0A5E96"/><ellipse cx="256" cy="222" rx="14" ry="18" fill="url(#fs-spot)"/><ellipse cx="256" cy="224" rx="6" ry="8" fill="#22D3A0"/>
<ellipse cx="193" cy="230" rx="16" ry="20" transform="rotate(-18 193 230)" fill="#0A5E96"/><ellipse cx="193" cy="230" rx="11" ry="15" transform="rotate(-18 193 230)" fill="url(#fs-spot)"/><ellipse cx="193" cy="232" rx="5" ry="6" fill="#22D3A0"/>
<ellipse cx="319" cy="230" rx="16" ry="20" transform="rotate(18 319 230)" fill="#0A5E96"/><ellipse cx="319" cy="230" rx="11" ry="15" transform="rotate(18 319 230)" fill="url(#fs-spot)"/><ellipse cx="319" cy="232" rx="5" ry="6" fill="#22D3A0"/>
</g>
<g class="fs-eyes">
<ellipse cx="190" cy="380" rx="54" ry="66" fill="#fff"/><ellipse cx="322" cy="380" rx="54" ry="66" fill="#fff"/>
<ellipse cx="200" cy="382" rx="31" ry="43" fill="#3B3F4A"/><ellipse cx="332" cy="382" rx="31" ry="43" fill="#3B3F4A"/>
<circle cx="214" cy="358" r="15" fill="#fff"/><circle cx="346" cy="358" r="15" fill="#fff"/>
</g>
<g fill="#fff" fill-opacity=".14" stroke="#E8A33D" stroke-width="9"><circle cx="190" cy="380" r="64"/><circle cx="322" cy="380" r="64"/></g>
<g stroke="#E8A33D" stroke-width="9" stroke-linecap="round" fill="none"><path d="M254 372Q256 364 258 372"/><path d="M127 366L104 356"/><path d="M385 366L408 356"/></g>
<g stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"><path d="M148 340L168 322"/><path d="M280 340L300 322"/></g>
<path d="M228 446C236 440 276 440 284 446C288 458 270 484 256 488C242 484 224 458 228 446Z" fill="url(#fs-beak)"/>
<path d="M238 449C246 446 266 446 274 449" stroke="#FFF3BF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85"/>
</g>
<g transform="translate(404 458) rotate(14)"><g class="fs-coin">
<circle r="46" fill="#7A3E00" opacity=".3" transform="translate(4 8)"/>
<circle r="46" fill="url(#fs-coin)"/><circle r="35" fill="none" stroke="#C97A00" stroke-width="4" opacity=".7"/>
<path d="M8 -20C-14 -26 -20 -4 -2 0C16 4 12 26 -10 20" fill="none" stroke="#B86A00" stroke-width="7" stroke-linecap="round"/>
<path d="M-1 -26V-20M-1 20V27" stroke="#B86A00" stroke-width="7" stroke-linecap="round"/>
<path d="M-28 -22C-18 -36 -2 -42 14 -40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
</g></g>
<path d="M0 0H512V150C380 200 130 200 0 150Z" fill="#fff" opacity=".08"/>
<rect x="3" y="3" width="506" height="506" rx="113" fill="none" stroke="url(#fs-rim)" stroke-width="6"/>
</g>
</svg>`

// Runs before the splash paints: use the saved theme so a dark-mode user never sees a white flash.
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('theme-storage')||'{}');if(s&&s.state&&s.state.isDarkMode){document.documentElement.classList.add('dark')}}catch(e){}`

const DISMISS_SCRIPT = `(function(){
var el=document.getElementById('fico-splash');if(!el)return;
var start=performance.now(),done=false;
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var MIN=reduce?0:${TIMING.minMs},MAX=${TIMING.maxMs},EXIT=reduce?0:${TIMING.exitMs};
function hide(){if(done)return;done=true;el.classList.add('fs-leaving');el.setAttribute('inert','');setTimeout(function(){el.remove()},EXIT)}
function ready(){setTimeout(hide,Math.max(0,MIN-(performance.now()-start)))}
if(window.__ficoReady)ready();else window.addEventListener('fico:ready',ready,{once:true});
setTimeout(hide,MAX);
el.addEventListener('click',hide);
})();`

const SPLASH_HTML = `<script>${THEME_SCRIPT}</script>
<div id="fico-splash" class="fico-splash" role="status" aria-label="Opening Fico">
<div class="fs-stage">${LOGO_SVG}<span class="fs-word" aria-hidden="true">Fico</span></div>
</div>
<script>${DISMISS_SCRIPT}</script>`

export default function LaunchSplash() {
  // React owns only this empty host; the markup inside is static and removes itself.
  return <div id="fico-splash-host" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SPLASH_HTML }} />
}
