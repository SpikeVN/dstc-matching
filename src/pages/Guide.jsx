import React from 'react';
import GuideContent from '/docs/guide.mdx';

export default function Guide() {
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-3xl mx-auto gap-4 w-full flex-1 flex flex-col">
        <div className="flex items-center justify-center gap-3">
          <img src="/ftu.webp" alt="FTU" className="w-12 h-12 object-contain" />
          <img src="/fyu.svg" alt="Đoàn" className="w-12 h-12 object-contain" />
          <img src="/cte-logo.svg" alt="CTE FTU" className="w-10 h-10 object-contain" />
          <img src="/dstc-key.webp" alt="DSTC" className="w-12 h-12 object-contain" />
        </div>

        <div className="prose prose-invert prose-sm max-w-none">
          <GuideContent />
        </div>
      </div>
    </div>
  );
}
