import SupportContent from '/docs/support.mdx';
import { HelpCircle } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 grid-overlay">
      <div className="max-w-2xl mx-auto gap-5 w-full flex-1 flex flex-col">
        <div>
          <h1 className="font-display font-bold text-xl tracking-wide text-primary flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5" />
            Hỗ trợ & Xử lý sự cố
          </h1>
        </div>
        <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
          <div className="p-4 prose prose-invert prose-sm max-w-none">
            <SupportContent />
          </div>
        </div>
      </div>
    </div>
  );
}
