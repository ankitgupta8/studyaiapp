const { Mistral } = require('@mistralai/mistralai');

async function run() {
  const client = new Mistral({ apiKey: "c1e5f7mf6iz65dJlB2zSAlnFsievvOzl" });
  const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [ 3 0 R ]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [ 0 0 612 792 ]\n/Resources << >>\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n200\n%%EOF').toString('base64');
  
  try {
    const ocrResponse = await client.ocr.process({
        document: {
            type: "document_url",
            documentUrl: `data:application/pdf;base64,${pdfBase64}`
        },
        model: "mistral-ocr-latest"
    });
    console.log(JSON.stringify(ocrResponse, null, 2));
  } catch (e) {
    console.error(e.message || e);
  }
}
run();
