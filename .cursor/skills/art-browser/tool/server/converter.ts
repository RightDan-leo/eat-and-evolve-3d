import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import type { ExportConfig, ExportResultItem, ExportStatus } from '../src/types';

let sharpModule: typeof import('sharp') | null = null;
let pLimitFn: ((concurrency: number) => <T>(fn: () => Promise<T>) => Promise<T>) | null = null;

async function ensureDeps() {
  if (!sharpModule) {
    sharpModule = (await import('sharp')).default as any;
  }
  if (!pLimitFn) {
    pLimitFn = (await import('p-limit')).default as any;
  }
}

// ─── TGA Decoder ──────────────────────────────────────

function decodeTGA(buf: Buffer): { width: number; height: number; data: Buffer } {
  const idLen = buf[0];
  const hasColorMap = buf[1] !== 0;
  const imgType = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const descriptor = buf[17];
  const topToBottom = (descriptor & 0x20) !== 0;
  const channels = bpp / 8;

  let offset = 18 + idLen;
  if (hasColorMap) {
    const cmLen = buf.readUInt16LE(5);
    const cmBits = buf[7];
    offset += cmLen * Math.ceil(cmBits / 8);
  }

  const out = Buffer.alloc(width * height * 4);

  function writePixel(idx: number, srcOff: number) {
    const row = topToBottom ? Math.floor(idx / width) : height - 1 - Math.floor(idx / width);
    const col = idx % width;
    const dst = (row * width + col) * 4;
    out[dst] = buf[srcOff + 2];
    out[dst + 1] = buf[srcOff + 1];
    out[dst + 2] = buf[srcOff];
    out[dst + 3] = channels >= 4 ? buf[srcOff + 3] : 255;
  }

  if (imgType === 2) {
    for (let i = 0; i < width * height; i++) {
      writePixel(i, offset + i * channels);
    }
  } else if (imgType === 10) {
    let pi = 0, di = offset;
    while (pi < width * height && di < buf.length) {
      const packet = buf[di++];
      const count = (packet & 0x7f) + 1;
      if (packet & 0x80) {
        for (let j = 0; j < count && pi < width * height; j++) writePixel(pi++, di);
        di += channels;
      } else {
        for (let j = 0; j < count && pi < width * height; j++) {
          writePixel(pi++, di);
          di += channels;
        }
      }
    }
  }

  return { width, height, data: out };
}

// ─── Unity .meta Clip Parsing ─────────────────────────

interface UnityClipDef {
  name: string;
  firstFrame: number;
  lastFrame: number;
}

function parseUnityMetaClips(content: string): UnityClipDef[] {
  const clips: UnityClipDef[] = [];
  const startIdx = content.indexOf('clipAnimations:');
  if (startIdx === -1) return clips;

  const section = content.slice(startIdx);
  const marker = /\n\s+- serializedVersion:/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(section)) !== null) starts.push(m.index);

  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : section.length;
    const block = section.slice(starts[i], end);
    const nameMatch = block.match(/\bname:\s*(.+)/);
    const firstMatch = block.match(/\bfirstFrame:\s*([\d.]+)/);
    const lastMatch = block.match(/\blastFrame:\s*([\d.]+)/);
    if (nameMatch && firstMatch && lastMatch) {
      clips.push({
        name: nameMatch[1].trim(),
        firstFrame: parseFloat(firstMatch[1]),
        lastFrame: parseFloat(lastMatch[1]),
      });
    }
  }
  return clips;
}

// ─── GLB Animation Splitting ─────────────────────────

function gltfElemCount(type: string): number {
  const m: Record<string, number> = {
    SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4,
    MAT2: 4, MAT3: 9, MAT4: 16,
  };
  return m[type] ?? 1;
}

async function splitGlbAnimations(glbPath: string, clips: UnityClipDef[]): Promise<void> {
  const buf = await fs.promises.readFile(glbPath);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546C67) return;

  const jsonLen = buf.readUInt32LE(12);
  const jsonRaw = buf.slice(20, 20 + jsonLen).toString('utf8').replace(/[\0\s]+$/, '');
  const gltf = JSON.parse(jsonRaw);

  const binStart = 20 + jsonLen;
  if (binStart + 8 > buf.length) { console.log('[UAB-split] No BIN chunk found'); return; }
  const binLen = buf.readUInt32LE(binStart);
  const binData = buf.slice(binStart + 8, binStart + 8 + binLen);

  if (!gltf.animations?.length || !gltf.buffers?.length) {
    console.log('[UAB-split] GLB has no animations or buffers, skipping');
    return;
  }
  const srcAnim = gltf.animations[0];
  if (!srcAnim.channels?.length || !srcAnim.samplers?.length) {
    console.log('[UAB-split] Source animation has no channels/samplers');
    return;
  }
  console.log(`[UAB-split] Source animation: ${srcAnim.channels.length} channels, ${srcAnim.samplers.length} samplers`);

  function readFloats(accIdx: number): Float32Array {
    const acc = gltf.accessors[accIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const ec = gltfElemCount(acc.type);
    const stride = bv.byteStride || ec * 4;
    const arr = new Float32Array(acc.count * ec);
    for (let i = 0; i < acc.count; i++) {
      const rowOff = off + i * stride;
      for (let j = 0; j < ec; j++) arr[i * ec + j] = binData.readFloatLE(rowOff + j * 4);
    }
    return arr;
  }

  const refTimes = readFloats(srcAnim.samplers[srcAnim.channels[0].sampler].input);
  const totalDur = refTimes[refTimes.length - 1];
  const maxFrame = Math.max(...clips.map((c) => c.lastFrame));
  const fps = maxFrame > 0 && totalDur > 0 ? maxFrame / totalDur : 30;
  console.log(`[UAB-split] Animation duration: ${totalDur.toFixed(3)}s, maxFrame: ${maxFrame}, detected FPS: ${fps.toFixed(2)}`);

  const actualBinLen: number = gltf.buffers[0].byteLength;
  let extraOffset = actualBinLen;
  const extraChunks: Buffer[] = [];

  function appendFloat32(data: Float32Array): number {
    const pad = (4 - (extraOffset % 4)) % 4;
    if (pad) { extraChunks.push(Buffer.alloc(pad)); extraOffset += pad; }
    const byteOff = extraOffset;
    const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    extraChunks.push(b);
    extraOffset += b.length;
    return byteOff;
  }

  const newAnimations: any[] = [];

  for (const clip of clips) {
    const tStart = clip.firstFrame / fps;
    const tEnd = clip.lastFrame / fps;
    const anim: any = { name: clip.name, samplers: [], channels: [] };

    for (const ch of srcAnim.channels) {
      const smp = srcAnim.samplers[ch.sampler];
      const times = readFloats(smp.input);
      const outAcc = gltf.accessors[smp.output];
      const ec = gltfElemCount(outAcc.type);
      const vals = readFloats(smp.output);

      const idx: number[] = [];
      for (let i = 0; i < times.length; i++) {
        if (times[i] >= tStart - 0.0005 && times[i] <= tEnd + 0.0005) idx.push(i);
      }
      if (idx.length === 0) continue;

      const newT = new Float32Array(idx.length);
      const newV = new Float32Array(idx.length * ec);
      for (let j = 0; j < idx.length; j++) {
        newT[j] = times[idx[j]] - tStart;
        for (let k = 0; k < ec; k++) newV[j * ec + k] = vals[idx[j] * ec + k];
      }

      const tOff = appendFloat32(newT);
      const tBvIdx = gltf.bufferViews.length;
      gltf.bufferViews.push({ buffer: 0, byteOffset: tOff, byteLength: newT.byteLength });
      const tAccIdx = gltf.accessors.length;
      gltf.accessors.push({
        bufferView: tBvIdx, componentType: 5126, count: idx.length,
        type: 'SCALAR', min: [newT[0]], max: [newT[newT.length - 1]],
      });

      const vOff = appendFloat32(newV);
      const vBvIdx = gltf.bufferViews.length;
      gltf.bufferViews.push({ buffer: 0, byteOffset: vOff, byteLength: newV.byteLength });
      const vAccIdx = gltf.accessors.length;
      gltf.accessors.push({
        bufferView: vBvIdx, componentType: outAcc.componentType,
        count: idx.length, type: outAcc.type,
      });

      const sIdx = anim.samplers.length;
      anim.samplers.push({ input: tAccIdx, output: vAccIdx, interpolation: smp.interpolation || 'LINEAR' });
      anim.channels.push({ sampler: sIdx, target: { node: ch.target.node, path: ch.target.path } });
    }

    if (anim.channels.length > 0) {
      console.log(`[UAB-split] Clip "${clip.name}": frames ${clip.firstFrame}-${clip.lastFrame} => ${anim.channels.length} channels`);
      newAnimations.push(anim);
    }
  }

  if (newAnimations.length === 0) { console.log('[UAB-split] No clips produced, skipping'); return; }
  console.log(`[UAB-split] Writing ${newAnimations.length} split animations to GLB`);

  gltf.animations = newAnimations;
  gltf.buffers[0].byteLength = extraOffset;

  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const pJsonLen = jsonBuf.length + jsonPad;

  const newBin = Buffer.concat([binData.slice(0, actualBinLen), ...extraChunks]);
  const binPad = (4 - (newBin.length % 4)) % 4;
  const pBinLen = newBin.length + binPad;

  const total = 12 + 8 + pJsonLen + 8 + pBinLen;
  const out = Buffer.alloc(total);

  out.writeUInt32LE(0x46546C67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(pJsonLen, 12);
  out.writeUInt32LE(0x4E4F534A, 16);
  jsonBuf.copy(out, 20);
  if (jsonPad) out.fill(0x20, 20 + jsonBuf.length, 20 + pJsonLen);

  const bH = 20 + pJsonLen;
  out.writeUInt32LE(pBinLen, bH);
  out.writeUInt32LE(0x004E4942, bH + 4);
  newBin.copy(out, bH + 8);

  await fs.promises.writeFile(glbPath, out);
}

// ─── GLB Embedded Texture Conversion ─────────────────

async function convertGlbTextures(glbPath: string): Promise<void> {
  await ensureDeps();
  if (!sharpModule) return;

  const buf = await fs.promises.readFile(glbPath);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546C67) return;

  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8').replace(/[\0\s]+$/, ''));

  const binStart = 20 + jsonLen;
  if (binStart + 8 > buf.length) return;
  const binLen = buf.readUInt32LE(binStart);
  const binData = buf.slice(binStart + 8, binStart + 8 + binLen);

  if (!gltf.images?.length || !gltf.bufferViews?.length || !gltf.buffers?.length) return;

  let anyConverted = false;

  const bvBlobs: Buffer[] = [];
  for (let i = 0; i < gltf.bufferViews.length; i++) {
    const bv = gltf.bufferViews[i];
    const off = bv.byteOffset || 0;
    bvBlobs.push(Buffer.from(binData.slice(off, off + bv.byteLength)));
  }

  for (const img of gltf.images) {
    if (img.bufferView === undefined) continue;
    const data = bvBlobs[img.bufferView];
    const isPng = data[0] === 0x89 && data[1] === 0x50;
    const isJpeg = data[0] === 0xFF && data[1] === 0xD8;
    if (isPng || isJpeg) continue;

    try {
      let pngBuf: Buffer;
      try {
        pngBuf = await (sharpModule as any)(data).png().toBuffer();
      } catch {
        const { width, height, data: pixels } = decodeTGA(data);
        pngBuf = await (sharpModule as any)(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
      }
      console.log(`[UAB-tex] Converted "${img.name || img.bufferView}" to PNG (${data.length} => ${pngBuf.length})`);
      bvBlobs[img.bufferView] = pngBuf;
      img.mimeType = 'image/png';
      anyConverted = true;
    } catch (e) {
      console.warn(`[UAB-tex] Failed to convert texture ${img.bufferView}:`, e instanceof Error ? e.message : String(e));
    }
  }

  if (!anyConverted) return;

  let newOffset = 0;
  const chunks: Buffer[] = [];
  for (let i = 0; i < gltf.bufferViews.length; i++) {
    const bv = gltf.bufferViews[i];
    const data = bvBlobs[i];
    const pad = (4 - (newOffset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); newOffset += pad; }
    bv.byteOffset = newOffset;
    bv.byteLength = data.length;
    chunks.push(data);
    newOffset += data.length;
  }

  gltf.buffers[0].byteLength = newOffset;

  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const pJsonLen = jsonBuf.length + jsonPad;

  const newBin = Buffer.concat(chunks);
  const binPad2 = (4 - (newBin.length % 4)) % 4;
  const pBinLen = newBin.length + binPad2;

  const total = 12 + 8 + pJsonLen + 8 + pBinLen;
  const out = Buffer.alloc(total);

  out.writeUInt32LE(0x46546C67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(pJsonLen, 12);
  out.writeUInt32LE(0x4E4F534A, 16);
  jsonBuf.copy(out, 20);
  if (jsonPad) out.fill(0x20, 20 + jsonBuf.length, 20 + pJsonLen);

  const bH = 20 + pJsonLen;
  out.writeUInt32LE(pBinLen, bH);
  out.writeUInt32LE(0x004E4942, bH + 4);
  newBin.copy(out, bH + 8);

  await fs.promises.writeFile(glbPath, out);
  console.log('[UAB-tex] GLB texture conversion complete');
}

// ─── Embed External Textures into GLB ────────────────

type TexRole = 'baseColor' | 'normal' | 'metallicRoughness' | 'occlusion' | 'emissive';

const TEX_ROLE_PATTERNS: [RegExp, TexRole][] = [
  [/(_d|_diffuse|_albedo|_basecolor|_color)$/i, 'baseColor'],
  [/(_n|_normal|_nrm|_bump)$/i, 'normal'],
  [/(_mask|_metallic|_roughness|_mr|_metalrough|_metallicroughness)$/i, 'metallicRoughness'],
  [/(_ao|_occlusion|_ambient|_ambientocclusion)$/i, 'occlusion'],
  [/(_e|_emissive|_emission|_glow)$/i, 'emissive'],
];

const EMBEDDABLE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
  '.tga', '.psd', '.tif', '.tiff',
]);

function classifySiblingTexture(baseName: string): TexRole | null {
  for (const [pattern, role] of TEX_ROLE_PATTERNS) {
    if (pattern.test(baseName)) return role;
  }
  return null;
}

function isPlaceholderImage(gltf: any, imgIdx: number, binData: Buffer): boolean {
  const img = gltf.images?.[imgIdx];
  if (!img) return false;
  if (img.uri && img.uri.startsWith('data:')) return img.uri.length < 300;
  if (img.bufferView !== undefined) {
    const bv = gltf.bufferViews?.[img.bufferView];
    return bv ? bv.byteLength < 1000 : false;
  }
  return false;
}

async function loadImageAsPng(imgPath: string, maxSize: number): Promise<Buffer> {
  await ensureDeps();
  const raw = await fs.promises.readFile(imgPath);
  const ext = path.extname(imgPath).toLowerCase();

  let pipeline: import('sharp').Sharp;
  if (ext === '.tga') {
    const { width, height, data } = decodeTGA(raw);
    pipeline = (sharpModule as any)(data, { raw: { width, height, channels: 4 } });
  } else if (SHARP_SUPPORTED.has(ext)) {
    pipeline = (sharpModule as any)(raw);
  } else {
    return raw;
  }

  if (maxSize > 0) {
    pipeline = pipeline.resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true });
  }
  return pipeline.png().toBuffer();
}

async function embedExternalTextures(
  glbPath: string,
  srcDir: string,
  config: ExportConfig,
): Promise<void> {
  await ensureDeps();
  if (!sharpModule) return;

  const buf = await fs.promises.readFile(glbPath);
  const parsed = parseGlb(buf);
  if (!parsed) return;
  const { gltf, binData } = parsed;

  if (!gltf.materials?.length) return;

  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(srcDir, { withFileTypes: true }); } catch { return; }

  const siblingImages = entries
    .filter(e => e.isFile() && EMBEDDABLE_EXTS.has(path.extname(e.name).toLowerCase()))
    .map(e => ({
      baseName: path.basename(e.name, path.extname(e.name)).toLowerCase(),
      fullPath: path.join(srcDir, e.name),
      ext: path.extname(e.name).toLowerCase(),
    }));

  if (siblingImages.length === 0) return;

  const texByRole = new Map<TexRole, typeof siblingImages[0]>();
  const unmatched: typeof siblingImages = [];

  for (const img of siblingImages) {
    const role = classifySiblingTexture(img.baseName);
    if (role && !texByRole.has(role)) texByRole.set(role, img);
    else if (!role) unmatched.push(img);
  }

  if (!texByRole.has('baseColor') && unmatched.length === 1) {
    texByRole.set('baseColor', unmatched[0]);
  }

  if (texByRole.size === 0) return;

  if (!gltf.images) gltf.images = [];
  if (!gltf.textures) gltf.textures = [];
  if (!gltf.samplers) gltf.samplers = [];
  if (!gltf.bufferViews) gltf.bufferViews = [];
  if (!gltf.buffers) gltf.buffers = [{ byteLength: 0 }];

  if (gltf.samplers.length === 0) {
    gltf.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
  }

  const actualBinLen: number = gltf.buffers[0].byteLength;
  let extraOffset = actualBinLen;
  const extraChunks: Buffer[] = [];
  let modified = false;

  function appendBin(data: Buffer): number {
    const pad = (4 - (extraOffset % 4)) % 4;
    if (pad) { extraChunks.push(Buffer.alloc(pad)); extraOffset += pad; }
    const off = extraOffset;
    extraChunks.push(data);
    extraOffset += data.length;
    return off;
  }

  function addEmbeddedImage(pngData: Buffer, name: string): number {
    const byteOffset = appendBin(pngData);
    const bvIdx = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: pngData.length });
    const imgIdx = gltf.images.length;
    gltf.images.push({ bufferView: bvIdx, mimeType: 'image/png', name });
    return imgIdx;
  }

  function addTexture(imageIndex: number): number {
    const texIdx = gltf.textures.length;
    gltf.textures.push({ sampler: 0, source: imageIndex });
    return texIdx;
  }

  for (const [role, imgInfo] of texByRole) {
    try {
      const pngData = await loadImageAsPng(imgInfo.fullPath, config.maxTextureSize);
      const texName = path.basename(imgInfo.fullPath, imgInfo.ext);
      console.log(`[UAB-embed] ${role}: ${path.basename(imgInfo.fullPath)} (${pngData.length} bytes)`);

      for (const mat of gltf.materials) {
        if (!mat.pbrMetallicRoughness) mat.pbrMetallicRoughness = {};
        const pbr = mat.pbrMetallicRoughness;

        if (role === 'baseColor') {
          if (pbr.baseColorTexture?.index !== undefined) {
            const tex = gltf.textures[pbr.baseColorTexture.index];
            if (tex && isPlaceholderImage(gltf, tex.source, binData)) {
              const img = gltf.images[tex.source];
              const off = appendBin(pngData);
              const bvIdx = gltf.bufferViews.length;
              gltf.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: pngData.length });
              delete img.uri;
              img.bufferView = bvIdx;
              img.mimeType = 'image/png';
              img.name = texName;
              modified = true;
              console.log(`[UAB-embed] Replaced placeholder baseColor in "${mat.name || '(unnamed)'}"`);
            }
          } else {
            const imgIdx = addEmbeddedImage(pngData, texName);
            const texIdx = addTexture(imgIdx);
            pbr.baseColorTexture = { index: texIdx };
            modified = true;
            console.log(`[UAB-embed] Added baseColor to "${mat.name || '(unnamed)'}"`);
          }
        } else if (role === 'normal') {
          if (!mat.normalTexture) {
            const imgIdx = addEmbeddedImage(pngData, texName);
            const texIdx = addTexture(imgIdx);
            mat.normalTexture = { index: texIdx };
            modified = true;
            console.log(`[UAB-embed] Added normal to "${mat.name || '(unnamed)'}"`);
          }
        } else if (role === 'metallicRoughness') {
          if (!pbr.metallicRoughnessTexture) {
            const imgIdx = addEmbeddedImage(pngData, texName);
            const texIdx = addTexture(imgIdx);
            pbr.metallicRoughnessTexture = { index: texIdx };
            modified = true;
            console.log(`[UAB-embed] Added metallicRoughness to "${mat.name || '(unnamed)'}"`);
          }
        } else if (role === 'occlusion') {
          if (!mat.occlusionTexture) {
            const imgIdx = addEmbeddedImage(pngData, texName);
            const texIdx = addTexture(imgIdx);
            mat.occlusionTexture = { index: texIdx };
            modified = true;
            console.log(`[UAB-embed] Added occlusion to "${mat.name || '(unnamed)'}"`);
          }
        } else if (role === 'emissive') {
          if (!mat.emissiveTexture) {
            const imgIdx = addEmbeddedImage(pngData, texName);
            const texIdx = addTexture(imgIdx);
            mat.emissiveTexture = { index: texIdx };
            modified = true;
            console.log(`[UAB-embed] Added emissive to "${mat.name || '(unnamed)'}"`);
          }
        }
      }
    } catch (e) {
      console.warn(`[UAB-embed] Failed to embed ${role}:`, e instanceof Error ? e.message : String(e));
    }
  }

  if (!modified) return;

  gltf.buffers[0].byteLength = extraOffset;
  await writeGlb(glbPath, gltf, [binData.slice(0, actualBinLen), ...extraChunks]);
  console.log('[UAB-embed] Texture embedding complete');
}

// ─── Sibling FBX Animation Merging ───────────────────

function parseGlb(buf: Buffer) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546C67) return null;
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8').replace(/[\0\s]+$/, ''));
  const binStart = 20 + jsonLen;
  if (binStart + 8 > buf.length) return null;
  const binLen = buf.readUInt32LE(binStart);
  const binData = buf.slice(binStart + 8, binStart + 8 + binLen);
  return { gltf, binData };
}

function writeGlb(glbPath: string, gltf: any, binParts: Buffer[]): Promise<void> {
  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const pJsonLen = jsonBuf.length + jsonPad;
  const newBin = Buffer.concat(binParts);
  const binPad = (4 - (newBin.length % 4)) % 4;
  const pBinLen = newBin.length + binPad;
  const total = 12 + 8 + pJsonLen + 8 + pBinLen;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546C67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(pJsonLen, 12);
  out.writeUInt32LE(0x4E4F534A, 16);
  jsonBuf.copy(out, 20);
  if (jsonPad) out.fill(0x20, 20 + jsonBuf.length, 20 + pJsonLen);
  const bH = 20 + pJsonLen;
  out.writeUInt32LE(pBinLen, bH);
  out.writeUInt32LE(0x004E4942, bH + 4);
  newBin.copy(out, bH + 8);
  return fs.promises.writeFile(glbPath, out);
}

function readFloatsFromBin(gltf: any, binData: Buffer, accIdx: number): Float32Array {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const ec = gltfElemCount(acc.type);
  const stride = bv.byteStride || ec * 4;
  const arr = new Float32Array(acc.count * ec);
  for (let i = 0; i < acc.count; i++) {
    const rowOff = off + i * stride;
    for (let j = 0; j < ec; j++) arr[i * ec + j] = binData.readFloatLE(rowOff + j * 4);
  }
  return arr;
}

async function mergeAnimationsIntoGlb(
  mainGlbPath: string,
  animGlbPath: string,
  fallbackName: string,
): Promise<number> {
  const mainParsed = parseGlb(await fs.promises.readFile(mainGlbPath));
  const animParsed = parseGlb(await fs.promises.readFile(animGlbPath));
  if (!mainParsed || !animParsed) return 0;

  const { gltf: mg, binData: mb } = mainParsed;
  const { gltf: ag, binData: ab } = animParsed;

  if (!mg.nodes?.length || !mg.buffers?.length) return 0;
  if (!ag.animations?.length || !ag.nodes?.length) return 0;

  const nodeMap = new Map<string, number>();
  for (let i = 0; i < mg.nodes.length; i++) {
    if (mg.nodes[i].name) nodeMap.set(mg.nodes[i].name, i);
  }

  const actualMainBinLen: number = mg.buffers[0].byteLength;
  let extraOffset = actualMainBinLen;
  const extraChunks: Buffer[] = [];

  function appendData(data: Float32Array): number {
    const pad = (4 - (extraOffset % 4)) % 4;
    if (pad) { extraChunks.push(Buffer.alloc(pad)); extraOffset += pad; }
    const off = extraOffset;
    const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    extraChunks.push(b);
    extraOffset += b.length;
    return off;
  }

  if (!mg.animations) mg.animations = [];
  let mergedCount = 0;

  for (const anim of ag.animations) {
    const newAnim: any = { name: anim.name || fallbackName, samplers: [], channels: [] };

    for (const ch of (anim.channels || [])) {
      const srcNodeIdx = ch.target?.node;
      if (srcNodeIdx === undefined || srcNodeIdx === null) continue;
      const srcNodeName = ag.nodes[srcNodeIdx]?.name;
      if (!srcNodeName) continue;
      const mainNodeIdx = nodeMap.get(srcNodeName);
      if (mainNodeIdx === undefined) continue;

      const smp = anim.samplers?.[ch.sampler];
      if (!smp) continue;

      const times = readFloatsFromBin(ag, ab, smp.input);
      const outAcc = ag.accessors[smp.output];
      const values = readFloatsFromBin(ag, ab, smp.output);

      const tOff = appendData(times);
      const tBvIdx = mg.bufferViews.length;
      mg.bufferViews.push({ buffer: 0, byteOffset: tOff, byteLength: times.byteLength });
      const tAccIdx = mg.accessors.length;
      mg.accessors.push({
        bufferView: tBvIdx, componentType: 5126, count: times.length,
        type: 'SCALAR', min: [times[0]], max: [times[times.length - 1]],
      });

      const vOff = appendData(values);
      const vBvIdx = mg.bufferViews.length;
      mg.bufferViews.push({ buffer: 0, byteOffset: vOff, byteLength: values.byteLength });
      const vAccIdx = mg.accessors.length;
      mg.accessors.push({
        bufferView: vBvIdx, componentType: outAcc.componentType,
        count: ag.accessors[smp.output].count, type: outAcc.type,
      });

      const sIdx = newAnim.samplers.length;
      newAnim.samplers.push({ input: tAccIdx, output: vAccIdx, interpolation: smp.interpolation || 'LINEAR' });
      newAnim.channels.push({ sampler: sIdx, target: { node: mainNodeIdx, path: ch.target.path } });
    }

    if (newAnim.channels.length > 0) {
      mg.animations.push(newAnim);
      mergedCount++;
    }
  }

  if (mergedCount === 0) return 0;

  mg.buffers[0].byteLength = extraOffset;
  await writeGlb(mainGlbPath, mg, [mb.slice(0, actualMainBinLen), ...extraChunks]);
  return mergedCount;
}

async function mergeSiblingFbxAnimations(mainGlbPath: string, mainFbxPath: string): Promise<void> {
  const srcDir = path.dirname(mainFbxPath);
  const mainFbxName = path.basename(mainFbxPath).toLowerCase();

  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(srcDir, { withFileTypes: true }); } catch { return; }

  const siblingFbx = entries
    .filter(e => e.isFile()
      && e.name.toLowerCase() !== mainFbxName
      && path.extname(e.name).toLowerCase() === '.fbx')
    .map(e => path.join(srcDir, e.name));

  if (siblingFbx.length === 0) return;
  console.log(`[UAB] Found ${siblingFbx.length} sibling FBX file(s) for animation merge`);

  const tmpDir = path.join(path.dirname(mainGlbPath), `.uab-tmp-${Date.now()}`);
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    for (const sibPath of siblingFbx) {
      const baseName = path.basename(sibPath, path.extname(sibPath));
      const tmpBase = path.join(tmpDir, baseName);
      const tmpGlb = tmpBase + '.glb';

      try {
        await runFbx2Gltf(sibPath, tmpBase);
        if (!fs.existsSync(tmpGlb)) continue;

        try {
          const meta = await fs.promises.readFile(sibPath + '.meta', 'utf8');
          const clips = parseUnityMetaClips(meta);
          if (clips.length > 0) await splitGlbAnimations(tmpGlb, clips);
        } catch {}

        const count = await mergeAnimationsIntoGlb(mainGlbPath, tmpGlb, baseName);
        if (count > 0) console.log(`[UAB] Merged ${count} animation(s) from ${baseName}.fbx`);
      } catch (e) {
        console.warn(`[UAB] Failed to merge ${baseName}.fbx:`, e instanceof Error ? e.message : String(e));
      }
    }
  } finally {
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── Image Conversion ─────────────────────────────────

const SHARP_SUPPORTED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg']);

async function convertImage(
  inputPath: string,
  outputPath: string,
  config: ExportConfig,
): Promise<ExportResultItem> {
  const inputSize = (await fs.promises.stat(inputPath)).size;
  const ext = path.extname(inputPath).toLowerCase();

  let pipeline: import('sharp').Sharp | null = null;
  try {
    await ensureDeps();
    if (!sharpModule) throw new Error('sharp not available');

    const inputBuffer = await fs.promises.readFile(inputPath);

    if (ext === '.tga') {
      const { width, height, data } = decodeTGA(inputBuffer);
      pipeline = (sharpModule as any)(data, { raw: { width, height, channels: 4 } });
    } else if (SHARP_SUPPORTED.has(ext)) {
      pipeline = (sharpModule as any)(inputBuffer);
    } else {
      await fs.promises.copyFile(inputPath, outputPath);
      const outputSize = (await fs.promises.stat(outputPath)).size;
      return { inputPath, outputPath, success: true, inputSize, outputSize };
    }

    if (config.maxTextureSize > 0) {
      pipeline = pipeline!.resize(config.maxTextureSize, config.maxTextureSize, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const outExt = config.imageFormat === 'webp' ? '.webp' : '.png';
    outputPath = outputPath.replace(/\.[^.]+$/, outExt);

    if (config.imageFormat === 'webp') {
      pipeline = pipeline!.webp({ quality: config.imageQuality });
    } else {
      pipeline = pipeline!.png({ compressionLevel: Math.min(9, Math.round(config.imageQuality / 11)) });
    }

    await pipeline!.toFile(outputPath);
    const outputSize = (await fs.promises.stat(outputPath)).size;
    return { inputPath, outputPath, success: true, inputSize, outputSize };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { inputPath, outputPath, success: false, error: msg, inputSize, outputSize: 0 };
  } finally {
    if (pipeline) {
      try { pipeline.destroy(); } catch {}
    }
  }
}

// ─── Model Conversion ─────────────────────────────────

let fbx2gltfBin: string | null = null;

const CONVERTER_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));

function getFbx2GltfBin(): string {
  if (fbx2gltfBin) return fbx2gltfBin;
  const osType = process.platform === 'win32' ? 'Windows_NT'
    : process.platform === 'darwin' ? 'Darwin' : 'Linux';
  const ext = process.platform === 'win32' ? '.exe' : '';
  const relBin = path.join('node_modules', 'fbx2gltf', 'bin', osType, 'FBX2glTF' + ext);

  const candidates = [
    path.resolve(relBin),
    path.resolve(CONVERTER_DIR, '..', relBin),
  ];

  for (const bin of candidates) {
    if (fs.existsSync(bin)) {
      fbx2gltfBin = bin;
      return bin;
    }
  }
  throw new Error(`fbx2gltf binary not found. Searched:\n${candidates.join('\n')}`);
}

export function runFbx2Gltf(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let binPath: string;
    try {
      binPath = getFbx2GltfBin();
    } catch (e) {
      reject(e);
      return;
    }
    const args = ['-i', input, '-o', output, '--binary'];
    execFile(binPath, args, { timeout: 120_000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function convertModel(
  inputPath: string,
  outputPath: string,
  config: ExportConfig,
): Promise<ExportResultItem> {
  const inputSize = (await fs.promises.stat(inputPath)).size;
  const ext = path.extname(inputPath).toLowerCase();

  try {
    if (ext === '.fbx') {
      const outBase = outputPath.replace(/\.[^.]+$/, '');
      const glbOut = outBase + '.glb';
      try {
        await runFbx2Gltf(inputPath, outBase);
        if (!fs.existsSync(glbOut)) {
          const gltfOut = outBase + '.gltf';
          if (fs.existsSync(gltfOut)) {
            outputPath = gltfOut;
          } else {
            throw new Error('fbx2gltf produced no output');
          }
        } else {
          outputPath = glbOut;
        }
        console.log(`[UAB] fbx2gltf OK => ${path.basename(outputPath)}`);
      } catch (fbxErr) {
        console.warn('[UAB] fbx2gltf failed, copying raw FBX:', fbxErr instanceof Error ? fbxErr.message : String(fbxErr));
        await fs.promises.copyFile(inputPath, outputPath);
      }
      if (outputPath.endsWith('.glb')) {
        try {
          const metaPath = inputPath + '.meta';
          console.log(`[UAB] Looking for meta: ${metaPath}`);
          const metaContent = await fs.promises.readFile(metaPath, 'utf8');
          const clips = parseUnityMetaClips(metaContent);
          console.log(`[UAB] Parsed ${clips.length} clip(s):`, clips.map(c => `${c.name}(${c.firstFrame}-${c.lastFrame})`).join(', ') || '(none)');
          if (clips.length > 0) {
            await splitGlbAnimations(outputPath, clips);
            console.log('[UAB] Animation split done');
          }
        } catch (e) {
          console.warn('[UAB] Animation split failed:', e instanceof Error ? e.message : String(e));
        }
        try {
          await convertGlbTextures(outputPath);
        } catch (e) {
          console.warn('[UAB] GLB texture conversion failed:', e instanceof Error ? e.message : String(e));
        }
        try {
          await mergeSiblingFbxAnimations(outputPath, inputPath);
        } catch (e) {
          console.warn('[UAB] Sibling animation merge failed:', e instanceof Error ? e.message : String(e));
        }
        if (config.embedTextures) {
          try {
            await embedExternalTextures(outputPath, path.dirname(inputPath), config);
          } catch (e) {
            console.warn('[UAB] External texture embedding failed:', e instanceof Error ? e.message : String(e));
          }
        }
      } else {
        console.log(`[UAB] FBX conversion produced non-GLB output: ${outputPath}`);
      }
    } else if (ext === '.gltf' || ext === '.glb') {
      await fs.promises.copyFile(inputPath, outputPath);
      if (ext === '.glb' && config.embedTextures) {
        try {
          await embedExternalTextures(outputPath, path.dirname(inputPath), config);
        } catch (e) {
          console.warn('[UAB] External texture embedding failed:', e instanceof Error ? e.message : String(e));
        }
      }
    } else if (ext === '.obj') {
      await fs.promises.copyFile(inputPath, outputPath);
      const mtlPath = inputPath.replace(/\.obj$/i, '.mtl');
      if (fs.existsSync(mtlPath)) {
        const mtlOut = outputPath.replace(/\.obj$/i, '.mtl');
        await fs.promises.copyFile(mtlPath, mtlOut);
      }
    } else {
      await fs.promises.copyFile(inputPath, outputPath);
    }

    const outputSize = fs.existsSync(outputPath) ? (await fs.promises.stat(outputPath)).size : 0;
    return { inputPath, outputPath, success: true, inputSize, outputSize };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { inputPath, outputPath, success: false, error: msg, inputSize, outputSize: 0 };
  }
}

// ─── Batch Export ─────────────────────────────────────

interface ExportTaskInternal {
  taskId: string;
  assets: Array<{ relativePath: string; type: string; absolutePath: string }>;
  outputDir: string;
  config: ExportConfig;
}

const activeTasks = new Map<string, ExportStatus>();
const cancelledTasks = new Set<string>();

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tga',
  '.psd', '.tif', '.tiff', '.exr', '.hdr', '.svg',
]);
const MODEL_EXTS = new Set(['.fbx', '.obj', '.gltf', '.glb']);

function classifyAsset(ext: string): 'image' | 'model' | 'other' {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (MODEL_EXTS.has(ext)) return 'model';
  return 'other';
}


interface FlatExportItem {
  absolutePath: string;
  outputPath: string;
  category: 'image' | 'model' | 'other';
  label: string;
}

function buildFlatExportPlan(
  assets: ExportTaskInternal['assets'],
  outputDir: string,
): FlatExportItem[] {
  const items: FlatExportItem[] = [];
  const usedOutputPaths = new Set<string>();
  const includedInputs = new Set(assets.map((a) => a.absolutePath));

  function uniqueOut(desired: string): string {
    if (!usedOutputPaths.has(desired)) { usedOutputPaths.add(desired); return desired; }
    const ext = path.extname(desired);
    const base = desired.slice(0, -ext.length);
    for (let n = 2; ; n++) {
      const candidate = `${base}_${n}${ext}`;
      if (!usedOutputPaths.has(candidate)) { usedOutputPaths.add(candidate); return candidate; }
    }
  }

  for (const asset of assets) {
    const ext = path.extname(asset.relativePath).toLowerCase();
    const category = classifyAsset(ext);
    const fileName = path.basename(asset.relativePath);

    if (category === 'model') {
      const modelName = path.basename(fileName, ext);
      const modelDir = path.join(outputDir, modelName);
      const modelOut = uniqueOut(path.join(modelDir, fileName));
      items.push({ absolutePath: asset.absolutePath, outputPath: modelOut, category: 'model', label: asset.relativePath });

      // find sibling textures and add them into the same model folder
      const srcDir = path.dirname(asset.absolutePath);
      try {
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const sibExt = path.extname(entry.name).toLowerCase();
          if (!IMAGE_EXTS.has(sibExt)) continue;
          const sibAbs = path.join(srcDir, entry.name);
          if (includedInputs.has(sibAbs)) continue;
          includedInputs.add(sibAbs);
          const texOut = uniqueOut(path.join(modelDir, entry.name));
          items.push({ absolutePath: sibAbs, outputPath: texOut, category: 'image', label: `${modelName}/${entry.name}` });
        }
      } catch {}
    } else {
      const outPath = uniqueOut(path.join(outputDir, fileName));
      items.push({ absolutePath: asset.absolutePath, outputPath: outPath, category, label: asset.relativePath });
    }
  }

  return items;
}

export async function startExport(task: ExportTaskInternal): Promise<string> {
  await ensureDeps();

  const { taskId, assets, outputDir, config } = task;

  await fs.promises.mkdir(outputDir, { recursive: true });

  const plan = buildFlatExportPlan(assets, outputDir);

  const status: ExportStatus = {
    taskId,
    current: 0,
    total: plan.length,
    currentFile: '',
    status: 'running',
    results: [],
  };
  activeTasks.set(taskId, status);

  (async () => {
    const limit = pLimitFn ? pLimitFn(config.concurrency || 4) : null;
    const tasks: Array<Promise<void>> = [];

    for (let i = 0; i < plan.length; i++) {
      const processOne = async () => {
        if (cancelledTasks.has(taskId)) return;

        const item = plan[i];
        status.currentFile = item.label;

        await fs.promises.mkdir(path.dirname(item.outputPath), { recursive: true });

        let result: ExportResultItem;
        if (item.category === 'image') {
          result = await convertImage(item.absolutePath, item.outputPath, config);
        } else if (item.category === 'model') {
          result = await convertModel(item.absolutePath, item.outputPath, config);
        } else {
          const inputSize = (await fs.promises.stat(item.absolutePath)).size;
          await fs.promises.copyFile(item.absolutePath, item.outputPath);
          const outputSize = (await fs.promises.stat(item.outputPath)).size;
          result = { inputPath: item.absolutePath, outputPath: item.outputPath, success: true, inputSize, outputSize };
        }

        status.results.push(result);
        status.current = status.results.length;
      };

      if (limit) {
        tasks.push(limit(processOne));
      } else {
        await processOne();
      }
    }

    if (limit) await Promise.all(tasks);

    if (cancelledTasks.has(taskId)) {
      status.status = 'cancelled';
      cancelledTasks.delete(taskId);
    } else {
      if (config.generateManifest) {
        await generateManifest(outputDir, status.results);
      }
      const hasFailure = status.results.some((r) => !r.success);
      status.status = hasFailure && status.results.every((r) => !r.success) ? 'failed' : 'completed';
    }

    status.currentFile = '';
  })().catch((err) => {
    status.status = 'failed';
    status.error = err instanceof Error ? err.message : String(err);
  });

  return taskId;
}

export function getTaskStatus(taskId: string): ExportStatus | null {
  return activeTasks.get(taskId) ?? null;
}

export function cancelTask(taskId: string): boolean {
  if (activeTasks.has(taskId)) {
    cancelledTasks.add(taskId);
    return true;
  }
  return false;
}

// ─── Manifest ─────────────────────────────────────────

async function generateManifest(outputDir: string, results: ExportResultItem[]) {
  const manifest = {
    exportTime: new Date().toISOString(),
    totalFiles: results.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
    files: results
      .filter((r) => r.success)
      .map((r) => ({
        path: path.relative(outputDir, r.outputPath).replace(/\\/g, '/'),
        originalPath: r.inputPath,
        size: r.outputSize,
      })),
  };

  await fs.promises.writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
}
