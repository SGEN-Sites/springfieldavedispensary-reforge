// 04-launch — the live "Launching Soon" panel with Browse the Menu + Contact Us (F2: kept as live). Floats: the visit
// lane's clean edibles cut-out (src/tools/visit-images.py) and the pre-rolls.
import { launchPanel, float } from '../common.mjs';
export const meta = { order: 4, id: 'launch' };

export function render({ content: C, link }) {
  const floats = `<div class="launch__floats" aria-hidden="true">${float('visit-cut-edibles-280', { link, cls: 'launch__f1', ft: 9, r0: -4, r1: 1 })}${float('cut-prerolls-280', { link, cls: 'launch__f2', ft: 11, fd: -3, r0: 8, r1: 3 })}</div>`;
  return launchPanel(C.launch, { link, id: 'bd-launch-title', floats });
}
