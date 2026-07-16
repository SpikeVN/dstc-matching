// Cities — Hà Nội & HCM lên đầu
export const VIETNAM_CITIES = [
  "Thành phố Hà Nội",
  "Thành phố Hồ Chí Minh",
  "Thành phố Đà Nẵng",
  "Thành phố Hải Phòng",
  "Thành phố Cần Thơ",
  "Thành phố Huế",
  "Tỉnh Bắc Ninh",
  "Tỉnh Hưng Yên",
  "Tỉnh Ninh Bình",
  "Tỉnh Quảng Ninh",
  "Tỉnh Thanh Hoá",
  "Tỉnh Nghệ An",
  "Tỉnh Hà Tĩnh",
  "Tỉnh Quảng Trị",
  "Tỉnh Quảng Ngãi",
  "Tỉnh Gia Lai",
  "Tỉnh Khánh Hoà",
  "Tỉnh Lâm Đồng",
  "Tỉnh Đắk Lắk",
  "Tỉnh Đồng Nai",
  "Tỉnh Tây Ninh",
  "Tỉnh Vĩnh Long",
  "Tỉnh Đồng Tháp",
  "Tỉnh Cà Mau",
  "Tỉnh An Giang",
  "Tỉnh Tuyên Quang",
  "Tỉnh Lào Cai",
  "Tỉnh Thái Nguyên",
  "Tỉnh Phú Thọ",
  "Tỉnh Lai Châu",
  "Tỉnh Điện Biên",
  "Tỉnh Sơn La",
  "Tỉnh Lạng Sơn",
  "Tỉnh Cao Bằng",
  "Khác",
];

// City filter options (simplified for filtering)
export const FILTER_CITIES = ["Hà Nội", "Hồ Chí Minh", "Tỉnh/Thành phố khác"];

// Tools (Quant-focused)
export const TOOL_SKILLS = [
  "Python", "R", "MATLAB", "Julia", "SQL", "Excel", "VBA",
];

// Frameworks / Libraries (Quant-focused)
export const FRAMEWORK_SKILLS = [
  "Pandas", "NumPy", "Statsmodels", "Scipy", "QuantLib",
  "Zipline", "Backtrader", "VectorBT",
  "Scikit-learn", "XGBoost", "LightGBM", "PyTorch",
];

// Skillset
export const SKILLSET = [
  "Quantitative Finance", "Backtesting", "Time Series", "Alpha Research",
  "Portfolio Optimization", "Risk Management", "Options Pricing",
  "Data Analysis", "Statistics", "Machine Learning", "Deep Learning",
  "NLP", "Computer Vision", "Data Visualization", "Web Scraping",
];

// Mindset / Soft skills
export const SOFT_SKILLS = [
  "Leadership", "Teamwork", "Communication", "Problem Solving",
  "Critical Thinking", "Time Management", "Presentation",
  "Project Management", "Creativity", "Adaptability",
];

// Legacy flat export dùng cho Discover scoring
export const TECHNICAL_SKILLS = [...TOOL_SKILLS, ...FRAMEWORK_SKILLS, ...SKILLSET];

export const EXPERIENCE_OPTIONS = [
  { value: "Chưa thi lần nào", label: "🌱 Lần đầu tham gia", desc: "Chưa từng thi cuộc thi về Data/Quant" },
  { value: "Đã thi cuộc thi về Quant", label: "📈 Đã thi Quant", desc: "Đã từng tham gia cuộc thi về Quant Finance" },
  { value: "Đã từng thi DSTC", label: "🏆 Alumni DSTC", desc: "Đã từng tham gia DSTC các mùa trước" },
];

export const GOAL_OPTIONS = [
  { value: "Học hỏi", label: "📚 Học hỏi", desc: "Muốn học thêm kỹ năng mới" },
  { value: "Kết bạn", label: "🤝 Kết bạn", desc: "Mở rộng mạng lưới quan hệ" },
  { value: "Top ranking", label: "🎯 Top ranking", desc: "Muốn xếp hạng cao" },
  { value: "Giải thưởng", label: "🥇 Giải thưởng", desc: "Chinh phục giải thưởng" },
];

export const ROLE_OPTIONS = [
  "Quant Researcher",
  "Quant Developer",
  "Quant Trader",
  "Quant Analyst",
  "Data Analyst",
  "ML Engineer",
  "Backend Developer",
  "All-rounder",
];

export const SKILL_ICONS = {
  "Python": "🐍", "SQL": "🗄️", "Power BI": "💡", "Excel": "📗", "Tableau": "🎨", "R": "📐",
  "Pandas": "🐼", "NumPy": "🔢", "Scikit-learn": "🔬", "TensorFlow": "⚡", "PyTorch": "🔥",
  "Statsmodels": "📉", "XGBoost": "🚀", "LightGBM": "🌿",
  "Data Analysis": "📊", "Statistics": "📐", "Machine Learning": "🧠", "Deep Learning": "🌊",
  "NLP": "💬", "Computer Vision": "👁️", "Data Visualization": "📈", "Web Scraping": "🕸️",
  "Quantitative Finance": "💹", "Backtesting": "🔁", "Time Series": "📅",
};

// Complementary roles for smart matching
export const COMPLEMENTARY_ROLES = {
  "Data Analyst": ["ML Engineer", "Backend Developer", "Quant Researcher"],
  "ML Engineer": ["Data Analyst", "Backend Developer", "Quant Developer"],
  "Backend Developer": ["Data Analyst", "ML Engineer", "Quant Developer"],
  "Quant Researcher": ["Quant Developer", "Quant Trader", "Data Analyst"],
  "Quant Developer": ["Quant Researcher", "Quant Trader", "Backend Developer"],
  "Quant Trader": ["Quant Researcher", "Quant Developer"],
  "All-rounder": ["Data Analyst", "ML Engineer", "Backend Developer", "Quant Researcher", "Quant Developer", "Quant Trader", "All-rounder"],
};