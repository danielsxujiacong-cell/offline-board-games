export const names=['樱','梅','菊','藤','莲','枫','月'];
export const gifts=['香囊','花簪','折扇','茶盏','和伞','三味线','诗笺'];
// Original vector artwork: layered woodblock shapes and seven distinct gift motifs.
const motifs=[
 '<path d="M19 20h26l5 30Q32 65 14 50Z"/><path d="m23 14 9 8 9-8M24 23l-4 25m20-25 4 25"/><circle cx="32" cy="40" r="6"/>',
 '<path d="m22 55 16-37m-9 39 15-35"/><path d="M35 17c-12-9 6-20 8-6 12-9 18 10 4 11 4 14-14 15-12 2-12 2-15-13 0-7Z"/>',
 '<path d="M10 32Q32 0 54 32L32 56Z"/><path d="m32 56-14-28m14 28V18m0 38 14-28M11 32q21-12 42 0"/>',
 '<path d="M12 24h36v16Q30 60 12 40Zm36 4h7q9 15-10 15M15 52h36M23 17q-8-6 0-12m12 12q-8-6 0-12"/>',
 '<path d="M7 30Q32-6 57 30Q43 24 32 30Q20 24 7 30Zm25-20v43q0 12-9 6"/><path d="M32 12Q19 16 18 28m14-16q13 4 14 16"/>',
 '<path d="m33 8 9 3-7 27-9-3ZM18 34l23 7-6 20-23-7Z"/><path d="m36 10-14 44m17-43L25 55m9-39 12 3m-13 5 11 3"/>',
 '<path d="M14 13h32v41H14ZM14 13q-8-9-8 0t8 0m32 41q8-9 8 0t-8 0M22 24h16M22 32h16M22 40h10"/>'
];
export const giftArt=i=>`<svg class="gift-art" viewBox="0 0 64 68" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${motifs[i]}</svg>`;
export const portraitArt=i=>`<svg class="geisha-art" viewBox="0 0 120 196" aria-hidden="true"><defs><pattern id="weave${i}" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 9 0 18 9 9 18Z" fill="none" stroke="#f6dfb2" stroke-opacity=".25"/></pattern></defs><circle cx="72" cy="51" r="37" fill="#f5d9ab" opacity=".45"/><path d="M0 154Q35 133 44 103h30q15 30 46 51v42H0Z" fill="var(--tone)"/><path d="M0 154Q35 133 44 103h30q15 30 46 51v42H0Z" fill="url(#weave${i})"/><path d="m43 103 17 37 16-37-8-10H51Z" fill="#f0d9b3"/><path d="m41 108 20 32-16 36-17-55Zm36 0-16 32 16 36 18-55Z" fill="#252733"/><path d="M44 57q-4 26 8 36l-2 14 15 5 4-19q17-14 13-35Z" fill="#efd2ac"/><path d="M39 68Q20 31 49 26q1-17 20-13 23-2 22 20 15 16-8 43l-5-21q-22 5-28-12Z" fill="#202330"/><ellipse cx="${48+i*3}" cy="25" rx="22" ry="${13+i%3*2}" fill="#202330"/><path d="m31 ${33+i*2} 60-7" stroke="#c4a266" stroke-width="3"/><circle cx="${35+i%3*5}" cy="${30+i*2}" r="7" fill="var(--tone)"/><circle cx="${35+i%3*5}" cy="${30+i*2}" r="2" fill="#f4d49b"/><path d="m72 69 5 1m-9 13 6 1" stroke="#9b4843" stroke-width="2"/><path d="M21 155h77v25H21Z" fill="#d1ac68"/><path d="m40 155 18 13-18 12m38-25-18 13 18 12" fill="#9a493f"/><path d="M91 110q-6 27-28 36l9 12q36-10 39-31" fill="var(--tone)"/><path d="m67 145-12-4-13 7 23 8" fill="#efd2ac"/><path d="m43 146-25-23q27-18 40 1Z" fill="#e5c78c"/><path d="m43 146-13-23m13 23 1-29" stroke="#9e6b51" fill="none"/></svg>`;
export const labels={secret:'密约',discard:'取舍',gift:'赠予',compete:'竞争'};
