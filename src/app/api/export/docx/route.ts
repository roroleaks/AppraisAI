import { NextRequest, NextResponse } from 'next/server';
import { Packer } from 'docx';
import { buildAcademicDocxManuscript, AppraiserMetadata } from '@/lib/docx/docx-builder';
import { MasterAppraisalReport } from '@/lib/schemas/appraisal.schema';

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

    // Sanitize filename: Author_Year_Critical_Appraisal.docx
    const firstAuthor =
      report.metadata.authors?.[0]?.replace(/[^a-zA-Z0-9]/g, '_') || 'Article';
    const year = report.metadata.publicationYear || new Date().getFullYear();
    const filename = `Critical_Appraisal_${firstAuthor}_${year}.docx`;

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
