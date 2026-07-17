import { db } from '@/api/base44Client';

import React, { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { ArrowRight, UserPen, FolderHeart, Users, Mail, MapPin, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/* ── Logo assets ──────────────────────────────────────────── */
const FTU_LOGO = '/ftu.webp';
const DOAN_LOGO = '/fyu.svg';
const CTE_LOGO = '/cte-logo.svg';

/* ── Decorative assets ────────────────────────────────────── */
const IMG_TREES = '/dstc-trees.webp';
const IMG_ASTRO = '/astro.webp';
const IMG_KEY = '/dstc-key-sphere.webp';
const IMG_BUSH = '/trees-half-cut.webp';

/* ── Design tokens (from Figma) ───────────────────────────── */
const FIGMA_GREEN = '#71d65b';
const FIGMA_BG = '#0a120b';
const FIGMA_BORDER = '#2a4b2e';
const FIGMA_SUBTEXT = '#96aa98';
const FIGMA_FG = '#cedfd0';

/* ── Motion helpers ───────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

/* ─────────────────────────────────────────────────────────── */
/*  Step Card                                                   */
/* ─────────────────────────────────────────────────────────── */
function StepCard({ icon: Icon, title, desc, delay = 0 }) {
  return (
    <motion.div
      {...fadeUp(delay)}
      className="flex flex-col gap-3 lg:gap-5 items-start flex-[1_1_320px]
                 px-5 lg:px-[30px] min-h-full py-4 lg:py-[21px] rounded-[18px]
                 border backdrop-blur-[13.5px] overflow-hidden"
      style={{
        background: 'rgba(42,75,46,0.2)',
        borderColor: FIGMA_BORDER,
      }}
    >
      <div className="flex gap-2.5 items-center">
        <Icon className="w-5 h-5 lg:w-[30px] lg:h-[30px]" style={{ color: FIGMA_FG }} />
        <p
          className="font-display font-semibold text-base lg:text-[18px] tracking-tight"
          style={{ color: FIGMA_FG }}
        >
          {title}
        </p>
      </div>
      <p
        className="font-body text-xs lg:text-[16px] leading-normal text-justify"
        style={{ color: FIGMA_SUBTEXT }}
      >
        {desc}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Footer contact row                                          */
/* ─────────────────────────────────────────────────────────── */
function ContactRow({ icon: Icon, children }) {
  return (
    <div className="flex gap-3 lg:gap-[15px] items-center w-full">
      <Icon className="w-5 h-5 lg:w-[30px] lg:h-[30px] shrink-0" style={{ color: FIGMA_SUBTEXT }} />
      <div className="font-body text-sm lg:text-[16px] leading-normal" style={{ color: FIGMA_SUBTEXT }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Landing Page                                                */
/* ═══════════════════════════════════════════════════════════ */
export default function Landing() {
  const handleLogin = () => {
    db.auth.redirectToLogin('/');
  };

  useEffect(() => {
    document.documentElement.classList.add('no-bg');
    return () => document.documentElement.classList.remove('no-bg');
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center w-full">

      {/* ── Navbar ────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-30 w-full flex items-center justify-between
                   px-5 lg:px-[75px] h-16 lg:h-24
                   border-b backdrop-blur-md"
        style={{ borderColor: FIGMA_BORDER, background: 'rgba(10,18,11,0.85)' }}
      >
        {/* Logo cluster */}
        <div className="hidden lg:flex items-center gap-1 lg:gap-5 h-8 lg:h-10">
          <img src={FTU_LOGO} alt="FTU" className="h-full aspect-square object-contain rounded-full" />
          <img src={DOAN_LOGO} alt="Đoàn TNCS HCM" className="h-full aspect-square object-contain" />
          <img src={CTE_LOGO} alt="CTE FTU" className="h-full aspect-square object-contain" />
        </div>

        {/* Title */}
        <p className="font-display font-bold text-sm lg:text-[20px] text-white text-center">
          DSTC 2026&nbsp;&nbsp;
          <span style={{ color: FIGMA_BORDER }}>//</span>
          &nbsp;&nbsp;Vietnam Quant Challenge
        </p>

        {/* CTA */}
        <Button
          size="sm"
          className="hidden rounded-full px-5 lg:px-[30px] py-2 lg:py-[15px] h-auto
                     font-display font-medium text-sm lg:text-[16px]
                     md:flex gap-2 items-center transition-all duration-200"
          style={{ background: FIGMA_GREEN, color: FIGMA_BG }}
          onClick={handleLogin}
        >
          Bắt đầu
          <ArrowRight className="w-4 h-4 lg:w-6 lg:h-6" />
        </Button>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="relative w-full flex items-center
                   px-5 lg:px-[75px] py-8 lg:py-[64px]
                   border-b"
        style={{ borderColor: FIGMA_BORDER, minHeight: '320px' }}
      >
        {/* Trees background */}
        <img
          src={IMG_TREES}
          alt=""
          className="absolute left-0 top-3 w-full h-auto
                     pointer-events-none select-none opacity-40 z-5"
        />

        <div className="relative z-10 w-full flex flex-col lg:flex-row items-center lg:items-center
                        justify-center lg:justify-between gap-6 lg:gap-0">
          {/* Left: headline + buttons */}
          <motion.div {...fadeUp(0)} className="flex flex-col gap-4 lg:gap-[25px] items-center lg:items-start max-w-[490px]">
            <h1
              className="font-display font-bold text-3xl lg:text-[44px]
                         leading-tight lg:leading-[1.15] text-center lg:text-left max-w-[400px]"
              style={{ letterSpacing: '-0.03em', color: '#ffffff' }}
            >
              Chiến thắng <br /> bắt đầu từ đây.
            </h1>

            <div className="flex flex-wrap gap-3 lg:gap-[15px] items-center justify-center lg:justify-start">
              <Button
                className="rounded-full px-5 lg:px-[30px] py-2.5 lg:py-[15px] h-auto
                           font-display font-medium text-sm lg:text-[16px] flex gap-2 items-center
                           transition-all duration-200"
                style={{ background: FIGMA_GREEN, color: FIGMA_BG }}
                onClick={handleLogin}
              >
                Match ngay
                <ArrowRight className="w-4 h-4 lg:w-6 lg:h-6" />
              </Button>

              <Link to="/guide">
                <Button
                  variant="ghost"
                  className="rounded-full px-5 lg:px-[30px] py-2.5 lg:py-[15px] h-auto
                             font-display font-medium text-sm lg:text-[16px] flex gap-2 items-center
                             transition-all duration-200 hover:bg-transparent"
                  style={{ color: FIGMA_GREEN }}
                >
                  Xem hướng dẫn
                  <ArrowRight className="w-4 h-4 lg:w-6 lg:h-6" style={{ color: FIGMA_GREEN }} />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right: description (desktop only) */}
          <motion.p
            {...fadeUp(0.15)}
            className="hidden lg:block font-body text-[18px]
                       text-right max-w-[350px] leading-snug"
            style={{ color: FIGMA_SUBTEXT, letterSpacing: '-0.03em' }}
          >
            Một người đồng đội tốt cũng quý giá không kém gì Alpha của bạn.
            <br /><br />
            Chỉ cần Swipe và Match. Tìm người đồng hành lý tưởng chưa bao giờ dễ dàng hơn.
          </motion.p>

          {/* Description for mobile */}
          <motion.p
            {...fadeUp(0.15)}
            className="lg:hidden font-body text-sm text-center max-w-xs leading-relaxed"
            style={{ color: FIGMA_SUBTEXT }}
          >
            Một người đồng đội tốt cũng quý giá không kém gì Alpha của bạn.
            <br /><br />
            Chỉ cần Swipe và Match. Tìm người đồng hành lý tưởng chưa bao giờ dễ dàng hơn.
          </motion.p>
        </div>
      </section>

      {/* ── Giới thiệu hệ thống (desktop only) ───────────── */}
      <section
        className="hidden lg:flex relative w-full items-start
                   px-[75px] py-[62px] border-b overflow-hidden"
        style={{ borderColor: FIGMA_BORDER }}
      >
        {/* Trees decorative background */}


        {/* Title block */}
        <div className="shrink-0 w-[473px]">
          <h2 className="font-display font-bold text-[30px] leading-normal text-white">
            Giới thiệu hệ thống<br />Matching Teammate
          </h2>
        </div>

        {/* Description */}
        <p
          className="font-body text-[18px] leading-relaxed text-justify flex-1"
          style={{ color: FIGMA_FG }}
        >
          DSTC Matching Teammate là hệ thống ghép đội dành riêng cho thí sinh DSTC 2026: Vietnam Quant Challenge.
          Thay vì tìm đội một cách thủ công, thí sinh chỉ cần tạo hồ sơ, khám phá và kết nối trực tiếp
          với những người cùng chí hướng.
          <br /><br />
          Thí sinh đăng ký tài khoản và tạo hồ sơ trên trang web Matching Teammate với thế mạnh của bản thân
          (toán, lập trình, tài chính, v.v.) mong muốn của mình, và những thông tin khác.
          <br /><br />
          Hệ thống sẽ gợi ý những đồng đội phù hợp nhất để cùng xây dựng một đội hình cân bằng và mạnh.
        </p>
      </section>

      {/* ── Matching Steps ────────────────────────────────── */}
      <section
        className="w-full flex flex-col gap-6 lg:gap-[35px] items-center
                   px-5 lg:px-[75px] py-8 lg:py-[62px] border-b"
        style={{ borderColor: FIGMA_BORDER }}
      >
        <h2 className="font-display font-bold text-xl lg:text-[24px] text-white">
          Các bước matching (tóm tắt)
        </h2>

        <div className="w-full flex flex-row flex-wrap items-stretch
                        justify-between gap-3 lg:gap-[30px]">
          <StepCard
            icon={UserPen}
            title="Tạo hồ sơ"
            desc="Sau khi tạo tài khoản, điền kỹ năng, kinh nghiệm và mục tiêu của bạn đề hoàn thành hồ sơ."
            delay={0.1}
          />
          <StepCard
            icon={FolderHeart}
            title="Match"
            desc="Trong mục Khám phá, tìm hiểu và like những người bạn muốn ghép đội. Lướt sang phải để match."
            delay={0.2}
          />
          <StepCard
            icon={Users}
            title="Chat & Hình thành đội"
            desc="Sau khi Match, bạn có thể nhắn tin trực tiếp với các match của bạn. Bạn có thể tạo team với những người đã match hoặc thêm tùy ý."
            delay={0.3}
          />
        </div>
      </section>

      {/* ── Về DSTC 2026 ─────────────────────────────────── */}
      <section
        className="relative w-full flex flex-row gap-4
                   items-center justify-center px-5 lg:px-[75px] py-8 lg:py-[62px] border-b overflow-hidden"
        style={{ borderColor: FIGMA_BORDER }}
      >
        {/* Title */}
        <div className="flex flex-col gap-4 w-fit h-fit lg:max-w-[50%]">
          <h2 className="z-10 font-display font-bold text-2xl lg:text-[30px] text-white leading-normal">
            Về DSTC 2026&nbsp;&nbsp;&nbsp;
            <span style={{ color: FIGMA_BORDER }}>//</span>
            <br />Vietnam Quant Challenge
          </h2>

          {/* Description */}
          <p
            className="z-10 font-body text-sm lg:text-[18px] leading-relaxed text-justify"
            style={{ color: FIGMA_FG }}
          >
            Data Science Talent Competition là một sân chơi khoa học dữ liệu hàng năm được tổ chức bởi
            CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh, Trường Đại học Ngoại Thương.
            <br /><br />
            DSTC 2026 chính thức trở lại với chủ đề Vietnam Quant Challenge, giải mã thị trường tài chính
            bằng dữ liệu và tư duy định lượng. Cuộc thi đưa thí sinh vào hành trình nơi khoa học dữ liệu
            gặp gỡ tài thế giới chính hiện đại, nơi các thuật toán chi phối các dòng tiền khổng lồ.
          </p>
        </div>

        <div className="hidden lg:flex w-[50%] overflow-hidden flex-row items-center justify-center">
          <div className="relative w-[500px] h-[400px]">
            <img
              src={IMG_KEY}
              alt=""
              className="absolute pointer-events-none select-none
                     w-auto h-full"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="relative w-full overflow-hidden" style={{ minHeight: '360px' }}>
        {/* Bushes decoration */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start
                        gap-6 lg:gap-[60px] px-5 lg:px-[75px] py-8 lg:py-[79px] justify-between">

          {/* CTE logo */}
          <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
            <img
              src={CTE_LOGO}
              alt="CTE FTU"
              className="w-12 h-12 lg:w-[68px] lg:h-[68px] object-contain shrink-0"
            />

            {/* Right column: club name + contacts */}
            <div className="flex flex-col gap-4 lg:gap-[15px] items-center lg:items-start w-full lg:w-auto">
              {/* Club name */}
              <div className="font-display font-semibold text-sm lg:text-[18px] text-white text-center lg:text-left leading-relaxed">
                <p>CLB KHOA HỌC CÔNG NGHỆ</p>
                <p>TRONG KINH TẾ VÀ KINH DOANH</p>
              </div>

              {/* Contact info */}

            </div>
          </div>

          <div className="flex flex-col gap-3 lg:gap-[15px] items-center lg:items-start">
            <ContactRow icon={Mail}>
              contact.cte.ftu@gmail.com
            </ContactRow>

            <ContactRow icon={MapPin}>
              <p>Bàn số 41, Nhà CLB, tòa B, Trường Đại học Ngoại Thương</p>
              <p>91 Chùa Láng, phường Láng, TP. Hà Nội</p>
            </ContactRow>

            <ContactRow icon={Phone}>
              <p>094 904 1674 (Mr. Nguyễn Sỹ Bách)</p>
              <p>094 737 5991 (Ms. Nguyễn Bảo Anh)</p>
            </ContactRow>
          </div>
        </div>

        {/* Copyright */}
        <p
          className="relative z-10 font-body text-xs lg:text-[16px] text-center px-5 pb-6"
          style={{ color: FIGMA_SUBTEXT }}
        >
          © Bản quyền 2026 CLB Khoa học Công nghệ trong Kinh tế và Kinh doanh. Bảo lưu mọi quyền.
        </p>
        <img
          src={IMG_TREES}
          alt=""
          className="absolute left-0 top-0 w-full h-full object-cover object-top
                     pointer-events-none select-none opacity-40 z-5"
        />
      </footer>
    </div>
  );
}