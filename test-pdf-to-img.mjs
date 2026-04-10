import { pdf } from "pdf-to-img";
import { PDFDocument } from "pdf-lib";
import fs from "fs";

// Create a test PDF first
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage();
page.drawText("Hello World - Fireworks OCR Test!", { x: 50, y: 700, size: 30 });
const pdfBytes = await pdfDoc.save();
fs.writeFileSync("test.pdf", pdfBytes);

// Convert PDF to images
const pdfBuffer = fs.readFileSync("test.pdf");
const doc = await pdf(pdfBuffer, { scale: 2.0 });

let pageNum = 0;
for await (const image of doc) {
  pageNum++;
  const base64 = image.toString("base64");
  console.log(`Page ${pageNum}: image size=${image.length} bytes, base64 length=${base64.length}`);
  // Save first page as PNG for verification
  fs.writeFileSync(`test-page-${pageNum}.png`, image);
}
console.log(`Total pages: ${pageNum}`);
console.log("Success! PDF converted to images without canvas/pdfjs issues.");
