const fs = require('fs');

async function test() {
  const pdfBytes = fs.readFileSync('test.pdf');
  const base64 = pdfBytes.toString('base64');
  
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
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64}`
              }
            },
            {
              type: "text",
              text: "ocr this"
            }
          ]
        }
      ]
    })
  });
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
