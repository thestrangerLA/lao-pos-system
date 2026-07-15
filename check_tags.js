import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

// Standard HTML tags that are self-closing in React / JSX
const selfClosingTags = new Set([
  'img', 'input', 'br', 'hr', 'link', 'meta', 'area', 'base', 'col', 'embed', 'keygen', 'param', 'source', 'track', 'wbr'
]);

let stack = [];

function parse() {
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNum = idx + 1;
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('{/*')) continue;
    
    // Find all tag openings and closings using a custom scanner
    let i = 0;
    while (i < line.length) {
      if (line[i] === '<') {
        // Is it a comment?
        if (line.slice(i, i + 4) === '<!--') {
          i = line.indexOf('-->', i);
          if (i === -1) break;
          i += 3;
          continue;
        }
        
    // Is it a closing tag?
    if (line[i + 1] === '/') {
      const end = line.indexOf('>', i);
      if (end === -1) break;
      const tagName = line.slice(i + 2, end).trim();
      
      const parsedTagName = tagName === '' ? '<>' : tagName;
      
      if (stack.length > 0) {
        const last = stack.pop();
        if (last.tag !== parsedTagName) {
          console.log(`[Line ${lineNum}] ERROR: Closing </${tagName}> does not match opening <${last.tag}> from line ${last.line}`);
          stack.push(last);
        }
      } else {
        console.log(`[Line ${lineNum}] ERROR: Dangling closing </${tagName}>`);
      }
      i = end + 1;
      continue;
    }
        
        // Is it an opening tag or fragment?
        const nextChar = line[i + 1];
        if (nextChar === '>') {
          // Fragment open <>
          stack.push({ tag: '<>', line: lineNum });
          i += 2;
          continue;
        }
        
        if (/[a-zA-Z0-9.-]/.test(nextChar)) {
          // Find tag name
          let endName = i + 1;
          while (endName < line.length && /[a-zA-Z0-9.-]/.test(line[endName])) {
            endName++;
          }
          const tagName = line.slice(i + 1, endName);
          
          // Find tag end '>'
          const endTag = line.indexOf('>', i);
          if (endTag === -1) break;
          
          // Is it self-closing?
          const isSelfClosing = line[endTag - 1] === '/' || selfClosingTags.has(tagName.toLowerCase());
          
          if (!isSelfClosing) {
            stack.push({ tag: tagName, line: lineNum });
          }
          i = endTag + 1;
          continue;
        }
      }
      i++;
    }
  }
  
  if (stack.length > 0) {
    console.log("Unclosed tags remaining:", stack);
  } else {
    console.log("All tags balanced perfectly according to the scanner!");
  }
}

parse();
