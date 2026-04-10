import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { v4 as uuidv4 } from 'uuid';
import {
  generateMCQsFromChunks,
  generateFlashcardsFromChunks,
  generateRemNoteFromChunks,
  withRetry,
  AIModel
} from '@/services/ai-service';
import { db } from '@/lib/db';
import type { Difficulty, Style, Mode } from '@/types';

// Fireworks API Key
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY || 'fw_RCwn7jRXXy3piUzMzRCdrt';

// Timeout for API calls
const API_TIMEOUT = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single PDF page image with Fireworks AI Vision Model (Qwen3-VL)
 */
async function processVisionOCR(base64DataUrl: string, pageNum: number, totalPages: number): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Page ${pageNum}/${totalPages}] OCR via Fireworks AI (attempt ${attempt})...`);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FIREWORKS_API_KEY}`
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
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const extractedText = data?.choices?.[0]?.message?.content || '';

      console.log(`[Page ${pageNum}/${totalPages}] Done: ${extractedText.length} chars`);
      return extractedText + '\n\n--- PAGE BREAK ---\n\n';
    } catch (error) {
      console.error(`[Page ${pageNum}/${totalPages}] Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = attempt * 5000;
        console.log(`[Page ${pageNum}/${totalPages}] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error(`[Page ${pageNum}/${totalPages}] Failed after all retries`);
  return '';
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication with Supabase
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = (formData.get('mode') || 'mcq') as Mode;
    const difficulty = (formData.get('difficulty') || 'medium') as Difficulty;
    const style = (formData.get('style') || 'high_yield') as Style;
    const questionCount = parseInt(formData.get('questionCount') as string) || 10;
    const model = (formData.get('model') || 'gpt-oss') as AIModel;
    const title = formData.get('title') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    }

    console.log(`[Upload] File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // Convert PDF to images using pdf-to-img (MuPDF WASM - no native deps needed)
    const { pdf } = await import('pdf-to-img');
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfDoc = await pdf(pdfBuffer, { scale: 2.0 });

    // Collect all page images
    const pageImages: Buffer[] = [];
    for await (const image of pdfDoc) {
      pageImages.push(image);
    }

    const totalPages = pageImages.length;
    console.log(`[Upload] PDF converted to ${totalPages} page images`);

    if (totalPages === 0) {
      return NextResponse.json({ success: false, error: 'Empty or unreadable PDF' }, { status: 400 });
    }

    // OCR pages via Fireworks AI Vision — process in parallel chunks of 10
    const CHUNK_SIZE = 3;
    const textResults: string[] = new Array(pageImages.length).fill('');
    const totalChunks = Math.ceil(pageImages.length / CHUNK_SIZE);

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, pageImages.length);
      const chunkPages = pageImages.slice(start, end);

      console.log(`[Upload] Processing OCR chunk ${chunkIdx + 1}/${totalChunks} (pages ${start + 1}-${end})`);

      // Process all pages in this chunk in parallel
      const chunkPromises = chunkPages.map((image, i) => {
        const globalIndex = start + i;
        const pageNum = globalIndex + 1;
        const base64DataUrl = `data:image/png;base64,${image.toString('base64')}`;
        return processVisionOCR(base64DataUrl, pageNum, totalPages);
      });

      const chunkResults = await Promise.all(chunkPromises);

      // Store results in order
      chunkResults.forEach((result, i) => {
        textResults[start + i] = result;
      });

      // Small delay between chunks to respect rate limits
      if (chunkIdx < totalChunks - 1) {
        console.log(`[Upload] Waiting 7sec before next chunk...`);
        await sleep(7000);
      }
    }

    // Filter out empty results (keep ordering)
    const filteredResults = textResults.filter(t => t.trim());

    const extractedText = filteredResults.join('\n\n');

    if (!extractedText.trim()) {
      return NextResponse.json({ success: false, error: 'No text extracted from PDF. The OCR process returned empty strings.' }, { status: 400 });
    }

    console.log(`[Upload] Total extracted text: ${extractedText.length} chars`);

    // Create document linked to user
    const document = await db.document.create({
      data: {
        userId,
        originalText: extractedText,
        mode,
        difficulty,
        style,
        title: title || file.name.replace('.pdf', ''),
      },
    });

    let mcqs: Array<any> = [];
    let flashcards: Array<any> = [];
    let remnoteContent = '';

    // Generate content (MCQs / Flashcards / RemNote)
    try {
      const count = Math.max(1, questionCount);

      if (mode === 'mcq') {
        const result = await withRetry(() =>
          generateMCQsFromChunks(extractedText, difficulty, style, count, 10000, undefined, model)
        );
        mcqs = result.mcqs;
        console.log(`[Upload] Generated ${mcqs.length} MCQs`);

        if (mcqs.length > 0) {
          await db.mCQ.createMany({
            data: mcqs.map((mcq: any) => ({
              documentId: document.id,
              question: mcq.question,
              optionA: mcq.options.A,
              optionB: mcq.options.B,
              optionC: mcq.options.C,
              optionD: mcq.options.D,
              correctAnswer: mcq.correctAnswer,
              explanation: mcq.explanation,
              hint: mcq.hint || 'Think about the key concepts.',
              difficulty: mcq.difficulty,
              style: mcq.style,
            })),
          });
        }
      } else if (mode === 'remnote') {
        const result = await withRetry(() =>
          generateRemNoteFromChunks(extractedText, count, 10000, undefined, model)
        );
        remnoteContent = result.content;
        console.log(`[Upload] Generated ${remnoteContent.length} chars of RemNote content`);

        if (remnoteContent.length > 0) {
          await db.document.update({
            where: { id: document.id },
            data: { remnoteContent },
          });
        }
      } else {
        const result = await withRetry(() =>
          generateFlashcardsFromChunks(extractedText, difficulty, style, count, 10000, undefined, model)
        );
        flashcards = result.flashcards;
        console.log(`[Upload] Generated ${flashcards.length} flashcards`);

        if (flashcards.length > 0) {
          await db.flashcard.createMany({
            data: flashcards.map((card: any) => ({
              documentId: document.id,
              front: card.front,
              back: card.back,
              mnemonic: card.mnemonic,
              clinicalCorrelation: card.clinicalCorrelation,
              keyPoint: card.keyPoint,
              difficulty: card.difficulty,
              style: card.style,
            })),
          });
        }
      }
    } catch (error) {
      console.error('[Upload] Generation error:', error);
      await db.document.delete({ where: { id: document.id } });
      throw error;
    }

    const completeDocument = await db.document.findUnique({
      where: { id: document.id },
      include: { mcqs: true, flashcards: true },
    });

    console.log(`[Upload] Complete!`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      mcqs: completeDocument?.mcqs || [],
      flashcards: completeDocument?.flashcards || [],
      remnoteContent: completeDocument?.remnoteContent || '',
      stats: {
        pdfPages: totalPages,
        extractedChars: extractedText.length,
        generatedCount: mode === 'remnote' ? (remnoteContent.length > 0 ? questionCount : 0) : (mcqs.length || flashcards.length),
      },
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process PDF',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    supportedTypes: ['application/pdf'],
    ocrModel: 'Fireworks AI Vision (qwen3-vl-30b-a3b-instruct)',
    note: 'Uses MuPDF WASM for PDF rendering, Fireworks Vision for OCR',
  });
}
