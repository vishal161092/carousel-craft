/**
 * WhatsApp-style text formatting for the Aster chat — port of page.tsx formatWhatsApp().
 * Escapes HTML, linkifies http(s) URLs, then renders *bold* _italic_ ~strike~ (markers must
 * hug non-space), and converts newlines to <br>. Returns an HTML string injected via
 * lwc:dom="manual" (we escape first, so this is safe).
 */
function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatWhatsApp(text) {
  let s = escapeHtml(text);

  // Linkify first so inline markers never land inside a URL.
  s = s.replace(
    /(https?:\/\/[^\s<]+)/g,
    (m) =>
      `<a href="${m}" target="_blank" rel="noopener noreferrer" class="aster-link" style="color:#027eb5;text-decoration:underline;word-break:break-all;">${m}</a>`
  );

  // *bold* / _italic_ / ~strike~ — the marker must hug a non-space character.
  s = s.replace(/\*(\S(?:[^*]*\S)?)\*/g, "<b>$1</b>");
  s = s.replace(/_(\S(?:[^_]*\S)?)_/g, "<i>$1</i>");
  s = s.replace(/~(\S(?:[^~]*\S)?)~/g, "<s>$1</s>");

  // Newlines -> <br>.
  s = s.replace(/\n/g, "<br>");
  return s;
}
