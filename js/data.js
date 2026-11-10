// js/data.js - Dữ liệu Nâng Cấp: 18 Loài Hoa Mở Khóa Theo Ngày Chơi (Progressive Unlocking), Giấy Gói & Nơ Rõ Nét

// 0. CẤU HÌNH MỞ KHÓA HOA THEO NGÀY CHƠI (gắn với biến currentDay)
const FLOWER_UNLOCK_CONFIG = [
  {
    day: 1,
    mode: 'auto',
    title: 'Ngày Khai Trương • 3 Loài Hoa Cơ Bản',
    desc: 'Làm quen quầy hoa với 3 giống hoa kinh điển dễ cắm nhất.',
    flowerIds: ['red_rose', 'daisy', 'sunflower']
  },
  {
    day: 2,
    mode: 'auto',
    title: 'Ngày 2 • Hương Thơm Tinh Khôi',
    desc: 'Tự động mở khóa thêm Hoa Hồng Trắng, Hoa Baby Trắng và Hoa Lavender!',
    flowerIds: ['white_rose', 'baby_breath', 'lavender']
  },
  {
    day: 3,
    mode: 'auto',
    title: 'Ngày 3 • Sắc Hoa Ngọt Ngào',
    desc: 'Tự động mở khóa thêm Hoa Tulip Hồng, Hoa Cẩm Chướng và Cẩm Tú Cầu Xanh!',
    flowerIds: ['tulip_pink', 'carnation', 'hydrangea']
  },
  {
    day: 4,
    mode: 'purchase',
    title: 'Ngày 4 • Mở Chợ Sỉ Hoa Cao Cấp',
    desc: 'Từ hôm nay, bạn có thể dùng xu kiếm được trong "Nhập Hoa" buổi sáng để mở khóa thêm các loài hoa nghệ thuật!',
    flowerIds: ['tulip_red', 'gerbera', 'pompon_mum', 'dahlia', 'lily_white']
  },
  {
    day: 5,
    mode: 'purchase',
    title: 'Ngày 5 • Bộ Sưu Tập Hoa Quý Tộc',
    desc: 'Những loài hoa vương giả bậc nhất đã cập bến Chợ Sỉ! Hãy vào "Nhập Hoa" để mở khóa bằng xu nhé.',
    flowerIds: ['peony', 'lotus', 'orchid', 'cherry_blossom']
  }
];

// 1. ĐỊNH NGHĨA 18 LOÀI HOA (ĐỒ HỌA VECTOR MINH HỌA SẮC NÉT, TƯƠI TẮN)
const FLOWERS_DATA = {
  // === NGÀY 1 (KHỞI ĐẦU: CHỈ 3 HOA CƠ BẢN) ===
  red_rose: {
    id: 'red_rose',
    name: 'Hoa Hồng Đỏ',
    tier: 1,
    unlockedAtDay: 1,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 1,
    cost: 5,
    basePrice: 16,
    defaultStock: 15,
    maxStock: 30,
    color: '#e63946',
    meaning: 'Tình yêu nồng cháy & lãng mạn',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 66 Q58 108 60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 102 C38 86 24 98 30 112 C42 118 54 110 58 102 Z" fill="#84cc16"/>
      <path d="M62 116 C84 100 96 112 90 126 C78 132 66 124 62 116 Z" fill="#65a30d"/>
      <path d="M48 64 Q60 76 72 64 L66 72 L54 72 Z" fill="#4d7c0f"/>
      <path d="M33 42 C32 20 50 14 60 22 C70 14 88 20 87 42 C86 62 74 68 60 68 C46 68 34 62 33 42 Z" fill="#dc2626"/>
      <path d="M40 40 C39 24 52 20 60 27 C68 20 81 24 80 40 C78 55 68 60 60 60 C52 60 42 55 40 40 Z" fill="#ef4444"/>
      <path d="M47 36 C48 26 57 25 60 30 C63 25 72 26 73 36 C71 46 65 50 60 50 C55 50 49 46 47 36 Z" fill="#b91c1c"/>
      <path d="M52 34 Q60 28 68 34 Q60 40 52 34 Z" fill="#fca5a5" opacity="0.65"/>
      <circle cx="60" cy="36" r="5" fill="#991b1b"/>
    </svg>`
  },

  white_rose: {
    id: 'white_rose',
    name: 'Hoa Hồng Trắng',
    tier: 1,
    unlockedAtDay: 2,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 1,
    cost: 5,
    basePrice: 16,
    defaultStock: 15,
    maxStock: 30,
    color: '#f8f9fa',
    meaning: 'Thuần khiết & chân thành',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 66 Q62 108 60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 102 C38 86 24 98 30 112 C42 118 54 110 58 102 Z" fill="#84cc16"/>
      <path d="M62 116 C84 100 96 112 90 126 C78 132 66 124 62 116 Z" fill="#65a30d"/>
      <path d="M48 64 Q60 76 72 64 L66 72 L54 72 Z" fill="#4d7c0f"/>
      <path d="M33 42 C32 20 50 14 60 22 C70 14 88 20 87 42 C86 62 74 68 60 68 C46 68 34 62 33 42 Z" fill="#f1f5f9"/>
      <path d="M40 40 C39 24 52 20 60 27 C68 20 81 24 80 40 C78 55 68 60 60 60 C52 60 42 55 40 40 Z" fill="#ffffff"/>
      <path d="M47 36 C48 26 57 25 60 30 C63 25 72 26 73 36 C71 46 65 50 60 50 C55 50 49 46 47 36 Z" fill="#e2e8f0"/>
      <circle cx="60" cy="36" r="5" fill="#fde68a"/>
    </svg>`
  },

  daisy: {
    id: 'daisy',
    name: 'Cúc Họa Mi',
    tier: 1,
    unlockedAtDay: 1,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 1,
    cost: 4,
    basePrice: 14,
    defaultStock: 18,
    maxStock: 35,
    color: '#ffffff',
    meaning: 'Nét tinh khôi trong trẻo đầu đông',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 74 Q58 114 60 152" stroke="#65a30d" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      <path d="M58 110 C38 92 26 104 34 118 C44 122 54 116 58 110 Z" fill="#84cc16"/>
      <path d="M62 122 C82 106 94 118 86 130 C76 134 66 128 62 122 Z" fill="#65a30d"/>
      <g fill="#f1f5f9">
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(22.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(67.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(112.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(157.5 60 48)"/>
      </g>
      <g fill="#ffffff">
        <ellipse cx="60" cy="48" rx="6.5" ry="35"/>
        <ellipse cx="60" cy="48" rx="6.5" ry="35" transform="rotate(45 60 48)"/>
        <ellipse cx="60" cy="48" rx="6.5" ry="35" transform="rotate(90 60 48)"/>
        <ellipse cx="60" cy="48" rx="6.5" ry="35" transform="rotate(135 60 48)"/>
      </g>
      <circle cx="60" cy="48" r="13" fill="#f59e0b"/>
      <circle cx="60" cy="48" r="9.5" fill="#fbbf24"/>
      <circle cx="57" cy="45" r="2" fill="#fef3c7"/>
    </svg>`
  },

  baby_breath: {
    id: 'baby_breath',
    name: 'Hoa Baby Trắng',
    tier: 1,
    unlockedAtDay: 2,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 1,
    cost: 5,
    basePrice: 14,
    defaultStock: 20,
    maxStock: 40,
    color: '#f8f9fa',
    meaning: 'Tình yêu ngây thơ bồng bềnh mây trắng',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 152 L60 94 Q58 76 38 52" stroke="#65a30d" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M60 94 Q62 74 82 50" stroke="#65a30d" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M60 84 L60 34" stroke="#84cc16" stroke-width="2.8" stroke-linecap="round" fill="none"/>
      <path d="M38 52 L24 34" stroke="#84cc16" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M38 52 L46 30" stroke="#84cc16" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M82 50 L74 28" stroke="#84cc16" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M82 50 L96 34" stroke="#84cc16" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <g fill="#ffffff">
        <circle cx="24" cy="34" r="8.5"/><circle cx="46" cy="30" r="8"/><circle cx="60" cy="32" r="9"/>
        <circle cx="74" cy="28" r="8"/><circle cx="96" cy="34" r="8.5"/><circle cx="36" cy="52" r="7.5"/>
        <circle cx="84" cy="50" r="7.5"/><circle cx="60" cy="52" r="8"/>
      </g>
      <g fill="#fde047">
        <circle cx="24" cy="34" r="2.6"/><circle cx="46" cy="30" r="2.4"/><circle cx="60" cy="32" r="2.8"/>
        <circle cx="74" cy="28" r="2.4"/><circle cx="96" cy="34" r="2.6"/><circle cx="60" cy="52" r="2.4"/>
      </g>
    </svg>`
  },

  // === HOA HƯỚNG DƯƠNG (NGÀY 1), TULIP HỒNG & CẨM CHƯỚNG (NGÀY 3), TULIP ĐỎ (NGÀY 4) ===
  sunflower: {
    id: 'sunflower',
    name: 'Hoa Hướng Dương',
    tier: 1,
    unlockedAtDay: 1,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 2,
    cost: 7,
    basePrice: 19,
    defaultStock: 14,
    maxStock: 30,
    color: '#ffb703',
    meaning: 'Năng lượng tích cực & hy vọng',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 80 Q58 118 60 152" stroke="#65a30d" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M57 108 C32 92 22 108 32 122 C44 128 54 118 57 108 Z" fill="#84cc16"/>
      <path d="M63 122 C88 106 98 122 88 136 C76 142 66 132 63 122 Z" fill="#65a30d"/>
      <g fill="#f59e0b">
        <ellipse cx="60" cy="50" rx="8.5" ry="38" transform="rotate(22.5 60 50)"/>
        <ellipse cx="60" cy="50" rx="8.5" ry="38" transform="rotate(67.5 60 50)"/>
        <ellipse cx="60" cy="50" rx="8.5" ry="38" transform="rotate(112.5 60 50)"/>
        <ellipse cx="60" cy="50" rx="8.5" ry="38" transform="rotate(157.5 60 50)"/>
      </g>
      <g fill="#facc15">
        <ellipse cx="60" cy="50" rx="9" ry="39"/>
        <ellipse cx="60" cy="50" rx="9" ry="39" transform="rotate(45 60 50)"/>
        <ellipse cx="60" cy="50" rx="9" ry="39" transform="rotate(90 60 50)"/>
        <ellipse cx="60" cy="50" rx="9" ry="39" transform="rotate(135 60 50)"/>
      </g>
      <circle cx="60" cy="50" r="20" fill="#78350f"/>
      <circle cx="60" cy="50" r="14.5" fill="#451a03"/>
      <circle cx="54" cy="45" r="2" fill="#fbbf24"/>
      <circle cx="66" cy="46" r="2" fill="#fbbf24"/>
      <circle cx="60" cy="56" r="2" fill="#fbbf24"/>
    </svg>`
  },

  tulip_pink: {
    id: 'tulip_pink',
    name: 'Hoa Tulip Hồng',
    tier: 1,
    unlockedAtDay: 3,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 2,
    cost: 6,
    basePrice: 17,
    defaultStock: 14,
    maxStock: 30,
    color: '#ff758f',
    meaning: 'Vẻ đẹp ngọt ngào & kiêu sa',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 72 L60 152" stroke="#65a30d" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <path d="M58 148 Q30 112 32 62 Q48 92 58 134 Z" fill="#84cc16"/>
      <path d="M62 148 Q90 112 88 66 Q72 96 62 134 Z" fill="#65a30d"/>
      <path d="M36 52 C34 30 46 22 54 32 L60 16 L66 32 C74 22 86 30 84 52 C82 72 72 78 60 78 C48 78 38 72 36 52 Z" fill="#f472b6"/>
      <path d="M46 52 C46 34 54 20 60 16 C66 20 74 34 74 52 C74 70 68 77 60 77 C52 77 46 70 46 52 Z" fill="#f9a8d4"/>
      <path d="M54 50 C54 36 58 24 60 20 C62 24 66 36 66 50 C66 64 63 72 60 72 C57 72 54 64 54 50 Z" fill="#fbcfe8" opacity="0.7"/>
    </svg>`
  },

  tulip_red: {
    id: 'tulip_red',
    name: 'Hoa Tulip Đỏ',
    tier: 1,
    unlockedAtDay: 4,
    unlockMode: 'purchase',
    unlockCost: 40,
    unlockedAtLevel: 2,
    cost: 7,
    basePrice: 18,
    defaultStock: 14,
    maxStock: 30,
    color: '#d90429',
    meaning: 'Tình yêu hoàn hảo & nhiệt thành',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 72 L60 152" stroke="#65a30d" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <path d="M58 148 Q30 112 32 62 Q48 92 58 134 Z" fill="#84cc16"/>
      <path d="M62 148 Q90 112 88 66 Q72 96 62 134 Z" fill="#65a30d"/>
      <path d="M36 52 C34 30 46 22 54 32 L60 16 L66 32 C74 22 86 30 84 52 C82 72 72 78 60 78 C48 78 38 72 36 52 Z" fill="#b91c1c"/>
      <path d="M46 52 C46 34 54 20 60 16 C66 20 74 34 74 52 C74 70 68 77 60 77 C52 77 46 70 46 52 Z" fill="#dc2626"/>
      <path d="M54 50 C54 36 58 24 60 20 C62 24 66 36 66 50 C66 64 63 72 60 72 C57 72 54 64 54 50 Z" fill="#ef4444" opacity="0.8"/>
    </svg>`
  },

  carnation: {
    id: 'carnation',
    name: 'Hoa Cẩm Chướng',
    tier: 1,
    unlockedAtDay: 3,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 2,
    cost: 6,
    basePrice: 16,
    defaultStock: 14,
    maxStock: 30,
    color: '#ff85a1',
    meaning: 'Lòng biết ơn & tình mẫu tử',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 74 Q61 114 60 152" stroke="#65a30d" stroke-width="4.8" stroke-linecap="round" fill="none"/>
      <path d="M58 104 C40 90 28 100 34 114 C44 118 54 112 58 104 Z" fill="#84cc16"/>
      <path d="M62 120 C80 106 92 116 86 130 C76 134 66 128 62 120 Z" fill="#65a30d"/>
      <circle cx="60" cy="48" r="26" fill="#fb7185"/>
      <circle cx="44" cy="34" r="11" fill="#f43f5e"/><circle cx="76" cy="34" r="11" fill="#f43f5e"/>
      <circle cx="38" cy="54" r="11" fill="#f43f5e"/><circle cx="82" cy="54" r="11" fill="#f43f5e"/>
      <circle cx="60" cy="28" r="11" fill="#f43f5e"/><circle cx="60" cy="66" r="11" fill="#e11d48"/>
      <circle cx="60" cy="48" r="18" fill="#fda4af"/>
      <circle cx="60" cy="48" r="10" fill="#e11d48"/>
      <circle cx="60" cy="48" r="4" fill="#fef08a"/>
    </svg>`
  },

  // === TẦNG 2 & CÁC HOA MỞ THEO NGÀY 2-5 ===
  lavender: {
    id: 'lavender',
    name: 'Hoa Lavender',
    tier: 2,
    unlockedAtDay: 2,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 3,
    cost: 6,
    basePrice: 16,
    defaultStock: 14,
    maxStock: 30,
    color: '#9d4edd',
    meaning: 'Sự thủy chung & thư thái',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 36 L60 152" stroke="#65a30d" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      <path d="M60 116 Q38 102 30 82 Q46 92 60 112 Z" fill="#84cc16"/>
      <path d="M60 124 Q82 110 90 90 Q74 100 60 120 Z" fill="#65a30d"/>
      <g fill="#9333ea">
        <ellipse cx="60" cy="22" rx="6" ry="9"/>
        <ellipse cx="51" cy="36" rx="7" ry="5.5" transform="rotate(-25 51 36)"/>
        <ellipse cx="69" cy="36" rx="7" ry="5.5" transform="rotate(25 69 36)"/>
        <ellipse cx="49" cy="50" rx="8" ry="6" transform="rotate(-25 49 50)"/>
        <ellipse cx="71" cy="50" rx="8" ry="6" transform="rotate(25 71 50)"/>
        <ellipse cx="48" cy="66" rx="8.5" ry="6.5" transform="rotate(-25 48 66)"/>
        <ellipse cx="72" cy="66" rx="8.5" ry="6.5" transform="rotate(25 72 66)"/>
      </g>
      <g fill="#c084fc">
        <ellipse cx="60" cy="20" rx="3.5" ry="6"/>
        <circle cx="52" cy="35" r="3.5"/><circle cx="68" cy="35" r="3.5"/>
        <circle cx="50" cy="49" r="4"/><circle cx="70" cy="49" r="4"/>
        <circle cx="49" cy="65" r="4"/><circle cx="71" cy="65" r="4"/>
      </g>
    </svg>`
  },

  gerbera: {
    id: 'gerbera',
    name: 'Hoa Đồng Tiền',
    tier: 1,
    unlockedAtDay: 4,
    unlockMode: 'purchase',
    unlockCost: 45,
    unlockedAtLevel: 3,
    cost: 7,
    basePrice: 18,
    defaultStock: 14,
    maxStock: 30,
    color: '#f77f00',
    meaning: 'Tài lộc may mắn & hân hoan',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 76 Q61 114 60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 112 C38 96 26 108 34 122 C44 126 54 118 58 112 Z" fill="#84cc16"/>
      <g fill="#ea580c">
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(18 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(54 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(90 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(126 60 48)"/>
        <ellipse cx="60" cy="48" rx="6" ry="34" transform="rotate(162 60 48)"/>
      </g>
      <g fill="#fb923c">
        <ellipse cx="60" cy="48" rx="5.5" ry="32"/>
        <ellipse cx="60" cy="48" rx="5.5" ry="32" transform="rotate(36 60 48)"/>
        <ellipse cx="60" cy="48" rx="5.5" ry="32" transform="rotate(72 60 48)"/>
        <ellipse cx="60" cy="48" rx="5.5" ry="32" transform="rotate(108 60 48)"/>
        <ellipse cx="60" cy="48" rx="5.5" ry="32" transform="rotate(144 60 48)"/>
      </g>
      <circle cx="60" cy="48" r="14" fill="#fbbf24"/>
      <circle cx="60" cy="48" r="8" fill="#78350f"/>
    </svg>`
  },

  pompon_mum: {
    id: 'pompon_mum',
    name: 'Cúc Mẫu Đơn Tím',
    tier: 2,
    unlockedAtDay: 4,
    unlockMode: 'purchase',
    unlockCost: 50,
    unlockedAtLevel: 3,
    cost: 8,
    basePrice: 20,
    defaultStock: 12,
    maxStock: 25,
    color: '#a855f7',
    meaning: 'Quý phái & tràn đầy viên mãn',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 78 L60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 112 C38 96 26 108 34 122 C44 126 54 118 58 112 Z" fill="#84cc16"/>
      <path d="M62 124 C82 110 94 122 86 134 C76 138 66 130 62 124 Z" fill="#65a30d"/>
      <circle cx="60" cy="48" r="29" fill="#a855f7"/>
      <circle cx="60" cy="48" r="22" fill="#c084fc"/>
      <circle cx="60" cy="48" r="15" fill="#9333ea"/>
      <circle cx="60" cy="48" r="8" fill="#d8b4fe"/>
      <circle cx="60" cy="48" r="4" fill="#fef08a"/>
    </svg>`
  },

  dahlia: {
    id: 'dahlia',
    name: 'Hoa Thược Dược',
    tier: 2,
    unlockedAtDay: 4,
    unlockMode: 'purchase',
    unlockCost: 55,
    unlockedAtLevel: 3,
    cost: 8,
    basePrice: 21,
    defaultStock: 12,
    maxStock: 25,
    color: '#e11d48',
    meaning: 'Tài hoa, uy quyền & rực rỡ',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 78 Q62 115 60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 112 C38 96 26 108 34 122 C44 126 54 118 58 112 Z" fill="#84cc16"/>
      <g fill="#e11d48">
        <ellipse cx="60" cy="48" rx="8" ry="33"/>
        <ellipse cx="60" cy="48" rx="8" ry="33" transform="rotate(45 60 48)"/>
        <ellipse cx="60" cy="48" rx="8" ry="33" transform="rotate(90 60 48)"/>
        <ellipse cx="60" cy="48" rx="8" ry="33" transform="rotate(135 60 48)"/>
      </g>
      <g fill="#fb7185">
        <ellipse cx="60" cy="48" rx="7" ry="25" transform="rotate(22.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="7" ry="25" transform="rotate(67.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="7" ry="25" transform="rotate(112.5 60 48)"/>
        <ellipse cx="60" cy="48" rx="7" ry="25" transform="rotate(157.5 60 48)"/>
      </g>
      <circle cx="60" cy="48" r="10" fill="#fde047"/>
      <circle cx="60" cy="48" r="5" fill="#f59e0b"/>
    </svg>`
  },

  lily_white: {
    id: 'lily_white',
    name: 'Hoa Ly Trắng',
    tier: 2,
    unlockedAtDay: 4,
    unlockMode: 'purchase',
    unlockCost: 65,
    unlockedAtLevel: 4,
    cost: 9,
    basePrice: 23,
    defaultStock: 12,
    maxStock: 25,
    color: '#f8f9fa',
    meaning: 'Trang trọng & trăm năm hòa hợp',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 76 L60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 148 Q28 100 32 54 Q48 92 58 134 Z" fill="#84cc16"/>
      <path d="M62 148 Q92 100 88 54 Q72 92 62 134 Z" fill="#65a30d"/>
      <path d="M60 54 Q40 16 60 10 Q80 16 60 54 Z" fill="#ffffff"/>
      <path d="M60 54 Q14 42 18 62 Q42 68 60 54 Z" fill="#f8fafc"/>
      <path d="M60 54 Q106 42 102 62 Q78 68 60 54 Z" fill="#f8fafc"/>
      <path d="M60 54 Q30 86 44 90 Q54 74 60 54 Z" fill="#e2e8f0"/>
      <path d="M60 54 Q90 86 76 90 Q66 74 60 54 Z" fill="#e2e8f0"/>
      <path d="M60 52 L54 32 M60 52 L66 32 M60 52 L60 28" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
      <circle cx="54" cy="31" r="2.5" fill="#d97706"/>
      <circle cx="66" cy="31" r="2.5" fill="#d97706"/>
      <circle cx="60" cy="27" r="2.5" fill="#d97706"/>
    </svg>`
  },

  peony: {
    id: 'peony',
    name: 'Hoa Mẫu Đơn',
    tier: 2,
    unlockedAtDay: 5,
    unlockMode: 'purchase',
    unlockCost: 75,
    unlockedAtLevel: 4,
    cost: 10,
    basePrice: 26,
    defaultStock: 10,
    maxStock: 25,
    color: '#ff4d6d',
    meaning: 'Vương giả, phú quý & kiêu sa',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 80 L60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 114 C36 98 26 112 34 126 C46 130 54 122 58 114 Z" fill="#84cc16"/>
      <circle cx="60" cy="48" r="30" fill="#fb7185"/>
      <path d="M35 46 C34 26 54 20 60 28 C66 20 86 26 85 46 C83 66 70 73 60 73 C50 73 37 66 35 46 Z" fill="#f43f5e"/>
      <circle cx="60" cy="44" r="14" fill="#fda4af"/>
      <circle cx="60" cy="44" r="6.5" fill="#fde047"/>
    </svg>`
  },

  hydrangea: {
    id: 'hydrangea',
    name: 'Cẩm Tú Cầu Xanh',
    tier: 2,
    unlockedAtDay: 3,
    unlockMode: 'auto',
    unlockCost: 0,
    unlockedAtLevel: 4,
    cost: 11,
    basePrice: 28,
    defaultStock: 10,
    maxStock: 25,
    color: '#38bdf8',
    meaning: 'Lòng biết ơn & sự chân thành sâu sắc',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 82 L60 152" stroke="#65a30d" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <path d="M58 116 C34 98 24 114 34 128 C46 132 54 124 58 116 Z" fill="#84cc16"/>
      <path d="M62 122 C86 104 96 120 86 134 C74 138 66 130 62 122 Z" fill="#65a30d"/>
      <circle cx="60" cy="50" r="31" fill="#bae6fd"/>
      <g fill="#38bdf8">
        <circle cx="46" cy="40" r="8"/><circle cx="74" cy="40" r="8"/>
        <circle cx="60" cy="28" r="8"/><circle cx="46" cy="60" r="8"/>
        <circle cx="74" cy="60" r="8"/><circle cx="60" cy="68" r="7"/>
      </g>
      <circle cx="60" cy="49" r="9.5" fill="#0284c7"/>
      <circle cx="60" cy="49" r="3" fill="#fef08a"/>
    </svg>`
  },

  // === NGÀY 5 (HOA QUÝ TỘC HOÀNG GIA: SEN HỒNG, LAN HỒ ĐIỆP, ANH ĐÀO) ===
  lotus: {
    id: 'lotus',
    name: 'Hoa Sen Hồng',
    tier: 2,
    unlockedAtDay: 5,
    unlockMode: 'purchase',
    unlockCost: 85,
    unlockedAtLevel: 5,
    cost: 12,
    basePrice: 30,
    defaultStock: 8,
    maxStock: 20,
    color: '#ffb4a2',
    meaning: 'Thanh cao thoát tục & an nhiên',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 80 L60 152" stroke="#65a30d" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <path d="M26 66 C28 46 42 32 60 20 C78 32 92 46 94 66 C86 80 72 82 60 82 C48 82 34 80 26 66 Z" fill="#fbcfe8"/>
      <path d="M36 66 C38 48 48 34 60 22 C72 34 82 48 84 66 C76 78 68 80 60 80 C52 80 44 78 36 66 Z" fill="#f472b6"/>
      <path d="M48 64 C50 46 55 32 60 24 C65 32 70 46 72 64 C68 74 64 76 60 76 C56 76 52 74 48 64 Z" fill="#f9a8d4"/>
      <ellipse cx="60" cy="54" rx="8" ry="4" fill="#fbbf24"/>
    </svg>`
  },

  orchid: {
    id: 'orchid',
    name: 'Lan Hồ Điệp Tím',
    tier: 2,
    unlockedAtDay: 5,
    unlockMode: 'purchase',
    unlockCost: 95,
    unlockedAtLevel: 5,
    cost: 14,
    basePrice: 35,
    defaultStock: 8,
    maxStock: 20,
    color: '#c026d3',
    meaning: 'Vương giả quyền quý & tinh tế',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 80 Q72 114 60 152" stroke="#65a30d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <ellipse cx="38" cy="44" rx="19" ry="14" fill="#f0abfc" transform="rotate(-18 38 44)"/>
      <ellipse cx="82" cy="44" rx="19" ry="14" fill="#f0abfc" transform="rotate(18 82 44)"/>
      <ellipse cx="60" cy="27" rx="14" ry="18" fill="#e879f9"/>
      <ellipse cx="48" cy="64" rx="12" ry="14" fill="#d946ef" transform="rotate(15 48 64)"/>
      <ellipse cx="72" cy="64" rx="12" ry="14" fill="#d946ef" transform="rotate(-15 72 64)"/>
      <path d="M51 50 C51 64 69 64 69 50 Z" fill="#a21caf"/>
      <circle cx="60" cy="49" r="4" fill="#facc15"/>
    </svg>`
  },

  cherry_blossom: {
    id: 'cherry_blossom',
    name: 'Hoa Anh Đào',
    tier: 2,
    unlockedAtDay: 5,
    unlockMode: 'purchase',
    unlockCost: 100,
    unlockedAtLevel: 5,
    cost: 13,
    basePrice: 32,
    defaultStock: 8,
    maxStock: 20,
    color: '#fbcfe8',
    meaning: 'Tuổi thanh xuân & khởi đầu may mắn',
    svg: `<svg viewBox="0 0 120 155" class="flower-art">
      <path d="M60 76 Q52 114 60 152" stroke="#78350f" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 110 Q42 96 34 86" stroke="#78350f" stroke-width="3" stroke-linecap="round" fill="none"/>
      <g fill="#fbcfe8">
        <circle cx="60" cy="28" r="12"/><circle cx="40" cy="43" r="12"/>
        <circle cx="80" cy="43" r="12"/><circle cx="48" cy="64" r="12"/>
        <circle cx="72" cy="64" r="12"/>
      </g>
      <circle cx="60" cy="48" r="10" fill="#f472b6"/>
      <circle cx="60" cy="48" r="4.5" fill="#fef08a"/>
    </svg>`
  }
};

// 2. VẬT LIỆU TRANG TRÍ (GIẤY LÓT TRONG, GIẤY GÓI NGOÀI & RUY BĂNG NƠ LỤA)
const DECOR_DATA = {
  innerPapers: [
    {
      id: 'silk_white',
      name: 'Lụa Trắng',
      color: '#ffffff',
      border: '#cbd5e1',
      pleat: '#f1f5f9',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#e2e8f0" stroke-width="1.6" fill="none"/></svg>`
    },
    {
      id: 'silk_blush',
      name: 'Lụa Hồng Phấn',
      color: '#ffe4e6',
      border: '#fda4af',
      pleat: '#fff1f2',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#ffe4e6" stroke="#fda4af" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#fecdd3" stroke-width="1.6" fill="none"/></svg>`
    },
    {
      id: 'silk_cream',
      name: 'Vani Kem',
      color: '#fef3c7',
      border: '#fcd34d',
      pleat: '#fffbeb',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#fef3c7" stroke="#fcd34d" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#fde68a" stroke-width="1.6" fill="none"/></svg>`
    },
    {
      id: 'silk_mint',
      name: 'Lụa Bạc Hà',
      color: '#d1fae5',
      border: '#6ee7b7',
      pleat: '#ecfdf5',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#d1fae5" stroke="#6ee7b7" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#a7f3d0" stroke-width="1.6" fill="none"/></svg>`
    },
    {
      id: 'silk_lavender',
      name: 'Lụa Tím Sương',
      color: '#ede9fe',
      border: '#c4b5fd',
      pleat: '#f5f3ff',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#ede9fe" stroke="#c4b5fd" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#ddd6fe" stroke-width="1.6" fill="none"/></svg>`
    },
    {
      id: 'silk_peach',
      name: 'Lụa Cam Đào',
      color: '#ffedd5',
      border: '#fdba74',
      pleat: '#fff7ed',
      thumbSvg: `<svg viewBox="0 0 60 60"><path d="M10 46 Q14 14 22 10 Q28 18 30 8 Q34 18 40 10 Q46 14 50 46 L30 54 Z" fill="#ffedd5" stroke="#fdba74" stroke-width="2"/><path d="M18 44 Q23 22 25 14 M30 50 L30 12 M42 44 Q37 22 35 14" stroke="#fed7aa" stroke-width="1.6" fill="none"/></svg>`
    }
  ],

  papers: [
    {
      id: 'pink_pastel',
      name: 'Hồng Pastel',
      color: '#ffcad4',
      border: '#f4acb7',
      innerFold: '#ffe5ec',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#ffcad4" stroke="#f4acb7" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#ffe5ec"/></svg>`
    },
    {
      id: 'kraft_vintage',
      name: 'Kraft Vintage',
      color: '#ddb892',
      border: '#b08968',
      innerFold: '#ede0d4',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#ddb892" stroke="#b08968" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#ede0d4"/></svg>`
    },
    {
      id: 'snow_white',
      name: 'Trắng Tuyết',
      color: '#f8f9fa',
      border: '#cbd5e1',
      innerFold: '#ffffff',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#f8f9fa" stroke="#cbd5e1" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#ffffff"/></svg>`
    },
    {
      id: 'mint_green',
      name: 'Xanh Mint',
      color: '#c7f9cc',
      border: '#80ed99',
      innerFold: '#d8f3dc',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#c7f9cc" stroke="#80ed99" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#d8f3dc"/></svg>`
    },
    {
      id: 'lavender_mist',
      name: 'Tím Lavender',
      color: '#e0aaff',
      border: '#c77dff',
      innerFold: '#f3e8ff',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#e0aaff" stroke="#c77dff" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#f3e8ff"/></svg>`
    },
    {
      id: 'wine_red_paper',
      name: 'Đỏ Đô',
      color: '#9d0208',
      border: '#6a040f',
      innerFold: '#ba181b',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#9d0208" stroke="#6a040f" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#ba181b"/></svg>`
    },
    {
      id: 'cream_yellow',
      name: 'Vàng Kem',
      color: '#ffeedb',
      border: '#f59e0b',
      innerFold: '#fffbeb',
      thumbSvg: `<svg viewBox="0 0 60 60"><polygon points="30,55 6,22 16,8 30,14 44,8 54,22" fill="#ffeedb" stroke="#f59e0b" stroke-width="2.5"/><path d="M30,55 L20,32 L40,32 Z" fill="#fffbeb"/></svg>`
    }
  ],

  ribbons: [
    {
      id: 'wine_red',
      name: 'Đỏ Đô',
      color: '#9d0208',
      accentColor: '#6a040f',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#9d0208"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#9d0208"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#9d0208"/><path d="M28 26 Q18 42 15 54" stroke="#9d0208" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#9d0208" stroke-width="3" fill="none"/></svg>`
    },
    {
      id: 'baby_pink',
      name: 'Hồng Phấn',
      color: '#ff758f',
      accentColor: '#c9184a',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#ff758f"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#ff758f"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#ff758f"/><path d="M28 26 Q18 42 15 54" stroke="#ff758f" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#ff758f" stroke-width="3" fill="none"/></svg>`
    },
    {
      id: 'pearl_white',
      name: 'Trắng',
      color: '#ffffff',
      accentColor: '#94a3b8',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/><path d="M28 26 Q18 42 15 54" stroke="#cbd5e1" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#cbd5e1" stroke-width="3" fill="none"/></svg>`
    },
    {
      id: 'golden_satin',
      name: 'Vàng Gold',
      color: '#f59e0b',
      accentColor: '#b45309',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#f59e0b"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#f59e0b"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#f59e0b"/><path d="M28 26 Q18 42 15 54" stroke="#f59e0b" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#f59e0b" stroke-width="3" fill="none"/></svg>`
    },
    {
      id: 'pastel_blue',
      name: 'Xanh Pastel',
      color: '#93c5fd',
      accentColor: '#2563eb',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#93c5fd"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#93c5fd"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#93c5fd"/><path d="M28 26 Q18 42 15 54" stroke="#93c5fd" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#93c5fd" stroke-width="3" fill="none"/></svg>`
    },
    {
      id: 'soft_purple',
      name: 'Tím Nhạt',
      color: '#c084fc',
      accentColor: '#7e22ce',
      thumbSvg: `<svg viewBox="0 0 60 60"><circle cx="30" cy="24" r="5" fill="#c084fc"/><path d="M30 24 C14 10 10 32 27 28 Z" fill="#c084fc"/><path d="M30 24 C46 10 50 32 33 28 Z" fill="#c084fc"/><path d="M28 26 Q18 42 15 54" stroke="#c084fc" stroke-width="3" fill="none"/><path d="M32 26 Q42 42 45 54" stroke="#c084fc" stroke-width="3" fill="none"/></svg>`
    }
  ],

  cards: [
    {
      id: 'birthday',
      name: 'Sinh Nhật',
      sampleMsg: 'Chúc bạn tuổi mới rạng rỡ như đóa hoa!',
      thumbSvg: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="40" rx="6" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/><text x="30" y="34" font-size="20" text-anchor="middle">🎂</text></svg>`
    },
    {
      id: 'anniversary',
      name: 'Kỷ Niệm',
      sampleMsg: 'Mãi mãi bên nhau hạnh phúc trọn đời!',
      thumbSvg: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="40" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="2"/><text x="30" y="34" font-size="20" text-anchor="middle">💍</text></svg>`
    },
    {
      id: 'love',
      name: 'Tỏ Tình',
      sampleMsg: 'Yêu em từ cái nhìn đầu tiên!',
      thumbSvg: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="40" rx="6" fill="#fff1f2" stroke="#f43f5e" stroke-width="2"/><text x="30" y="34" font-size="20" text-anchor="middle">❤️</text></svg>`
    },
    {
      id: 'congrats',
      name: 'Khai Trương',
      sampleMsg: 'Khai trương hồng phát, tấn tài tấn lộc!',
      thumbSvg: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="40" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="2"/><text x="30" y="34" font-size="20" text-anchor="middle">🎉</text></svg>`
    },
    {
      id: 'gratitude',
      name: 'Cảm Ơn',
      sampleMsg: 'Chân thành cảm ơn sự đồng hành của bạn!',
      thumbSvg: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="40" rx="6" fill="#f0fdf4" stroke="#22c55e" stroke-width="2"/><text x="30" y="34" font-size="20" text-anchor="middle">🌸</text></svg>`
    }
  ]
};

// 2B. KIỂU DÁNG ĐÓNG GÓI ĐƠN HÀNG (BÓ NÓN, HỘP TRÒN, GIỎ MÂY)
const CONTAINER_STYLES_DATA = {
  cone: { id: 'cone', name: 'Bó Giấy Hình Nón', shortName: 'Bó Nón', icon: '💐', priceAdd: 0 },
  box: { id: 'box', name: 'Hộp Quà Tròn', shortName: 'Hộp Tròn', icon: '🎁', priceAdd: 10 },
  basket: { id: 'basket', name: 'Giỏ Mây Cắm Hoa', shortName: 'Giỏ Hoa', icon: '🧺', priceAdd: 14 }
};

// 3. KHÁCH HÀNG MINH HỌA CHIBI DỄ THƯƠNG
const CUSTOMERS_DATA = [
  {
    id: 'c_sinh_vien',
    name: 'Minh Khôi - Sinh Viên',
    stylePref: 'Lãng mạn',
    thumbEmoji: '🎒',
    dialogue: 'Chị ơi gói giúp em thật khéo để em mang đi tặng người thương nha!',
    avatarSvg: `<img src="assets/customers/boy.png" alt="Minh Khôi" class="chibi-character-img" draggable="false">`
  },
  {
    id: 'c_me_be',
    name: 'Chị Linh & Bé Bơ',
    stylePref: 'Ngọt ngào',
    thumbEmoji: '👶',
    dialogue: 'Hai mẹ con ghé chọn ít hoa xinh đem về trang trí góc nhà nè!',
    avatarSvg: `<img src="assets/customers/mom_baby.png" alt="Chị Linh & Bé Bơ" class="chibi-character-img" draggable="false">`
  },
  {
    id: 'c_co_nang_toc_xoan',
    name: 'Hạ Vy - Nàng Thơ',
    stylePref: 'Thanh lịch',
    thumbEmoji: '💜',
    dialogue: 'Mình mê nhất hương hoa tươi buổi sớm, làm giúp mình kiểu thật tinh tế nhé!',
    avatarSvg: `<img src="assets/customers/curly_girl.png" alt="Hạ Vy" class="chibi-character-img" draggable="false">`
  },
  {
    id: 'c_ba_ngoai',
    name: 'Bà Ngoại Hiền Hậu',
    stylePref: 'Trang nhã',
    thumbEmoji: '👵',
    dialogue: 'Bà chọn chút hoa tươi để cắm bàn trà chiều cùng con cháu đây.',
    avatarSvg: `<img src="assets/customers/grandma.png" alt="Bà Ngoại" class="chibi-character-img" draggable="false">`
  },
  {
    id: 'c_gia_dinh',
    name: 'Ông Ngoại & Gia Đình',
    stylePref: 'Ấm áp',
    thumbEmoji: '🌻',
    dialogue: 'Cả nhà mình cùng đi dạo ghé tiệm mua hoa chúc mừng cuối tuần!',
    avatarSvg: `<img src="assets/customers/grandpa_family.png" alt="Ông Ngoại & Gia Đình" class="chibi-character-img wide-cust" draggable="false">`
  }
];

// 4. SỰ KIỆN TRONG NGÀY
const GAME_EVENTS = {
  normal: {
    name: 'Sáng Bình Yên ☀️',
    desc: 'Một ngày kinh doanh êm đềm với những đơn hoa tươi thắm.',
    preferredFlower: null
  },
  valentine: {
    name: 'Lễ Tình Nhân 14/2 ❤️',
    desc: 'Hoa hồng đỏ và thiệp tình yêu bán chạy gấp đôi!',
    preferredFlower: 'red_rose'
  },
  womens_day: {
    name: 'Quốc Tế Phụ Nữ 8/3 💐',
    desc: 'Tôn vinh phái đẹp! Hoa tulip và hoa cẩm chướng đắt khách!',
    preferredFlower: 'tulip_pink'
  },
  wedding_season: {
    name: 'Mùa Cưới Rực Rỡ 💍',
    desc: 'Mùa uyên ương! Khách chuộng hoa hồng trắng và hoa ly!',
    preferredFlower: 'white_rose'
  }
};

// 5. HỆ THỐNG NÂNG CẤP TIỆM HOA ĐA CẤP ĐỘ (MỖI HẠNG MỤC CÓ 3 CẤP ĐỘ RÕ RÀNG)
const UPGRADES_DATA = [
  {
    id: 'fast_hands',
    name: 'Bàn Tay Khéo Léo',
    icon: '⚡',
    category: 'Tốc độ cắm & gói',
    desc: 'Tăng tốc độ thao tác cắm hoa/gói quà và giúp khách kiên nhẫn chờ lâu hơn.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        cost: 50,
        effectLabel: '+25% tốc độ cắm hoa • +8% kiên nhẫn khách',
        speedMult: 0.75,
        patienceBonus: 0.08
      },
      {
        level: 2,
        cost: 110,
        effectLabel: '+50% tốc độ cắm hoa • +16% kiên nhẫn khách',
        speedMult: 0.55,
        patienceBonus: 0.16
      },
      {
        level: 3,
        cost: 190,
        effectLabel: '+75% tốc độ cắm hoa • +25% kiên nhẫn khách',
        speedMult: 0.38,
        patienceBonus: 0.25
      }
    ]
  },
  {
    id: 'flower_cooler',
    name: 'Kệ Mát & Kho Hoa Tươi',
    icon: '❄️',
    category: 'Dung lượng kệ & nhập hoa',
    desc: 'Mở rộng sức chứa từng xô hoa trên kệ và giảm chi phí nhập hoa tại Chợ Sỉ.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        cost: 70,
        effectLabel: '+10 sức chứa mỗi xô • Giảm 10% giá nhập hoa',
        capacityBonus: 10,
        restockDiscount: 0.10
      },
      {
        level: 2,
        cost: 150,
        effectLabel: '+20 sức chứa mỗi xô • Giảm 20% giá nhập hoa',
        capacityBonus: 20,
        restockDiscount: 0.20
      },
      {
        level: 3,
        cost: 260,
        effectLabel: '+35 sức chứa mỗi xô • Giảm 30% giá nhập hoa',
        capacityBonus: 35,
        restockDiscount: 0.30
      }
    ]
  },
  {
    id: 'golden_shears',
    name: 'Kéo Tỉa Mạ Vàng & Giấy Lụa',
    icon: '✂️',
    category: 'Giá bán & tiền boa',
    desc: 'Nâng tầm thẩm mỹ bó hoa, tăng giá bán đơn hàng và tiền boa từ khách hài lòng.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        cost: 80,
        effectLabel: '+12% giá bán bó hoa • +10% tiền boa',
        priceBonus: 0.12,
        tipBonus: 0.10
      },
      {
        level: 2,
        cost: 160,
        effectLabel: '+24% giá bán bó hoa • +20% tiền boa',
        priceBonus: 0.24,
        tipBonus: 0.20
      },
      {
        level: 3,
        cost: 280,
        effectLabel: '+38% giá bán bó hoa • +35% tiền boa',
        priceBonus: 0.38,
        tipBonus: 0.35
      }
    ]
  },
  {
    id: 'vip_signboard',
    name: 'Biển Hiệu Đón Khách VIP',
    icon: '👑',
    category: 'Khách VIP & lưu lượng',
    desc: 'Thu hút thêm khách hàng VIP chi tiêu cao và tăng số khách ghé tiệm mỗi ngày.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        cost: 90,
        effectLabel: '25% khách VIP (+35% giá đơn) • Khách đến nhanh +15%',
        vipChance: 0.25,
        vipPriceMult: 1.35,
        spawnIntervalMs: 10200,
        extraQueueSlots: 0
      },
      {
        level: 2,
        cost: 180,
        effectLabel: '45% khách VIP (+40% giá đơn) • Khách đến nhanh +30%',
        vipChance: 0.45,
        vipPriceMult: 1.40,
        spawnIntervalMs: 8400,
        extraQueueSlots: 0
      },
      {
        level: 3,
        cost: 300,
        effectLabel: '65% khách VIP (+50% giá đơn) • Tối đa 4 khách xếp hàng',
        vipChance: 0.65,
        vipPriceMult: 1.50,
        spawnIntervalMs: 7400,
        extraQueueSlots: 1
      }
    ]
  },
  {
    id: 'shop_decor',
    name: 'Nội Thất & Đèn Trang Trí Tiệm',
    icon: '🪴',
    category: 'Trang trí tiệm & giữ chân khách',
    desc: 'Trang trí dây đèn lung linh, chậu cây treo & hương hoa giúp khách thư thái chờ lâu hơn và boa thêm xu.',
    maxLevel: 3,
    levels: [
      {
        level: 1,
        cost: 60,
        effectLabel: 'Treo dây đèn ấm áp • Giảm 15% tốc độ tụt kiên nhẫn • +6% boa',
        patienceDecayMult: 0.85,
        tipBonus: 0.06
      },
      {
        level: 2,
        cost: 135,
        effectLabel: 'Thêm chậu treo & kệ gỗ xinh • Giảm 28% tụt kiên nhẫn • +14% boa',
        patienceDecayMult: 0.72,
        tipBonus: 0.14
      },
      {
        level: 3,
        cost: 240,
        effectLabel: 'Tiệm Boutique rực rỡ • Giảm 40% tụt kiên nhẫn • +22% boa',
        patienceDecayMult: 0.60,
        tipBonus: 0.22
      }
    ]
  }
];

// 6. HỆ THỐNG PHỐI MÀU & TÔNG BÓ HOA (COLOR HARMONY)
const COLOR_TONE_META = {
  romantic: {
    id: 'romantic',
    name: 'Lãng Mạn Đỏ - Hồng',
    badge: '🌹 Tông Lãng Mạn',
    hint: 'Phối hợp hoa đỏ/hồng cùng lụa phấn/trắng & giấy Hồng hoặc Đỏ Đô',
    accent: '#e11d48'
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel Ngọt Ngào',
    badge: '🌸 Tông Pastel',
    hint: 'Ưu tiên lụa nhẹ, giấy Hồng Pastel / Xanh Mint / Tím Lavender / Trắng',
    accent: '#ec4899'
  },
  sunny: {
    id: 'sunny',
    name: 'Năng Lượng Rực Rỡ',
    badge: '☀️ Tông Rực Rỡ',
    hint: 'Hợp giấy Vàng Kem / Kraft Vintage / Trắng & nơ Vàng Gold',
    accent: '#d97706'
  },
  elegant: {
    id: 'elegant',
    name: 'Sang Trọng Quý Phái',
    badge: '👑 Tông Sang Trọng',
    hint: 'Hợp lụa Trắng / Tím, giấy Trắng Tuyết / Đỏ Đô / Lavender & nơ Gold/Trắng',
    accent: '#7e22ce'
  }
};

const FLOWER_TONES_MAP = {
  red_rose: ['romantic', 'elegant'],
  white_rose: ['pastel', 'elegant', 'romantic'],
  daisy: ['pastel', 'sunny'],
  baby_breath: ['pastel', 'romantic', 'elegant', 'sunny'],
  sunflower: ['sunny'],
  tulip_pink: ['pastel', 'romantic'],
  tulip_red: ['romantic', 'elegant'],
  carnation: ['romantic', 'pastel'],
  lavender: ['elegant', 'pastel'],
  gerbera: ['sunny', 'romantic'],
  pompon_mum: ['elegant', 'pastel'],
  dahlia: ['romantic', 'elegant'],
  lily_white: ['elegant', 'pastel'],
  peony: ['romantic', 'pastel', 'elegant'],
  hydrangea: ['pastel', 'elegant'],
  lotus: ['pastel', 'elegant'],
  orchid: ['elegant', 'romantic'],
  cherry_blossom: ['pastel', 'romantic']
};

Object.keys(FLOWER_TONES_MAP).forEach(id => {
  if (FLOWERS_DATA[id]) {
    FLOWERS_DATA[id].tones = FLOWER_TONES_MAP[id];
  }
});

const DECOR_TONES_MAP = {
  innerPapers: {
    silk_white: ['romantic', 'pastel', 'sunny', 'elegant'],
    silk_blush: ['romantic', 'pastel'],
    silk_cream: ['sunny', 'pastel', 'elegant'],
    silk_mint: ['pastel', 'sunny'],
    silk_lavender: ['elegant', 'pastel'],
    silk_peach: ['sunny', 'romantic', 'pastel']
  },
  papers: {
    pink_pastel: ['pastel', 'romantic'],
    kraft_vintage: ['sunny', 'romantic', 'elegant'],
    snow_white: ['pastel', 'elegant', 'romantic', 'sunny'],
    mint_green: ['pastel', 'sunny'],
    lavender_mist: ['elegant', 'pastel'],
    wine_red_paper: ['romantic', 'elegant'],
    cream_yellow: ['sunny', 'pastel']
  },
  ribbons: {
    wine_red: ['romantic', 'elegant'],
    baby_pink: ['pastel', 'romantic'],
    pearl_white: ['pastel', 'elegant', 'romantic', 'sunny'],
    golden_satin: ['elegant', 'sunny', 'romantic'],
    pastel_blue: ['pastel', 'sunny'],
    soft_purple: ['elegant', 'pastel']
  }
};

Object.keys(DECOR_TONES_MAP).forEach(group => {
  if (DECOR_DATA[group]) {
    DECOR_DATA[group].forEach(item => {
      item.tones = DECOR_TONES_MAP[group][item.id] || ['pastel'];
    });
  }
});

// 7. VẬT PHẨM TRANG TRÍ KHÔNG GIAN TIỆM HOA (SHOP ATMOSPHERE)
const ATMOSPHERE_ITEMS_DATA = [
  {
    id: 'lofi_radio',
    name: 'Radio Lofi Cổ Điển',
    icon: '📻',
    cost: 45,
    desc: 'Đặt chiếc radio gỗ phát nhạc thư giãn ngay góc quầy (bấm trực tiếp vào radio để bật/tắt nhạc).',
    effectLabel: 'Giảm 10% tốc độ tụt kiên nhẫn • +5% tiền boa',
    patienceReduction: 0.10,
    rushBonusReduction: 0.04,
    tipBonus: 0.05
  },
  {
    id: 'fairy_lights',
    name: 'Đèn Nhấp Nháy Ấm Áp',
    icon: '💡',
    cost: 55,
    desc: 'Treo dây đèn vàng hồng lung linh khắp quầy hoa, giúp không gian ấm cúng vào giờ cao điểm.',
    effectLabel: 'Giảm 12% tụt kiên nhẫn (giảm thêm 6% lúc Cao Điểm)',
    patienceReduction: 0.12,
    rushBonusReduction: 0.06,
    tipBonus: 0.04
  },
  {
    id: 'cozy_rug',
    name: 'Thảm Trải Sàn Hoa Cúc',
    icon: '🧶',
    cost: 65,
    desc: 'Thảm dệt thủ công êm ái dưới chân quầy giúp khách xếp hàng thư thái hơn.',
    effectLabel: 'Giảm 10% tốc độ tụt kiên nhẫn • +6% tiền boa',
    patienceReduction: 0.10,
    rushBonusReduction: 0.04,
    tipBonus: 0.06
  },
  {
    id: 'corner_plants',
    name: 'Chậu Cây Monstera & Sen Đá',
    icon: '🪴',
    cost: 75,
    desc: 'Những chậu cây xanh mướt đặt cạnh quầy làm dịu mát không khí cho khách chờ.',
    effectLabel: 'Giảm 12% tốc độ tụt kiên nhẫn • +6% tiền boa',
    patienceReduction: 0.12,
    rushBonusReduction: 0.04,
    tipBonus: 0.06
  },
  {
    id: 'sleepy_cat',
    name: 'Mèo Cưng Ngủ Trưa Góc Quầy',
    icon: '🐱',
    cost: 95,
    desc: 'Bé mèo mướp cuộn tròn ngủ gật cạnh bảng kẹp đơn! Khách mê mẩn ngắm mèo nên đợi rất kiên nhẫn (bấm để vuốt ve!).',
    effectLabel: 'Giảm 16% tụt kiên nhẫn • +10% tiền boa • Tương tác được!',
    patienceReduction: 0.16,
    rushBonusReduction: 0.08,
    tipBonus: 0.10
  }
];
