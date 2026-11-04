// 05-launch — the live "Program Launching Soon" panel with Visit Us + Shop Now (F2: kept as live).
import { launchPanel } from '../common.mjs';
export const meta = { order: 5, id: 'launch' };

export function render({ content: C, link }) {
  return launchPanel(C.launch, { link, id: 'ly-launch-title' });
}
