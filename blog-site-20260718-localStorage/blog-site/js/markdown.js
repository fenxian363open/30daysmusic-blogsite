/* ===================== Markdown 渲染器 ===================== */
const Markdown = (() => {
  function render(md) {
    if (!md) return '';
    let html = md;

    // 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 粗体和斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 图片（必须先于链接处理，否则 ![alt](url) 会被链接正则先匹配成 !<a>）
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 引用
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // 分割线
    html = html.replace(/^---$/gm, '<hr />');

    // 有序列表
    html = html.replace(/^(\d+)\. (.+)$/gm, '<ol-item>$1. $2</ol-item>');
    // 无序列表
    html = html.replace(/^[-*] (.+)$/gm, '<ul-item>$1</ul-item>');

    // 段落 - 先处理连续的列表项
    html = groupListItems(html, 'ul-item', 'ul');
    html = groupListItems(html, 'ol-item', 'ol');

    // 普通段落
    html = html.replace(/^(?!<)(.+)$/gm, '<p>$1</p>');

    // 清理空段落
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br\/?><\/p>/g, '');

    return html;
  }

  function groupListItems(html, itemName, listType) {
    const items = [];
    let buffer = '';
    const regex = new RegExp(`(<${itemName}>)(.+?)(<\\/${itemName}>)`, 'g');

    // 简单分组：将连续的列表项包装到列表中
    let result = html;
    let inList = false;
    const lines = result.split('\n');
    let output = [];
    let currentItems = [];

    for (const line of lines) {
      if (line.includes(`<${itemName}>`)) {
        if (!inList) {
          inList = true;
          output.push(`<${listType}>`);
        }
        const content = line.replace(`<${itemName}>`, '').replace(`</${itemName}>`, '');
        output.push(`<li>${content}</li>`);
        currentItems.push(line);
      } else if (inList && line.trim() === '') {
        output.push(`</${listType}>`);
        inList = false;
        currentItems = [];
      } else {
        if (inList) {
          output.push(`</${listType}>`);
          inList = false;
          currentItems = [];
        }
        output.push(line);
      }
    }

    if (inList) {
      output.push(`</${listType}>`);
    }

    return output.join('\n');
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  return { render };
})();
