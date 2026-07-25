import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const IMG_EXT = /\.(png|jpe?g|webp|gif)(\?|$)/i;
const PDF_EXT = /\.pdf(\?|$)/i;

const PDF_VIEWER_BASE = '/pdf-viewer/web/viewer.html';

// ── Full pdf.js viewer in iframe ─────────────────────────────────────
function PdfViewer({ url }) {
  const src = `${PDF_VIEWER_BASE}?file=${encodeURIComponent(url)}&zoom=page-width`;
  return (
    <iframe
      src={src}
      title="CV Viewer"
      className="w-full h-full border-0"
      style={{ background: '#525659' }}
    />
  );
}

// ── Image viewer with pan & zoom ──────────────────────────────────────
function ImagePage({ url }) {
  return (
    <TransformWrapper minScale={0.5} maxScale={5} initialScale={1} centerOnInit wheel={{ step: 0.1 }}>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div className="flex items-center gap-1 py-1.5 px-4 border-b border-primary/10 shrink-0">
            <button onClick={() => zoomOut()} className="p-1 rounded hover:bg-muted/50 transition-colors" title="Thu nhỏ">
              <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => zoomIn()} className="p-1 rounded hover:bg-muted/50 transition-colors" title="Phóng to">
              <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => resetTransform()} className="p-1 rounded hover:bg-muted/50 transition-colors" title="Đặt lại">
              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <TransformComponent>
            <img src={url} alt="CV" className="max-w-none" />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────
export default function CvViewer({ url, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!url) return null;

  const isImage = IMG_EXT.test(url.split('?')[0]);
  const isPdf = PDF_EXT.test(url.split('?')[0]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="relative bg-card border border-primary/20 rounded-xl overflow-hidden w-full max-w-5xl mx-4 shadow-2xl flex flex-col"
        style={{ height: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 shrink-0">
          <h3 className="font-display text-sm font-semibold text-primary">Xem CV</h3>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Tải xuống"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isPdf ? (
            <PdfViewer url={url} />
          ) : isImage ? (
            <ImagePage url={url} />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Không thể xem trực tiếp loại tệp này. Nhấn Tải xuống để lưu về máy.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
