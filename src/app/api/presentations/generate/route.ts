import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

interface GenerateRequest {
  missionId: string;
  title: string;
  content: string;
  template?: 'executive' | 'detailed' | 'minimal';
  author?: string;
  company?: string;
}

// Pre-process markdown to fix common formatting issues
function preprocessMarkdown(content: string): string {
  return content
    // Ensure tables have proper spacing
    .replace(/\|([^\n]*)\|/g, (match) => {
      // Add spaces around pipes for better parsing
      return match.replace(/\|([^|]+)\|/g, ' | $1 | ');
    })
    // Fix bold text - ensure ** is on word boundaries
    .replace(/\*\*([^*]+)\*\*/g, '**$1**')
    // Ensure headers have space after #
    .replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
    // Fix list items
    .replace(/^(\s*)[-*]([^\s])/gm, '$1- $2');
}

// Create a reference docx template for consistent styling
async function createReferenceDoc(template: string, outputPath: string): Promise<void> {
  const templateContent = {
    executive: `
---
title: "Executive Summary"
author: "Mission Control"
date: "${new Date().toISOString().split('T')[0]}"
---

<style>
h1 { font-size: 24pt; color: #005EB8; }
h2 { font-size: 18pt; color: #333333; border-bottom: 1px solid #005EB8; }
h3 { font-size: 14pt; color: #444444; }
strong { font-weight: bold; color: #000000; }
table { border-collapse: collapse; width: 100%; }
th { background-color: #005EB8; color: white; padding: 8px; font-weight: bold; }
td { border: 1px solid #ddd; padding: 8px; }
tr:nth-child(even) { background-color: #f9f9f9; }
</style>
`,
    detailed: `
---
title: "Detailed Analysis Report"
author: "Mission Control"
date: "${new Date().toISOString().split('T')[0]}"
---

<style>
h1 { font-size: 28pt; color: #005EB8; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 20pt; color: #333333; margin-top: 24pt; }
h3 { font-size: 16pt; color: #444444; margin-top: 18pt; }
strong { font-weight: bold; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
th { background-color: #005EB8; color: white; padding: 10px; font-weight: bold; border: 1px solid #004a93; }
td { border: 1px solid #ddd; padding: 10px; }
tr:nth-child(even) { background-color: #f5f5f5; }
ul, ol { margin: 12pt 0; }
li { margin: 6pt 0; }
</style>
`,
    minimal: `
<style>
h1 { font-size: 20pt; }
h2 { font-size: 16pt; }
h3 { font-size: 14pt; }
strong { font-weight: bold; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 6px; }
</style>
`
  };

  // Write a temporary markdown file that pandoc can use as reference
  const refMdPath = outputPath.replace('.docx', '-ref.md');
  fs.writeFileSync(refMdPath, templateContent[template as keyof typeof templateContent] || templateContent.detailed);
  
  // Convert to docx as reference document
  try {
    await execAsync(`pandoc "${refMdPath}" -o "${outputPath}" --reference-doc=/dev/null 2>/dev/null || echo ""`);
  } catch {
    // Reference doc creation is optional
  }
  
  // Clean up
  if (fs.existsSync(refMdPath)) {
    fs.unlinkSync(refMdPath);
  }
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();
    const { missionId, title, content, template = 'detailed', author, company } = body;

    if (!missionId || !title || !content) {
      return NextResponse.json(
        { error: 'missionId, title, and content are required' },
        { status: 400 }
      );
    }

    // Setup paths
    const missionsDir = process.env.MISSIONS_PATH || path.join(os.homedir(), '.openclaw', 'missions');
    const missionDir = path.join(missionsDir, missionId);
    const outputsDir = path.join(missionDir, 'presentations');
    
    // Create outputs directory
    fs.mkdirSync(outputsDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `Presentation_${safeTitle}_${timestamp}.docx`;
    const outputPath = path.join(outputsDir, filename);

    // Pre-process markdown
    const processedContent = preprocessMarkdown(content);

    // Create full markdown with metadata
    const fullMarkdown = `---
title: "${title}"
author: "${author || 'Mission Control'}"
company: "${company || ''}"
date: "${new Date().toLocaleDateString()}"
---

${processedContent}
`;

    // Write temporary markdown file
    const tempMdPath = path.join(os.tmpdir(), `presentation-${Date.now()}.md`);
    fs.writeFileSync(tempMdPath, fullMarkdown);

    // Create reference document for styling
    const refDocPath = path.join(os.tmpdir(), `reference-${Date.now()}.docx`);
    await createReferenceDoc(template, refDocPath);

    // Build pandoc command
    let pandocCmd = `pandoc "${tempMdPath}" -o "${outputPath}"`;
    
    // Add options based on template
    if (template === 'executive') {
      pandocCmd += ' --toc --toc-depth=2';
    } else if (template === 'detailed') {
      pandocCmd += ' --toc --toc-depth=3 --number-sections';
    }

    // Add table of contents for non-minimal templates
    if (template !== 'minimal') {
      pandocCmd += ' --reference-doc=/usr/share/pandoc/data/reference.docx 2>/dev/null || true';
    }

    try {
      await execAsync(pandocCmd);
    } catch (error) {
      console.warn('Pandoc command failed, trying fallback:', error);
      
      // Fallback: Try basic conversion
      try {
        await execAsync(`pandoc "${tempMdPath}" -o "${outputPath}"`);
      } catch (fallbackError) {
        // If pandoc is not available, create a simple HTML intermediary
        console.warn('Pandoc not available, trying HTML fallback');
        
        const tempHtmlPath = tempMdPath.replace('.md', '.html');
        await execAsync(`pandoc "${tempMdPath}" -o "${tempHtmlPath}" --standalone 2>/dev/null || echo "<html><body>${processedContent.replace(/\n/g, '<br>')}</body></html>" > "${tempHtmlPath}"`);
        
        // Try using libreoffice for conversion
        try {
          await execAsync(`cd "${outputsDir}" && libreoffice --headless --convert-to docx --outdir . "${tempHtmlPath}" 2>/dev/null`);
          const htmlFilename = path.basename(tempHtmlPath);
          const docxFromHtml = htmlFilename.replace('.html', '.docx');
          if (fs.existsSync(path.join(outputsDir, docxFromHtml))) {
            fs.renameSync(path.join(outputsDir, docxFromHtml), outputPath);
          }
        } catch {
          // Final fallback: Create markdown as docx (will need manual formatting)
          fs.copyFileSync(tempMdPath, outputPath.replace('.docx', '.md'));
          return NextResponse.json({
            success: true,
            warning: 'Word generation requires pandoc or libreoffice. Markdown version created.',
            filePath: outputPath.replace('.docx', '.md'),
            markdownContent: processedContent,
            downloadUrl: `/api/presentations/download?mission=${missionId}&file=${encodeURIComponent(filename.replace('.docx', '.md'))}`,
            fileSize: fs.statSync(outputPath.replace('.docx', '.md')).size
          });
        }
      }
    }

    // Clean up temp files
    try {
      fs.unlinkSync(tempMdPath);
      if (fs.existsSync(refDocPath)) fs.unlinkSync(refDocPath);
    } catch {
      // Ignore cleanup errors
    }

    // Get file stats
    const stats = fs.statSync(outputPath);

    return NextResponse.json({
      success: true,
      filePath: outputPath,
      downloadUrl: `/api/presentations/download?mission=${missionId}&file=${encodeURIComponent(filename)}`,
      fileSize: stats.size,
      filename
    });

  } catch (error) {
    console.error('Failed to generate presentation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate presentation' },
      { status: 500 }
    );
  }
}
