/**
 * A one-page PDF holding a single picture, written by hand so the export needs no PDF library.
 * The picture is stored losslessly (Flate) where the browser can compress, as JPEG otherwise.
 */

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

export type PdfLayout = {
  pageWidth: number;
  pageHeight: number;
  /** Where the picture sits on the page, in points from the bottom left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Device pixels per CSS pixel to capture the picture at. */
  pixelRatio: number;
};

/** Fits a picture of the given CSS size on the page, which turns landscape for a wide picture. */
export function layoutPdf(page: PdfPage, width: number, height: number): PdfLayout {
  const [short, long] = PAGE_SIZES[page];
  const landscape = width > height;
  const pageWidth = landscape ? long : short;
  const pageHeight = landscape ? short : long;
  const zoom = Math.min((pageWidth - MARGIN * 2) / width, (pageHeight - MARGIN * 2) / height, MAX_ZOOM);
  const w = width * zoom;
  const h = height * zoom;
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - w) / 2,
    y: (pageHeight - h) / 2,
    width: w,
    height: h,
    pixelRatio: (zoom * DPI) / 72,
  };
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

export async function buildPdf(canvas: HTMLCanvasElement, layout: PdfLayout, title: string): Promise<Blob> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  // The capture is painted on the theme's background; the page takes the same colour, edge to edge.
  const background = [rgba[0], rgba[1], rgba[2]].map((c) => num(c / 255)).join(' ');

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

  const content =
    `q ${background} rg 0 0 ${num(layout.pageWidth)} ${num(layout.pageHeight)} re f ` +
    `${num(layout.width)} 0 0 ${num(layout.height)} ${num(layout.x)} ${num(layout.y)} cm /Im0 Do Q`;

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
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(layout.pageWidth)} ${num(layout.pageHeight)}] ` +
      '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
  );
  object(`<< /Length ${content.length} >>`, encoder.encode(content));
  object(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter ${filter} /Length ${image.length} >>`,
    image,
  );
  object(`<< /Title ${pdfText(title)} /Creator (flowdraft) /Producer (flowdraft) >>`);

  const xref = length;
  push(
    `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n` +
      offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts, { type: 'application/pdf' });
}
