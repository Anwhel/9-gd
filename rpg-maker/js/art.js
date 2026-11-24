/* Turns pixel arrays into cached canvases for fast drawing. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';
  const cache = new WeakMap(); // frame pixel array -> canvas
  // Call after changing a frame's pixels in place.
  function invalidate(pixels) { cache.delete(pixels); }

  function frameCanvas(pixels) {
    const N = RPG.TILE;
    const hit = cache.get(pixels);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    pixels.forEach((col, i) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(i % N, Math.floor(i / N), 1, 1);
    });
    cache.set(pixels, c);
    return c;
  }

  // Which frame of an asset to show at time t (ms).
  function assetCanvas(asset, t) {
    if (!asset) return null;
    const n = asset.frames.length;
    const f = n > 1 ? Math.floor(Math.max(0, t || 0) / (1000 / (asset.fps || 3))) % n : 0;
    return frameCanvas(asset.frames[f]);
  }

  function thumbURL(asset) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameCanvas(asset.frames[0]), 0, 0, 32, 32);
    return c.toDataURL();
  }

  RPG.art = { invalidate, frameCanvas, assetCanvas, thumbURL };
})(window.RPG);
