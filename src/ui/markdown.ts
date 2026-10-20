// Minimal, safe Markdown for lore entries: headings, paragraphs, lists,
// **bold**, *italic* and `code`. All HTML in the source is escaped.

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s: string) =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

export function renderMarkdown(src: string): string {
  return src
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const h = block.match(/^(#{1,3})\s+(.*)$/);
      if (h) return `<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`;
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}
