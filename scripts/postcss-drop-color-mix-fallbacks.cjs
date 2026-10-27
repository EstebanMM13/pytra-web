// PostCSS plugin: drop the pre-color-mix() fallbacks Tailwind emits.
//
// For every color with an opacity modifier (bg-bg/50, ring-gold/40...) and every color-mix() in our
// own CSS, Tailwind writes an opaque fallback and repeats the declaration inside
// `@supports (color: color-mix(in lab, red, red))`. Every browser in Angular's support policy
// ("baseline widely available") has color-mix(), and our own tokens (--pt-card, the aura, the focus
// halo) already use it unguarded, so the fallbacks never apply. This keeps the color-mix()
// declaration, unwraps the @supports block and removes the fallback, in both shapes Tailwind can
// produce: nested (unoptimized) and flattened (optimized). Anything that does not match the exact
// shape is left untouched.

const COLOR_MIX_SUPPORTS = /^\(\s*color\s*:\s*color-mix\(\s*in lab\s*,\s*red\s*,\s*red\s*\)\s*\)$/;

/** Nested: `.x { color: A; @supports (...) { color: B } }` -> `.x { color: B }`. */
function unwrapNested(atRule) {
  const props = new Set(atRule.nodes.map((decl) => decl.prop));
  let node = atRule.prev();
  while (node && node.type === 'decl' && props.size > 0) {
    const previous = node.prev();
    if (props.has(node.prop)) {
      props.delete(node.prop);
      node.remove();
    }
    node = previous;
  }
  atRule.replaceWith(atRule.nodes);
}

/** Flattened: `.x { color: A } @supports (...) { .x { color: B } }` -> `.x { color: B }`. */
function unwrapFlattened(atRule) {
  const [rule] = atRule.nodes;
  const previous = atRule.prev();
  // Only the fallback rule right before the block, with the same selector, is Tailwind's.
  if (previous?.type !== 'rule' || previous.selector !== rule.selector) return;
  const props = new Set(rule.nodes.filter((n) => n.type === 'decl').map((decl) => decl.prop));
  previous.each((n) => {
    if (n.type === 'decl' && props.has(n.prop)) n.remove();
  });
  if (previous.nodes.length === 0) previous.remove();
  atRule.replaceWith(rule);
}

module.exports = () => ({
  postcssPlugin: 'drop-color-mix-fallbacks',
  // OnceExit: runs after @tailwindcss/postcss (a Once plugin) has generated the utilities.
  OnceExit(root) {
    root.walkAtRules('supports', (atRule) => {
      if (!COLOR_MIX_SUPPORTS.test(atRule.params) || !atRule.nodes?.length) return;
      if (atRule.nodes.every((n) => n.type === 'decl')) {
        unwrapNested(atRule);
      } else if (atRule.nodes.length === 1 && atRule.nodes[0].type === 'rule') {
        unwrapFlattened(atRule);
      }
    });
  },
});
module.exports.postcss = true;
