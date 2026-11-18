import * as THREE from 'three';
import type { AvailabilityStatus } from '../types/realestate';

export function createTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#E8ECEF';
    ctx.fillRect(0, 0, size, size);

    // Subtle organic grain
    for (let i = 0; i < 4000; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = 222 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Crisp architectural survey grid
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.16)';
    ctx.lineWidth = 1;
    const step = 64;
    for (let p = 0; p <= size; p += step) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    // Major cross lines
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createParcelRoughnessTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 3200; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 150 + Math.floor(Math.random() * 65);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.fillRect(x, y, 3, 3);
    }

    ctx.strokeStyle = 'rgba(220, 220, 220, 0.25)';
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.1,
      size / 2,
      size / 2,
      size * 0.5
    );
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.16)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createSignPlateTexture(
  plotId: string,
  status: AvailabilityStatus,
  priceText: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const badgeColor =
      status === 'For Sale'
        ? '#DC2626'
        : status === 'Reserved'
          ? '#D97706'
          : status === 'Sold'
            ? '#475569'
            : '#78716C';

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = badgeColor;
    ctx.fillRect(0, 0, 256, 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(status.toUpperCase(), 14, 19);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(plotId, 14, 66);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 20px sans-serif';
    ctx.fillText(priceText, 14, 102);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}
