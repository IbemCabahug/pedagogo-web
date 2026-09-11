/**
 * Pedagogo Desk: In-Browser Document Parser 📄
 * 100% Client-side text extraction for PDF, DOCX, PPTX, TXT, and Images.
 * Grounded in spatial layout reconstruction for academic 2-column accuracy.
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
   * @returns {Promise<{ filename: string, fileType: string, mimeType: string, totalUnits: number, unitLabel: string, rawText: string, units: Array<{ unitNumber: number, title: string, text: string }>, base64Data?: string }>}
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
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return await this.parseImage(file, filename);
      default:
        throw new Error(`Unsupported file format (.${extension}). Please upload a .pdf, .docx, .pptx, .txt, or image document.`);
    }
  }

  /**
   * Extracts word-for-word text page-by-page from a PDF document with spatial layout reconstruction.
   */
  static async parsePdf(arrayBuffer, filename) {
    try {
      // 1. Base64 encoding for direct multimodal Gemini ingestion (if under 20MB)
      // Must be cloned/prepared before PDF.js transfers the buffer to its Web Worker
      let base64Data = null;
      try {
        if (arrayBuffer && arrayBuffer.byteLength > 0 && arrayBuffer.byteLength <= 20 * 1024 * 1024) {
          base64Data = this.arrayBufferToBase64(arrayBuffer.slice(0));
        }
      } catch (e) {
        console.warn('Could not prepare multimodal PDF base64:', e);
      }

      // 2. Clone arrayBuffer before passing to PDF.js worker to prevent detachment of the main buffer
      const pdfBytes = new Uint8Array(arrayBuffer.slice(0));
      const loadingTask = pdfjsLib.getDocument({
        data: pdfBytes,
        useSystemFonts: true
      });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const units = [];
      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // Spatially reconstruct columns, lines, and de-hyphenated words
        const pageText = this.extractPageTextSpatially(textContent.items, viewport);
        const trimmedPage = pageText.trim();

        units.push({
          unitNumber: i,
          title: `Page ${i}`,
          text: trimmedPage
        });

        fullText += `\n\n--- [Page ${i} of ${numPages}] ---\n\n` + trimmedPage;
      }

      const strippedContent = fullText.replace(/--- \[Page \d+ of \d+\] ---/g, '').trim();
      const hasSelectableText = strippedContent && strippedContent.length >= 10;

      if (!hasSelectableText && !base64Data) {
        throw new Error(`No readable digital text could be extracted from "${filename}". This PDF appears to be a scanned photocopy without selectable text. Please upload a PDF with selectable text, a Word (.docx) file, or plain text.`);
      }

      return {
        filename,
        fileType: 'PDF',
        mimeType: 'application/pdf',
        totalUnits: numPages,
        unitLabel: 'Pages',
        rawText: fullText.trim(),
        hasSelectableText: Boolean(hasSelectableText),
        units,
        base64Data
      };
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw err;
    }
  }

  /**
   * Spatially reconstructs lines and columns from raw PDF.js text items.
   * Accurately sorts 2-column layouts, joins wrapped hyphenated words, and filters running page headers.
   */
  static extractPageTextSpatially(items, viewport) {
    if (!items || items.length === 0) return '';

    const pageWidth = viewport?.width || 612;
    const pageHeight = viewport?.height || 792;

    // Filter valid items and attach geometry
    const validItems = items
      .filter(item => item.str !== undefined && item.str.trim().length > 0)
      .map(item => {
        const x = item.transform[4];
        const y = item.transform[5]; // PDF coordinate: 0 is bottom, pageHeight is top
        const width = item.width || 0;
        const height = item.height || Math.abs(item.transform[0]) || 12;
        return {
          str: this.cleanLigatures(item.str),
          x,
          y,
          width,
          height,
          right: x + width,
          top: y + height
        };
      });

    if (validItems.length === 0) return '';

    // Strip running header (< 35pt from top) and footer (< 35pt from bottom) if they look like metadata
    const contentItems = validItems.filter(item => {
      const isHeaderZone = item.y > (pageHeight - 35);
      const isFooterZone = item.y < 35;
      if (isHeaderZone || isFooterZone) {
        const str = item.str.trim();
        // Skip lone page numbers or running headers like "Page 12 of 45"
        if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(str)) return false;
      }
      return true;
    });

    const itemsToProcess = contentItems.length > 0 ? contentItems : validItems;

    // Detect 2-column layout: check if significant text exists on both sides of center
    const midMin = pageWidth * 0.42;
    const midMax = pageWidth * 0.58;
    let leftCount = 0;
    let rightCount = 0;

    for (const item of itemsToProcess) {
      if (item.right <= midMax && item.x < midMin) {
        leftCount++;
      } else if (item.x >= midMin && item.right > midMax) {
        rightCount++;
      }
    }

    const isTwoColumn = leftCount > 6 && rightCount > 6 && ((leftCount + rightCount) / itemsToProcess.length > 0.65);

    let columns = [];
    if (isTwoColumn) {
      const col1 = [];
      const col2 = [];
      for (const item of itemsToProcess) {
        if (item.x < (pageWidth * 0.5)) {
          col1.push(item);
        } else {
          col2.push(item);
        }
      }
      columns = [col1, col2];
    } else {
      columns = [itemsToProcess];
    }

    const columnTexts = columns.map(colItems => {
      // Group items into lines by Y coordinate
      // In PDF coordinates, higher Y is higher on page, so sort Y descending
      const sortedCol = [...colItems].sort((a, b) => b.y - a.y || a.x - b.x);

      const lines = [];
      let currentLine = [];
      let currentY = null;

      for (const item of sortedCol) {
        if (currentY === null || Math.abs(item.y - currentY) > 5) {
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = [item];
          currentY = item.y;
        } else {
          currentLine.push(item);
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      // Sort items within each line left-to-right
      const lineStrings = lines.map(lineItems => {
        lineItems.sort((a, b) => a.x - b.x);
        let lineStr = '';
        for (let i = 0; i < lineItems.length; i++) {
          const it = lineItems[i];
          if (i > 0) {
            const prev = lineItems[i - 1];
            if (it.x - prev.right > 2) {
              lineStr += ' ';
            }
          }
          lineStr += it.str;
        }
        return lineStr.trim();
      }).filter(Boolean);

      // De-hyphenate across lines
      const processedLines = [];
      for (let i = 0; i < lineStrings.length; i++) {
        let line = lineStrings[i];
        if (line.endsWith('-') && i + 1 < lineStrings.length) {
          const nextLine = lineStrings[i + 1];
          const nextFirstWord = nextLine.split(/\s+/)[0];
          // If next line starts with lowercase, join the split word
          if (/^[a-z]/.test(nextFirstWord)) {
            line = line.slice(0, -1) + nextFirstWord;
            lineStrings[i + 1] = nextLine.slice(nextFirstWord.length).trim();
          }
        }
        if (line) processedLines.push(line);
      }

      return processedLines.join('\n');
    });

    return columnTexts.filter(Boolean).join('\n\n');
  }

  /**
   * Normalizes Unicode typographic ligatures into plain characters
   */
  static cleanLigatures(text) {
    if (!text) return '';
    return text
      .replace(/\uFB00/g, 'ff')
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl')
      .replace(/\uFB03/g, 'ffi')
      .replace(/\uFB04/g, 'ffl')
      .replace(/\uFB05/g, 'ft')
      .replace(/\uFB06/g, 'st');
  }

  /**
   * Extracts structured headings, paragraphs, and tables from a Word (.docx) document.
   */
  static async parseDocx(arrayBuffer, filename) {
    try {
      // Mammoth HTML conversion preserves headings and tables
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) });
      const html = htmlResult.value || '';

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const units = [];
      let fullMarkdown = '';
      let currentSectionTitle = 'Overview';
      let currentSectionText = [];

      const flushSection = (newTitle) => {
        if (currentSectionText.length > 0) {
          const text = currentSectionText.join('\n\n').trim();
          if (text) {
            units.push({
              unitNumber: units.length + 1,
              title: currentSectionTitle,
              text
            });
            fullMarkdown += `\n\n### ${currentSectionTitle}\n\n` + text;
          }
          currentSectionText = [];
        }
        currentSectionTitle = newTitle || `Section ${units.length + 1}`;
      };

      const walker = doc.body.children;
      for (const node of walker) {
        const tagName = node.tagName.toLowerCase();
        if (/^h[1-4]$/.test(tagName)) {
          const headingText = node.textContent.trim();
          flushSection(headingText);
        } else if (tagName === 'p') {
          const pText = node.textContent.trim();
          if (pText) currentSectionText.push(pText);
        } else if (tagName === 'ul' || tagName === 'ol') {
          const lis = Array.from(node.querySelectorAll('li')).map(li => `• ${li.textContent.trim()}`);
          if (lis.length > 0) currentSectionText.push(lis.join('\n'));
        } else if (tagName === 'table') {
          const rows = Array.from(node.querySelectorAll('tr')).map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(td => td.textContent.trim().replace(/\|/g, '-'));
            return `| ${cells.join(' | ')} |`;
          });
          if (rows.length > 0) {
            const colCount = node.querySelector('tr')?.children.length || 2;
            const sep = '| ' + Array(colCount).fill(':---').join(' | ') + ' |';
            rows.splice(1, 0, sep);
            currentSectionText.push(rows.join('\n'));
          }
        }
      }
      flushSection();

      // If no sections were identified from HTML, fallback to raw text extraction
      if (units.length === 0) {
        const rawResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
        const rawText = rawResult.value.trim();
        const paragraphs = rawText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        paragraphs.forEach((para, idx) => {
          units.push({
            unitNumber: idx + 1,
            title: `Section ${idx + 1}`,
            text: para.trim()
          });
        });
        fullMarkdown = rawText;
      }

      return {
        filename,
        fileType: 'DOCX',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        totalUnits: units.length,
        unitLabel: 'Sections',
        rawText: fullMarkdown.trim(),
        units
      };
    } catch (err) {
      console.error('DOCX parsing error:', err);
      throw new Error(`Could not parse Word document: ${err.message}`);
    }
  }

  /**
   * Extracts slide bullet points, titles, and speaker notes from PowerPoint (.pptx).
   */
  static async parsePptx(arrayBuffer, filename) {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
      const parser = new DOMParser();

      const slideEntries = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
      if (slideEntries.length === 0) {
        throw new Error('No slide content found in this PowerPoint presentation.');
      }

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

        // Identify slide title vs body shapes
        let slideTitle = `Slide ${slideNum}`;
        const shapeElements = xmlDoc.getElementsByTagName('p:sp');
        const bodyLines = [];

        for (let s = 0; s < shapeElements.length; s++) {
          const sp = shapeElements[s];
          const isTitle = sp.querySelector('p\\:ph[type="title"], p\\:ph[type="ctrTitle"], ph[type="title"], ph[type="ctrTitle"]') !== null;
          const textNodes = sp.getElementsByTagName('a:t');
          let shapeText = '';
          for (let t = 0; t < textNodes.length; t++) {
            shapeText += textNodes[t].textContent + ' ';
          }
          shapeText = shapeText.trim();
          if (shapeText) {
            if (isTitle && slideTitle === `Slide ${slideNum}`) {
              slideTitle = shapeText;
            } else {
              bodyLines.push(shapeText);
            }
          }
        }

        // Speaker notes
        const notePath = slidePath.replace('slides/slide', 'notesSlides/notesSlide');
        let noteText = '';
        if (zip.files[notePath]) {
          const noteXml = await zip.files[notePath].async('string');
          const noteDoc = parser.parseFromString(noteXml, 'text/xml');
          const noteNodes = noteDoc.getElementsByTagName('a:t');
          for (let k = 0; k < noteNodes.length; k++) {
            const nTxt = noteNodes[k].textContent.trim();
            if (nTxt && !nTxt.match(/^\d+$/)) {
              noteText += nTxt + ' ';
            }
          }
        }

        let combined = `**${slideTitle}**\n` + (bodyLines.length > 0 ? bodyLines.map(b => `• ${b}`).join('\n') : '(Visual content / diagram slide)');
        if (noteText.trim()) {
          combined += `\n\n*[Speaker Note]*: ${noteText.trim()}`;
        }

        units.push({
          unitNumber: slideNum,
          title: slideTitle,
          text: combined
        });

        fullText += `\n\n--- [Slide ${slideNum}: ${slideTitle}] ---\n\n` + combined;
      }

      return {
        filename,
        fileType: 'PPTX',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
      mimeType: 'text/plain',
      totalUnits: units.length,
      unitLabel: 'Paragraphs',
      rawText: cleanText,
      units
    };
  }

  /**
   * Prepares image documents for direct multimodal AI processing.
   */
  static async parseImage(file, filename) {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = this.arrayBufferToBase64(arrayBuffer);
    const mimeType = file.type || (filename.endsWith('.png') ? 'image/png' : 'image/jpeg');

    return {
      filename,
      fileType: 'IMAGE',
      mimeType,
      base64Data,
      totalUnits: 1,
      unitLabel: 'Visual Sheet',
      rawText: `[Visual Educational Document: ${filename}]\nThis visual document has been prepared for high-fidelity multimodal pedagogical analysis.`,
      units: [
        {
          unitNumber: 1,
          title: filename,
          text: `[Visual Document: ${filename}]`
        }
      ]
    };
  }

  /**
   * Chunk-safe ArrayBuffer / Uint8Array to Base64 conversion that prevents browser call-stack overflow on large files.
   */
  static arrayBufferToBase64(buffer) {
    if (!buffer) return null;
    try {
      if (buffer.byteLength === 0) return null;
      let binary = '';
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    } catch (e) {
      console.warn('Could not encode buffer to base64:', e);
      return null;
    }
  }
}
