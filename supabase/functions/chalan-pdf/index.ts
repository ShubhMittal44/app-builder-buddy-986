import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChalanFile {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  uploaded_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate the caller: a valid signed-in user is required.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, download = false } = await req.json();
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating PDF for order: ${order_id}`);

    // Fetch order with files
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_number, files')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const files = (order.files || []) as ChalanFile[];
    
    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files found for this order' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${files.length} files`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Process each image
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Processing file ${i + 1}/${files.length}: ${file.path}`);

      try {
        // Download image from storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('sizes_chalan')
          .download(file.path);

        if (downloadError || !imageData) {
          console.error(`Failed to download ${file.path}:`, downloadError);
          continue;
        }

        // Convert blob to array buffer
        const imageBytes = await imageData.arrayBuffer();
        
        // Embed image in PDF (support JPG, PNG)
        let image;
        if (file.type.includes('png')) {
          image = await pdfDoc.embedPng(new Uint8Array(imageBytes));
        } else {
          // Default to JPG for other image types
          image = await pdfDoc.embedJpg(new Uint8Array(imageBytes));
        }

        // Add page with A4 dimensions (595.28 x 841.89 points)
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Calculate dimensions to fit image on page with margins
        const margin = 40;
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);
        
        const imageWidth = image.width;
        const imageHeight = image.height;
        const imageRatio = imageWidth / imageHeight;
        const pageRatio = maxWidth / maxHeight;
        
        let finalWidth, finalHeight;
        
        if (imageRatio > pageRatio) {
          // Image is wider than page ratio
          finalWidth = maxWidth;
          finalHeight = maxWidth / imageRatio;
        } else {
          // Image is taller than page ratio
          finalHeight = maxHeight;
          finalWidth = maxHeight * imageRatio;
        }
        
        // Center image on page
        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;
        
        page.drawImage(image, {
          x,
          y,
          width: finalWidth,
          height: finalHeight,
        });

        console.log(`Added page ${i + 1} with image`);
      } catch (imageError) {
        console.error(`Error processing image ${file.path}:`, imageError);
        // Continue with next image
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated successfully, size: ${pdfBytes.length} bytes`);

    // Determine filename and disposition
    const filename = `chalan_${order.order_number}.pdf`;
    const disposition = download 
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    // Create blob from PDF bytes (cast to any to fix Deno type issue)
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });

    return new Response(blob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
      },
    });
  } catch (error: any) {
    console.error('Error in chalan-pdf function:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate PDF' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
