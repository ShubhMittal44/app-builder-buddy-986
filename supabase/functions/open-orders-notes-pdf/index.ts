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
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN * 2;
const LINE_HEIGHT = 16;
const HEADER_HEIGHT = 60;

const stageOrder: Record<string, number> = {
  intake: 0,
  assign_site: 1,
  processing: 2,
  dispatch: 3,
  fitting: 4,
};

const stageLabels: Record<string, string> = {
  intake: 'Intake',
  assign_site: 'Assign Site',
  processing: 'Processing',
  dispatch: 'Dispatch',
  fitting: 'Fitting',
};

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const allLines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      allLines.push('');
      continue;
    }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch non-closed orders with notes
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('order_number, customer_name, stage, order_date, notes')
      .neq('stage', 'closed')
      .not('notes', 'is', null)
      .neq('notes', '')
      .order('order_date', { ascending: false });

    if (fetchError) throw fetchError;

    // Sort: stage order, then date desc, then name
    const sorted = (orders || []).sort((a: any, b: any) => {
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
        JSON.stringify({ error: 'No open orders with notes found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGIN;

    function drawPageHeader() {
      page.drawText('RGH Open Orders – Customer Notes', {
        x: MARGIN, y: cursorY, size: 16, font: fontBold, color: rgb(0.118, 0.251, 0.686),
      });
      cursorY -= 20;
      page.drawText(`Generated: ${today}`, {
        x: MARGIN, y: cursorY, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
      });
      cursorY -= 10;
      // Divider
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
      if (!notes) continue;

      // Calculate block height
      const nameSize = 13;
      const metaSize = 9;
      const notesSize = 10;
      const notesLines = wrapText(notes, fontRegular, notesSize, USABLE_WIDTH);

      const blockHeight =
        nameSize + 6 +      // customer name + gap
        metaSize + 8 +      // meta line + gap
        notesLines.length * LINE_HEIGHT + // notes
        24;                  // bottom spacing

      const spaceLeft = cursorY - MARGIN;

      // If block doesn't fit, new page
      if (blockHeight > spaceLeft) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
        drawPageHeader();
      }

      // Draw customer name
      page.drawText(order.customer_name, {
        x: MARGIN, y: cursorY, size: nameSize, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });
      cursorY -= nameSize + 4;

      // Meta line
      const dateStr = new Date(order.order_date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
      const meta = `Order #${order.order_number}  •  ${stageLabels[order.stage] || order.stage}  •  ${dateStr}`;
      page.drawText(meta, {
        x: MARGIN, y: cursorY, size: metaSize, font: fontRegular, color: rgb(0.45, 0.45, 0.45),
      });
      cursorY -= metaSize + 8;

      // Notes lines
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

      // Separator
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

    const pdfBytes = await pdfDoc.save();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RGH_Open_Order_Notes_${dateStr}.pdf`;

    return new Response(new Blob([pdfBytes as any], { type: 'application/pdf' }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating notes PDF:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
