// bundles.mjs — the bundles page (visit lane): sections from src/sections/visit/bundles/NN-<id>.mjs in order.
import { renderSections } from '../sections/visit/common.mjs';

export async function render(ctx) {
  return { main: await renderSections(ctx, 'bundles') };
}
