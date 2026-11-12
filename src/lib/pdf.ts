/**
 * A one-page PDF holding the page as a single picture with link areas on top, written by hand so the export needs
 * no PDF library. The picture is stored losslessly (Flate) where the browser can compress, as JPEG otherwise.
 */

import { encode } from 'uqr';

export type PdfPage = 'a4' | 'a3';

/** Portrait sizes in points (1/72 inch). */
const PAGE_SIZES: Record<PdfPage, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
};

const MARGIN = 24;
/** A small flow is enlarged to fill the page, but only this far (points per CSS pixel; 0.75 is life size). */
const MAX_ZOOM = 1.5;
const DPI = 220;
/** Canvas pixels per point. */
const PX = DPI / 72;

const SITE = 'https://flowdraft.tech';
const LOGO = 20;
const QR = 64;
const FOOTER_GAP = 14;
/** Light margin around the code, in modules; scanners need it on a dark page. */
const QUIET = 4;

export type PdfLayout = {
  pageWidth: number;
  pageHeight: number;
  /** Where the flow sits on the page, in points from the top left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Device pixels per CSS pixel to capture the flow at. */
  pixelRatio: number;
  withQr: boolean;
};

export type PdfLink = { x: number; y: number; width: number; height: number; url: string };

export type PdfFooter = {
  /** Where the QR code leads: the flow on the web. Null leaves the code out. */
  flowUrl: string | null;
  caption: string;
  text: string;
  textMuted: string;
  textFaint: string;
  fontSans: string;
  fontMono: string;
};

/**
 * Fits a flow of the given CSS size on the page, which turns landscape for a wide flow. The strip along the bottom
 * is kept free for the logo and the QR code.
 */
export function layoutPdf(page: PdfPage, width: number, height: number, withQr: boolean): PdfLayout {
  const [short, long] = PAGE_SIZES[page];
  const landscape = width > height;
  const pageWidth = landscape ? long : short;
  const pageHeight = landscape ? short : long;
  const areaWidth = pageWidth - MARGIN * 2;
  const areaHeight = pageHeight - MARGIN * 2 - (withQr ? QR : LOGO) - FOOTER_GAP;
  const zoom = Math.min(areaWidth / width, areaHeight / height, MAX_ZOOM);
  const w = width * zoom;
  const h = height * zoom;
  return {
    pageWidth,
    pageHeight,
    x: MARGIN + (areaWidth - w) / 2,
    y: MARGIN + (areaHeight - h) / 2,
    width: w,
    height: h,
    pixelRatio: zoom * PX,
    withQr,
  };
}

/** The mark of the logo (src/components/TopBar.tsx), drawn in a 64 unit box. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 64, 14);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.fill(
    new Path2D(
      'M47 9H28C19.163 9 12 16.163 12 25V51C12 54.314 14.686 57 18 57S24 54.314 24 51V38H41V28H24V25C24 22.791 25.791 21 28 21H47C50.314 21 53 18.314 53 15S50.314 9 47 9Z',
    ),
  );
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  ctx.roundRect(37, 25, 16, 16, 4);
  ctx.fill();
  ctx.restore();
}

/** The code on a white tile, its modules on whole pixels so that no seams show. */
function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const { data, size: count } = encode(url, { ecc: 'M', border: 0 });
  const left = Math.round(x * PX);
  const top = Math.round(y * PX);
  const side = Math.round(size * PX);
  const unit = Math.max(1, Math.floor(side / (count + QUIET * 2)));
  const inset = Math.floor((side - unit * count) / 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(left, top, side, side, 4 * PX);
  ctx.fill();
  ctx.fillStyle = '#111111';
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++)
      if (data[row][col]) ctx.fillRect(left + inset + col * unit, top + inset + row * unit, unit, unit);
  ctx.restore();
}

/**
 * The whole page as one picture: the captured flow, the logo with the site's address at the bottom left and, when
 * the flow has a place on the web, a QR code to it at the bottom right. Returns the areas that are links.
 */
export async function composePage(flow: HTMLCanvasElement, layout: PdfLayout, footer: PdfFooter) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.pageWidth * PX);
  canvas.height = Math.round(layout.pageHeight * PX);
  const ctx = canvas.getContext('2d');
  const source = flow.getContext('2d');
  if (!ctx || !source) throw new Error('No 2D context');

  const wordmark = `600 13px ${footer.fontSans}`;
  const small = `9px ${footer.fontSans}`;
  const mono = `8px ${footer.fontMono}`;
  await Promise.all([wordmark, small, mono].map((font) => document.fonts.load(font).catch(() => undefined)));

  // The capture is painted on the theme's background; the page takes the same colour, edge to edge.
  const [r, g, b] = source.getImageData(0, 0, 1, 1).data;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(flow, layout.x * PX, layout.y * PX, layout.width * PX, layout.height * PX);

  ctx.scale(PX, PX);
  ctx.textBaseline = 'middle';
  const links: PdfLink[] = [];
  const bottom = layout.pageHeight - MARGIN;

  const middle = bottom - LOGO / 2;
  drawMark(ctx, MARGIN, bottom - LOGO, LOGO);
  ctx.font = wordmark;
  ctx.fillStyle = footer.text;
  let x = MARGIN + LOGO + 7;
  ctx.fillText('flowdraft', x, middle + 0.5);
  x += ctx.measureText('flowdraft').width + 10;
  ctx.font = mono;
  ctx.fillStyle = footer.textMuted;
  const site = SITE.replace('https://', '');
  ctx.fillText(site, x, middle + 1);
  x += ctx.measureText(site).width;
  links.push({ x: MARGIN, y: bottom - LOGO, width: x - MARGIN, height: LOGO, url: SITE });

  if (footer.flowUrl) {
    const right = layout.pageWidth - MARGIN;
    drawQr(ctx, footer.flowUrl, right - QR, bottom - QR, QR);
    const address = footer.flowUrl.replace(/^https?:\/\//, '');
    ctx.textAlign = 'right';
    ctx.font = small;
    ctx.fillStyle = footer.textMuted;
    ctx.fillText(footer.caption, right - QR - 10, bottom - 18);
    let left = right - QR - 10 - ctx.measureText(footer.caption).width;
    ctx.font = mono;
    ctx.fillStyle = footer.textFaint;
    ctx.fillText(address, right - QR - 10, bottom - 6);
    left = Math.min(left, right - QR - 10 - ctx.measureText(address).width);
    links.push({ x: left, y: bottom - QR, width: right - left, height: QR, url: footer.flowUrl });
  }
  return { canvas, links };
}

async function deflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A PDF text string: UTF-16BE with a byte order mark, as hex. */
function pdfText(text: string) {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** Characters with a meaning inside a PDF string are escaped; anything outside ASCII is percent-encoded first. */
const pdfUri = (url: string) => `(${encodeURI(url).replace(/[\\()]/g, '\\$&')})`;

export async function buildPdf(
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  title: string,
  links: PdfLink[],
): Promise<Blob> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;

  let image: Uint8Array<ArrayBuffer>;
  let filter: string;
  if (typeof CompressionStream === 'function') {
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4) {
      rgb[j++] = rgba[i];
      rgb[j++] = rgba[i + 1];
      rgb[j++] = rgba[i + 2];
    }
    image = await deflate(rgb);
    filter = '/FlateDecode';
  } else {
    image = fromBase64(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    filter = '/DCTDecode';
  }

  const content = `q ${num(pageWidth)} 0 0 ${num(pageHeight)} 0 0 cm /Im0 Do Q`;

  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string, stream?: Uint8Array<ArrayBuffer>) => {
    offsets.push(length);
    push(`${offsets.length} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };

  push('%PDF-1.4\n%âãÏÓ\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageWidth)} ${num(pageHeight)}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R /Annots [${links.map((_, i) => `${7 + i} 0 R`).join(' ')}] >>`,
  );
  object(`<< /Length ${content.length} >>`, encoder.encode(content));
  object(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter ${filter} /Length ${image.length} >>`,
    image,
  );
  object(`<< /Title ${pdfText(title)} /Creator (flowdraft) /Producer (flowdraft) >>`);
  // Link areas are measured from the top left; PDF counts from the bottom left.
  for (const link of links) {
    const rect = [link.x, pageHeight - link.y - link.height, link.x + link.width, pageHeight - link.y].map(num).join(' ');
    object(`<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI ${pdfUri(link.url)} >> >>`);
  }

  const xref = length;
  push(
    `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n` +
      offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts, { type: 'application/pdf' });
}
