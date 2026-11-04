// contact.mjs — the contact page (visit lane): sections from src/sections/visit/contact/NN-<id>.mjs in order.
import { renderSections } from '../sections/visit/common.mjs';

export async function render(ctx) {
  return { main: await renderSections(ctx, 'contact'), scripts: ['assets/js/contact.js'] };
}
