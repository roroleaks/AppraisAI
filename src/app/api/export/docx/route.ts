import { NextRequest, NextResponse } from 'next/server';
import { Packer } from 'docx';
import { buildAcademicDocxManuscript, AppraiserMetadata } from '@/lib/docx/docx-builder';
import { MasterAppraisalReport } from '@/lib/schemas/appraisal.schema';
import { getCleanDownloadFilename } from '@/lib/parsers/title-sanitizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report: MasterAppraisalReport = body?.report;
    const appraiserMeta: AppraiserMetadata | undefined = body?.appraiserMeta;

    if (!report || !report.metadata || !report.metadata.title) {
      return NextResponse.json(
        { error: 'Invalid or missing appraisal report payload' },
        { status: 400 }
      );
    }

    // Build the docx document using our academic builder
    const doc = buildAcademicDocxManuscript(report, appraiserMeta);

    // Pack into a Node buffer
    const buffer = await Packer.toBuffer(doc);

    // Clean, academic filename: e.g. Critical_Appraisal_Roshdy_2026.docx
    const filename = getCleanDownloadFilename(
      report.metadata.authors,
      report.metadata.publicationYear
    );

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Error generating .docx manuscript:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate publication .docx file' },
      { status: 500 }
    );
  }
}
