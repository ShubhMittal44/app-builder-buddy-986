import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 16;

const stageOrder: Record<string, number> = {
  intake: 0, assign_site: 1, processing: 2, dispatch: 3, fitting: 4,
};

const stageLabels: Record<string, string> = {
  intake: 'Intake', assign_site: 'Assign Site', processing: 'Processing',
  dispatch: 'Dispatch', fitting: 'Fitting',
};

interface OrderFile {
  name?: string; path?: string; url?: string; type?: string;
  size?: number; uploaded_at?: string; sequence?: number;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const allLines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { allLines.push(''); continue; }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }
  return allLines;
}

function sortFiles(files: OrderFile[]): OrderFile[] {
  return [...files].sort((a, b) => {
    if (typeof a.sequence === 'number' && typeof b.sequence === 'number') {
      return a.sequence - b.sequence;
    }
    if (a.uploaded_at && b.uploaded_at) {
      return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

async function fetchImageBytes(supabase: any, file: OrderFile): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    if (file.path) {
      const { data, error } = await supabase.storage.from('sizes_chalan').download(file.path);
      if (error) {
        console.warn(`Failed to download ${file.path}:`, error.message);
      } else if (data) {
        const buf = new Uint8Array(await data.arrayBuffer());
        return { bytes: buf, type: file.type || 'image/jpeg' };
      }
    }
    if (file.url) {
      const resp = await fetch(file.url);
      if (!resp.ok) {
        console.warn(`Failed to fetch ${file.url}: ${resp.status}`);
        return null;
      }
      const buf = new Uint8Array(await resp.arrayBuffer());
      return { bytes: buf, type: file.type || 'image/jpeg' };
    }
  } catch (e: any) {
    console.warn('Image fetch error:', e?.message);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('order_number, customer_name, stage, order_date, notes, files')
      .neq('stage', 'closed')
      .order('order_date', { ascending: false });

    if (fetchError) throw fetchError;

    const filtered = (orders || []).filter((o: any) => {
      const hasNotes = (o.notes || '').trim().length > 0;
      const hasFiles = Array.isArray(o.files) && o.files.length > 0;
      return hasNotes || hasFiles;
    });

    const sorted = filtered.sort((a: any, b: any) => {
      const sa = stageOrder[a.stage] ?? 99;
      const sb = stageOrder[b.stage] ?? 99;
      if (sa !== sb) return sa - sb;
      const da = new Date(a.order_date).getTime();
      const db = new Date(b.order_date).getTime();
      if (da !== db) return db - da;
      return a.customer_name.localeCompare(b.customer_name);
    });

    if (sorted.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No open orders with notes or chalan found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    function drawPageHeader() {
      page.drawText('RGH Open Orders – Notes & Chalan', {
        x: MARGIN, y: cursorY, size: 16, font: fontBold, color: rgb(0.118, 0.251, 0.686),
      });
      cursorY -= 20;
      page.drawText(`Generated: ${today}`, {
        x: MARGIN, y: cursorY, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
      });
      cursorY -= 10;
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
        thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
      });
      cursorY -= 20;
    }

    drawPageHeader();

    for (const order of sorted) {
      const notes = (order.notes || '').trim();
      const files: OrderFile[] = Array.isArray(order.files) ? sortFiles(order.files) : [];
      const imageFiles = files.filter((f) => {
        const t = (f.type || '').toLowerCase();
        const n = (f.name || f.path || '').toLowerCase();
        return t.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(n);
      });

      if (notes) {
        const nameSize = 13;
        const metaSize = 9;
        const notesSize = 10;
        const notesLines = wrapText(notes, fontRegular, notesSize, USABLE_WIDTH);

        const blockHeight =
          nameSize + 6 +
          metaSize + 8 +
          notesLines.length * LINE_HEIGHT +
          24;

        const spaceLeft = cursorY - MARGIN;

        if (blockHeight > spaceLeft) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          cursorY = PAGE_HEIGHT - MARGIN;
          drawPageHeader();
        }

        page.drawText(order.customer_name, {
          x: MARGIN, y: cursorY, size: nameSize, font: fontBold, color: rgb(0.1, 0.1, 0.1),
        });
        cursorY -= nameSize + 4;

        const dateStr = new Date(order.order_date).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        const meta = `Order #${order.order_number}  •  ${stageLabels[order.stage] || order.stage}  •  ${dateStr}`;
        page.drawText(meta, {
          x: MARGIN, y: cursorY, size: metaSize, font: fontRegular, color: rgb(0.45, 0.45, 0.45),
        });
        cursorY -= metaSize + 8;

        for (const line of notesLines) {
          if (cursorY < MARGIN) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            cursorY = PAGE_HEIGHT - MARGIN;
            drawPageHeader();
          }
          page.drawText(line, {
            x: MARGIN, y: cursorY, size: notesSize, font: fontRegular, color: rgb(0.15, 0.15, 0.15),
          });
          cursorY -= LINE_HEIGHT;
        }

        cursorY -= 8;
        if (cursorY > MARGIN + 10) {
          page.drawLine({
            start: { x: MARGIN, y: cursorY },
            end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
            thickness: 0.3, color: rgb(0.85, 0.85, 0.85),
          });
        }
        cursorY -= 16;
      }

      let imagesAdded = 0;
      for (const file of imageFiles) {
        const fetched = await fetchImageBytes(supabase, file);
        if (!fetched) continue;

        let embedded;
        try {
          const t = (fetched.type || '').toLowerCase();
          if (t.includes('png')) {
            embedded = await pdfDoc.embedPng(fetched.bytes);
          } else {
            try {
              embedded = await pdfDoc.embedJpg(fetched.bytes);
            } catch {
              embedded = await pdfDoc.embedPng(fetched.bytes);
            }
          }
        } catch (e: any) {
          console.warn('Embed image failed:', file.path || file.url, e?.message);
          continue;
        }

        const imgPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        const headerH = 28;
        const availW = PAGE_WIDTH - MARGIN * 2;
        const availH = PAGE_HEIGHT - MARGIN * 2 - headerH;

        const caption = `${order.customer_name} — Order #${order.order_number}`;
        imgPage.drawText(caption, {
          x: MARGIN, y: PAGE_HEIGHT - MARGIN - 12, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2),
        });

        const ratio = Math.min(availW / embedded.width, availH / embedded.height);
        const drawW = embedded.width * ratio;
        const drawH = embedded.height * ratio;
        const drawX = MARGIN + (availW - drawW) / 2;
        const drawY = MARGIN + (availH - drawH) / 2;

        imgPage.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
        imagesAdded++;
      }

      if (imagesAdded > 0) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
        drawPageHeader();
      }
    }

    const pdfBytes = await pdfDoc.save();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RGH_Open_Orders_Notes_Chalan_${dateStr}.pdf`;

    return new Response(new Blob([pdfBytes as any], { type: 'application/pdf' }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating notes+chalan PDF:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
