// notfound.mjs — the notfound page (visit lane): sections from src/sections/visit/notfound/NN-<id>.mjs in order.
import { renderSections } from '../sections/visit/common.mjs';

export async function render(ctx) {
  return { main: await renderSections(ctx, 'notfound') };
}
