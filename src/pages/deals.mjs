// deals.mjs — the deals page (visit lane): sections from src/sections/visit/deals/NN-<id>.mjs in order.
import { renderSections } from '../sections/visit/common.mjs';

export async function render(ctx) {
  return { main: await renderSections(ctx, 'deals') };
}
