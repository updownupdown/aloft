// The menu's frame: a sheet of frosted glass over the paused world (the look is the .glass3 rules
// in 3d.css). It used to paint a paper letter behind the card, so the menu still calls the
// function this returns whenever its layout changes; glass needs no painting.
export function letter(card) {
  card.classList.add('glass3');
  return () => {};
}
