// Shared page footer: four logos + copyright line.
// Used across all authenticated pages (except Messages, which is a full-height chat layout).
// `mt-auto` pushes the footer to the bottom of the page when the parent is a flex column.
export default function PageFooter() {
    return (
        <footer className="flex flex-col items-center text-center gap-2 pt-6 pb-4 mt-auto">
            <div className="flex items-center justify-center gap-3 opacity-70">
                <img src="/ftu.webp" alt="FTU" className="w-8 h-8 object-contain" />
                <img src="/fyu.svg" alt="Đoàn" className="w-8 h-8 object-contain" />
                <img src="/cte-logo.svg" alt="CTE FTU" className="w-7 h-7 object-contain" />
                <img src="/dstc-key.webp" alt="DSTC" className="w-8 h-8 object-contain" />
            </div>
            <p className="font-body text-[12px] text-muted-foreground/80">
                Bản quyền © 2026 CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh. Bảo lưu mọi quyền.
            </p>
        </footer>
    );
}
