import { pdf } from "pdf-to-img";
import fs from "fs";

async function testFullPipeline() {
  const pdfBuffer = fs.readFileSync("test.pdf");
  const doc = await pdf(pdfBuffer, { scale: 2.0 });

  let pageNum = 0;
  for await (const image of doc) {
    pageNum++;
    const base64DataUrl = `data:image/png;base64,${image.toString("base64")}`;
    
    console.log(`Page ${pageNum}: Sending to Fireworks AI...`);
    
    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Bearer fw_RCwn7jRXXy3piUzMzRCdrt"
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/qwen3-vl-30b-a3b-instruct",
        max_tokens: 4096,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        temperature: 0.6,
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: base64DataUrl }
            },
            {
              type: "text",
              text: "ocr this"
            }
          ]
        }]
      })
    });
    
    if (!response.ok) {
      console.error(`API Error: ${response.status} - ${await response.text()}`);
      return;
    }
    
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    console.log(`Page ${pageNum} OCR result (${text.length} chars):`);
    console.log(text);
  }
}

testFullPipeline().catch(console.error);
