import { NextRequest, NextResponse } from 'next/server';
import { extractBiomedicalPdf } from '@/lib/parsers/pdf-extractor';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB max upload (P5-2)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 25MB.` },
        { status: 413 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Convert file to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Verify %PDF- magic bytes (0x25, 0x50, 0x44, 0x46, 0x2D) (P5-2)
    if (
      uint8Array.length < 5 ||
      uint8Array[0] !== 0x25 ||
      uint8Array[1] !== 0x50 ||
      uint8Array[2] !== 0x44 ||
      uint8Array[3] !== 0x46 ||
      uint8Array[4] !== 0x2d
    ) {
      return NextResponse.json(
        { error: 'Invalid file format: uploaded file does not contain valid PDF magic bytes (%PDF-).' },
        { status: 422 }
      );
    }

    // Layout-aware PDF extraction
    const extracted = await extractBiomedicalPdf(uint8Array);

    const payload: ParsedManuscriptPayload = {
      id: crypto.randomUUID(),
      metadata: {
        title: extracted.metadata.title,
        authors: extracted.metadata.authors,
        journal: extracted.metadata.journal || 'Biomedical Journal',
        publicationYear: extracted.metadata.year || new Date().getFullYear(),
        doi: extracted.metadata.doi,
        vancouverCitation: extracted.metadata.vancouverCitation,
        sourceDepth: extracted.metadata.sourceDepth,
        openAccess: true,
      },
      abstract: extracted.abstract,
      fullText: extracted.text,
      sections: extracted.sections,
      tablesRaw: [],
      pageCount: extracted.pageCount,
      contentAvailable: true,
      extractedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('Error in PDF upload route:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to parse uploaded PDF manuscript' },
      { status: 500 }
    );
  }
}
