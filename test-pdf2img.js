const fs = require('fs/promises');
const path = require('path');
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function testPdfToImage() {
  const data = new Uint8Array(await fs.readFile(path.join(__dirname, 'test.pdf')).catch(() => null));
  if (!data) {
    console.log("No test.pdf found, creating a dummy PDF using pdf-lib...");
    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([500, 500]);
    page.drawText('Helooo world', { x: 50, y: 400, size: 50 });
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(path.join(__dirname, 'test.pdf'), pdfBytes);
  }

  const pdfData = new Uint8Array(await fs.readFile(path.join(__dirname, 'test.pdf')));
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  console.log(`Document loaded, pages: ${pdfDocument.numPages}`);
  
  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  
  const canvasFactory = {
      create: function (width, height) {
        const canvas = createCanvas(width, height);
        return {
          canvas,
          context: canvas.getContext('2d'),
        };
      },
      reset: function (canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      },
      destroy: function (canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
      },
  };
  
  const renderContext = {
    canvasContext: canvasFactory.create(viewport.width, viewport.height).context,
    viewport: viewport,
    canvasFactory: canvasFactory
  };
  
  await page.render(renderContext).promise;
  console.log("Rendered!");
  const base64 = renderContext.canvasContext.canvas.toDataURL('image/jpeg');
  console.log("Base64 length:", base64.length);
}

testPdfToImage().catch(console.error);
