import { db } from '@/api/base44Client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Star, LogIn, UserPlus, Search, HeartHandshake, AlertTriangle, Lightbulb, Building2, Handshake, Code2, Palette, Database } from 'lucide-react';
import PageFooter from '@/components/layout/PageFooter';

const STEPS = [
  {
    icon: LogIn,
    title: 'Đăng nhập',
    desc: 'Đăng nhập bằng tài khoản đã được cấp quyền sử dụng. Sau khi đăng nhập thành công, bạn sẽ được chuyển đến trang hồ sơ cá nhân.',
    color: 'text-blue-300',
  },
  {
    icon: UserPlus,
    title: 'Hoàn thiện hồ sơ',
    desc: 'Hồ sơ càng đầy đủ thì khả năng tìm được đồng đội phù hợp càng cao. Cập nhật ảnh đại diện, họ tên, trường học, chuyên ngành, kỹ năng, ngôn ngữ lập trình, kinh nghiệm Quant/Data Science, thành tích, mục tiêu và thời gian làm việc. Sau khi hoàn tất, nhấn Lưu thông tin.',
    color: 'text-primary',
  },
  {
    icon: Search,
    title: 'Khám phá hồ sơ thí sinh',
    desc: 'Trong mục Find Teammates, bạn có thể xem hồ sơ các thí sinh khác: trường học, kỹ năng, kinh nghiệm, giới thiệu, công nghệ sử dụng, mục tiêu. Dùng bộ lọc để tìm theo trường, kỹ năng, kinh nghiệm, công nghệ, mục tiêu.',
    color: 'text-purple-300',
  },
  {
    icon: HeartHandshake,
    title: 'Gửi lời mời kết nối',
    desc: 'Khi tìm được người phù hợp, nhấn Connect hoặc Send Invitation. Người nhận sẽ nhận được lời mời. Khi cả hai đồng ý, hai bạn có thể trao đổi để chuẩn bị cho Giai đoạn 2 của cuộc thi.',
    color: 'text-pink-400',
  },
];

const TIPS = [
  'Kỹ năng bổ trợ cho bản thân (ví dụ: Python, Machine Learning, Statistics, Finance).',
  'Mục tiêu thi đấu tương đồng.',
  'Khả năng trao đổi thường xuyên.',
  'Khung thời gian làm việc phù hợp.',
  'Tinh thần hợp tác và chủ động.',
];

const FAQ = [
  {
    q: '1. Website có tự động ghép đội không?',
    a: 'Hiện tại website hỗ trợ kết nối giữa các thí sinh. Việc xác nhận đội sẽ được thực hiện theo quy định của Ban Tổ chức.',
  },
  {
    q: '2. Tôi có thể đổi thông tin hồ sơ không?',
    a: 'Có. Bạn có thể cập nhật hồ sơ bất cứ lúc nào trước khi quá trình ghép đội kết thúc.',
  },
  {
    q: '3. Tôi không nhìn thấy hồ sơ của người khác.',
    a: 'Nguyên nhân có thể là: website đang bảo trì, kết nối mạng không ổn định, hệ thống đang cập nhật dữ liệu, hoặc lỗi tạm thời của hệ thống. Hãy thử tải lại trang hoặc đăng nhập lại.',
  },
  {
    q: '4. Tôi gửi lời mời nhưng chưa có phản hồi.',
    a: 'Lời mời sẽ được xử lý khi người nhận đăng nhập và xem thông báo. Bạn chỉ cần chờ người nhận phản hồi.',
  },
  {
    q: '5. Tôi có thể tham gia nhiều đội cùng lúc không?',
    a: 'Không. Theo quy định của cuộc thi, mỗi đội gồm 02 thành viên, và thí sinh chỉ được tham gia 01 đội trong Giai đoạn 2.',
  },
  {
    q: '6. Nếu chưa tìm được đồng đội thì sao?',
    a: 'Bạn vẫn nên hoàn thiện hồ sơ và thường xuyên truy cập website để tìm kiếm các thí sinh khác. Trong trường hợp cần thiết, Ban Tổ chức sẽ xử lý việc ghép đội hoặc các trường hợp đội thiếu thành viên theo quy định của cuộc thi.',
  },
  {
    q: '7. Tôi gặp lỗi kỹ thuật thì phải làm gì?',
    a: 'Chụp màn hình lỗi (nếu có), ghi rõ thời gian xảy ra lỗi, mô tả các bước dẫn đến lỗi, và gửi phản hồi tới Ban Tổ chức qua các kênh hỗ trợ chính thức.',
  },
  {
    q: '8. Website có lưu thông tin cá nhân của tôi không?',
    a: 'Thông tin cá nhân được sử dụng phục vụ việc tổ chức cuộc thi và được Ban Tổ chức cam kết bảo mật theo quy định của thể lệ cuộc thi.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="font-body text-sm text-foreground">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-primary/60 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-primary/60 flex-shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.1, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 font-body text-xs text-muted-foreground leading-relaxed border-t border-primary/8 pt-3 whitespace-pre-wrap">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
        {/* Hero */}
        <div className="text-center space-y-3 pt-2">
          <p className="font-display text-sm text-primary/80">
            Data Science Talent Competition 2026&ensp;<span className="text-gray-700">//</span>&ensp;Vietnam Quant Challenge
          </p>
          <h1 className="font-display font-bold text-2xl text-primary leading-snug">
            HƯỚNG DẪN SỬ DỤNG WEBSITE MATCHING TEAMMATE
          </h1>
          <p className="font-body text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Chào mừng bạn đến với nền tảng <strong className="text-foreground">Matching Teammate</strong> do CTE FTU phát triển dành riêng cho Data Science Talent Competition - Vietnam Quant Challenge 2026.
          </p>
          <p className="font-body text-xs text-muted-foreground/70 max-w-md mx-auto leading-relaxed">
            Website giúp các thí sinh vượt qua Vòng 1 tìm kiếm và kết nối với đồng đội phù hợp để tham gia Giai đoạn 2 của cuộc thi, nơi các đội gồm 02 thành viên sẽ cùng phát triển chiến lược định lượng. Theo thể lệ cuộc thi, việc ghép đội sẽ được thực hiện thông qua nền tảng ghép đội của CTE FTU.
          </p>
        </div>

        {/* Section 1: Cách sử dụng */}
        <div>
          <h2 className="font-display font-bold text-base text-foreground mb-1">1. Cách sử dụng</h2>
          <div className="space-y-3 mt-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="glass-card rounded-xl border border-primary/10 p-4 flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 ${step.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-display text-[10px] text-muted-foreground/50">Bước {i + 1}</span>
                    </div>
                    <p className="font-display font-semibold text-sm text-foreground">{step.title}</p>
                    <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Cách tìm đồng đội */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-base text-foreground">2. Cách tìm đồng đội</h2>

          {/* Lưu ý quan trọng */}
          <div className="glass-card rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <p className="font-display text-sm font-bold text-yellow-300">Lưu ý quan trọng</p>
            </div>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Hiện tại tính năng Matching Teammate vẫn đang trong quá trình hoàn thiện và có thể phát sinh một số lỗi.
            </p>
            <div className="space-y-1 font-body text-xs text-muted-foreground leading-relaxed pl-4 list-disc">
              <li>Không hiển thị đầy đủ danh sách thí sinh.</li>
              <li>Hồ sơ tải chậm.</li>
              <li>Không gửi được lời mời kết nối.</li>
              <li>Kết quả tìm kiếm chưa chính xác.</li>
              <li>Một số bộ lọc hoạt động chưa ổn định.</li>
            </div>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mt-2">
              Nếu gặp các lỗi trên, bạn có thể:
            </p>
            <div className="space-y-1 font-body text-xs text-muted-foreground leading-relaxed pl-4 list-disc">
              <li>Tải lại trang (Refresh).</li>
              <li>Đăng xuất và đăng nhập lại.</li>
              <li>Thử lại sau vài phút.</li>
              <li>Xóa cache trình duyệt nếu cần.</li>
            </div>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mt-2">
              Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ Ban Tổ chức.
            </p>
          </div>

          {/* Mẹo */}
          <div className="glass-card rounded-xl border border-primary/10 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="font-display text-sm font-semibold text-primary">Mẹo để tìm được đồng đội phù hợp</p>
            </div>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Bạn nên ưu tiên những người có:
            </p>
            <div className="space-y-2">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex gap-2 font-body text-xs text-muted-foreground leading-relaxed">
                  <span className="text-primary">→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mt-2">
              Một đội cân bằng thường hiệu quả hơn hai người có kỹ năng giống hệt nhau.
            </p>
          </div>
        </div>

        {/* Section 3: FAQ */}
        <div>
          <h2 className="font-display font-bold text-base text-foreground mb-4">3. FAQ (Câu hỏi thường gặp)</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>

        {/* Closing */}
        <div className="glass-card rounded-xl border border-primary/20 p-5 text-center">
          <p className="font-body text-sm text-foreground leading-relaxed">
            Chúc bạn sớm tìm được đồng đội phù hợp và có một mùa Data Science Talent Competition - Vietnam Quant Challenge 2026 thật thành công!
          </p>
        </div>

        {/* Credits */}
        <div>
          <h2 className="font-display font-bold text-base text-foreground mb-4">Credits</h2>
          <div className="space-y-4">
            {/* Đơn vị tổ chức */}
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <p className="font-display text-sm font-semibold text-primary">Đơn vị tổ chức</p>
              </div>
              <div className="p-4 space-y-2 font-body text-sm text-foreground">
                <p>Câu lạc bộ Khoa học Công nghệ trong Kinh tế và Kinh doanh (CTE FTU)</p>
                <p>Trường Đại học Ngoại thương</p>
                <p>Đoàn Thanh niên Cộng sản Hồ Chí Minh Trường Đại học Ngoại thương</p>
              </div>
            </div>

            {/* Đối tác chiến lược */}
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-primary" />
                <p className="font-display text-sm font-semibold text-primary">Đối tác chiến lược</p>
              </div>
              <div className="p-4 font-body text-sm text-foreground">
                <p>XNOQuant</p>
              </div>
            </div>

            {/* Product owner & team */}
            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                <p className="font-display text-sm font-semibold text-primary">Product Owner & Developer</p>
              </div>
              <div className="p-4 space-y-2 font-body text-sm text-foreground">
                <p>Nguyễn Phương Vy</p>
                <p>Lê Hoàng Việt</p>
              </div>
            </div>

            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <p className="font-display text-sm font-semibold text-primary">Design & UI/UX</p>
              </div>
              <div className="p-4 space-y-2 font-body text-sm text-foreground">
                <p>Nguyễn Phương Vy</p>
                <p>Lê Hoàng Việt</p>
              </div>
            </div>

            <div className="glass-card rounded-xl border border-primary/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <p className="font-display text-sm font-semibold text-primary">Backend & Data</p>
              </div>
              <div className="p-4 space-y-2 font-body text-sm text-foreground">
                <p>Nguyễn Phương Vy</p>
                <p>Lê Hoàng Việt</p>
              </div>
            </div>
          </div>
        </div>

        {/* Closing credits text */}
        <div className="glass-card rounded-xl border border-primary/15 p-5 space-y-3">
          <p className="font-body text-xs text-muted-foreground leading-relaxed">
            Website Matching Teammate được phát triển nhằm hỗ trợ các thí sinh Data Science Talent Competition - Vietnam Quant Challenge 2026 trong quá trình kết nối, tìm kiếm đồng đội và chuẩn bị cho Giai đoạn 2 của cuộc thi.
          </p>
          <p className="font-body text-xs text-muted-foreground leading-relaxed">
            Xin chân thành cảm ơn các đơn vị tổ chức, đối tác chiến lược cùng toàn thể các thí sinh đã đồng hành và đóng góp ý kiến để nền tảng ngày càng hoàn thiện.
          </p>
        </div>

        {/* Footer */}
        <PageFooter />
      </div>
    </div>
  );
}