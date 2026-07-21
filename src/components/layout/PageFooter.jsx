// Shared page footer: four logos + copyright line.
// Used across all authenticated pages (except Messages, which is a full-height chat layout).
// `mt-auto` pushes the footer to the bottom of the page when the parent is a flex column.
export default function PageFooter({ compact }) {
    return (
        <footer className={`flex flex-col items-center text-center ${compact ? 'gap-1.5 pt-4 pb-2' : 'gap-2 pt-6 pb-4'}`}>
            <div className={`flex items-center justify-center opacity-70 ${compact ? 'gap-2.5' : 'gap-3'}`}>
                <img src="/ftu.webp" alt="FTU" className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} object-contain`} />
                <img src="/fyu.svg" alt="Đoàn" className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} object-contain`} />
                <img src="/cte-logo.svg" alt="CTE FTU" className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} object-contain`} />
                <img src="/dstc-key.webp" alt="DSTC" className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} object-contain`} />
            </div>
            <p className={`font-body text-muted-foreground/80 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
                Bản quyền © 2026 CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh. Bảo lưu mọi quyền.
            </p>
        </footer>
    );
}
