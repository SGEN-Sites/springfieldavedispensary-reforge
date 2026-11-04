// loyalty.mjs — the loyalty page (visit lane): sections from src/sections/visit/loyalty/NN-<id>.mjs in order.
import { renderSections } from '../sections/visit/common.mjs';

export async function render(ctx) {
  return { main: await renderSections(ctx, 'loyalty') };
}
