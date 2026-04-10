# Add RemNote Flashcard Generation

Add a third content mode — **RemNote Flashcards** — alongside existing MCQ and Flashcard modes. It uses a specialized pharmacology-focused prompt to generate RemNote-formatted markdown, saved in the database and displayed with a copy button.

## Proposed Changes

### 1. Types

#### [MODIFY] [index.ts](file:///c:/Users/putdf/Desktop/studyai/src/types/index.ts)
- Extend `Mode` type: `'mcq' | 'flashcard' | 'remnote'`
- No new interface needed — RemNote output is raw markdown text

---

### 2. Database Schema

#### [MODIFY] [schema.prisma](file:///c:/Users/putdf/Desktop/studyai/prisma/schema.prisma)
- Add `remnoteContent String?` field to the `Document` model
- This stores the generated RemNote markdown alongside existing MCQ/flashcard data
- Run `npx prisma db push` to apply

---

### 3. AI Service

#### [MODIFY] [ai-service.ts](file:///c:/Users/putdf/Desktop/studyai/src/services/ai-service.ts)
- Add `generateRemNoteFlashcards(text, difficulty, style, count, model)` — calls Baseten with the user's pharmacology RemNote prompt
- Add `generateRemNoteFromChunks(text, difficulty, style, totalCount, maxChunkSize, onProgress, model)` — chunked parallel version
- The output is **raw markdown text** (not JSON), so parsing is simpler — just concatenate chunk results

---

### 4. API Routes

#### [MODIFY] [route.ts](file:///c:/Users/putdf/Desktop/studyai/src/app/api/generate/route.ts) (generate)
- Accept `mode: 'remnote'` 
- Call `generateRemNoteFromChunks()`
- Save result to `document.remnoteContent`
- Return `remnoteContent` in response

#### [MODIFY] [route.ts](file:///c:/Users/putdf/Desktop/studyai/src/app/api/upload-pdf/route.ts) (upload-pdf)
- Same changes — handle `mode: 'remnote'` alongside mcq/flashcard

---

### 5. Frontend UI

#### [MODIFY] [page.tsx](file:///c:/Users/putdf/Desktop/studyai/src/app/page.tsx)
- Add `remnoteContent` state variable
- Add "RemNote" option to the mode toggle group (third button)
- On generate, if mode is `remnote`, store the returned markdown
- In results tab, when mode is `remnote`, show the markdown rendered with `ReactMarkdown` plus a **"Copy to Clipboard"** button
- Wire up the PDF upload path too

---

## User Review Required

> [!IMPORTANT]
> The RemNote output is **raw markdown** (not structured JSON like MCQs/flashcards). It won't have practice mode support — it's view-and-copy only. This matches the request for "a md formatted file that can be copied."

> [!NOTE]  
> The DB migration requires `npx prisma db push`. This will add a nullable column — no data loss.

## Verification Plan

### Automated Tests
- `npx prisma db push` succeeds
- `npm run dev` compiles without errors

### Manual Verification
- Select "RemNote" mode in UI, enter text, generate → should show formatted markdown with copy button
- PDF upload with RemNote mode → same result
- Library documents with mode `remnote` load correctly
