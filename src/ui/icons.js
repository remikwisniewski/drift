// Small line icons for each sound, drawn on a 24×24 grid.

const paths = {
  rain: '<path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.4A3.3 3.3 0 0 1 17 15Z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>',
  thunder:
    '<path d="M7 13a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.4A3.3 3.3 0 0 1 17 13"/><path d="M12.5 11 10 16h3l-1.5 4"/>',
  wind: '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/>',
  waves:
    '<path d="M2 10c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  fire: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3 2.2-4.6 3.4-7.4.6 1.4 1.2 2.1 2.2 2.6C12 7.4 13 5 15 3c.2 3 3 5.3 3 9.4 0 4.6-2.4 8.6-6 8.6Z"/><path d="M12 21c-1.4 0-2.4-1-2.4-2.4 0-1.6 1.4-2.3 2.4-3.6 1 1.3 2.4 2 2.4 3.6 0 1.4-1 2.4-2.4 2.4Z"/>',
  crickets: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/><path d="M17 4v3M15.5 5.5h3"/>',
  birds:
    '<path d="M3 11c2-2 4.5-2 6 0 1.5-2 4-2 6 0"/><path d="M12 16c1.4-1.4 3.2-1.4 4.2 0 1-1.4 2.8-1.4 4.2 0"/>',
  keys: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  play: '<path d="M8 5.5v13l11-6.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  shuffle:
    '<path d="M3 7h3.5c4 0 6 10 10 10H21"/><path d="M3 17h3.5c1.4 0 2.6-1.2 3.6-2.8M13.9 9.8C14.9 8.2 16.1 7 17.5 7H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  volume:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
};

/** @param {keyof typeof paths} name */
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
