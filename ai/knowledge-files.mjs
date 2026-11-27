const archiveName = name => /\.(?:zip|docx|odt|pptx)$/i.test(name);
const textName = name => /\.(?:txt|text|md|markdown|csv|tsv|jsonl?|log|xml|ya?ml|ini|toml|js|mjs|ts|tsx|jsx|py|css|html?|sh|env|sql|rs|go|java|kt|swift|c|cpp|h|cs|php|rb)$/i.test(name);
const archiveBudget = 500 * 1024 * 1024;
export {archiveName};

function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { return new TextDecoder('euc-kr').decode(bytes); }
}

function officeText(bytes, type) {
  const xml = new DOMParser().parseFromString(decodeText(bytes),'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw Error('문서 XML을 읽지 못했습니다.');
  return Array.from(xml.getElementsByTagNameNS('*','p'), p => type === 'odt' ? p.textContent :
    Array.from(p.getElementsByTagNameNS('*','t'),t => t.textContent).join('')).join('\n');
}

export async function readArchive(blob, name) {
  await import('../vendor/jszip/jszip.min.js');
  const documents = [], stack = [{name,bytes:await blob.arrayBuffer(),archived:false}];
  let expanded = 0;
  while (stack.length) {
    const item = stack.pop();
    const zip = await globalThis.JSZip.loadAsync(item.bytes,{decodeFileName:decodeText});
    const office = item.name.match(/\.(docx|odt|pptx)$/i)?.[1].toLowerCase();
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const path = item.name+'/'+entry.name;
      const page = office && (office === 'docx' ? /^word\/(?:document|footnotes|endnotes)\.xml$/ :
        office === 'odt' ? /^content\.xml$/ : /^ppt\/slides\/slide\d+\.xml$/).test(entry.name);
      if (office ? !page : !textName(entry.name) && !archiveName(entry.name)) continue;
      const size = entry._data?.uncompressedSize ?? 0;
      if (expanded + size > archiveBudget) throw Error('압축을 푼 자료가 전용 폴더의 500MB 저장 용량을 넘습니다.');
      const bytes = await entry.async('uint8array');
      expanded += bytes.byteLength;
      if (expanded > archiveBudget) throw Error('압축을 푼 자료가 전용 폴더의 500MB 저장 용량을 넘습니다.');
      if (!office && archiveName(entry.name)) stack.push({name:path,bytes,archived:true});
      else {
        const text = page ? officeText(bytes,office) : decodeText(bytes);
        if (text.trim()) documents.push({name:page ? item.name : path,text,archived:!office || item.archived});
      }
    }
  }
  return documents;
}
