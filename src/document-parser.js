/**
 * Pedagogo Desk: In-Browser Document Parser 📄
 * 100% Client-side text extraction for PDF, DOCX, PPTX, and TXT files.
 * Zero server cost, zero upload latency, 100% student privacy.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker via Vite's bundled worker URL
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export class DocumentParser {
  /**
   * Parse an uploaded File object and return structured verbatim text.
   * @param {File} file 
   * @returns {Promise<{ filename: string, fileType: string, totalUnits: number, unitLabel: string, rawText: string, units: Array<{ unitNumber: number, text: string }> }>}
   */
  static async parseFile(file) {
    const filename = file.name;
    const extension = filename.split('.').pop().toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    switch (extension) {
      case 'pdf':
        return await this.parsePdf(arrayBuffer, filename);
      case 'docx':
        return await this.parseDocx(arrayBuffer, filename);
      case 'pptx':
        return await this.parsePptx(arrayBuffer, filename);
      case 'txt':
      case 'md':
        return await this.parsePlainText(file, filename);
      default:
        throw new Error(`Unsupported file format (.${extension}). Please upload a .pdf, .docx, .pptx, or .txt document.`);
    }
  }

  /**
   * Extracts word-for-word text page-by-page from a PDF document.
   */
  static async parsePdf(arrayBuffer, filename) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true
      });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const units = [];
      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Accumulate text items preserving word spaces and line breaks
        let lastY;
        let pageText = '';
        for (const item of textContent.items) {
          if (item.str === undefined) continue;
          if (lastY !== undefined && Math.abs(item.transform[5] - lastY) > 8) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith(' ') && !item.str.startsWith(' ')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }

        const trimmedPage = pageText.trim();
        units.push({
          unitNumber: i,
          title: `Page ${i}`,
          text: trimmedPage
        });

        fullText += `\n\n--- [Page ${i} of ${numPages}] ---\n\n` + trimmedPage;
      }

      return {
        filename,
        fileType: 'PDF',
        totalUnits: numPages,
        unitLabel: 'Pages',
        rawText: fullText.trim(),
        units
      };
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error(`Could not parse PDF: ${err.message}`);
    }
  }

  /**
   * Extracts raw paragraphs and headings word-for-word from a Word (.docx) document.
   */
  static async parseDocx(arrayBuffer, filename) {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      const rawText = result.value.trim();

      // Chunk into logical sections or paragraphs
      const paragraphs = rawText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const units = paragraphs.map((para, idx) => ({
        unitNumber: idx + 1,
        title: `Section ${idx + 1}`,
        text: para.trim()
      }));

      return {
        filename,
        fileType: 'DOCX',
        totalUnits: units.length,
        unitLabel: 'Sections',
        rawText: rawText,
        units
      };
    } catch (err) {
      console.error('DOCX parsing error:', err);
      throw new Error(`Could not parse Word document: ${err.message}`);
    }
  }

  /**
   * Extracts slide bullet points and instructor speaker notes from a PowerPoint (.pptx) presentation.
   */
  static async parsePptx(arrayBuffer, filename) {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const parser = new DOMParser();

      // Find all slide XML files inside ppt/slides/
      const slideEntries = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
      
      if (slideEntries.length === 0) {
        throw new Error('No slide content found in this PowerPoint presentation.');
      }

      // Sort slides numerically (slide1.xml, slide2.xml, ..., slide10.xml)
      slideEntries.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)[1], 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)[1], 10);
        return numA - numB;
      });

      const units = [];
      let fullText = '';

      for (let i = 0; i < slideEntries.length; i++) {
        const slidePath = slideEntries[i];
        const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/i)[1], 10);
        const xmlString = await zip.files[slidePath].async('string');
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Text elements in PowerPoint DrawingML are <a:t>
        const textElements = xmlDoc.getElementsByTagName('a:t');
        let slideBody = '';
        for (let j = 0; j < textElements.length; j++) {
          const text = textElements[j].textContent.trim();
          if (text) {
            slideBody += text + ' ';
          }
        }

        // Check for presenter notes in ppt/notesSlides/notesSlide{n}.xml
        const notePath = slidePath.replace('slides/slide', 'notesSlides/notesSlide');
        let noteText = '';
        if (zip.files[notePath]) {
          const noteXml = await zip.files[notePath].async('string');
          const noteDoc = parser.parseFromString(noteXml, 'text/xml');
          const noteNodes = noteDoc.getElementsByTagName('a:t');
          for (let k = 0; k < noteNodes.length; k++) {
            const nTxt = noteNodes[k].textContent.trim();
            if (nTxt && !nTxt.match(/^\d+$/)) { // filter out slide number marker
              noteText += nTxt + ' ';
            }
          }
        }

        let combinedSlide = slideBody.trim();
        if (noteText.trim()) {
          combinedSlide += `\n[Speaker Note]: ${noteText.trim()}`;
        }

        units.push({
          unitNumber: slideNum,
          title: `Slide ${slideNum}`,
          text: combinedSlide
        });

        fullText += `\n\n--- [Slide ${slideNum} of ${slideEntries.length}] ---\n\n` + combinedSlide;
      }

      return {
        filename,
        fileType: 'PPTX',
        totalUnits: units.length,
        unitLabel: 'Slides',
        rawText: fullText.trim(),
        units
      };
    } catch (err) {
      console.error('PPTX parsing error:', err);
      throw new Error(`Could not parse PowerPoint presentation: ${err.message}`);
    }
  }

  /**
   * Extracts text from plain text or markdown files.
   */
  static async parsePlainText(file, filename) {
    const text = await file.text();
    const cleanText = text.trim();
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const units = paragraphs.map((para, idx) => ({
      unitNumber: idx + 1,
      title: `Paragraph ${idx + 1}`,
      text: para.trim()
    }));

    return {
      filename,
      fileType: filename.endsWith('.md') ? 'MARKDOWN' : 'TXT',
      totalUnits: units.length,
      unitLabel: 'Paragraphs',
      rawText: cleanText,
      units
    };
  }
}
