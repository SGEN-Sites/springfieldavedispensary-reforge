// 08-brands — "Brands We Carry": a compact band with one outlined marquee of the twelve live brand names.
// Paused / reduced motion: atmosphere.css turns the marquee into a wrapped list (duplicate half dropped); 08-brands.css sizes it.
import { marquee, withAccent } from '../../lib/parts.mjs';
export const meta = { order: 8, id: 'brands' };

export function render({ content: C }) {
  const B = C.brands;
  return `<section class="brands sec--tight" id="brands" aria-labelledby="brands-title">
 <div class="container">
  <h2 id="brands-title" class="brands__title" data-reveal>${withAccent(B.title, B.titleAccent)}</h2>
 </div>
 <div class="brands__band" data-reveal style="--i:1">
  <div class="light-rule" aria-hidden="true"></div>
  ${marquee(B.names, { variant: 'outline', speed: 64 })}
  <div class="light-rule" aria-hidden="true"></div>
 </div>
</section>`;
}
