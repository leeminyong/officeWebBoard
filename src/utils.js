export function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export function isImage(name) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)
}

export function downloadFromUrl(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}
