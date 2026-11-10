// js/game.js - Logic Lõi Game FLOWER SHOP STORY: Phân Tách Giai Đoạn Chơi, Cân Bằng Kinh Tế & Chơi Lại

const INITIAL_GOLD = 160;

class FlowerShopGame {
  constructor() {
    this.state = {
      gold: INITIAL_GOLD,
      level: 1,
      currentDay: 1,
      day: 1,
      hour: 7,
      minute: 0,
      phase: 'PREPARING', // 'PREPARING' (Soạn hàng sáng) | 'OPEN' (Mở bán) | 'CLOSING' | 'CLOSED'
      isPaused: false,
      isRushHour: false,
      completedOrdersCount: 0,
      reputation: 5.0,
      currentEventKey: 'normal',
      flowerStocks: {},
      innerPaperStocks: {},
      paperStocks: {},
      ribbonStocks: {},
      unlockedFlowers: {}, // Lưu trạng thái mở khóa từng loài hoa
      upgrades: {},
      atmosphereItems: {}, // Đồ trang trí không gian tiệm (radio, đèn, thảm, cây, mèo ngủ)
      customRecipes: [], // Các mẫu bó hoa độc quyền do người chơi tự sáng tạo
      dayStartSnapshot: null, // Bản lưu đầu ngày để hỗ trợ "Chơi Lại Ngày Này"

      // Hàng đợi khách hàng
      customersQueue: [],
      activeCustomerIdx: 0,

      // Bàn cắm hoa hiện tại: Luôn trống ban đầu để người chơi tự tay cắm & chọn lót trong/giấy ngoài/nơ
      workbench: {
        trimmed: false,
        containerType: 'cone', // 'cone' (Bó Hình Nón) | 'box' (Hộp Quà Tròn)
        flowers: [],
        innerPaper: null,
        paper: null,
        ribbon: null,
        card: null
      },

      dayStats: {
        orders: 0,
        revenue: 0,
        tips: 0,
        ratings: []
      }
    };

    this.gameLoopTimer = null;
    this.customerSpawnTimer = null;
    this.endDayBufferTimer = null;
    this.activeTool = 'none'; // 'none' | 'shears'
    this.maxQueueLength = 3;
    this.dragState = null;
    this.suppressNextBucketClick = false;
    this.justSnappedStemIdx = -1;
    this.isMobilePortrait = false;
    this.activeMobilePrepTab = 'plan';
    this.activeMobilePlayTab = 'customers';

    // Trạng thái Mini-game thắt nơ
    this.ribbonMinigame = {
      active: false,
      pos: 50,
      dir: 1,
      rafId: null,
      lastTime: 0,
      locked: false
    };

    // Bản nháp Góc Sáng Tạo Mẫu Hoa Độc Quyền
    this.diyDraft = {
      containerType: 'cone',
      flowers: {},
      innerPaper: 'silk_white',
      paper: 'pink_pastel',
      ribbon: 'wine_red'
    };

    this.init();
  }

  init() {
    this.loadSaveData();
    this.normalizeUpgrades();
    this.syncDayAutoUnlocks();
    this.maxQueueLength = this.getMaxQueueLength();
    this.applyCraftSpeedStyle();
    this.renderShopDecorVisual();
    this.setupWindowScaling();
    this.renderShelves();
    this.renderDecorPalettes();
    this.renderUpgradesList();
    this.renderRestockGrid();
    this.bindEvents();
    this.updateHUD();

    // Chừa trống bàn cắm hoa ban đầu (chỉ vẽ nền trống, không cho sẵn bó hoa)
    this.renderBouquetVisual();

    // Khởi đầu ở giai đoạn chuẩn bị buổi sáng (chụp snapshot nếu chưa có)
    this.setupMorningPrepPhase(!this.state.dayStartSnapshot);

    // Vòng lặp thời gian
    this.startGameLoops();

    if (!localStorage.getItem('flowershop_tutorial_shown')) {
      setTimeout(() => {
        this.openModal('modal-tutorial');
        localStorage.setItem('flowershop_tutorial_shown', 'true');
      }, 500);
    }
  }

  // CHUYỂN ĐỔI DỮ LIỆU NÂNG CẤP CŨ SANG DẠNG CẤP ĐỘ (0..3)
  normalizeUpgrades() {
    if (this.state.upgrades['flower_signboard'] === true && !this.state.upgrades['vip_signboard']) {
      this.state.upgrades['vip_signboard'] = 1;
    }
    if (this.state.upgrades['cooling_flower_cooler'] === true && !this.state.upgrades['flower_cooler']) {
      this.state.upgrades['flower_cooler'] = 1;
    }
    delete this.state.upgrades['flower_signboard'];
    delete this.state.upgrades['cooling_flower_cooler'];

    UPGRADES_DATA.forEach(upg => {
      const val = this.state.upgrades[upg.id];
      if (val === true) this.state.upgrades[upg.id] = 1;
      else if (typeof val !== 'number' || val < 0) this.state.upgrades[upg.id] = 0;
      else this.state.upgrades[upg.id] = Math.min(upg.maxLevel, val);
    });
  }

  getUpgradeLevel(upgradeId) {
    return Number(this.state.upgrades[upgradeId] || 0);
  }

  getUpgradeBonus(upgradeId) {
    const lvl = this.getUpgradeLevel(upgradeId);
    if (lvl <= 0) return {};
    const upg = UPGRADES_DATA.find(u => u.id === upgradeId);
    return (upg && upg.levels[lvl - 1]) || {};
  }

  getMaxQueueLength() {
    const base = 3 + (this.getUpgradeBonus('vip_signboard').extraQueueSlots || 0);
    return base + (this.state.isRushHour ? 1 : 0);
  }

  getFlowerMaxStock(flower) {
    return flower.maxStock + (this.getUpgradeBonus('flower_cooler').capacityBonus || 0);
  }

  getFlowerRestockUnitCost(flower) {
    const discount = this.getUpgradeBonus('flower_cooler').restockDiscount || 0;
    return Math.max(1, Math.round(flower.cost * (1 - discount)));
  }

  applyCraftSpeedStyle() {
    const container = document.getElementById('game-container');
    if (!container) return;
    const mult = this.getUpgradeBonus('fast_hands').speedMult || 1;
    container.style.setProperty('--craft-anim-dur', `${Math.round(520 * mult)}ms`);
    container.style.setProperty('--stem-trans-dur', `${(0.3 * mult).toFixed(2)}s`);
  }

  getPatienceDecayMult() {
    let mult = this.getUpgradeBonus('shop_decor').patienceDecayMult || 1;
    let atmoReduction = 0;
    if (typeof ATMOSPHERE_ITEMS_DATA !== 'undefined') {
      ATMOSPHERE_ITEMS_DATA.forEach(item => {
        if (this.state.atmosphereItems && this.state.atmosphereItems[item.id]) {
          atmoReduction += item.patienceReduction || 0;
          if (this.state.isRushHour && item.rushBonusReduction) {
            atmoReduction += item.rushBonusReduction;
          }
        }
      });
    }
    mult = mult * Math.max(0.45, 1 - atmoReduction);
    return Math.max(0.35, mult);
  }

  getAtmosphereTipBonus() {
    let bonus = this.getUpgradeBonus('shop_decor').tipBonus || 0;
    if (typeof ATMOSPHERE_ITEMS_DATA !== 'undefined') {
      ATMOSPHERE_ITEMS_DATA.forEach(item => {
        if (this.state.atmosphereItems && this.state.atmosphereItems[item.id]) {
          bonus += item.tipBonus || 0;
        }
      });
    }
    return bonus;
  }

  renderShopDecorVisual() {
    const decorEl = document.getElementById('shop-interior-decor');
    const propsEl = document.getElementById('shop-counter-props');
    const custArea = document.getElementById('customer-area');
    const lvl = this.getUpgradeLevel('shop_decor');
    const atmo = this.state.atmosphereItems || {};

    if (custArea) {
      custArea.classList.remove('decor-lvl-1', 'decor-lvl-2', 'decor-lvl-3');
      if (lvl > 0) custArea.classList.add(`decor-lvl-${lvl}`);
    }

    if (decorEl) {
      let html = '';
      if (lvl >= 1 || atmo.fairy_lights) {
        html += `
          <div class="decor-fairy-lights" aria-hidden="true">
            <span class="bulb b1"></span><span class="bulb b2"></span><span class="bulb b3"></span>
            <span class="bulb b4"></span><span class="bulb b5"></span><span class="bulb b6"></span>
            <span class="bulb b7"></span><span class="bulb b8"></span>
          </div>
        `;
      }
      if (lvl >= 2 || atmo.corner_plants) {
        html += `
          <div class="decor-hanging-plant left">🌿</div>
          <div class="decor-hanging-plant right">🪴</div>
          <div class="decor-corner-monstera left">🌱</div>
        `;
      }
      if (atmo.cozy_rug) {
        html += `<div class="decor-cozy-rug" aria-hidden="true"></div>`;
      }
      if (lvl >= 3) {
        html += `<div class="decor-boutique-garland">✨🌸 Boutique Tiệm Hoa Nhỏ 🌸✨</div>`;
      }
      decorEl.innerHTML = html;
    }

    if (propsEl) {
      propsEl.innerHTML = '';
      if (atmo.lofi_radio) {
        const radioBtn = document.createElement('button');
        radioBtn.className = `counter-prop-btn prop-radio ${window.soundMgr.musicEnabled ? 'playing' : ''}`;
        radioBtn.title = 'Radio Lofi: Bấm để bật/tắt nhạc thư giãn!';
        radioBtn.innerHTML = `<span>📻</span><span>${window.soundMgr.musicEnabled ? '🎵 Lofi On' : 'Lofi Off'}</span>`;
        radioBtn.addEventListener('click', () => {
          const on = window.soundMgr.toggleMusic();
          const topMusicBtn = document.getElementById('btn-music-toggle');
          if (topMusicBtn) {
            topMusicBtn.querySelector('.icon').textContent = on ? '🎵' : '🎶';
            topMusicBtn.style.color = on ? '#2d6a4f' : '';
          }
          this.renderShopDecorVisual();
          this.showToast(on ? '📻 Radio Lofi đang phát nhạc thư giãn!' : '📻 Đã tắt Radio Lofi.');
        });
        propsEl.appendChild(radioBtn);
      }

      if (atmo.sleepy_cat) {
        const catBtn = document.createElement('button');
        catBtn.className = 'counter-prop-btn prop-cat';
        catBtn.title = 'Bé Mèo ngủ gật góc quầy! Bấm để vuốt ve nhé';
        catBtn.innerHTML = `<span>🐱</span><span>💤 Mèo cưng</span>`;
        catBtn.addEventListener('click', () => {
          window.soundMgr.playCatPurr();
          this.spawnHeartParticles();
          this.showToast('🐱 Meo~ Bé mèo thích thú dụi đầu! Khách nhìn ngắm vui vẻ hơn hẳn.');
        });
        propsEl.appendChild(catBtn);
      }
    }
  }

  loadSaveData() {
    const saved = localStorage.getItem('flowershop_saved_game');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state.gold = parsed.gold ?? INITIAL_GOLD;
        this.state.level = parsed.level ?? 1;
        this.state.currentDay = parsed.currentDay ?? parsed.day ?? 1;
        this.state.day = this.state.currentDay;
        this.state.completedOrdersCount = parsed.completedOrdersCount ?? 0;
        this.state.reputation = parsed.reputation ?? 5.0;
        this.state.currentEventKey = parsed.currentEventKey || 'normal';
        this.state.flowerStocks = parsed.flowerStocks || {};
        this.state.innerPaperStocks = parsed.innerPaperStocks || {};
        this.state.paperStocks = parsed.paperStocks || {};
        this.state.ribbonStocks = parsed.ribbonStocks || {};
        this.state.unlockedFlowers = parsed.unlockedFlowers || {};
        this.state.upgrades = parsed.upgrades || {};
        this.state.atmosphereItems = parsed.atmosphereItems || {};
        this.state.customRecipes = Array.isArray(parsed.customRecipes) ? parsed.customRecipes : [];
        this.state.dayStartSnapshot = parsed.dayStartSnapshot || null;
      } catch (e) {
        console.warn('Lỗi đọc lưu trữ:', e);
      }
    }

    // Đảm bảo tồn kho 18 loài hoa (khởi điểm vừa phải để có cảm giác soạn & nhập hàng)
    Object.keys(FLOWERS_DATA).forEach(flowerKey => {
      if (this.state.flowerStocks[flowerKey] === undefined) {
        const f = FLOWERS_DATA[flowerKey];
        this.state.flowerStocks[flowerKey] = Math.min(12, f.defaultStock);
      }
    });

    // Đảm bảo tồn kho giấy lót trong, giấy gói ngoài & ruy băng trong kho nguyên liệu
    DECOR_DATA.innerPapers.forEach(ip => {
      if (this.state.innerPaperStocks[ip.id] === undefined) this.state.innerPaperStocks[ip.id] = 6;
    });
    DECOR_DATA.papers.forEach(p => {
      if (this.state.paperStocks[p.id] === undefined) this.state.paperStocks[p.id] = 6;
    });
    DECOR_DATA.ribbons.forEach(r => {
      if (this.state.ribbonStocks[r.id] === undefined) this.state.ribbonStocks[r.id] = 6;
    });
  }

  saveGameData() {
    const dataToSave = {
      gold: this.state.gold,
      level: this.state.level,
      currentDay: this.state.currentDay,
      day: this.state.currentDay,
      completedOrdersCount: this.state.completedOrdersCount,
      reputation: this.state.reputation,
      currentEventKey: this.state.currentEventKey,
      flowerStocks: this.state.flowerStocks,
      innerPaperStocks: this.state.innerPaperStocks,
      paperStocks: this.state.paperStocks,
      ribbonStocks: this.state.ribbonStocks,
      unlockedFlowers: this.state.unlockedFlowers,
      upgrades: this.state.upgrades,
      atmosphereItems: this.state.atmosphereItems,
      customRecipes: this.state.customRecipes,
      dayStartSnapshot: this.state.dayStartSnapshot
    };
    localStorage.setItem('flowershop_saved_game', JSON.stringify(dataToSave));
  }

  captureDayStartSnapshot() {
    this.state.dayStartSnapshot = {
      gold: this.state.gold,
      level: this.state.level,
      currentDay: this.state.currentDay,
      completedOrdersCount: this.state.completedOrdersCount,
      reputation: this.state.reputation,
      currentEventKey: this.state.currentEventKey,
      flowerStocks: { ...this.state.flowerStocks },
      innerPaperStocks: { ...this.state.innerPaperStocks },
      paperStocks: { ...this.state.paperStocks },
      ribbonStocks: { ...this.state.ribbonStocks },
      unlockedFlowers: { ...this.state.unlockedFlowers },
      upgrades: { ...this.state.upgrades },
      atmosphereItems: { ...this.state.atmosphereItems },
      customRecipes: JSON.parse(JSON.stringify(this.state.customRecipes || []))
    };
  }

  replayCurrentDay() {
    clearTimeout(this.endDayBufferTimer);
    this.endDayBufferTimer = null;

    const snap = this.state.dayStartSnapshot;
    if (snap) {
      this.state.gold = snap.gold;
      this.state.level = snap.level;
      this.state.currentDay = snap.currentDay;
      this.state.day = snap.currentDay;
      this.state.completedOrdersCount = snap.completedOrdersCount;
      this.state.reputation = snap.reputation;
      this.state.currentEventKey = snap.currentEventKey;
      this.state.flowerStocks = { ...snap.flowerStocks };
      if (snap.innerPaperStocks) this.state.innerPaperStocks = { ...snap.innerPaperStocks };
      if (snap.paperStocks) this.state.paperStocks = { ...snap.paperStocks };
      if (snap.ribbonStocks) this.state.ribbonStocks = { ...snap.ribbonStocks };
      this.state.unlockedFlowers = { ...snap.unlockedFlowers };
      this.state.upgrades = { ...snap.upgrades };
      if (snap.atmosphereItems) this.state.atmosphereItems = { ...snap.atmosphereItems };
      if (Array.isArray(snap.customRecipes)) this.state.customRecipes = JSON.parse(JSON.stringify(snap.customRecipes));
    }

    this.normalizeUpgrades();
    this.syncDayAutoUnlocks();
    this.state.isRushHour = false;
    this.maxQueueLength = this.getMaxQueueLength();
    this.applyCraftSpeedStyle();
    this.renderShopDecorVisual();
    this.restartCustomerSpawnTimer();

    this.state.isPaused = false;
    this.state.customersQueue = [];
    this.state.activeCustomerIdx = 0;
    this.state.dayStats = { orders: 0, revenue: 0, tips: 0, ratings: [] };
    this.state.workbench.flowers = [];
    this.state.workbench.trimmed = false;
    this.state.workbench.innerPaper = null;
    this.state.workbench.paper = null;
    this.state.workbench.ribbon = null;
    this.state.workbench.card = null;
    if (this.activeTool !== 'none') this.setActiveTool('none');

    this.closeModal('modal-day-end');
    this.closeModal('modal-settings');
    this.renderShelves();
    this.renderDecorPalettes();
    this.renderUpgradesList();
    this.renderRestockGrid();
    this.renderBouquetVisual();
    this.setupMorningPrepPhase(false);
    this.saveGameData();

    window.soundMgr.playPickFlower();
    this.showToast(`🔄 Đã quay lại đầu Ngày ${this.state.currentDay}! Hãy soạn hoa và chuẩn bị lại nhé.`);
  }

  resetGameFromStart() {
    clearTimeout(this.endDayBufferTimer);
    this.endDayBufferTimer = null;
    localStorage.removeItem('flowershop_saved_game');

    this.state.gold = INITIAL_GOLD;
    this.state.level = 1;
    this.state.currentDay = 1;
    this.state.day = 1;
    this.state.isPaused = false;
    this.state.isRushHour = false;
    this.state.completedOrdersCount = 0;
    this.state.reputation = 5.0;
    this.state.currentEventKey = 'normal';
    this.state.unlockedFlowers = {};
    this.state.upgrades = {};
    this.state.atmosphereItems = {};
    this.state.customRecipes = [];
    this.state.customersQueue = [];
    this.state.activeCustomerIdx = 0;
    this.state.dayStats = { orders: 0, revenue: 0, tips: 0, ratings: [] };
    this.state.workbench = {
      trimmed: false,
      containerType: 'cone',
      flowers: [],
      innerPaper: null,
      paper: null,
      ribbon: null,
      card: null
    };

    Object.keys(FLOWERS_DATA).forEach(flowerKey => {
      const f = FLOWERS_DATA[flowerKey];
      this.state.flowerStocks[flowerKey] = Math.min(12, f.defaultStock);
    });
    DECOR_DATA.innerPapers.forEach(ip => { this.state.innerPaperStocks[ip.id] = 6; });
    DECOR_DATA.papers.forEach(p => { this.state.paperStocks[p.id] = 6; });
    DECOR_DATA.ribbons.forEach(r => { this.state.ribbonStocks[r.id] = 6; });

    this.normalizeUpgrades();
    this.syncDayAutoUnlocks();
    this.maxQueueLength = this.getMaxQueueLength();
    this.applyCraftSpeedStyle();
    this.renderShopDecorVisual();
    this.restartCustomerSpawnTimer();
    if (this.activeTool !== 'none') this.setActiveTool('none');

    const confirmBox = document.getElementById('reset-confirm-box');
    if (confirmBox) confirmBox.style.display = 'none';
    this.closeModal('modal-settings');
    this.closeModal('modal-day-end');

    this.renderShelves();
    this.renderDecorPalettes();
    this.renderUpgradesList();
    this.renderRestockGrid();
    this.renderBouquetVisual();
    this.setupMorningPrepPhase(true);
    this.saveGameData();

    window.soundMgr.playDoorBell();
    this.showToast(`🌱 Đã bắt đầu lại từ Ngày 1 với ${INITIAL_GOLD} 🪙 vốn khởi nghiệp!`);
  }

  showGameScreen(mode) {
    const prepScreen = document.getElementById('morning-prep-screen');
    const playfield = document.getElementById('main-playfield');
    const workbench = document.getElementById('workbench-area');

    if (mode === 'PREPARING') {
      if (prepScreen) prepScreen.style.display = 'flex';
      if (playfield) playfield.style.display = 'none';
      if (workbench) workbench.style.display = 'none';
      this.setMobilePrepTab(this.activeMobilePrepTab || 'plan');
    } else {
      if (prepScreen) prepScreen.style.display = 'none';
      if (playfield) playfield.style.display = 'grid';
      if (workbench) workbench.style.display = 'grid';
      this.setMobilePlayTab(this.activeMobilePlayTab || 'customers');
    }
    this.syncMobilePlayTabsVisibility();
  }

  setMobilePrepTab(tabName) {
    this.activeMobilePrepTab = tabName || 'plan';
    document.querySelectorAll('#mobile-prep-tabs .mobile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.prepTab === this.activeMobilePrepTab);
    });
    const prepMap = {
      plan: '.prep-col-plan',
      stock: '.prep-col-stock',
      decor: '.prep-col-decor'
    };
    Object.entries(prepMap).forEach(([key, sel]) => {
      const col = document.querySelector(sel);
      if (col) col.classList.toggle('mobile-panel-active', key === this.activeMobilePrepTab);
    });
  }

  setMobilePlayTab(tabName) {
    this.activeMobilePlayTab = tabName || 'customers';
    document.querySelectorAll('#mobile-play-tabs .mobile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.playTab === this.activeMobilePlayTab);
    });
    const container = document.getElementById('game-container');
    if (container) {
      container.dataset.mobileView = this.activeMobilePlayTab;
    }
  }

  syncMobilePlayTabsVisibility() {
    const playTabs = document.getElementById('mobile-play-tabs');
    const orderStrip = document.getElementById('mobile-order-strip');
    const show = !!(this.isMobilePortrait && this.state.phase !== 'PREPARING');
    if (playTabs) playTabs.style.display = show ? 'flex' : 'none';
    if (orderStrip) orderStrip.style.display = show ? 'flex' : 'none';
  }

  // ĐỒNG BỘ MỞ KHÓA TỰ ĐỘNG THEO NGÀY (NGÀY 1, 2, 3)
  syncDayAutoUnlocks() {
    Object.values(FLOWERS_DATA).forEach(flower => {
      if (flower.unlockMode === 'auto' && this.state.currentDay >= flower.unlockedAtDay) {
        this.state.unlockedFlowers[flower.id] = true;
      }
    });
  }

  isFlowerUnlocked(flowerId) {
    const flower = FLOWERS_DATA[flowerId];
    if (!flower) return false;
    if (flower.unlockMode === 'auto') {
      return this.state.currentDay >= flower.unlockedAtDay;
    }
    return this.state.currentDay >= flower.unlockedAtDay && !!this.state.unlockedFlowers[flowerId];
  }

  canPurchaseUnlock(flowerId) {
    const flower = FLOWERS_DATA[flowerId];
    if (!flower) return false;
    return (
      flower.unlockMode === 'purchase' &&
      this.state.currentDay >= flower.unlockedAtDay &&
      !this.state.unlockedFlowers[flowerId]
    );
  }

  unlockFlowerWithGold(flowerId) {
    const flower = FLOWERS_DATA[flowerId];
    if (!flower || !this.canPurchaseUnlock(flowerId)) return;

    if (this.state.gold < flower.unlockCost) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Không đủ xu! Cần ${flower.unlockCost} 🪙 để mở khóa ${flower.name}.`);
      return;
    }

    this.state.gold -= flower.unlockCost;
    this.state.unlockedFlowers[flowerId] = true;
    this.state.flowerStocks[flowerId] = Math.max(this.state.flowerStocks[flowerId] || 0, flower.defaultStock);

    window.soundMgr.playLevelUp();
    this.showToast(`🎉 Đã mở khóa ${flower.name} (-${flower.unlockCost} 🪙)! Đã nhập sẵn ${this.state.flowerStocks[flowerId]} bông lên kệ!`);

    this.renderShelves();
    this.renderRestockGrid();
    this.renderUpgradesList();
    this.renderMorningUnlockNotice();
    this.renderMorningStockGrid();
    this.updateHUD();
    this.saveGameData();
  }

  setupWindowScaling() {
    const resizeHandler = () => {
      const container = document.getElementById('game-container');
      if (!container) return;
      const baseW = 1400;
      const baseH = 788;
      const vv = window.visualViewport;
      const vw = (vv ? vv.width : window.innerWidth) || 1400;
      const vh = (vv ? vv.height : window.innerHeight) || 788;

      // Bật chế độ Responsive Mobile Portrait (1:1 không thu nhỏ) khi màn hình dọc hoặc rất hẹp
      const isPortrait = vw < 760 || (vh > vw && vw < 900);
      this.isMobilePortrait = isPortrait;
      if (document.body && document.body.classList) {
        document.body.classList.toggle('mobile-portrait', isPortrait);
      }

      if (isPortrait) {
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.transform = 'none';
        container.style.transformOrigin = 'top left';
        this.setMobilePrepTab(this.activeMobilePrepTab || 'plan');
        this.setMobilePlayTab(this.activeMobilePlayTab || 'customers');
      } else {
        const targetAspect = baseW / baseH;
        const screenAspect = vw / vh;
        let scale;
        let dynamicW;
        if (screenAspect >= targetAspect) {
          // Màn hình ngang rộng (điện thoại xoay ngang 19:9, 20:9...): vừa khít 100% chiều cao & rộng
          scale = vh / baseH;
          dynamicW = Math.round(vw / scale);
        } else {
          // Màn hình 4:3 (iPad / cửa sổ hẹp): giữ 1400px chuẩn và thu vừa trọn chiều ngang
          dynamicW = baseW;
          scale = Math.min(vw / baseW, vh / baseH);
        }
        container.style.width = `${dynamicW}px`;
        container.style.height = `${baseH}px`;
        container.style.transform = `translate(-50%, -50%) scale(${scale})`;
        container.style.transformOrigin = 'center center';
      }

      const rotNotice = document.getElementById('phone-rotate-notice');
      if (rotNotice) rotNotice.style.display = 'none';
      this.syncMobilePlayTabsVisibility();
    };

    window.addEventListener('resize', resizeHandler);
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener('resize', resizeHandler);
    }
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeHandler, 200);
      setTimeout(resizeHandler, 500);
    });
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', () => {
        setTimeout(resizeHandler, 200);
        setTimeout(resizeHandler, 500);
      });
    }
    resizeHandler();
  }

  toggleFullscreen() {
    const doc = document.documentElement;
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (!isFull) {
      if (doc.requestFullscreen) {
        doc.requestFullscreen().then(() => {
          this.showToast('⛶ Đã bật chế độ Toàn Màn Hình!');
        }).catch(() => {
          this.showToast('📱 Hãy xoay ngang điện thoại hoặc nhấn Chia sẻ → Thêm vào MH chính để chơi Full màn hình!');
        });
      } else if (doc.webkitRequestFullscreen) {
        doc.webkitRequestFullscreen();
        this.showToast('⛶ Đã bật chế độ Toàn Màn Hình!');
      } else if (doc.msRequestFullscreen) {
        doc.msRequestFullscreen();
        this.showToast('⛶ Đã bật chế độ Toàn Màn Hình!');
      } else {
        this.showToast('📱 Trên iPhone: Bấm nút "AA" ẩn thanh công cụ hoặc Chia sẻ → "Thêm vào MH chính" để Full 100%!');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      this.showToast('Đã thu nhỏ màn hình.');
    }
  }

  bindEvents() {
    // Toàn Màn Hình
    const fsBtn = document.getElementById('btn-fullscreen-toggle');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Âm thanh & Nhạc
    document.getElementById('btn-sound-toggle').addEventListener('click', (e) => {
      const enabled = window.soundMgr.toggleSound();
      e.currentTarget.querySelector('.icon').textContent = enabled ? '🔊' : '🔇';
      this.showToast(enabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh');
    });

    document.getElementById('btn-music-toggle').addEventListener('click', (e) => {
      const enabled = window.soundMgr.toggleMusic();
      e.currentTarget.querySelector('.icon').textContent = enabled ? '🎵' : '🎶';
      e.currentTarget.style.color = enabled ? '#2d6a4f' : '';
      this.renderShopDecorVisual();
      this.showToast(enabled ? 'Đã bật nhạc Lofi Cozy' : 'Đã tắt nhạc nền');
    });

    // Modal HUD & Góc Sáng Tạo
    const diyBtn = document.getElementById('btn-diy-workshop');
    if (diyBtn) {
      diyBtn.addEventListener('click', () => this.openDiyWorkshop());
    }
    document.getElementById('btn-quick-shop').addEventListener('click', () => this.openModal('modal-restock'));
    document.getElementById('btn-inventory-restock').addEventListener('click', () => this.openModal('modal-restock'));
    document.getElementById('btn-upgrade-shop').addEventListener('click', () => this.openModal('modal-upgrade'));
    document.getElementById('btn-tutorial-open').addEventListener('click', () => this.openModal('modal-tutorial'));
    document.getElementById('btn-pause-game').addEventListener('click', () => this.togglePauseGame());

    // Mini-game Thắt Nơ (dùng pointerdown để phản hồi tức thì khi chạm/bấm)
    const rmTieBtn = document.getElementById('btn-rm-tie');
    const rmTrack = document.getElementById('rm-track-wrap');
    const rmSkipBtn = document.getElementById('btn-rm-skip');
    const triggerTie = (e) => {
      if (e && e.cancelable) e.preventDefault();
      this.stopRibbonMinigame(false);
    };
    if (rmTieBtn) {
      rmTieBtn.addEventListener('pointerdown', triggerTie);
      rmTieBtn.addEventListener('click', () => this.stopRibbonMinigame(false));
    }
    if (rmTrack) {
      rmTrack.addEventListener('pointerdown', triggerTie);
      rmTrack.addEventListener('click', () => this.stopRibbonMinigame(false));
    }
    if (rmSkipBtn) rmSkipBtn.addEventListener('click', () => this.stopRibbonMinigame(true));

    // Góc Sáng Tạo DIY
    document.querySelectorAll('#diy-style-switch .diy-style-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.diyDraft.containerType = e.currentTarget.dataset.diyStyle;
        document.querySelectorAll('#diy-style-switch .diy-style-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.renderDiyPreview();
      });
    });
    const diySaveBtn = document.getElementById('btn-diy-save');
    if (diySaveBtn) {
      diySaveBtn.addEventListener('click', () => this.saveDiyRecipe());
    }

    const settingsBtn = document.getElementById('btn-settings-open');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const confirmBox = document.getElementById('reset-confirm-box');
        if (confirmBox) confirmBox.style.display = 'none';
        this.openModal('modal-settings');
      });
    }

    document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        const modal = e.target.closest('.game-modal');
        if (modal) modal.classList.remove('active');
      });
    });

    document.getElementById('btn-close-tutorial').addEventListener('click', () => {
      document.getElementById('modal-tutorial').classList.remove('active');
    });

    document.getElementById('btn-start-next-day').addEventListener('click', () => {
      this.startNextDay();
    });

    document.getElementById('btn-restock-all').addEventListener('click', () => {
      this.restockAllFlowers();
    });

    const prepRestockAllBtn = document.getElementById('btn-prep-restock-all');
    if (prepRestockAllBtn) {
      prepRestockAllBtn.addEventListener('click', () => {
        this.restockAllFlowers();
      });
    }

    // CHƠI LẠI NGÀY NÀY & CHƠI LẠI TỪ ĐẦU
    const replayHandlers = ['btn-replay-day', 'btn-quick-replay-day', 'btn-summary-replay-day'];
    replayHandlers.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this.replayCurrentDay());
    });

    const resetBtn = document.getElementById('btn-reset-game');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const box = document.getElementById('reset-confirm-box');
        if (box) box.style.display = 'flex';
      });
    }
    const cancelResetBtn = document.getElementById('btn-cancel-reset');
    if (cancelResetBtn) {
      cancelResetBtn.addEventListener('click', () => {
        const box = document.getElementById('reset-confirm-box');
        if (box) box.style.display = 'none';
      });
    }
    const confirmResetBtn = document.getElementById('btn-confirm-reset');
    if (confirmResetBtn) {
      confirmResetBtn.addEventListener('click', () => this.resetGameFromStart());
    }

    // NÚT LẬT BIỂN MỞ BÁN
    document.getElementById('btn-open-store-action').addEventListener('click', () => {
      this.openStoreForBusiness();
    });

    const unlockShopBtn = document.getElementById('btn-prep-unlock-shop');
    if (unlockShopBtn) {
      unlockShopBtn.addEventListener('click', () => {
        this.openModal('modal-restock');
      });
    }

    const prepRestockDecorBtn = document.getElementById('btn-prep-restock-decor');
    if (prepRestockDecorBtn) {
      prepRestockDecorBtn.addEventListener('click', () => {
        this.restockAllDecor();
      });
    }

    // Chuyển tab trong Modal Nâng Cấp (Dụng Cụ vs Trang Trí Tiệm vs Giống Hoa Cao Cấp)
    document.querySelectorAll('.upgrade-modal-tabs .upg-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.upgTab;
        document.querySelectorAll('.upgrade-modal-tabs .upg-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const upgList = document.getElementById('upgrade-items-container');
        const atmoList = document.getElementById('upgrade-atmosphere-container');
        const flwList = document.getElementById('upgrade-flowers-container');
        if (upgList) upgList.style.display = tab === 'furniture' ? 'flex' : 'none';
        if (atmoList) atmoList.style.display = tab === 'atmosphere' ? 'grid' : 'none';
        if (flwList) flwList.style.display = tab === 'flowers' ? 'grid' : 'none';
      });
    });

    // Kéo thả hoa mượt mà bằng Pointer (có Ghost theo con trỏ & hiệu ứng Snap vào bàn cắm)
    this.setupSmoothPointerDrag();

    // Kéo thả HTML5 dự phòng cho bàn cắm (#bouquet-workspace)
    const workspace = document.getElementById('bouquet-workspace');
    if (workspace) {
      workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        workspace.classList.add('drag-over');
        const ring = document.getElementById('workspace-snap-ring');
        if (ring) ring.classList.add('visible');
      });
      workspace.addEventListener('dragleave', () => {
        workspace.classList.remove('drag-over');
        const ring = document.getElementById('workspace-snap-ring');
        if (ring) ring.classList.remove('visible');
      });
      workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        workspace.classList.remove('drag-over');
        const ring = document.getElementById('workspace-snap-ring');
        if (ring) ring.classList.remove('visible');
        const flowerId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
        if (flowerId && FLOWERS_DATA[flowerId]) {
          this.pickFlowerToWorkbench(flowerId, e);
        }
      });
    }

    // Chuyển 3 Tab vật liệu
    document.querySelectorAll('.decor-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabKey = e.currentTarget.dataset.tab;
        document.querySelectorAll('.decor-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.decor-tab-view').forEach(v => v.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(`tab-${tabKey}-view`).classList.add('active');
        window.soundMgr.playWrapPaper();
      });
    });

    // Chuyển kiểu gói: Bó Hình Nón / Hộp Quà Tròn / Giỏ Mây Cắm Hoa
    document.querySelectorAll('#container-style-switcher .style-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const style = e.currentTarget.dataset.style;
        this.state.workbench.containerType = style;
        document.querySelectorAll('#container-style-switcher .style-pill-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        window.soundMgr.playWrapPaper();
        const styleMeta = (typeof CONTAINER_STYLES_DATA !== 'undefined' && CONTAINER_STYLES_DATA[style])
          ? CONTAINER_STYLES_DATA[style]
          : { icon: '💐', name: 'Bó Giấy Hình Nón' };
        this.showToast(`${styleMeta.icon} Đã đổi sang kiểu ${styleMeta.name}!`);
        this.renderBouquetVisual();
        this.updateScoringChecklist();
      });
    });

    // Dụng cụ: Kéo Tỉa tương tác trực tiếp với cành hoa
    document.getElementById('btn-trim-flower').addEventListener('click', () => {
      this.toggleTrimTool();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeTool !== 'none') {
        this.setActiveTool('none');
      }
      if (this.ribbonMinigame && this.ribbonMinigame.active && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        this.stopRibbonMinigame(false);
      }
    });

    document.getElementById('btn-quick-undo').addEventListener('click', () => {
      this.undoLastFlower();
    });

    document.getElementById('btn-action-clear').addEventListener('click', () => {
      this.clearWorkbench(true);
    });

    document.getElementById('btn-action-deliver').addEventListener('click', () => {
      this.deliverOrder();
    });

    // Tab chuyển đổi Mobile Portrait (Sáng: Kế hoạch / Kho hoa / Giấy gói | Mở bán: Khách / Kệ / Bàn cắm)
    document.querySelectorAll('#mobile-prep-tabs .mobile-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setMobilePrepTab(e.currentTarget.dataset.prepTab);
      });
    });

    document.querySelectorAll('#mobile-play-tabs .mobile-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setMobilePlayTab(e.currentTarget.dataset.playTab);
      });
    });

    const mobileOpenBtn = document.getElementById('btn-mobile-open-store');
    if (mobileOpenBtn) {
      mobileOpenBtn.addEventListener('click', () => this.openStoreForBusiness());
    }

    const mobileOrderStrip = document.getElementById('mobile-order-strip');
    if (mobileOrderStrip) {
      mobileOrderStrip.addEventListener('click', () => {
        this.setMobilePlayTab('customers');
      });
    }
  }

  getEventClientXY(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX || 0, y: e.clientY || 0 };
  }

  setupSmoothPointerDrag() {
    const positionGhost = (ghost, clientX, clientY) => {
      const container = document.getElementById('game-container');
      const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: 1400 };
      let scale = 1;
      if (!this.isMobilePortrait) {
        const currentContainerWidth = container ? (parseFloat(container.style.width) || 1400) : 1400;
        scale = rect.width ? rect.width / currentContainerWidth : 1;
      }
      const gx = (clientX - rect.left) / scale;
      const gy = (clientY - rect.top) / scale;
      ghost.style.left = `${gx}px`;
      ghost.style.top = `${gy}px`;
    };

    const isOverDropZone = (clientX, clientY) => {
      const checkEl = (el, pad = 18) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad;
      };
      return checkEl(document.getElementById('bouquet-workspace'), 20) ||
             checkEl(document.getElementById('mobile-shelf-drop-target'), 18);
    };

    const handleMove = (e, sourceType) => {
      if (!this.dragState) return;
      if (this.dragState.source && this.dragState.source !== sourceType) return;
      const ds = this.dragState;
      const { x, y } = this.getEventClientXY(e);
      const dist = Math.hypot(x - ds.startX, y - ds.startY);
      const ghost = document.getElementById('drag-flower-ghost');
      const ws = document.getElementById('bouquet-workspace');
      const ring = document.getElementById('workspace-snap-ring');
      const mDrop = document.getElementById('mobile-shelf-drop-target');

      if (!ds.active && dist > 8) {
        if ((this.state.flowerStocks[ds.flowerId] ?? 0) <= 0) {
          this.dragState = null;
          return;
        }
        ds.active = true;
        if (ds.slotEl) ds.slotEl.classList.add('is-dragging');
        if (ghost) {
          ghost.innerHTML = FLOWERS_DATA[ds.flowerId]?.svg || '';
          ghost.style.display = 'flex';
        }
      }

      if (ds.active) {
        if (e.cancelable) e.preventDefault();
        if (ghost) {
          positionGhost(ghost, x, y);
          const over = isOverDropZone(x, y);
          ghost.classList.toggle('snap-ready', over);
          if (ws) ws.classList.toggle('drag-over', over);
          if (ring) ring.classList.toggle('visible', over);
          if (mDrop) mDrop.classList.toggle('drag-over', over);
        }
      }
    };

    const endDrag = (e, sourceType) => {
      if (!this.dragState) return;
      if (sourceType && this.dragState.source && this.dragState.source !== sourceType) return;
      const ds = this.dragState;
      this.dragState = null;

      const { x, y } = this.getEventClientXY(e);
      const ghost = document.getElementById('drag-flower-ghost');
      const ws = document.getElementById('bouquet-workspace');
      const ring = document.getElementById('workspace-snap-ring');
      const mDrop = document.getElementById('mobile-shelf-drop-target');

      if (ds.slotEl) ds.slotEl.classList.remove('is-dragging');
      if (ghost) {
        ghost.style.display = 'none';
        ghost.classList.remove('snap-ready');
      }
      if (ws) ws.classList.remove('drag-over');
      if (ring) ring.classList.remove('visible');
      if (mDrop) mDrop.classList.remove('drag-over');

      if (ds.active) {
        this.suppressNextBucketClick = true;
        setTimeout(() => { this.suppressNextBucketClick = false; }, 140);

        if (isOverDropZone(x, y)) {
          this.pickFlowerToWorkbench(ds.flowerId, {
            type: 'drop',
            clientX: x,
            clientY: y
          });
          if (ws) {
            ws.classList.remove('snap-pop');
            void ws.offsetWidth;
            ws.classList.add('snap-pop');
            setTimeout(() => ws.classList.remove('snap-pop'), 360);
          }
        }
      }
    };

    // Hỗ trợ đồng thời Touch (touchstart/touchmove/touchend), Mouse (mousedown/mousemove/mouseup) và Pointer Events
    document.addEventListener('pointermove', (e) => handleMove(e, 'pointer'));
    document.addEventListener('touchmove', (e) => handleMove(e, 'touch'), { passive: false });
    document.addEventListener('mousemove', (e) => handleMove(e, 'mouse'));

    document.addEventListener('pointerup', (e) => endDrag(e, 'pointer'));
    document.addEventListener('pointercancel', (e) => endDrag(e, 'pointer'));
    document.addEventListener('touchend', (e) => endDrag(e, 'touch'));
    document.addEventListener('touchcancel', (e) => endDrag(e, 'touch'));
    document.addEventListener('mouseup', (e) => endDrag(e, 'mouse'));
  }

  syncContainerStyleButtons() {
    const style = this.state.workbench.containerType;
    document.querySelectorAll('#container-style-switcher .style-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === style);
    });
  }

  // 1. GIAI ĐOẠN 1: MÀN HÌNH SOẠN HÀNG BUỔI SÁNG (CHỈ NHẬP HOA & NGUYÊN LIỆU VÀO KHO, KHÔNG CHO SẴN BÓ HOA)
  setupMorningPrepPhase(captureSnapshot = true) {
    this.state.phase = 'PREPARING';
    this.state.hour = 7;
    this.state.minute = 0;
    this.state.isRushHour = false;
    this.maxQueueLength = this.getMaxQueueLength();

    // Xóa sạch bàn cắm để đảm bảo không còn bó hoa làm sẵn nào
    this.state.workbench.flowers = [];
    this.state.workbench.trimmed = false;
    this.state.workbench.innerPaper = null;
    this.state.workbench.paper = null;
    this.state.workbench.ribbon = null;
    this.state.workbench.card = null;

    if (captureSnapshot) {
      this.captureDayStartSnapshot();
      this.saveGameData();
    }

    this.showGameScreen('PREPARING');

    const evt = GAME_EVENTS[this.state.currentEventKey];
    const dayCfg = FLOWER_UNLOCK_CONFIG.find(c => c.day === this.state.currentDay);
    const unlockHighlight = dayCfg ? ` • ${dayCfg.title}` : '';

    document.getElementById('ticker-status-tag').textContent = `🌅 BUỔI SÁNG NGÀY ${this.state.currentDay}:`;
    document.getElementById('event-ticker-content').textContent = `${evt.name}${unlockHighlight} — Nhập hoa tươi và giấy gói/ruy băng vào kho trước khi mở bán!`;
    document.getElementById('prep-trend-text').textContent = `${evt.name}: ${evt.desc}`;

    this.renderMorningUnlockNotice();
    this.renderMorningStockGrid();
    this.renderMorningDecorStock();
    this.syncContainerStyleButtons();

    this.state.customersQueue = [];
    this.renderCustomerQueue();
    this.updateHUD();
  }

  renderMorningStockGrid() {
    const grid = document.getElementById('prep-shelf-restock-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.values(FLOWERS_DATA).forEach(flower => {
      const stock = this.state.flowerStocks[flower.id] ?? 0;
      const maxCap = this.getFlowerMaxStock(flower);
      const unitCost = this.getFlowerRestockUnitCost(flower);
      const packCost = unitCost * 5;
      const isUnlocked = this.isFlowerUnlocked(flower.id);
      const isPurchasableNow = this.canPurchaseUnlock(flower.id);
      const pct = Math.min(100, Math.round((stock / maxCap) * 100));

      const card = document.createElement('div');
      if (isUnlocked) {
        card.className = `prep-flower-card ${stock <= 3 ? 'low-stock' : ''}`;
        card.innerHTML = `
          <div class="prep-flw-art">${flower.svg}</div>
          <div class="prep-flw-name">${flower.name}</div>
          <div class="prep-flw-stock-row">
            <span>Tồn: <strong>${stock}/${maxCap}</strong></span>
          </div>
          <div class="prep-stock-bar"><div class="prep-stock-fill ${stock <= 3 ? 'low' : ''}" style="width:${pct}%"></div></div>
          <button class="prep-buy-btn">+5 cành (${packCost} 🪙)</button>
        `;
        card.querySelector('.prep-buy-btn').addEventListener('click', () => {
          this.buyFlowerStock(flower.id, 5, packCost);
        });
      } else if (isPurchasableNow) {
        card.className = 'prep-flower-card unlockable';
        card.innerHTML = `
          <div class="prep-flw-art">${flower.svg}</div>
          <div class="prep-flw-name">${flower.name}</div>
          <div class="prep-flw-stock-row"><span class="unlock-ready">✨ Mở (+${flower.defaultStock} bông)</span></div>
          <button class="prep-buy-btn prep-unlock-now-btn">🔓 Mở (${flower.unlockCost} 🪙)</button>
        `;
        card.querySelector('.prep-unlock-now-btn').addEventListener('click', () => {
          this.unlockFlowerWithGold(flower.id);
        });
      } else {
        card.className = 'prep-flower-card locked';
        card.innerHTML = `
          <div class="prep-flw-art locked-art">${flower.svg}</div>
          <div class="prep-flw-name">${flower.name}</div>
          <div class="prep-flw-stock-row"><span>🔒 Mở Ngày ${flower.unlockedAtDay}</span></div>
          <button class="prep-buy-btn" disabled>Ngày ${flower.unlockedAtDay}</button>
        `;
      }
      grid.appendChild(card);
    });
  }

  renderMorningDecorStock() {
    const innerListEl = document.getElementById('prep-inner-paper-stock-list');
    const paperListEl = document.getElementById('prep-paper-stock-list');
    const ribbonListEl = document.getElementById('prep-ribbon-stock-list');
    if (!paperListEl || !ribbonListEl) return;

    if (innerListEl) {
      innerListEl.innerHTML = '';
      DECOR_DATA.innerPapers.forEach(ip => {
        const stock = this.state.innerPaperStocks[ip.id] ?? 0;
        const card = document.createElement('div');
        card.className = `prep-mat-card ${stock <= 2 ? 'low-stock' : ''}`;
        card.innerHTML = `
          <div class="prep-mat-top">
            <span class="mini-swatch" style="background:${ip.color}; border-color:${ip.border};"></span>
            <span class="prep-mat-name">${ip.name}</span>
            <strong class="prep-mat-qty ${stock <= 2 ? 'low' : ''}">${stock}</strong>
          </div>
          <button class="prep-mat-buy-btn">+5 tờ (5 🪙)</button>
        `;
        card.querySelector('.prep-mat-buy-btn').addEventListener('click', () => {
          this.buyMaterialStock('innerPaper', ip.id, 5, 5);
        });
        innerListEl.appendChild(card);
      });
    }

    paperListEl.innerHTML = '';
    DECOR_DATA.papers.forEach(p => {
      const stock = this.state.paperStocks[p.id] ?? 0;
      const card = document.createElement('div');
      card.className = `prep-mat-card ${stock <= 2 ? 'low-stock' : ''}`;
      card.innerHTML = `
        <div class="prep-mat-top">
          <span class="mini-swatch" style="background:${p.color}; border-color:${p.border};"></span>
          <span class="prep-mat-name">${p.name}</span>
          <strong class="prep-mat-qty ${stock <= 2 ? 'low' : ''}">${stock}</strong>
        </div>
        <button class="prep-mat-buy-btn">+5 tờ (5 🪙)</button>
      `;
      card.querySelector('.prep-mat-buy-btn').addEventListener('click', () => {
        this.buyMaterialStock('paper', p.id, 5, 5);
      });
      paperListEl.appendChild(card);
    });

    ribbonListEl.innerHTML = '';
    DECOR_DATA.ribbons.forEach(r => {
      const stock = this.state.ribbonStocks[r.id] ?? 0;
      const card = document.createElement('div');
      card.className = `prep-mat-card ${stock <= 2 ? 'low-stock' : ''}`;
      card.innerHTML = `
        <div class="prep-mat-top">
          <span class="mini-swatch" style="background:${r.color}; border-color:${r.accentColor || '#64748b'};"></span>
          <span class="prep-mat-name">${r.name}</span>
          <strong class="prep-mat-qty ${stock <= 2 ? 'low' : ''}">${stock}</strong>
        </div>
        <button class="prep-mat-buy-btn">+5 dải (5 🪙)</button>
      `;
      card.querySelector('.prep-mat-buy-btn').addEventListener('click', () => {
        this.buyMaterialStock('ribbon', r.id, 5, 5);
      });
      ribbonListEl.appendChild(card);
    });
  }

  buyMaterialStock(type, id, amount, cost) {
    if (this.state.gold < cost) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Không đủ tiền! Cần ${cost} 🪙 để nhập thêm nguyên liệu.`);
      return;
    }

    const stocksMap =
      type === 'innerPaper'
        ? this.state.innerPaperStocks
        : type === 'paper'
          ? this.state.paperStocks
          : this.state.ribbonStocks;
    const metaList =
      type === 'innerPaper'
        ? DECOR_DATA.innerPapers
        : type === 'paper'
          ? DECOR_DATA.papers
          : DECOR_DATA.ribbons;
    const unitLabel =
      type === 'innerPaper' ? 'tờ giấy lót' : type === 'paper' ? 'tờ giấy ngoài' : 'dải nơ';
    const meta = metaList.find(m => m.id === id);
    const cur = stocksMap[id] ?? 0;

    if (cur + amount > 30) {
      this.showToast(`Kho ${meta ? meta.name : ''} đã đầy ắp rồi (tối đa 30)!`);
      return;
    }

    this.state.gold -= cost;
    stocksMap[id] = cur + amount;
    window.soundMgr.playCoinChime();
    this.showToast(`📦 Đã nhập thêm +${amount} ${unitLabel} ${meta ? meta.name : ''}!`);
    this.renderMorningDecorStock();
    this.renderDecorPalettes();
    this.updateHUD();
    this.saveGameData();
  }

  restockAllDecor() {
    const targetQty = 8;
    let totalUnits = 0;
    DECOR_DATA.innerPapers.forEach(ip => {
      totalUnits += Math.max(0, targetQty - (this.state.innerPaperStocks[ip.id] ?? 0));
    });
    DECOR_DATA.papers.forEach(p => {
      totalUnits += Math.max(0, targetQty - (this.state.paperStocks[p.id] ?? 0));
    });
    DECOR_DATA.ribbons.forEach(r => {
      totalUnits += Math.max(0, targetQty - (this.state.ribbonStocks[r.id] ?? 0));
    });

    if (totalUnits === 0) {
      this.showToast('Kho giấy lót, giấy gói và ruy băng đều đang đầy đủ!');
      return;
    }

    const cost = Math.max(1, Math.round(totalUnits * 0.9));
    if (this.state.gold < cost) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Không đủ xu! Cần ${cost} 🪙 để nhập đầy kho vật liệu.`);
      return;
    }

    this.state.gold -= cost;
    DECOR_DATA.innerPapers.forEach(ip => {
      if ((this.state.innerPaperStocks[ip.id] ?? 0) < targetQty) this.state.innerPaperStocks[ip.id] = targetQty;
    });
    DECOR_DATA.papers.forEach(p => {
      if ((this.state.paperStocks[p.id] ?? 0) < targetQty) this.state.paperStocks[p.id] = targetQty;
    });
    DECOR_DATA.ribbons.forEach(r => {
      if ((this.state.ribbonStocks[r.id] ?? 0) < targetQty) this.state.ribbonStocks[r.id] = targetQty;
    });

    window.soundMgr.playCoinChime();
    this.showToast(`📦 Đã bổ sung đầy kho Giấy lót, Giấy gói & Ruy băng (-${cost} 🪙)!`);
    this.renderMorningDecorStock();
    this.renderDecorPalettes();
    this.updateHUD();
    this.saveGameData();
  }

  // HIỂN THỊ THÔNG BÁO HOA MỞ KHÓA HÔM NAY TRONG BẢNG "KẾ HOẠCH SÁNG NAY"
  renderMorningUnlockNotice() {
    const dayPill = document.getElementById('prep-day-pill');
    const titleEl = document.getElementById('prep-unlock-title');
    const flowersWrap = document.getElementById('prep-unlock-flowers');
    const descEl = document.getElementById('prep-unlock-desc');
    const unlockShopBtn = document.getElementById('btn-prep-unlock-shop');
    const stockSummaryEl = document.getElementById('prep-stock-summary');

    if (dayPill) dayPill.textContent = `Ngày ${this.state.currentDay}`;

    const unlockedCount = Object.keys(FLOWERS_DATA).filter(id => this.isFlowerUnlocked(id)).length;
    const totalCount = Object.keys(FLOWERS_DATA).length;
    if (stockSummaryEl) {
      stockSummaryEl.textContent = `Đang mở bán ${unlockedCount}/${totalCount} loài hoa trên kệ`;
    }

    if (!flowersWrap || !titleEl || !descEl) return;
    flowersWrap.innerHTML = '';

    const todayConfig = FLOWER_UNLOCK_CONFIG.find(c => c.day === this.state.currentDay);
    const purchasableRemaining = Object.values(FLOWERS_DATA).filter(f => this.canPurchaseUnlock(f.id));

    if (todayConfig) {
      if (todayConfig.mode === 'auto') {
        titleEl.textContent = this.state.currentDay === 1
          ? '🌱 Hoa Khai Trương (Ngày 1)'
          : `🎉 Hoa Mới Mở Khóa (Ngày ${this.state.currentDay})`;
        descEl.textContent = todayConfig.desc;
        if (unlockShopBtn) unlockShopBtn.style.display = 'none';

        todayConfig.flowerIds.forEach(fId => {
          const f = FLOWERS_DATA[fId];
          if (!f) return;
          const chip = document.createElement('div');
          chip.className = 'prep-unlock-chip unlocked';
          chip.innerHTML = `<span class="prep-chip-svg">${f.svg}</span><span>${f.name}</span>`;
          flowersWrap.appendChild(chip);
        });
      } else {
        titleEl.textContent = `💎 Chợ Hoa Cao Cấp (Ngày ${this.state.currentDay})`;
        descEl.textContent = todayConfig.desc;
        if (unlockShopBtn) {
          unlockShopBtn.style.display = purchasableRemaining.length > 0 ? 'inline-flex' : 'none';
        }

        todayConfig.flowerIds.forEach(fId => {
          const f = FLOWERS_DATA[fId];
          if (!f) return;
          const isOwned = this.isFlowerUnlocked(fId);
          const chip = document.createElement('div');
          chip.className = `prep-unlock-chip ${isOwned ? 'unlocked' : 'purchasable'}`;
          chip.innerHTML = `<span class="prep-chip-svg">${f.svg}</span><span>${f.name}${isOwned ? ' ✓' : ` (${f.unlockCost}🪙)`}</span>`;
          flowersWrap.appendChild(chip);
        });
      }
    } else if (purchasableRemaining.length > 0) {
      titleEl.textContent = `💎 Hoa Cao Cấp Chờ Mở Khóa (Ngày ${this.state.currentDay})`;
      descEl.textContent = `Còn ${purchasableRemaining.length} loài hoa cao cấp đang chờ bạn dùng xu mở khóa trong "Nhập Hoa".`;
      if (unlockShopBtn) unlockShopBtn.style.display = 'inline-flex';

      purchasableRemaining.slice(0, 4).forEach(f => {
        const chip = document.createElement('div');
        chip.className = 'prep-unlock-chip purchasable';
        chip.innerHTML = `<span class="prep-chip-svg">${f.svg}</span><span>${f.name} (${f.unlockCost}🪙)</span>`;
        flowersWrap.appendChild(chip);
      });
    } else {
      titleEl.textContent = `👑 Đã Mở Khóa Toàn Bộ ${totalCount} Loài Hoa!`;
      descEl.textContent = 'Tiệm hoa đã sở hữu đầy đủ bộ sưu tập hoa tươi rực rỡ nhất!';
      if (unlockShopBtn) unlockShopBtn.style.display = 'none';
    }
  }

  // GIAI ĐOẠN 2: CHUYỂN SANG MÀN HÌNH BÀY BÁN & PHỤC VỤ KHÁCH (BÀN CẮM TRỐNG HOÀN TOÀN)
  openStoreForBusiness() {
    this.state.phase = 'OPEN';
    this.state.hour = 8;
    this.state.minute = 30;
    this.state.isRushHour = false;
    this.maxQueueLength = this.getMaxQueueLength();

    // Bắt đầu phiên bán hàng với bàn cắm trống để người chơi tự tay cắm & chọn lót trong/giấy ngoài/nơ
    this.state.workbench.flowers = [];
    this.state.workbench.trimmed = false;
    this.state.workbench.innerPaper = null;
    this.state.workbench.paper = null;
    this.state.workbench.ribbon = null;
    this.state.workbench.card = null;

    this.showGameScreen('SHOP');
    this.renderShopDecorVisual();
    this.renderShelves();
    this.renderDecorPalettes();
    this.syncContainerStyleButtons();
    this.renderBouquetVisual();
    this.syncRushHourState(false);

    const sign = document.getElementById('shop-door-sign');
    sign.className = 'shop-signboard open';
    document.getElementById('sign-icon').textContent = '🌸';
    document.getElementById('sign-text').textContent = 'ĐANG MỞ BÁN';

    document.getElementById('clipboard-active-order-view').style.display = 'flex';
    const waitingView = document.getElementById('clipboard-waiting-view');
    if (waitingView) waitingView.style.display = 'none';

    document.getElementById('ticker-status-tag').textContent = '🔔 ĐANG BÁN:';
    document.getElementById('event-ticker-content').textContent = 'Tiệm hoa đã mở cửa! Kéo hoặc nhấp hoa từ kệ thả vào bàn cắm!';

    window.soundMgr.playDoorBell();
    this.showToast('🔔 Leng keng! Tiệm Hoa Nhỏ chính thức mở cửa đón khách!');

    this.spawnCustomer();
    this.restartCustomerSpawnTimer();
    this.updateHUD();
  }

  // 2. RENDER 18 LOÀI HOA TRÊN KỆ 2 TẦNG (MỞ KHÓA DẦN THEO NGÀY CHƠI & MUA MỞ KHÓA)
  renderShelves() {
    const tier1El = document.getElementById('shelf-tier-1');
    const tier2El = document.getElementById('shelf-tier-2');
    tier1El.innerHTML = '';
    tier2El.innerHTML = '';

    const allFlowers = Object.values(FLOWERS_DATA);
    allFlowers.forEach(flower => {
      const stock = this.state.flowerStocks[flower.id] ?? 0;
      const isUnlocked = this.isFlowerUnlocked(flower.id);
      const isLocked = !isUnlocked;
      const isPurchasableNow = this.canPurchaseUnlock(flower.id);

      const slot = document.createElement('div');
      slot.className = `big-flower-bucket ${isLocked ? 'locked-bucket' : ''} ${isPurchasableNow ? 'purchasable-bucket' : ''} ${stock <= 0 && isUnlocked ? 'empty-stock' : ''}`;
      slot.id = `bucket-${flower.id}`;

      if (isLocked) {
        const badgeLabel = isPurchasableNow
          ? `${flower.unlockCost} 🪙`
          : `Ngày ${flower.unlockedAtDay}`;
        const potLabel = isPurchasableNow
          ? `Mở bằng Xu`
          : `Ngày ${flower.unlockedAtDay}`;

        slot.title = isPurchasableNow
          ? `${flower.name} - 🔒 Vào "Nhập Hoa" để mở khóa với ${flower.unlockCost} 🪙`
          : `${flower.name} - 🔒 Mở khóa vào Ngày ${flower.unlockedAtDay}`;

        slot.innerHTML = `
          <div class="flower-bloom-frame locked-bloom">
            <div class="lock-overlay-badge ${isPurchasableNow ? 'purchasable' : ''}">
              <span class="lock-icon">🔒</span>
              <span class="lock-level-text">${badgeLabel}</span>
            </div>
            <div class="flower-art-locked">
              ${flower.svg}
            </div>
          </div>
          <div class="bucket-zinc-pot locked-pot ${isPurchasableNow ? 'purchasable-pot' : ''}">
            <span class="bucket-name-plate">${potLabel}</span>
          </div>
        `;

        slot.addEventListener('click', () => {
          window.soundMgr.playCustomerSad();
          if (isPurchasableNow) {
            this.showToast(`🔒 ${flower.name} đã sẵn sàng mở bán từ Ngày ${flower.unlockedAtDay}! Vào "Nhập Hoa" buổi sáng để mở khóa với ${flower.unlockCost} 🪙.`);
          } else {
            this.showToast(`🔒 Loại hoa này sẽ mở khóa vào Ngày ${flower.unlockedAtDay} (${flower.name})!`);
          }
        });
      } else {
        slot.title = `${flower.name} (Tồn kho: ${stock}) - Kéo thả hoặc nhấp để cắm vào bàn`;
        slot.dataset.flowerId = flower.id;
        slot.innerHTML = `
          <div class="flower-bloom-frame" id="bloom-${flower.id}">
            ${flower.svg}
          </div>
          <div class="bucket-zinc-pot">
            <span class="bucket-name-plate">${flower.name}</span>
            <span class="bucket-stock-badge-large ${stock <= 3 ? 'low' : ''}" id="stock-badge-${flower.id}">${stock}</span>
          </div>
        `;

        const startBucketDrag = (e, sourceType) => {
          if (e.button !== undefined && e.button !== 0) return;
          if (this.state.phase !== 'OPEN' && this.state.phase !== 'CLOSING') return;
          if (this.dragState) return;
          const { x, y } = this.getEventClientXY(e);
          this.dragState = {
            flowerId: flower.id,
            slotEl: slot,
            source: sourceType,
            startX: x,
            startY: y,
            active: false
          };
        };

        slot.addEventListener('pointerdown', (e) => startBucketDrag(e, 'pointer'));
        slot.addEventListener('touchstart', (e) => startBucketDrag(e, 'touch'), { passive: true });
        slot.addEventListener('mousedown', (e) => startBucketDrag(e, 'mouse'));

        slot.addEventListener('click', (e) => {
          if (this.suppressNextBucketClick) return;
          this.pickFlowerToWorkbench(flower.id, e);
        });
      }

      if (flower.tier === 1) {
        tier1El.appendChild(slot);
      } else {
        tier2El.appendChild(slot);
      }
    });
  }

  updateFlowerStockBadges() {
    Object.keys(FLOWERS_DATA).forEach(flowerId => {
      const badge = document.getElementById(`stock-badge-${flowerId}`);
      const slot = document.getElementById(`bucket-${flowerId}`);
      const isUnlocked = this.isFlowerUnlocked(flowerId);
      const stock = this.state.flowerStocks[flowerId] ?? 0;

      if (isUnlocked && badge) {
        badge.textContent = stock;
        badge.className = `bucket-stock-badge-large ${stock <= 3 ? 'low' : ''}`;
      }
      if (isUnlocked && slot) {
        if (stock <= 0) slot.classList.add('empty-stock');
        else slot.classList.remove('empty-stock');
      }
    });
  }

  // 3. RENDER 4 TAB LỚN VẬT LIỆU (LÓT TRONG, GIẤY NGOÀI, RUY BĂNG, THIỆP - HIỂN THỊ TỒN KHO, TỰ TAY CHỌN)
  renderDecorPalettes() {
    // TAB 1: Giấy lót bên trong (6 mẫu)
    const innerGrid = document.getElementById('inner-paper-items-grid');
    if (innerGrid) {
      innerGrid.innerHTML = '';
      DECOR_DATA.innerPapers.forEach(ip => {
        const stock = this.state.innerPaperStocks[ip.id] ?? 0;
        const card = document.createElement('div');
        card.className = `decor-visual-card ${this.state.workbench.innerPaper === ip.id ? 'selected' : ''} ${stock <= 0 ? 'out-of-stock' : ''}`;
        card.innerHTML = `
          <span class="decor-stock-pill ${stock <= 0 ? 'empty' : ''}">${stock > 0 ? stock : '+5🪙'}</span>
          <div class="decor-thumb-img">${ip.thumbSvg}</div>
          <span class="decor-card-name">${ip.name}</span>
        `;
        card.addEventListener('click', () => {
          if ((this.state.innerPaperStocks[ip.id] ?? 0) <= 0) {
            this.buyMaterialStock('innerPaper', ip.id, 5, 5);
            return;
          }
          if (this.state.workbench.innerPaper === ip.id) {
            this.state.workbench.innerPaper = null;
            card.classList.remove('selected');
            this.showToast('Đã bỏ chọn giấy lót trong');
          } else {
            this.state.workbench.innerPaper = ip.id;
            document.querySelectorAll('#inner-paper-items-grid .decor-visual-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            this.showToast(`Đã lót giấy trong: ${ip.name}`);
          }
          window.soundMgr.playWrapPaper();
          this.renderBouquetVisual();
          this.updateScoringChecklist();
        });
        innerGrid.appendChild(card);
      });
    }

    // TAB 2: Giấy gói bên ngoài (7 mẫu)
    const paperGrid = document.getElementById('paper-items-grid');
    paperGrid.innerHTML = '';
    DECOR_DATA.papers.forEach(p => {
      const stock = this.state.paperStocks[p.id] ?? 0;
      const card = document.createElement('div');
      card.className = `decor-visual-card ${this.state.workbench.paper === p.id ? 'selected' : ''} ${stock <= 0 ? 'out-of-stock' : ''}`;
      card.innerHTML = `
        <span class="decor-stock-pill ${stock <= 0 ? 'empty' : ''}">${stock > 0 ? stock : '+5🪙'}</span>
        <div class="decor-thumb-img">${p.thumbSvg}</div>
        <span class="decor-card-name">${p.name}</span>
      `;
      card.addEventListener('click', () => {
        if ((this.state.paperStocks[p.id] ?? 0) <= 0) {
          this.buyMaterialStock('paper', p.id, 5, 5);
          return;
        }
        if (this.state.workbench.paper === p.id) {
          this.state.workbench.paper = null;
          card.classList.remove('selected');
          this.showToast('Đã bỏ chọn giấy gói ngoài');
        } else {
          this.state.workbench.paper = p.id;
          document.querySelectorAll('#paper-items-grid .decor-visual-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.showToast(`Đã bọc giấy ngoài: ${p.name}`);
        }
        window.soundMgr.playWrapPaper();
        this.renderBouquetVisual();
        this.updateScoringChecklist();
      });
      paperGrid.appendChild(card);
    });

    // TAB 2: Ruy băng (6 mẫu)
    const ribbonGrid = document.getElementById('ribbon-items-grid');
    ribbonGrid.innerHTML = '';
    DECOR_DATA.ribbons.forEach(r => {
      const stock = this.state.ribbonStocks[r.id] ?? 0;
      const card = document.createElement('div');
      card.className = `decor-visual-card ${this.state.workbench.ribbon === r.id ? 'selected' : ''} ${stock <= 0 ? 'out-of-stock' : ''}`;
      card.innerHTML = `
        <span class="decor-stock-pill ${stock <= 0 ? 'empty' : ''}">${stock > 0 ? stock : '+5🪙'}</span>
        <div class="decor-thumb-img">${r.thumbSvg}</div>
        <span class="decor-card-name">${r.name}</span>
      `;
      card.addEventListener('click', () => {
        if ((this.state.ribbonStocks[r.id] ?? 0) <= 0) {
          this.buyMaterialStock('ribbon', r.id, 5, 5);
          return;
        }
        if (this.state.workbench.ribbon === r.id) {
          this.state.workbench.ribbon = null;
          card.classList.remove('selected');
          this.showToast('Đã tháo ruy băng');
        } else {
          this.state.workbench.ribbon = r.id;
          document.querySelectorAll('#ribbon-items-grid .decor-visual-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.showToast(`Đã thắt nơ ruy băng: ${r.name}`);
        }
        window.soundMgr.playWrapPaper();
        this.renderBouquetVisual();
        this.updateScoringChecklist();
      });
      ribbonGrid.appendChild(card);
    });

    // TAB 3: Thiệp (5 mẫu)
    const cardGrid = document.getElementById('card-items-grid');
    cardGrid.innerHTML = '';
    DECOR_DATA.cards.forEach(c => {
      const card = document.createElement('div');
      card.className = `decor-visual-card ${this.state.workbench.card === c.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="decor-thumb-img">${c.thumbSvg}</div>
        <span class="decor-card-name">${c.name}</span>
      `;
      card.addEventListener('click', () => {
        if (this.state.workbench.card === c.id) {
          this.state.workbench.card = null;
          card.classList.remove('selected');
          this.showToast('Đã bỏ kẹp thiệp');
        } else {
          this.state.workbench.card = c.id;
          document.querySelectorAll('#card-items-grid .decor-visual-card').forEach(i => i.classList.remove('selected'));
          card.classList.add('selected');
          this.showToast(`Đã kẹp thiệp: ${c.name}`);
        }
        window.soundMgr.playWrapPaper();
        this.renderBouquetVisual();
        this.updateScoringChecklist();
      });
      cardGrid.appendChild(card);
    });
  }

  // 4. THAO TÁC CẮM HOA & HIỆU ỨNG HOA BAY
  pickFlowerToWorkbench(flowerId, event) {
    const stock = this.state.flowerStocks[flowerId] ?? 0;
    if (stock <= 0) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Hết hoa ${FLOWERS_DATA[flowerId].name}! Hãy vào "Nhập Hoa" để lấy thêm nhé.`);
      return;
    }

    if (this.state.workbench.flowers.length >= 14) {
      this.showToast('Bó hoa đã đầy ắp 14 cành tươi thắm rồi!');
      return;
    }

    this.state.flowerStocks[flowerId]--;
    this.updateFlowerStockBadges();

    const pickedWithShears = this.activeTool === 'shears';
    if (pickedWithShears) {
      window.soundMgr.playSnip();
      if (event) this.spawnSnipParticles(event);
    } else {
      window.soundMgr.playPickFlower();
    }

    if (event && event.type === 'drop') {
      this.justSnappedStemIdx = this.state.workbench.flowers.length;
    } else {
      this.justSnappedStemIdx = -1;
      if (event) this.spawnFlyingFlowerEffect(flowerId, event);
    }

    const count = this.state.workbench.flowers.length;
    const spreadAngles = [0, -14, 14, -24, 24, -7, 7, -19, 19, -29, 29, -4, 4, 0];
    const angle = spreadAngles[count % spreadAngles.length];

    this.state.workbench.flowers.push({
      id: flowerId,
      angle: angle,
      scale: 1.0,
      trimmed: pickedWithShears
    });

    this.syncWorkbenchTrimmedState();
    this.renderBouquetVisual();
    this.justSnappedStemIdx = -1;
    this.updateScoringChecklist();

    if (pickedWithShears) {
      this.showToast(`✂️ Đã cắt cành ${FLOWERS_DATA[flowerId].name} gọn gàng và cắm lên bàn!`);
    }
  }

  // HỆ THỐNG KÉO TỈA TƯƠNG TÁC TRỰC TIẾP VỚI CÀNH HOA
  toggleTrimTool() {
    const nextTool = this.activeTool === 'shears' ? 'none' : 'shears';
    this.setActiveTool(nextTool);
  }

  setActiveTool(toolName) {
    this.activeTool = toolName;
    const isShears = toolName === 'shears';
    const trimBtn = document.getElementById('btn-trim-flower');
    const trimLabel = document.getElementById('trim-btn-label');
    const workspace = document.getElementById('bouquet-workspace');
    const banner = document.getElementById('active-tool-banner');

    if (trimBtn) trimBtn.classList.toggle('active', isShears);
    if (trimLabel) trimLabel.textContent = isShears ? 'Đang Cắt' : 'Kéo Tỉa';
    if (workspace) workspace.classList.toggle('shears-active', isShears);
    if (banner) banner.style.display = isShears ? 'block' : 'none';

    if (isShears) {
      window.soundMgr.playSnip();
      if (this.state.workbench.flowers.length === 0) {
        this.showToast('✂️ Đã bật Kéo Tỉa! Nhấp vào hoa trên kệ để cắt cành tươi, hoặc cắm hoa rồi tỉa trên bàn.');
      } else {
        this.showToast('✂️ Đã bật Kéo Tỉa! Bấm trực tiếp vào từng cành hoa trên bàn để cắt tỉa gọn.');
      }
    } else {
      this.showToast('Đã cất Kéo Tỉa.');
    }
  }

  syncWorkbenchTrimmedState() {
    const flowers = this.state.workbench.flowers;
    this.state.workbench.trimmed = flowers.length > 0 && flowers.every(f => !!f.trimmed);
  }

  trimStemAtIndex(idx, event) {
    const item = this.state.workbench.flowers[idx];
    if (!item) return;
    const flower = FLOWERS_DATA[item.id];
    if (!flower) return;

    window.soundMgr.playSnip();
    this.spawnSnipParticles(event);

    if (item.trimmed) {
      this.showToast(`✨ Cành ${flower.name} này đã được tỉa gọn gàng rồi!`);
      return;
    }

    item.trimmed = true;
    this.syncWorkbenchTrimmedState();
    this.renderBouquetVisual(idx);
    this.updateScoringChecklist();

    const trimmedCount = this.state.workbench.flowers.filter(f => f.trimmed).length;
    const totalCount = this.state.workbench.flowers.length;
    if (this.state.workbench.trimmed) {
      this.showToast(`✨ Hoàn tất cắt tỉa toàn bộ ${totalCount} cành hoa! (+5 🪙 thưởng gọn gàng)`);
    } else {
      this.showToast(`✂️ Đã tỉa gọn cành ${flower.name} (${trimmedCount}/${totalCount} cành)`);
    }
  }

  spawnSnipParticles(event) {
    const fxLayer = document.getElementById('fx-layer');
    const container = document.getElementById('game-container');
    if (!fxLayer || !container || !event) return;

    const containerRect = container.getBoundingClientRect();
    const scaleX = containerRect.width / 1400 || 1;
    const scaleY = containerRect.height / 788 || 1;

    let originX = 360;
    let originY = 580;
    if (typeof event.clientX === 'number' && event.clientX > 0) {
      originX = (event.clientX - containerRect.left) / scaleX;
      originY = (event.clientY - containerRect.top) / scaleY;
    } else if (event.currentTarget) {
      const r = event.currentTarget.getBoundingClientRect();
      originX = (r.left + r.width / 2 - containerRect.left) / scaleX;
      originY = (r.top + r.height / 2 - containerRect.top) / scaleY;
    }

    const bits = ['🍃', '🌿', '✂️', '✨'];
    for (let i = 0; i < 6; i++) {
      const p = document.createElement('div');
      p.className = 'snip-leaf-particle';
      p.textContent = bits[i % bits.length];
      p.style.left = `${originX}px`;
      p.style.top = `${originY}px`;
      p.style.setProperty('--sx', `${(Math.random() - 0.5) * 95}px`);
      p.style.setProperty('--sy', `${-20 + Math.random() * 65}px`);
      p.style.setProperty('--sr', `${(Math.random() - 0.5) * 240}deg`);
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }
  }

  spawnFlyingFlowerEffect(flowerId, event) {
    const flower = FLOWERS_DATA[flowerId];
    if (!flower) return;

    const fxLayer = document.getElementById('fx-layer');
    const flyEl = document.createElement('div');
    flyEl.className = 'flying-flower-fx';
    flyEl.innerHTML = flower.svg;

    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = document.getElementById('game-container').getBoundingClientRect();

    const startX = rect.left - containerRect.left + 20;
    const startY = rect.top - containerRect.top + 10;

    const speedMult = this.getUpgradeBonus('fast_hands').speedMult || 1;
    const durationMs = Math.round(520 * speedMult);

    flyEl.style.left = `${startX}px`;
    flyEl.style.top = `${startY}px`;
    flyEl.style.setProperty('--dest-x', `${350 - startX}px`);
    flyEl.style.setProperty('--dest-y', `${550 - startY}px`);
    flyEl.style.animationDuration = `${durationMs}ms`;

    fxLayer.appendChild(flyEl);
    setTimeout(() => flyEl.remove(), durationMs);
  }

  addSpecificFlower(flowerId) {
    this.pickFlowerToWorkbench(flowerId, null);
  }

  removeSpecificFlower(flowerId) {
    const idx = this.state.workbench.flowers.findLastIndex(f => f.id === flowerId);
    if (idx !== -1) {
      this.state.workbench.flowers.splice(idx, 1);
      this.state.flowerStocks[flowerId] = (this.state.flowerStocks[flowerId] || 0) + 1;
      this.syncWorkbenchTrimmedState();
      this.updateFlowerStockBadges();
      window.soundMgr.playPickFlower();
      this.renderBouquetVisual();
      this.updateScoringChecklist();
    }
  }

  undoLastFlower() {
    if (this.state.workbench.flowers.length === 0) return;
    const last = this.state.workbench.flowers.pop();
    this.state.flowerStocks[last.id] = (this.state.flowerStocks[last.id] || 0) + 1;
    this.syncWorkbenchTrimmedState();
    this.updateFlowerStockBadges();
    window.soundMgr.playPickFlower();
    this.renderBouquetVisual();
    this.updateScoringChecklist();
  }

  clearWorkbench(refund = true, silent = false) {
    if (refund) {
      this.state.workbench.flowers.forEach(f => {
        this.state.flowerStocks[f.id] = (this.state.flowerStocks[f.id] || 0) + 1;
      });
      this.updateFlowerStockBadges();
    }
    this.state.workbench.flowers = [];
    this.state.workbench.trimmed = false;
    this.state.workbench.innerPaper = null;
    this.state.workbench.paper = null;
    this.state.workbench.ribbon = null;
    this.state.workbench.card = null;
    this.renderDecorPalettes();
    this.renderBouquetVisual();
    this.updateScoringChecklist();
    if (!silent) {
      this.showToast('Đã dọn sạch bàn cắm');
    }
  }

  // 5. VẼ BÓ HOA THỦ CÔNG: CHỈ HIỆN GIẤY LÓT TRONG, GIẤY GÓI NGOÀI & RUY BĂNG KHI NGƯỜI CHƠI TỰ CHỌN
  renderBouquetVisual(justSnippedIdx = -1) {
    const flowersLayer = document.getElementById('bouquet-flowers-layer');
    const greeneryLayer = document.getElementById('bouquet-greenery-layer');
    const wrapBack = document.getElementById('bouquet-wrapper-back');
    const wrapFront = document.getElementById('bouquet-wrapper-front');
    const ribbonLayer = document.getElementById('bouquet-ribbon-layer');
    const cardLayer = document.getElementById('bouquet-card-layer');
    const hint = document.getElementById('empty-workspace-hint');
    const chipsContainer = document.getElementById('workbench-flower-chips');

    flowersLayer.innerHTML = '';
    if (greeneryLayer) greeneryLayer.innerHTML = '';
    wrapBack.innerHTML = '';
    wrapFront.innerHTML = '';
    ribbonLayer.innerHTML = '';
    cardLayer.innerHTML = '';

    const count = this.state.workbench.flowers.length;
    const stemBadgeEl = document.getElementById('m-stem-badge');
    const shelfStemEl = document.getElementById('m-shelf-stem-count');
    if (stemBadgeEl) stemBadgeEl.textContent = count;
    if (shelfStemEl) shelfStemEl.textContent = count;
    const containerType = this.state.workbench.containerType;
    const isBox = containerType === 'box';
    const isBasket = containerType === 'basket';
    const innerPaperObj = this.state.workbench.innerPaper
      ? DECOR_DATA.innerPapers.find(p => p.id === this.state.workbench.innerPaper)
      : null;
    const paperObj = this.state.workbench.paper
      ? DECOR_DATA.papers.find(p => p.id === this.state.workbench.paper)
      : null;
    const ribbonObj = this.state.workbench.ribbon
      ? DECOR_DATA.ribbons.find(r => r.id === this.state.workbench.ribbon)
      : null;

    if (count === 0 && !innerPaperObj && !paperObj && !ribbonObj) {
      hint.style.display = 'flex';
      hint.querySelector('.hint-text').textContent = 'Bàn Cắm Hoa Trống';
      hint.querySelector('.hint-sub').textContent = 'Kéo hoặc nhấp hoa từ kệ, rồi chọn kiểu gói & giấy gói/ruy băng!';
      chipsContainer.innerHTML = '<span class="empty-note">Chưa cắm cành hoa nào (kéo hoặc nhấp hoa trên kệ)</span>';
    } else if (count === 0) {
      hint.style.display = 'flex';
      hint.querySelector('.hint-text').textContent = 'Đã chọn vật liệu gói';
      hint.querySelector('.hint-sub').textContent = 'Hãy kéo hoặc nhấp cành hoa từ kệ vào đây!';
      chipsContainer.innerHTML = '<span class="empty-note">Chưa cắm cành hoa nào</span>';
    } else {
      hint.style.display = 'none';
    }

    // 1. LỚP LƯNG SAU (VẼ GIẤY NGOÀI / GIỎ MÂY & GIẤY LÓT LỤA BÊN TRONG)
    if (paperObj || innerPaperObj || isBasket) {
      if (isBasket) {
        let backSvg = `<ellipse cx="130" cy="264" rx="74" ry="8" fill="#cbd5e1" opacity="0.55"/>`;
        // Quai giỏ mây cong phía sau hoa
        backSvg += `
          <path d="M68,158 C68,40 192,40 192,158" fill="none" stroke="#8b5a2b" stroke-width="8" stroke-linecap="round"/>
          <path d="M68,158 C68,40 192,40 192,158" fill="none" stroke="#c68b59" stroke-width="4" stroke-dasharray="6 4" stroke-linecap="round"/>
          <ellipse cx="130" cy="158" rx="68" ry="12" fill="#7c4d25"/>
        `;
        if (innerPaperObj) {
          backSvg += `
            <path d="M64,158 Q80,126 98,142 Q114,122 130,138 Q146,122 162,142 Q180,126 196,158 L184,170 L76,170 Z"
                  fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.6"/>
          `;
        }
        wrapBack.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${backSvg}</svg>`;
      } else if (isBox) {
        let backSvg = `<ellipse cx="130" cy="266" rx="76" ry="8" fill="#cbd5e1" opacity="0.55"/>`;
        if (paperObj) {
          backSvg += `<ellipse cx="130" cy="148" rx="68" ry="12" fill="${paperObj.border}"/>`;
          backSvg += `<ellipse cx="130" cy="150" rx="64" ry="9" fill="#3f6212" opacity="0.22"/>`;
        }
        if (innerPaperObj) {
          // Lớp giấy lụa xếp ly nhô nhẹ quanh miệng hộp quà
          backSvg += `
            <path d="M62,150 Q78,120 96,136 Q114,116 130,134 Q146,116 164,136 Q182,120 198,150 L186,162 L74,162 Z"
                  fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.6"/>
            <path d="M84,152 L94,132 M112,152 L118,130 M148,152 L142,130 M176,152 L166,132"
                  stroke="${innerPaperObj.pleat}" stroke-width="1.5" fill="none"/>
          `;
        }
        wrapBack.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${backSvg}</svg>`;
      } else {
        let backSvg = `<ellipse cx="130" cy="268" rx="46" ry="7" fill="#cbd5e1" opacity="0.55"/>`;
        if (paperObj) {
          backSvg += `
            <polygon points="130,242 46,112 130,28 214,112" fill="${paperObj.innerFold || '#f8fafc'}"/>
            <polygon points="130,242 74,112 130,44 186,112" fill="${paperObj.color}" opacity="0.55"/>
          `;
        }
        if (innerPaperObj) {
          // Lớp giấy lót bên trong xếp nếp mềm mại lấp ló bên trong nón
          backSvg += `
            <path d="M130,238 L60,118 Q76,74 96,86 Q112,56 130,74 Q148,56 164,86 Q184,74 200,118 Z"
                  fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.6"/>
            <path d="M130,236 L88,92 M130,236 L114,74 M130,236 L146,74 M130,236 L172,92"
                  stroke="${innerPaperObj.pleat}" stroke-width="1.5" opacity="0.85" fill="none"/>
          `;
        }
        wrapBack.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${backSvg}</svg>`;
      }
    } else if (count > 0) {
      // Chỉ có hoa chưa bọc giấy: vẽ bóng đổ nhẹ trên mặt bàn gỗ
      wrapBack.innerHTML = `
        <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">
          <ellipse cx="130" cy="260" rx="58" ry="8" fill="#cbd5e1" opacity="0.45"/>
        </svg>
      `;
    }

    // 1B. LỚP LÁ XANH TỰ NHIÊN NỀN PHÍA SAU CỤM HOA (KHI ĐÃ CẮM HOA)
    if (greeneryLayer && count > 0) {
      const baseY = (isBox || isBasket) ? 162 : 168;
      greeneryLayer.innerHTML = `
        <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">
          <path d="M130,${baseY} Q84,110 64,66 Q94,96 128,${baseY - 4} Z" fill="#84cc16"/>
          <path d="M130,${baseY} Q176,110 196,66 Q166,96 132,${baseY - 4} Z" fill="#65a30d"/>
          <path d="M130,${baseY} Q98,96 86,44 Q112,86 130,${baseY - 6} Z" fill="#65a30d"/>
          <path d="M130,${baseY} Q162,96 174,44 Q148,86 130,${baseY - 6} Z" fill="#84cc16"/>
          <path d="M130,${baseY} Q118,80 130,36 Q142,80 130,${baseY} Z" fill="#4d7c0f"/>
        </svg>
      `;
    }

    // 2. CÁC CÀNH HOA TƯƠNG TÁC XÒE TỰ NHIÊN (BẤM VÀO ĐỂ CẮT TỈA KHI CẦM KÉO)
    this.state.workbench.flowers.forEach((item, idx) => {
      const flower = FLOWERS_DATA[item.id];
      if (!flower) return;

      const stemEl = document.createElement('div');
      const isTrimmed = !!item.trimmed;
      const justSnapped = this.justSnappedStemIdx === idx;
      stemEl.className = `crafted-flower-stem-big ${isTrimmed ? 'is-trimmed' : 'is-untrimmed'} ${justSnippedIdx === idx ? 'just-snipped' : ''} ${justSnapped ? 'stem-just-snapped' : ''}`;
      stemEl.dataset.stemIdx = idx;
      stemEl.title = isTrimmed
        ? `${flower.name} (Đã tỉa gọn ✨)`
        : `${flower.name} (Chưa tỉa — chọn ✂️ Kéo Tỉa rồi nhấp vào cành để tỉa gọn)`;

      stemEl.innerHTML = `
        ${flower.svg}
        ${isTrimmed
          ? '<span class="stem-status-dot trimmed" title="Đã tỉa gọn">✨</span>'
          : '<span class="stem-status-dot untrimmed" title="Lá thừa chưa tỉa">🌿</span>'}
      `;

      const rowLift = Math.floor(idx / 5) * 14;
      const wideSpread = isBox || isBasket;
      const xOffset = Math.sin((item.angle * Math.PI) / 180) * (wideSpread ? 64 : 56);
      const yOffset = (wideSpread ? -10 : -22) - Math.abs(Math.cos((item.angle * Math.PI) / 180) * 18) - rowLift;
      const scaleVal = isTrimmed ? 0.96 : 1.02;

      stemEl.style.transform = `translate(${xOffset}px, ${yOffset}px) rotate(${item.angle}deg) scale(${scaleVal})`;
      stemEl.style.zIndex = 6 + idx;

      stemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activeTool === 'shears') {
          this.trimStemAtIndex(idx, e);
        } else {
          this.showToast(`🌸 ${flower.name}: Chọn "✂️ Kéo Tỉa" ở bên trái rồi nhấp vào cành này để tỉa gọn!`);
        }
      });

      flowersLayer.appendChild(stemEl);
    });

    // 3. MẶT TRƯỚC GIỎ MÂY / HỘP TRÒN / GIẤY GÓI NGOÀI & VIỀN LÓT TRONG
    if (paperObj || innerPaperObj || isBasket) {
      if (isBasket) {
        let frontSvg = '';
        if (innerPaperObj) {
          frontSvg += `<path d="M68,158 Q96,174 130,170 Q164,174 192,158 L188,180 Q130,192 72,180 Z" fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.4" opacity="0.95"/>`;
        }
        // Thân giỏ mây đan ấm áp + đường viền màu giấy gói ngoài (nếu chọn)
        frontSvg += `
          <path d="M62,158 L76,254 Q130,270 184,254 L198,158 Q130,174 62,158 Z" fill="#d9a066" stroke="#7c4d25" stroke-width="2.4"/>
          <path d="M68,182 Q130,196 192,182 M71,206 Q130,220 189,206 M74,230 Q130,244 186,230" stroke="#8b5a2b" stroke-width="2.2" fill="none" opacity="0.7"/>
          <path d="M88,164 L96,257 M114,167 L118,261 M146,167 L142,261 M172,164 L164,257" stroke="#a06834" stroke-width="2" fill="none" opacity="0.6"/>
          <rect x="60" y="152" width="140" height="12" rx="6" fill="#c68b59" stroke="#7c4d25" stroke-width="2"/>
        `;
        if (paperObj) {
          frontSvg += `<path d="M65,172 Q130,188 195,172 L193,186 Q130,202 67,186 Z" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="1.4" opacity="0.92"/>`;
        }
        wrapFront.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${frontSvg}</svg>`;
      } else if (isBox) {
        let frontSvg = '';
        if (innerPaperObj) {
          frontSvg += `<path d="M68,149 Q96,168 130,164 Q164,168 192,149 L190,174 Q130,186 70,174 Z" fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.4" opacity="0.95"/>`;
        }
        if (paperObj) {
          frontSvg += `
            <path d="M62,148 L62,252 Q130,270 198,252 L198,148 Q130,164 62,148 Z" fill="${paperObj.color}"/>
            <path d="M62,148 L62,252 Q96,263 130,263 L130,157 Q96,156 62,148 Z" fill="#ffffff" opacity="0.22"/>
            <path d="M164,154 L164,259 Q182,256 198,252 L198,148 Q182,152 164,154 Z" fill="${paperObj.border}" opacity="0.28"/>
            <path d="M62,148 Q130,164 198,148" stroke="${paperObj.border}" stroke-width="2.5" fill="none"/>
          `;
        }
        wrapFront.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${frontSvg}</svg>`;
      } else {
        let frontSvg = '';
        if (innerPaperObj) {
          frontSvg += `<path d="M64,132 Q100,168 130,182 Q160,168 196,132 L138,236 L122,236 Z" fill="${innerPaperObj.color}" stroke="${innerPaperObj.border}" stroke-width="1.4" opacity="0.92"/>`;
        }
        if (paperObj) {
          frontSvg += `
            <polygon points="122,240 138,240 148,266 112,266" fill="${paperObj.border}" opacity="0.75"/>
            <polygon points="46,112 130,174 138,242 122,242" fill="${paperObj.color}"/>
            <polygon points="130,174 214,112 138,242 122,242" fill="${paperObj.border}" opacity="0.32"/>
            <polygon points="214,112 122,242 138,242 130,174" fill="${paperObj.innerFold || paperObj.color}"/>
            <polygon points="214,112 138,242 122,242 98,176" fill="${paperObj.color}" opacity="0.88"/>
          `;
        }
        wrapFront.innerHTML = `<svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">${frontSvg}</svg>`;
      }
    }

    // 4. RUY BĂNG & NƠ (CHỈ VẼ KHI ĐÃ CHỌN RUY BĂNG)
    if (ribbonObj) {
      if ((isBox && paperObj) || isBasket) {
        const yBar = isBasket ? 198 : 196;
        ribbonLayer.innerHTML = `
          <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">
            <path d="M66,${yBar} Q130,${yBar + 14} 194,${yBar} L194,${yBar + 16} Q130,${yBar + 30} 66,${yBar + 16} Z" fill="${ribbonObj.color}"/>
            <path d="M130,${yBar + 14} C106,${yBar - 4} 98,${yBar + 22} 125,${yBar + 19} Z" fill="${ribbonObj.color}"/>
            <path d="M130,${yBar + 14} C154,${yBar - 4} 162,${yBar + 22} 135,${yBar + 19} Z" fill="${ribbonObj.color}"/>
            <path d="M130,${yBar + 14} C110,${yBar + 2} 104,${yBar + 18} 125,${yBar + 17} Z" fill="#ffffff" opacity="0.25"/>
            <path d="M130,${yBar + 14} C150,${yBar + 2} 156,${yBar + 18} 135,${yBar + 17} Z" fill="#ffffff" opacity="0.25"/>
            <circle cx="130" cy="${yBar + 15}" r="6.5" fill="${ribbonObj.accentColor || ribbonObj.color}"/>
            <path d="M126,${yBar + 20} L116,${yBar + 36} L123,${yBar + 38} L129,${yBar + 22} Z" fill="${ribbonObj.color}"/>
            <path d="M134,${yBar + 20} L144,${yBar + 36} L137,${yBar + 38} L131,${yBar + 22} Z" fill="${ribbonObj.color}"/>
          </svg>
        `;
      } else {
        ribbonLayer.innerHTML = `
          <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">
            <rect x="117" y="236" width="26" height="7" rx="3.5" fill="${ribbonObj.color}"/>
            <path d="M130,239 C112,226 108,246 126,242 Z" fill="${ribbonObj.color}"/>
            <path d="M130,239 C148,226 152,246 134,242 Z" fill="${ribbonObj.color}"/>
            <circle cx="130" cy="240" r="4.5" fill="${ribbonObj.accentColor || ribbonObj.color}"/>
            <path d="M127,243 Q120,255 117,263" stroke="${ribbonObj.color}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
            <path d="M133,243 Q140,255 143,263" stroke="${ribbonObj.color}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
          </svg>
        `;
      }
    }

    // 5. KẸP THIỆP CHÚC MỪNG
    if (this.state.workbench.card) {
      const cardObj = DECOR_DATA.cards.find(c => c.id === this.state.workbench.card);
      if (cardObj) {
        cardLayer.innerHTML = `
          <div style="position:absolute; bottom:92px; right:64px; background:#fff; border:2px solid #73401c; border-radius:8px; padding:4px 8px; box-shadow:0 4px 8px rgba(0,0,0,0.16); transform:rotate(8deg); z-index:35; font-size:11px; font-weight:900; color:#1e3a5f; display:flex; align-items:center; gap:4px;">
            <span>💌</span>
            <span>${cardObj.name}</span>
          </div>
        `;
      }
    }

    // 6. CHIPS ĐIỀU KHIỂN HOA TRÊN BÀN
    if (count > 0) {
      const flowerCounts = {};
      this.state.workbench.flowers.forEach(f => {
        flowerCounts[f.id] = (flowerCounts[f.id] || 0) + 1;
      });

      chipsContainer.innerHTML = '';
      Object.keys(flowerCounts).forEach(fId => {
        const chip = document.createElement('div');
        chip.className = 'flower-chip-control';
        chip.innerHTML = `
          <span>🌸 ${FLOWERS_DATA[fId].name}</span>
          <button class="chip-btn-minus" data-id="${fId}">-</button>
          <span style="color:#e11d48;">x${flowerCounts[fId]}</span>
          <button class="chip-btn-plus" data-id="${fId}">+</button>
        `;

        chip.querySelector('.chip-btn-minus').addEventListener('click', () => {
          this.removeSpecificFlower(fId);
        });
        chip.querySelector('.chip-btn-plus').addEventListener('click', () => {
          this.addSpecificFlower(fId);
        });

        chipsContainer.appendChild(chip);
      });
    }
  }

  // 6. HỆ THỐNG KHÁCH HÀNG, ĐƠN GẤP, KHÁCH KHÓ TÍNH & BẢNG KẸP ĐƠN HÀNG
  spawnCustomer() {
    if (this.state.phase !== 'OPEN' || this.state.isPaused) return;
    if (this.state.hour >= 21 || (this.state.hour === 20 && this.state.minute >= 40)) return;
    if (this.state.customersQueue.length >= this.maxQueueLength) return;

    const inQueueIds = new Set(this.state.customersQueue.map(c => c.meta?.id));
    const availableCustomers = CUSTOMERS_DATA.filter(c => !inQueueIds.has(c.id));
    const customerPool = availableCustomers.length > 0 ? availableCustomers : CUSTOMERS_DATA;
    const customerMeta = customerPool[Math.floor(Math.random() * customerPool.length)];
    const vipBonus = this.getUpgradeBonus('vip_signboard');
    const isVip = Math.random() < (vipBonus.vipChance || 0.10);
    const isChoosy = !isVip ? Math.random() < 0.22 : Math.random() < 0.45;

    // Đơn Hàng Gấp (Express Order): xuất hiện ngẫu nhiên khi chưa có đơn gấp khác trong hàng đợi
    const hasExpressInQueue = this.state.customersQueue.some(c => c.order.isExpress && !c.isExpressExpired);
    const isExpress = !hasExpressInQueue && Math.random() < 0.22;

    // Khách có thể đặt Mẫu Độc Quyền từ Góc Sáng Tạo của tiệm (nếu đã phát minh ít nhất 1 mẫu)
    const eligibleDiy = (this.state.customRecipes || []).filter(r =>
      Object.keys(r.flowers).every(fId => this.isFlowerUnlocked(fId))
    );
    const pickedDiy = (!isExpress && eligibleDiy.length > 0 && Math.random() < 0.28)
      ? eligibleDiy[Math.floor(Math.random() * eligibleDiy.length)]
      : null;

    const order = this.generateVisualOrder(this.state.level, {
      isVip,
      isChoosy,
      isExpress,
      diyRecipe: pickedDiy
    });

    const patienceBonus = this.getUpgradeBonus('fast_hands').patienceBonus || 0;
    const totalStems = Object.values(order.flowers).reduce((sum, n) => sum + n, 0);
    const complexityBonus = totalStems >= 5 ? 18 : (Object.keys(order.flowers).length >= 2 ? 12 : 0);
    const basePatience = Math.round((115 + complexityBonus) * (1 + patienceBonus));

    const newCustomer = {
      id: 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      meta: customerMeta,
      isVip: isVip,
      isChoosy: isChoosy,
      order: order,
      maxPatience: basePatience,
      patience: basePatience,
      expressTimeLeft: isExpress ? 48 : 0,
      isExpressExpired: false,
      createdAt: Date.now()
    };

    this.state.customersQueue.push(newCustomer);
    this.renderCustomerQueue();
    this.updateActiveOrderClipboard();
    this.updateScoringChecklist();

    if (isExpress) {
      window.soundMgr.playExpressAlert();
      this.showToast(`⚡ ĐƠN HÀNG GẤP từ ${customerMeta.name}! Giao trong 48s để nhận x2 tiền đơn!`);
    } else if (pickedDiy) {
      window.soundMgr.playDoorBell();
      this.showToast(`💡 ${customerMeta.name} ghé tiệm đặt riêng Mẫu Độc Quyền "${pickedDiy.name}"!`);
    }
  }

  generateVisualOrder(level, opts = {}) {
    const isVip = typeof opts === 'boolean' ? opts : !!opts.isVip;
    const isChoosy = typeof opts === 'object' && !!opts.isChoosy;
    const isExpress = typeof opts === 'object' && !!opts.isExpress;
    const diyRecipe = typeof opts === 'object' ? opts.diyRecipe : null;

    const priceBonus = this.getUpgradeBonus('golden_shears').priceBonus || 0;
    const vipMult = isVip ? (this.getUpgradeBonus('vip_signboard').vipPriceMult || 1.3) : 1;
    const choosyMult = isChoosy ? 1.15 : 1;

    // 1. NẾU LÀ ĐƠN ĐẶT MẪU ĐỘC QUYỀN TỪ GÓC SÁNG TẠO
    if (diyRecipe) {
      let cardReq = null;
      let cardMsg = '';
      if (Math.random() > 0.5) {
        const cardObj = DECOR_DATA.cards[Math.floor(Math.random() * DECOR_DATA.cards.length)];
        cardReq = cardObj.id;
        cardMsg = cardObj.sampleMsg;
      }
      const price = Math.round(diyRecipe.price * (1 + priceBonus) * vipMult);
      return {
        containerType: diyRecipe.containerType || 'cone',
        flowers: { ...diyRecipe.flowers },
        innerPaper: diyRecipe.innerPaper,
        paper: diyRecipe.paper,
        ribbon: diyRecipe.ribbon,
        card: cardReq,
        cardMsg: cardMsg,
        requiredTone: diyRecipe.toneId || null,
        isDiyOrder: true,
        diyName: diyRecipe.name,
        isExpress: false,
        price: price
      };
    }

    // 2. ĐƠN THƯỜNG / VIP / KHÁCH KHÓ TÍNH / ĐƠN GẤP (LUÂN PHIÊN ĐA DẠNG: BÓ NÓN / HỘP TRÒN / GIỎ HOA)
    const allContainerTypes = ['cone', 'box', 'basket'];
    const poolTypes = this.lastOrderContainerType
      ? allContainerTypes.filter(t => t !== this.lastOrderContainerType)
      : allContainerTypes;
    const containerType = poolTypes[Math.floor(Math.random() * poolTypes.length)];
    this.lastOrderContainerType = containerType;
    const stylePriceAdd = (typeof CONTAINER_STYLES_DATA !== 'undefined' && CONTAINER_STYLES_DATA[containerType])
      ? CONTAINER_STYLES_DATA[containerType].priceAdd
      : 0;

    const available = Object.values(FLOWERS_DATA).filter(f => this.isFlowerUnlocked(f.id));
    let requiredTone = null;
    if (isVip || isChoosy) {
      const toneKeys = Object.keys(COLOR_TONE_META).filter(tKey =>
        available.some(f => Array.isArray(f.tones) && f.tones.includes(tKey))
      );
      if (toneKeys.length > 0) {
        requiredTone = toneKeys[Math.floor(Math.random() * toneKeys.length)];
      }
    }

    const tonePool = requiredTone
      ? available.filter(f => Array.isArray(f.tones) && f.tones.includes(requiredTone))
      : available;
    const flowerPool = tonePool.length > 0 ? tonePool : available;

    const reqFlowers = {};
    let totalPrice = 0;

    const numTypes = (flowerPool.length >= 2 && (this.state.currentDay >= 2 || level >= 2) && Math.random() > 0.4) ? 2 : 1;
    const shuffled = [...flowerPool].sort(() => 0.5 - Math.random());

    for (let i = 0; i < numTypes; i++) {
      const f = shuffled[i];
      if (!f) break;
      const maxRand = isExpress ? 2 : (level >= 3 ? 4 : 3);
      const count = 2 + Math.floor(Math.random() * maxRand);
      reqFlowers[f.id] = count;
      totalPrice += f.basePrice * count;
    }

    const pickByTone = (arr) => {
      if (requiredTone) {
        const matched = arr.filter(x => Array.isArray(x.tones) && x.tones.includes(requiredTone));
        if (matched.length > 0) return matched[Math.floor(Math.random() * matched.length)].id;
      }
      return arr[Math.floor(Math.random() * arr.length)].id;
    };

    const reqInnerPaper = pickByTone(DECOR_DATA.innerPapers);
    const reqPaper = pickByTone(DECOR_DATA.papers);
    const reqRibbon = pickByTone(DECOR_DATA.ribbons);

    let reqCard = null;
    let cardMsg = '';
    if (!isExpress && Math.random() > 0.4) {
      const cardObj = DECOR_DATA.cards[Math.floor(Math.random() * DECOR_DATA.cards.length)];
      reqCard = cardObj.id;
      cardMsg = cardObj.sampleMsg;
      totalPrice += 8;
    }

    totalPrice += 14 + stylePriceAdd;
    totalPrice = Math.round(totalPrice * (1 + priceBonus) * vipMult * choosyMult);

    return {
      containerType: containerType,
      flowers: reqFlowers,
      innerPaper: reqInnerPaper,
      paper: reqPaper,
      ribbon: reqRibbon,
      card: reqCard,
      cardMsg: cardMsg,
      requiredTone: requiredTone,
      isDiyOrder: false,
      diyName: '',
      isExpress: isExpress,
      price: totalPrice
    };
  }

  evaluateColorHarmony(flowerIds, innerId, paperId, ribbonId, targetTone = null) {
    if (!flowerIds || flowerIds.length === 0 || !innerId || !paperId || !ribbonId) {
      return { ready: false, level: 'none', toneId: null, bonusMult: 0, label: 'Chưa đủ vật liệu để chấm phối màu' };
    }

    const innerObj = DECOR_DATA.innerPapers.find(x => x.id === innerId);
    const paperObj = DECOR_DATA.papers.find(x => x.id === paperId);
    const ribbonObj = DECOR_DATA.ribbons.find(x => x.id === ribbonId);
    const items = [
      ...flowerIds.map(id => FLOWERS_DATA[id]).filter(Boolean),
      innerObj,
      paperObj,
      ribbonObj
    ].filter(Boolean);

    const allTones = Object.keys(COLOR_TONE_META);
    let bestTone = null;
    let bestMatchCount = 0;

    allTones.forEach(tKey => {
      const cnt = items.filter(it => Array.isArray(it.tones) && it.tones.includes(tKey)).length;
      if (cnt > bestMatchCount) {
        bestMatchCount = cnt;
        bestTone = tKey;
      }
    });

    if (targetTone) {
      const targetMatch = items.filter(it => Array.isArray(it.tones) && it.tones.includes(targetTone)).length;
      const toneMeta = COLOR_TONE_META[targetTone];
      if (targetMatch >= items.length - 1) {
        return {
          ready: true,
          level: 'good',
          toneId: targetTone,
          bonusMult: 0.16,
          label: `🎨 Chuẩn ${toneMeta.badge} (+16% 🪙)`
        };
      } else if (targetMatch >= Math.ceil(items.length * 0.6)) {
        return {
          ready: true,
          level: 'ok',
          toneId: targetTone,
          bonusMult: 0.06,
          label: `🎨 Khá hợp ${toneMeta.name} (+6% 🪙)`
        };
      }
      return {
        ready: true,
        level: 'warn',
        toneId: targetTone,
        bonusMult: 0,
        label: `🎨 Chưa đúng ${toneMeta.name}`
      };
    }

    const bestMeta = bestTone ? COLOR_TONE_META[bestTone] : null;
    if (bestMatchCount >= items.length) {
      return {
        ready: true,
        level: 'good',
        toneId: bestTone,
        bonusMult: 0.12,
        label: `🎨 Phối màu tuyệt mỹ: ${bestMeta.name} (+12% 🪙)`
      };
    } else if (bestMatchCount >= items.length - 1) {
      return {
        ready: true,
        level: 'ok',
        toneId: bestTone,
        bonusMult: 0.06,
        label: `🎨 Phối màu hài hòa (+6% 🪙)`
      };
    }
    return {
      ready: true,
      level: 'warn',
      toneId: null,
      bonusMult: 0,
      label: '🎨 Màu sắc ngẫu hứng (+0%)'
    };
  }

  renderCustomerQueue() {
    const queueArea = document.getElementById('customer-queue-area');
    queueArea.innerHTML = '';

    this.state.customersQueue.forEach((cust, index) => {
      const stand = document.createElement('div');
      const isSelected = index === this.state.activeCustomerIdx;
      const pct = Math.max(0, Math.min(100, (cust.patience / cust.maxPatience) * 100));
      const pState = pct < 25 ? 'danger' : (pct < 55 ? 'warning' : 'good');

      stand.className = `chibi-customer-stand pos-${index} ${cust.isVip ? 'is-vip-customer' : ''} ${cust.isChoosy ? 'is-choosy-customer' : ''} ${cust.order.isExpress && !cust.isExpressExpired ? 'is-express-customer' : ''} ${isSelected ? 'is-active-customer' : ''} ${pct < 25 ? 'is-impatient' : ''}`;
      stand.id = `cust-stand-${cust.id}`;

      let mood = 'Đang chờ';
      if (cust.order.isExpress && !cust.isExpressExpired) mood = `⚡ Gấp (${Math.ceil(cust.expressTimeLeft)}s)`;
      else if (isSelected) mood = cust.isVip ? '👑 Đang phục vụ VIP' : (cust.isChoosy ? '🧐 Khó tính' : '💬 Đang phục vụ');
      else if (pct < 25) mood = '💢 Sắp bỏ đi!';
      else if (cust.isVip) mood = '👑 Khách VIP';
      else if (cust.isChoosy) mood = '🧐 Kỹ tính';
      else if (index === 0) mood = '🌸 Đứng quầy';
      else mood = '👀 Đang chờ';

      stand.innerHTML = `
        <div class="chibi-mood-bubble ${cust.isVip ? 'vip-bubble' : ''}">${mood}</div>
        <div class="chibi-patience-wrap" title="Độ kiên nhẫn của khách">
          <span class="chibi-p-heart">${pct < 25 ? '💔' : '❤️'}</span>
          <div class="chibi-p-track">
            <div class="chibi-p-fill ${pState}" style="width: ${pct}%"></div>
          </div>
        </div>
        <div class="chibi-character-wrap">
          ${cust.meta.avatarSvg}
        </div>
      `;

      stand.addEventListener('click', () => {
        this.state.activeCustomerIdx = index;
        this.renderCustomerQueue();
        this.updateScoringChecklist();
        this.showToast(`Đang phục vụ: ${cust.isVip ? '👑 VIP ' : ''}${cust.meta.name}`);
      });

      queueArea.appendChild(stand);
    });

    const queueBadgeEl = document.getElementById('m-queue-badge');
    if (queueBadgeEl) queueBadgeEl.textContent = this.state.customersQueue.length;

    this.updateActiveOrderClipboard();
  }

  updateQueuePatienceUI() {
    this.state.customersQueue.forEach((cust, index) => {
      const stand = document.getElementById(`cust-stand-${cust.id}`);
      if (!stand) return;
      const pct = Math.max(0, Math.min(100, (cust.patience / cust.maxPatience) * 100));
      const pState = pct < 25 ? 'danger' : (pct < 55 ? 'warning' : 'good');
      const fill = stand.querySelector('.chibi-p-fill');
      const heart = stand.querySelector('.chibi-p-heart');
      const moodEl = stand.querySelector('.chibi-mood-bubble');

      if (fill) {
        fill.style.width = `${pct}%`;
        fill.className = `chibi-p-fill ${pState}`;
      }
      if (heart) {
        heart.textContent = pct < 25 ? '💔' : '❤️';
      }
      stand.classList.toggle('is-impatient', pct < 25);
      stand.classList.toggle('is-express-customer', !!(cust.order.isExpress && !cust.isExpressExpired));
      if (moodEl) {
        if (cust.order.isExpress && !cust.isExpressExpired) {
          moodEl.textContent = `⚡ Gấp (${Math.max(1, Math.ceil(cust.expressTimeLeft))}s)`;
        } else if (index !== this.state.activeCustomerIdx && pct < 25) {
          moodEl.textContent = '💢 Sắp bỏ đi!';
        }
      }
    });
  }

  updateActiveOrderClipboard() {
    if (this.state.phase !== 'OPEN' && this.state.phase !== 'CLOSING') return;

    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    const standEl = document.getElementById('order-clipboard-stand');
    const orderView = document.getElementById('clipboard-active-order-view');
    const waitingView = document.getElementById('clipboard-waiting-view');
    const specialStrip = document.getElementById('ticket-special-strip');
    const specialBadge = document.getElementById('ticket-special-badge');
    const expressTimerEl = document.getElementById('ticket-express-timer');
    const toneReqRow = document.getElementById('ticket-tone-req-row');

    if (!cust) {
      if (standEl) standEl.classList.remove('express-order', 'choosy-order', 'diy-order');
      if (specialStrip) specialStrip.style.display = 'none';
      const mStripTxt = document.getElementById('mobile-order-strip-text');
      const mStripScore = document.getElementById('mobile-order-strip-score');
      if (mStripTxt) mStripTxt.textContent = this.state.phase === 'CLOSING' ? '🌙 Đã phục vụ xong toàn bộ khách!' : '🌸 Đang chờ khách hàng ghé quầy...';
      if (mStripScore) mStripScore.textContent = '0%';
      const isClosing = this.state.phase === 'CLOSING';
      orderView.style.display = 'none';
      if (waitingView) {
        waitingView.style.display = 'flex';
        document.getElementById('clipboard-waiting-icon').textContent = isClosing ? '🌙' : '🌸';
        document.getElementById('clipboard-waiting-title').textContent = isClosing
          ? 'Đã phục vụ xong toàn bộ khách!'
          : 'Đang chờ khách hàng tiếp theo...';
        document.getElementById('clipboard-waiting-sub').textContent = isClosing
          ? 'Đang thu dọn quầy để mở bảng tổng kết ngày...'
          : 'Khách sẽ ghé quầy ngay bây giờ';
      }
      return;
    }

    if (waitingView) waitingView.style.display = 'none';
    orderView.style.display = 'flex';

    const isExpressActive = cust.order.isExpress && !cust.isExpressExpired;
    if (standEl) {
      standEl.classList.toggle('express-order', isExpressActive);
      standEl.classList.toggle('choosy-order', !isExpressActive && (cust.isChoosy || cust.isVip));
      standEl.classList.toggle('diy-order', !isExpressActive && cust.order.isDiyOrder);
    }

    if (specialStrip && specialBadge && expressTimerEl) {
      if (isExpressActive) {
        specialStrip.style.display = 'flex';
        specialStrip.className = 'ticket-special-strip';
        specialBadge.textContent = '⚡ ĐƠN HÀNG GẤP • x2 THƯỞNG';
        expressTimerEl.style.display = 'inline-block';
        expressTimerEl.textContent = `⏱️ ${Math.max(1, Math.ceil(cust.expressTimeLeft))}s`;
      } else if (cust.order.isDiyOrder) {
        specialStrip.style.display = 'flex';
        specialStrip.className = 'ticket-special-strip diy-strip';
        specialBadge.textContent = `💡 MẪU ĐỘC QUYỀN: "${cust.order.diyName}"`;
        expressTimerEl.style.display = 'none';
      } else if (cust.isChoosy || cust.isVip) {
        specialStrip.style.display = 'flex';
        specialStrip.className = 'ticket-special-strip choosy-strip';
        specialBadge.textContent = cust.isVip ? '👑 KHÁCH VIP ĐẶC BIỆT (+TIP LỚN)' : '🧐 KHÁCH KỸ TÍNH • CHÚ Ý TÔNG MÀU';
        expressTimerEl.style.display = 'none';
      } else {
        specialStrip.style.display = 'none';
      }
    }

    if (toneReqRow) {
      if (cust.order.requiredTone && COLOR_TONE_META[cust.order.requiredTone]) {
        const tm = COLOR_TONE_META[cust.order.requiredTone];
        toneReqRow.style.display = 'flex';
        toneReqRow.innerHTML = `<span>${tm.badge}:</span> <span>${tm.hint}</span>`;
      } else {
        toneReqRow.style.display = 'none';
      }
    }

    const avatarThumbEl = document.getElementById('active-cust-avatar-thumb');
    if (avatarThumbEl) avatarThumbEl.textContent = cust.meta.thumbEmoji || '🌸';

    document.getElementById('ticket-cust-name').textContent = (cust.isVip ? '👑 ' : (cust.isChoosy ? '🧐 ' : '')) + cust.meta.name;
    const styleEl = document.getElementById('ticket-cust-style');
    styleEl.textContent = cust.isVip ? `VIP • ${cust.meta.stylePref}` : (cust.isChoosy ? `Kỹ tính • ${cust.meta.stylePref}` : cust.meta.stylePref);
    styleEl.className = `ticket-style-pill ${cust.isVip ? 'vip-pill' : ''}`;

    const cType = cust.order.containerType || 'cone';
    const cMeta = (typeof CONTAINER_STYLES_DATA !== 'undefined' && CONTAINER_STYLES_DATA[cType])
      ? CONTAINER_STYLES_DATA[cType]
      : { icon: '💐', shortName: 'Bó Nón' };
    const containerBadgeEl = document.getElementById('ticket-container-badge');
    if (containerBadgeEl) {
      containerBadgeEl.textContent = `${cMeta.icon} ${cMeta.shortName}`;
      containerBadgeEl.className = `ticket-container-badge style-${cType}`;
    }

    document.getElementById('ticket-order-price').textContent = isExpressActive
      ? `${cust.order.price * 2} 🪙 (x2)`
      : `${cust.order.price} 🪙`;

    const pct = Math.max(0, Math.min(100, (cust.patience / cust.maxPatience) * 100));
    const decorMult = this.getPatienceDecayMult();
    const secsLeft = Math.max(0, Math.ceil((cust.patience / (1.2 * decorMult)) * 1.5));
    const fill = document.getElementById('active-patience-fill');
    const patienceTxt = document.getElementById('active-patience-txt');
    fill.style.width = `${pct}%`;
    if (pct < 25) {
      fill.className = 'ticket-patience-bar danger';
      if (patienceTxt) patienceTxt.textContent = `Sắp bỏ đi! (${secsLeft}s)`;
    } else if (pct < 55) {
      fill.className = 'ticket-patience-bar warning';
      if (patienceTxt) patienceTxt.textContent = `Hơi sốt ruột (${secsLeft}s)`;
    } else {
      fill.className = 'ticket-patience-bar';
      if (patienceTxt) patienceTxt.textContent = `Vui vẻ (${secsLeft}s)`;
    }

    const flowersListEl = document.getElementById('ticket-req-flowers-list');
    flowersListEl.innerHTML = '';
    Object.keys(cust.order.flowers).forEach(fId => {
      const fMeta = FLOWERS_DATA[fId];
      const pill = document.createElement('div');
      pill.className = 'ticket-flower-pill';
      pill.innerHTML = `
        <div class="ticket-flw-svg">${fMeta.svg}</div>
        <div class="ticket-flw-details">
          <span>${fMeta.name}</span>
          <strong>${cust.order.flowers[fId]} bông</strong>
        </div>
      `;
      flowersListEl.appendChild(pill);
    });

    const innerObj = DECOR_DATA.innerPapers.find(p => p.id === cust.order.innerPaper);
    const innerPrev = document.getElementById('ticket-inner-paper-preview');
    const innerName = document.getElementById('ticket-inner-paper-name');
    if (innerPrev) innerPrev.innerHTML = innerObj ? innerObj.thumbSvg : '';
    if (innerName) innerName.textContent = innerObj ? innerObj.name : '';

    const paperObj = DECOR_DATA.papers.find(p => p.id === cust.order.paper);
    document.getElementById('ticket-paper-preview').innerHTML = paperObj ? paperObj.thumbSvg : '';
    document.getElementById('ticket-paper-name').textContent = paperObj ? paperObj.name : '';

    const ribbonObj = DECOR_DATA.ribbons.find(r => r.id === cust.order.ribbon);
    document.getElementById('ticket-ribbon-preview').innerHTML = ribbonObj ? ribbonObj.thumbSvg : '';
    document.getElementById('ticket-ribbon-name').textContent = ribbonObj ? ribbonObj.name : '';

    const quoteEl = document.getElementById('ticket-card-quote');
    if (cust.order.card) {
      quoteEl.style.display = 'block';
      quoteEl.innerHTML = `💌 <em>"${cust.order.cardMsg}"</em>`;
    } else {
      quoteEl.style.display = 'none';
    }

    // Đồng bộ dải tóm tắt đơn hàng gọn cho chế độ điện thoại dọc
    const mStripTxt = document.getElementById('mobile-order-strip-text');
    if (mStripTxt) {
      const flwSummary = Object.keys(cust.order.flowers)
        .map(id => `${FLOWERS_DATA[id]?.name || id} x${cust.order.flowers[id]}`)
        .join(', ');
      const ipName = innerObj ? innerObj.name : '';
      const pName = paperObj ? paperObj.name : '';
      const rName = ribbonObj ? ribbonObj.name : '';
      const cCard = cust.order.card ? ` • ${DECOR_DATA.cards.find(x => x.id === cust.order.card)?.name || ''}` : '';
      mStripTxt.textContent = `${cMeta.icon} ${cMeta.shortName}: ${flwSummary} • ${ipName}/${pName}/${rName}${cCard}`;
    }
  }

  // 7. CƠ CHẾ CHẤM ĐIỂM 6 TIÊU CHÍ + PHỐI MÀU HÀI HÒA
  updateScoringChecklist() {
    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    const scoreBadge = document.getElementById('order-score-badge');
    const feedbackText = document.getElementById('order-feedback-text');
    const estPriceEl = document.getElementById('order-est-price');
    const harmonyBadge = document.getElementById('color-harmony-badge');

    if (!cust) {
      scoreBadge.textContent = '0%';
      feedbackText.textContent = this.state.phase === 'PREPARING' ? 'Đang chuẩn bị mở bán' : 'Chưa có đơn hàng';
      estPriceEl.textContent = '0 🪙';
      if (harmonyBadge) harmonyBadge.style.display = 'none';
      return;
    }

    let flowerScore = 0;
    let qtyScore = 0;
    let containerStyleScore = 0;
    let innerPaperScore = 0;
    let paperScore = 0;
    let ribbonScore = 0;
    let cardScore = 0;

    const currentCounts = {};
    this.state.workbench.flowers.forEach(f => {
      currentCounts[f.id] = (currentCounts[f.id] || 0) + 1;
    });

    const reqFlowers = cust.order.flowers;
    const reqKeys = Object.keys(reqFlowers);
    let missingNotes = [];

    // 1. Loại hoa (25đ)
    let correctTypes = 0;
    reqKeys.forEach(k => {
      if ((currentCounts[k] || 0) > 0) correctTypes++;
      else missingNotes.push(`Chưa có ${FLOWERS_DATA[k].name}`);
    });
    flowerScore = Math.round((correctTypes / reqKeys.length) * 25);

    // 2. Số lượng (20đ)
    let totalReqQty = 0;
    let matchQtyCount = 0;
    reqKeys.forEach(k => {
      totalReqQty += reqFlowers[k];
      const cur = currentCounts[k] || 0;
      if (cur === reqFlowers[k]) matchQtyCount += reqFlowers[k];
      else if (cur < reqFlowers[k]) {
        matchQtyCount += cur;
        missingNotes.push(`Thiếu ${reqFlowers[k] - cur} bông ${FLOWERS_DATA[k].name}`);
      } else {
        matchQtyCount += reqFlowers[k] * 0.8;
        missingNotes.push(`Thừa ${cur - reqFlowers[k]} bông ${FLOWERS_DATA[k].name}`);
      }
    });
    qtyScore = Math.min(20, Math.round((matchQtyCount / totalReqQty) * 20));

    // 3. Kiểu dáng đóng gói: Bó Nón / Hộp Tròn / Giỏ Hoa (15đ)
    const reqContainer = cust.order.containerType || 'cone';
    if (this.state.workbench.containerType === reqContainer) {
      containerStyleScore = 15;
    } else {
      const cMeta = (typeof CONTAINER_STYLES_DATA !== 'undefined' && CONTAINER_STYLES_DATA[reqContainer])
        ? CONTAINER_STYLES_DATA[reqContainer]
        : { shortName: 'Bó Nón' };
      missingNotes.push(`Cần kiểu ${cMeta.shortName}`);
    }

    // 4. Giấy lót bên trong (10đ)
    if (this.state.workbench.innerPaper === cust.order.innerPaper) innerPaperScore = 10;
    else {
      const ipObj = DECOR_DATA.innerPapers.find(p => p.id === cust.order.innerPaper);
      missingNotes.push(`Cần lót ${ipObj ? ipObj.name : ''}`);
    }

    // 5. Giấy gói bên ngoài (10đ)
    if (this.state.workbench.paper === cust.order.paper) paperScore = 10;
    else {
      const pObj = DECOR_DATA.papers.find(p => p.id === cust.order.paper);
      missingNotes.push(`Cần giấy ngoài ${pObj ? pObj.name : ''}`);
    }

    // 6. Ruy băng (10đ)
    if (this.state.workbench.ribbon === cust.order.ribbon) ribbonScore = 10;
    else {
      const rObj = DECOR_DATA.ribbons.find(r => r.id === cust.order.ribbon);
      missingNotes.push(`Cần nơ ${rObj ? rObj.name : ''}`);
    }

    // 7. Thiệp (10đ)
    if (cust.order.card) {
      if (this.state.workbench.card === cust.order.card) cardScore = 10;
      else {
        const cObj = DECOR_DATA.cards.find(c => c.id === cust.order.card);
        missingNotes.push(`Cần kẹp ${cObj ? cObj.name : 'thiệp'}`);
      }
    } else cardScore = 10;

    const updateRow = (id, score, max) => {
      const row = document.getElementById(id);
      if (!row) return;
      row.querySelector('.val').textContent = `${score}/${max}đ`;
      if (score >= max) {
        row.className = 'score-row passed';
        row.querySelector('.dot').textContent = '🟢';
      } else {
        row.className = 'score-row failed';
        row.querySelector('.dot').textContent = '🔴';
      }
    };

    updateRow('chk-flower-types', flowerScore, 25);
    updateRow('chk-flower-counts', qtyScore, 20);
    updateRow('chk-container-style', containerStyleScore, 15);
    updateRow('chk-inner-paper', innerPaperScore, 10);
    updateRow('chk-paper', paperScore, 10);
    updateRow('chk-ribbon', ribbonScore, 10);
    updateRow('chk-card', cardScore, 10);

    const totalScore = flowerScore + qtyScore + containerStyleScore + innerPaperScore + paperScore + ribbonScore + cardScore;
    scoreBadge.textContent = `${totalScore}%`;
    scoreBadge.style.color = totalScore >= 85 ? '#166534' : (totalScore >= 55 ? '#b45309' : '#e11d48');

    // Kiểm tra phối màu hài hòa trên bàn cắm
    const harmony = this.evaluateColorHarmony(
      this.state.workbench.flowers.map(f => f.id),
      this.state.workbench.innerPaper,
      this.state.workbench.paper,
      this.state.workbench.ribbon,
      cust.order.requiredTone
    );
    if (harmonyBadge) {
      if (harmony.ready) {
        harmonyBadge.style.display = 'block';
        harmonyBadge.textContent = harmony.label;
        harmonyBadge.className = `color-harmony-pill harmony-${harmony.level}`;
      } else {
        harmonyBadge.style.display = 'none';
      }
    }

    if (totalScore >= 95) {
      feedbackText.textContent = '✨ Bó hoa hoàn hảo từng chi tiết! Bấm Giao để thắt nơ!';
    } else if (missingNotes.length > 0) {
      feedbackText.textContent = `⚠️ Lưu ý: ${missingNotes.slice(0, 2).join(' • ')}`;
    } else {
      feedbackText.textContent = 'Bó hoa đã tương đối chuẩn yêu cầu';
    }

    const trimBadge = document.getElementById('trim-bonus-badge');
    if (trimBadge) {
      trimBadge.style.display = this.state.workbench.trimmed ? 'inline-block' : 'none';
    }

    const isExpressActive = cust.order.isExpress && !cust.isExpressExpired;
    const expressMult = isExpressActive ? 2 : 1;
    const harmonyBonusMult = harmony.ready ? (1 + harmony.bonusMult) : 1;
    const estPrice = Math.round((cust.order.price * totalScore / 100) * expressMult * harmonyBonusMult);
    estPriceEl.textContent = isExpressActive ? `${estPrice} 🪙 (x2)` : `${estPrice} 🪙`;

    const mStripScore = document.getElementById('mobile-order-strip-score');
    if (mStripScore) {
      mStripScore.textContent = `${totalScore}%`;
      mStripScore.style.background = totalScore >= 85 ? '#dcfce7' : (totalScore >= 55 ? '#fef9c3' : '#fee2e2');
      mStripScore.style.color = totalScore >= 85 ? '#166534' : (totalScore >= 55 ? '#854d0e' : '#991b1b');
    }

    return { totalScore, estPrice, harmony };
  }

  // 8. MINI-GAME THẮT NƠ & GIAO HOA THU TIỀN
  deliverOrder() {
    if (this.state.phase !== 'OPEN' && this.state.phase !== 'CLOSING') {
      this.showToast('Tiệm đang chuẩn bị, hãy bấm "LẬT BIỂN: MỞ BÁN" để đón khách!');
      return;
    }

    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    if (!cust) {
      this.showToast('Không có khách hàng nào để giao hoa!');
      return;
    }

    if (this.state.workbench.flowers.length === 0) {
      this.showToast('Bàn cắm hoa đang trống! Hãy kéo hoặc nhấp hoa từ kệ để cắm trước khi giao.');
      return;
    }

    if (!this.state.workbench.innerPaper || !this.state.workbench.paper || !this.state.workbench.ribbon) {
      this.showToast('Hãy tự tay chọn đủ Giấy Lót Trong, Giấy Gói Ngoài và Ruy Băng trước khi giao!');
      return;
    }

    const { totalScore } = this.updateScoringChecklist();
    if (totalScore < 50) {
      window.soundMgr.playCustomerSad();
      this.showToast('Bó hoa chưa đạt yêu cầu! Khách lắc đầu chưa muốn nhận.');
      return;
    }

    this.openRibbonMinigame();
  }

  openRibbonMinigame() {
    const overlay = document.getElementById('ribbon-minigame-overlay');
    const previewEl = document.getElementById('rm-bouquet-preview');
    const resultBanner = document.getElementById('rm-result-banner');
    const cursorEl = document.getElementById('rm-cursor');
    const tieBtn = document.getElementById('btn-rm-tie');
    const skipBtn = document.getElementById('btn-rm-skip');
    if (!overlay) {
      this.finalizeDeliverOrder({ tier: 'normal', bonusMult: 0, bonusTip: 0, label: '' });
      return;
    }

    if (previewEl) {
      this.renderCompactBouquetSvg(previewEl, {
        containerType: this.state.workbench.containerType,
        flowers: this.state.workbench.flowers.map(f => f.id),
        innerPaper: this.state.workbench.innerPaper,
        paper: this.state.workbench.paper,
        ribbon: this.state.workbench.ribbon
      });
    }

    if (resultBanner) resultBanner.style.display = 'none';
    if (tieBtn) tieBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;

    this.ribbonMinigame.active = true;
    this.ribbonMinigame.locked = false;
    this.ribbonMinigame.pos = 15;
    this.ribbonMinigame.dir = 1;
    this.ribbonMinigame.lastTime = performance.now();
    if (cursorEl) cursorEl.style.left = '15%';
    overlay.style.display = 'flex';

    const step = (now) => {
      if (!this.ribbonMinigame.active || this.ribbonMinigame.locked) return;
      const dt = Math.min(0.05, (now - this.ribbonMinigame.lastTime) / 1000);
      this.ribbonMinigame.lastTime = now;
      const speed = 58; // Tốc độ mượt mà vừa tầm tay để người chơi dễ căn chuẩn Hoàn Mỹ
      this.ribbonMinigame.pos += this.ribbonMinigame.dir * speed * dt;
      if (this.ribbonMinigame.pos >= 94) {
        this.ribbonMinigame.pos = 94;
        this.ribbonMinigame.dir = -1;
      } else if (this.ribbonMinigame.pos <= 6) {
        this.ribbonMinigame.pos = 6;
        this.ribbonMinigame.dir = 1;
      }
      if (cursorEl) cursorEl.style.left = `${this.ribbonMinigame.pos}%`;
      this.ribbonMinigame.rafId = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.ribbonMinigame.rafId);
    this.ribbonMinigame.rafId = requestAnimationFrame(step);
  }

  stopRibbonMinigame(skip = false) {
    if (!this.ribbonMinigame.active || this.ribbonMinigame.locked) return;
    this.ribbonMinigame.locked = true;
    cancelAnimationFrame(this.ribbonMinigame.rafId);

    const overlay = document.getElementById('ribbon-minigame-overlay');
    const resultBanner = document.getElementById('rm-result-banner');
    const tieBtn = document.getElementById('btn-rm-tie');
    const skipBtn = document.getElementById('btn-rm-skip');
    if (tieBtn) tieBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;

    if (skip) {
      this.ribbonMinigame.active = false;
      if (overlay) overlay.style.display = 'none';
      this.finalizeDeliverOrder({ tier: 'normal', bonusMult: 0, bonusTip: 0, label: '' });
      return;
    }

    const pos = this.ribbonMinigame.pos;
    let bowResult;
    if (pos >= 36 && pos <= 64) {
      bowResult = {
        tier: 'perfect',
        bonusMult: 0.25,
        bonusTip: 8,
        label: '✨ BÓ HOA HOÀN MỸ! (+25% giá & +8 🪙 boa)'
      };
      window.soundMgr.playPerfectBow();
    } else if (pos >= 20 && pos <= 80) {
      bowResult = {
        tier: 'good',
        bonusMult: 0.10,
        bonusTip: 3,
        label: '🎀 Thắt nơ khéo léo! (+10% giá & +3 🪙 boa)'
      };
      window.soundMgr.playWrapPaper();
    } else {
      bowResult = {
        tier: 'normal',
        bonusMult: 0,
        bonusTip: 0,
        label: '💐 Đã thắt nơ xong!'
      };
      window.soundMgr.playWrapPaper();
    }

    if (resultBanner) {
      resultBanner.style.display = 'block';
      resultBanner.className = `rm-result-banner ${bowResult.tier}`;
      resultBanner.textContent = bowResult.label;
    }

    setTimeout(() => {
      this.ribbonMinigame.active = false;
      if (overlay) overlay.style.display = 'none';
      this.finalizeDeliverOrder(bowResult);
    }, 520);
  }

  finalizeDeliverOrder(bowResult = { tier: 'normal', bonusMult: 0, bonusTip: 0, label: '' }) {
    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    if (!cust) return;

    const { totalScore, estPrice, harmony } = this.updateScoringChecklist();
    if (totalScore < 50) return;

    // Trừ 1 tờ giấy lót trong, 1 tờ giấy gói ngoài & 1 dải ruy băng đã sử dụng từ kho nguyên liệu
    if (this.state.innerPaperStocks[this.state.workbench.innerPaper] > 0) {
      this.state.innerPaperStocks[this.state.workbench.innerPaper]--;
    }
    if (this.state.paperStocks[this.state.workbench.paper] > 0) {
      this.state.paperStocks[this.state.workbench.paper]--;
    }
    if (this.state.ribbonStocks[this.state.workbench.ribbon] > 0) {
      this.state.ribbonStocks[this.state.workbench.ribbon]--;
    }

    const finalRevenue = Math.round(estPrice * (1 + (bowResult.bonusMult || 0)));
    let bonusTip = bowResult.bonusTip || 0;
    const decorTipRate = this.getAtmosphereTipBonus();
    const rushBonus = this.state.isRushHour ? 6 : 0;

    if (totalScore >= 85) {
      bonusTip += Math.round(finalRevenue * 0.25) + 6;
      const tipBonusRate = this.getUpgradeBonus('golden_shears').tipBonus || 0;
      if (tipBonusRate > 0) bonusTip += Math.round(finalRevenue * tipBonusRate);
      if (decorTipRate > 0) bonusTip += Math.round(finalRevenue * decorTipRate);
      if (cust.isVip) bonusTip += 14;
      if (cust.isChoosy && harmony && harmony.level === 'good') bonusTip += 12;
      if (this.state.workbench.trimmed) bonusTip += 5;
      bonusTip += rushBonus;
      window.soundMgr.playCustomerHappy();
      this.spawnHeartParticles();
    } else {
      if (decorTipRate > 0) bonusTip += Math.round(finalRevenue * decorTipRate);
      if (this.state.workbench.trimmed) bonusTip += 5;
      bonusTip += rushBonus;
      window.soundMgr.playCoinChime();
    }

    const totalEarned = finalRevenue + bonusTip;
    this.state.gold += totalEarned;
    this.state.completedOrdersCount++;
    this.state.dayStats.orders++;
    this.state.dayStats.revenue += finalRevenue;
    this.state.dayStats.tips += bonusTip;

    const starRating = Math.min(5, (totalScore / 100) * 5 + (bowResult.tier === 'perfect' ? 0.3 : 0));
    this.state.dayStats.ratings.push(starRating);
    const repGainBonus = (cust.isVip || cust.isChoosy) && totalScore >= 90 ? 0.1 : 0;
    this.state.reputation = Math.min(5.0, parseFloat(((this.state.reputation * 0.8) + (starRating * 0.2) + repGainBonus).toFixed(1)));

    this.spawnCoinParticles();
    const tags = [];
    if (cust.order.isExpress && !cust.isExpressExpired) tags.push('⚡ x2 Đơn Gấp');
    if (bowResult.tier === 'perfect') tags.push('✨ Bó Hoa Hoàn Mỹ');
    if (rushBonus > 0) tags.push(`🔥 +${rushBonus}🪙 Cao Điểm`);
    const tagText = tags.length > 0 ? ` (${tags.join(' • ')})` : '';
    this.showToast(`+${totalEarned} 🪙${tagText}! ${cust.meta.name}: "${cust.meta.dialogue}"`);

    this.clearWorkbench(false, true);

    this.state.customersQueue.splice(this.state.activeCustomerIdx, 1);
    this.state.activeCustomerIdx = 0;

    this.checkLevelProgress();
    this.renderCustomerQueue();
    this.updateScoringChecklist();
    this.updateHUD();
    this.saveGameData();

    if (this.state.phase === 'CLOSING') {
      this.checkClosingCompletion();
    }
  }

  spawnCoinParticles() {
    const fxLayer = document.getElementById('fx-layer');
    for (let i = 0; i < 7; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-particle';
      coin.textContent = '🪙';
      coin.style.left = `${320 + (Math.random() * 80 - 40)}px`;
      coin.style.bottom = `${140 + (Math.random() * 40)}px`;
      fxLayer.appendChild(coin);
      setTimeout(() => coin.remove(), 1100);
    }
  }

  spawnHeartParticles() {
    const fxLayer = document.getElementById('fx-layer');
    const hearts = ['❤️', '💖', '🌸', '✨'];
    for (let i = 0; i < 9; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart-particle';
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = `${140 + (Math.random() * 60 - 30)}px`;
      heart.style.bottom = `${240 + (Math.random() * 40)}px`;
      heart.style.setProperty('--tx', `${(Math.random() - 0.5) * 90}px`);
      fxLayer.appendChild(heart);
      setTimeout(() => heart.remove(), 1300);
    }
  }

  isRushHourTime(hour, minute) {
    // Khung Giờ Cao Điểm: Trưa (11:30–13:30) và Chiều Tan Tầm (17:00–19:00)
    const totalMin = hour * 60 + minute;
    return (totalMin >= 11 * 60 + 30 && totalMin < 13 * 60 + 30) ||
           (totalMin >= 17 * 60 && totalMin < 19 * 60);
  }

  syncRushHourState(notify = true) {
    const shouldRush = this.state.phase === 'OPEN' && this.isRushHourTime(this.state.hour, this.state.minute);
    const changed = shouldRush !== this.state.isRushHour;
    this.state.isRushHour = shouldRush;
    this.maxQueueLength = this.getMaxQueueLength();

    const rushHud = document.getElementById('hud-rush-badge');
    const rushBanner = document.getElementById('rush-hour-banner');
    const custArea = document.getElementById('customer-area');
    if (rushHud) rushHud.style.display = shouldRush ? 'inline-flex' : 'none';
    if (rushBanner) rushBanner.style.display = shouldRush ? 'inline-flex' : 'none';
    if (custArea) custArea.classList.toggle('rush-hour-active', shouldRush);

    if (changed) {
      this.restartCustomerSpawnTimer();
      if (shouldRush && notify) {
        window.soundMgr.playDoorBell();
        document.getElementById('ticker-status-tag').textContent = '🔥 GIỜ CAO ĐIỂM:';
        document.getElementById('event-ticker-content').textContent =
          'Khách đang đổ về tiệm rất đông! Hãy ưu tiên khách sắp hết thanh ❤️ kiên nhẫn (+6 🪙 thưởng cao điểm)!';
        this.showToast('🔥 GIỜ CAO ĐIỂM! Khách xếp hàng đông — Giao đơn nhanh nhận thêm +6 🪙!');
        // Gọi ngay 1 khách mới để cảm nhận nhịp độ giờ cao điểm
        if (this.state.customersQueue.length < this.maxQueueLength) {
          this.spawnCustomer();
        }
      } else if (!shouldRush && notify && this.state.phase === 'OPEN') {
        const evt = GAME_EVENTS[this.state.currentEventKey];
        document.getElementById('ticker-status-tag').textContent = '🔔 ĐANG BÁN:';
        document.getElementById('event-ticker-content').textContent =
          `${evt.name} — Đã qua khung giờ cao điểm, khách vào tiệm nhịp nhàng trở lại.`;
        this.showToast('🌸 Đã hết Giờ Cao Điểm, nhịp khách trở lại bình thường!');
      }
    }
  }

  // 9. VÒNG LẶP THỜI GIAN, GIỜ CAO ĐIỂM & KHÁCH HÀNG (KẾT THÚC NGÀY CHỈ KHI PHỤC VỤ XONG KHÁCH CUỐI + BUFFER)
  startGameLoops() {
    clearInterval(this.gameLoopTimer);
    this.gameLoopTimer = setInterval(() => {
      if (this.state.isPaused) return;

      if (this.state.phase === 'OPEN') {
        this.state.minute += 10;
        if (this.state.minute >= 60) {
          this.state.minute = 0;
          this.state.hour++;
        }

        if (this.state.hour >= 21) {
          this.state.hour = 21;
          this.state.minute = 0;
          this.enterClosingPhase();
        } else {
          this.syncRushHourState(true);
          this.updateCustomersPatience();
        }
      } else if (this.state.phase === 'CLOSING') {
        this.updateCustomersPatience();
        this.checkClosingCompletion();
      }

      this.updateHUDTime();
    }, 1500);

    this.restartCustomerSpawnTimer();
  }

  restartCustomerSpawnTimer() {
    clearInterval(this.customerSpawnTimer);
    const baseMs = this.getUpgradeBonus('vip_signboard').spawnIntervalMs || 12000;
    const intervalMs = this.state.isRushHour ? Math.max(4600, Math.round(baseMs * 0.52)) : baseMs;
    this.customerSpawnTimer = setInterval(() => {
      if (this.state.isPaused) return;
      if (this.state.phase === 'OPEN' && this.state.customersQueue.length < this.maxQueueLength) {
        this.spawnCustomer();
      }
    }, intervalMs);
  }

  enterClosingPhase() {
    if (this.state.phase !== 'OPEN') return;
    this.state.phase = 'CLOSING';
    this.syncRushHourState(false);

    const sign = document.getElementById('shop-door-sign');
    sign.className = 'shop-signboard closing';
    document.getElementById('sign-icon').textContent = '🌙';
    document.getElementById('sign-text').textContent = 'ĐÓN NỐT KHÁCH CUỐI';

    document.getElementById('ticker-status-tag').textContent = '🌙 SẮP ĐÓNG CỬA:';
    document.getElementById('event-ticker-content').textContent =
      this.state.customersQueue.length > 0
        ? 'Đã 21:00! Không nhận thêm khách mới — hãy giao nốt những đơn hoa cuối cùng trong tiệm nhé!'
        : 'Đã 21:00! Đang kiểm tra quầy và chuẩn bị tổng kết cuối ngày...';

    // Cho khách đang chờ thêm một khoảng thời gian an toàn để người chơi kịp giao nốt đơn cuối
    this.state.customersQueue.forEach(c => {
      c.patience = Math.max(c.patience, 48);
    });

    if (this.state.customersQueue.length > 0) {
      this.showToast('🌙 Đã 21:00 giờ đóng cửa! Hãy hoàn thành nốt các đơn hàng đang chờ nhé.');
    }

    this.updateHUD();
    this.checkClosingCompletion();
  }

  checkClosingCompletion() {
    if (this.state.phase !== 'CLOSING' || this.state.isPaused) return;
    // Chỉ cho phép tổng kết khi TẤT CẢ khách hàng đã được phục vụ xong hoặc đã rời đi
    if (this.state.customersQueue.length > 0) return;
    if (this.endDayBufferTimer) return;

    const hasLeftoverFlowers = this.state.workbench.flowers.length > 0;
    const bufferMs = hasLeftoverFlowers ? 2200 : 1600;

    document.getElementById('ticker-status-tag').textContent = '🌙 ĐANG TỔNG KẾT:';
    document.getElementById('event-ticker-content').textContent = hasLeftoverFlowers
      ? 'Khách cuối đã rời đi! Đang thu dọn hoa trên bàn để tổng kết ngày...'
      : 'Đã phục vụ xong đơn hàng cuối cùng! Đang mở sổ tổng kết ngày...';

    this.endDayBufferTimer = setTimeout(() => {
      this.endDayBufferTimer = null;
      if (this.state.phase === 'CLOSING') {
        this.endCurrentDay();
      }
    }, bufferMs);
  }

  spawnAngryParticles() {
    const fxLayer = document.getElementById('fx-layer');
    if (!fxLayer) return;
    const icons = ['💢', '😤', '💔'];
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      p.className = 'heart-particle';
      p.textContent = icons[i % icons.length];
      p.style.left = `${160 + (Math.random() * 80 - 40)}px`;
      p.style.bottom = `${250 + (Math.random() * 30)}px`;
      p.style.setProperty('--tx', `${(Math.random() - 0.5) * 70}px`);
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  updateCustomersPatience() {
    if (this.ribbonMinigame && this.ribbonMinigame.active) return;

    const decorMult = this.getPatienceDecayMult();
    const decayPerTick = 1.2 * decorMult;
    let queueChanged = false;

    for (let i = this.state.customersQueue.length - 1; i >= 0; i--) {
      const cust = this.state.customersQueue[i];
      cust.patience -= decayPerTick;

      // Đếm ngược thời gian Đơn Hàng Gấp (nếu đang kích hoạt)
      if (cust.order.isExpress && !cust.isExpressExpired) {
        cust.expressTimeLeft = Math.max(0, cust.expressTimeLeft - 1.5);
        if (cust.expressTimeLeft <= 0) {
          cust.isExpressExpired = true;
          cust.patience = Math.max(12, cust.patience - 10);
          window.soundMgr.playCustomerSad();
          this.showToast(`⏰ Hết giờ Đơn Gấp của ${cust.meta.name}! Mất thưởng x2 nhưng khách vẫn đợi thêm một chút.`);
          queueChanged = true;
        }
      }

      if (cust.patience <= 0) {
        window.soundMgr.playCustomerSad();
        this.spawnAngryParticles();
        const repPenalty = (cust.isVip || cust.isChoosy) ? 0.4 : 0.3;
        this.showToast(`💢 ${cust.meta.name} đợi quá lâu nên giận dỗi bỏ đi! (-${repPenalty} ⭐)`);
        this.state.reputation = Math.max(1.0, parseFloat((this.state.reputation - repPenalty).toFixed(1)));
        this.state.customersQueue.splice(i, 1);
        if (this.state.activeCustomerIdx >= this.state.customersQueue.length) {
          this.state.activeCustomerIdx = Math.max(0, this.state.customersQueue.length - 1);
        }
        queueChanged = true;
      }
    }

    if (queueChanged) {
      this.renderCustomerQueue();
      this.updateScoringChecklist();
      this.updateHUD();
    }

    if (this.state.customersQueue.length > 0) {
      this.updateQueuePatienceUI();
      this.updateActiveOrderClipboard();
    } else if (this.state.phase === 'CLOSING') {
      this.checkClosingCompletion();
    }
  }

  endCurrentDay() {
    clearTimeout(this.endDayBufferTimer);
    this.endDayBufferTimer = null;

    if (this.state.workbench.flowers.length > 0) {
      this.clearWorkbench(true, true);
    }

    this.state.isPaused = true;
    this.state.phase = 'CLOSED';

    document.getElementById('summary-orders').textContent = this.state.dayStats.orders;
    document.getElementById('summary-revenue').textContent = `${this.state.dayStats.revenue} 🪙`;
    document.getElementById('summary-tips').textContent = `${this.state.dayStats.tips} 🪙`;

    let avgStar = 5.0;
    if (this.state.dayStats.ratings.length > 0) {
      const sum = this.state.dayStats.ratings.reduce((a, b) => a + b, 0);
      avgStar = (sum / this.state.dayStats.ratings.length).toFixed(1);
    }
    document.getElementById('summary-stars').textContent = `${avgStar} ⭐`;

    const eventKeys = Object.keys(GAME_EVENTS);
    const nextDayNum = this.state.currentDay + 1;
    const nextKey = eventKeys[this.state.currentDay % eventKeys.length];
    const nextUnlockCfg = FLOWER_UNLOCK_CONFIG.find(c => c.day === nextDayNum);
    const nextFlowerNames = nextUnlockCfg
      ? nextUnlockCfg.flowerIds.map(id => FLOWERS_DATA[id]?.name).filter(Boolean).join(', ')
      : '';

    const previewEl = document.getElementById('summary-next-preview');
    if (nextUnlockCfg) {
      const actionLabel = nextUnlockCfg.mode === 'auto' ? 'Mở khóa tự động' : 'Mở bán bằng Xu trong Nhập Hoa';
      previewEl.innerHTML = `<div>Ngày mai (Ngày ${nextDayNum}): <strong>${GAME_EVENTS[nextKey].name}</strong></div><div style="margin-top:4px;">🌸 ${actionLabel}: <strong>${nextFlowerNames}</strong></div>`;
    } else {
      previewEl.textContent = `Ngày mai (Ngày ${nextDayNum}): ${GAME_EVENTS[nextKey].name} - ${GAME_EVENTS[nextKey].desc}`;
    }

    this.openModal('modal-day-end');
    window.soundMgr.playLevelUp();
  }

  startNextDay() {
    clearTimeout(this.endDayBufferTimer);
    this.endDayBufferTimer = null;
    this.closeModal('modal-day-end');
    this.state.currentDay++;
    this.state.day = this.state.currentDay;
    this.state.isPaused = false;
    this.state.dayStats = { orders: 0, revenue: 0, tips: 0, ratings: [] };

    const eventKeys = Object.keys(GAME_EVENTS);
    this.state.currentEventKey = eventKeys[(this.state.currentDay - 1) % eventKeys.length];

    // Tự động mở khóa hoa theo ngày mới (Ngày 2, 3...)
    this.syncDayAutoUnlocks();
    this.renderShelves();
    this.renderRestockGrid();

    this.setupMorningPrepPhase(true);
    this.saveGameData();

    const todayCfg = FLOWER_UNLOCK_CONFIG.find(c => c.day === this.state.currentDay);
    if (todayCfg) {
      const names = todayCfg.flowerIds.map(id => FLOWERS_DATA[id]?.name).filter(Boolean).join(', ');
      if (todayCfg.mode === 'auto') {
        this.showToast(`🎉 Ngày ${this.state.currentDay}: Đã mở khóa thêm ${names}!`);
      } else {
        this.showToast(`💎 Ngày ${this.state.currentDay}: Đã mở chợ hoa cao cấp (${names}) trong "Nhập Hoa"!`);
      }
    } else {
      this.showToast(`Chào ngày mới Ngày ${this.state.currentDay}! Hãy soạn hoa tươi sẵn sàng nhé!`);
    }
  }

  // THĂNG HẠNG UY TÍN TIỆM HOA THEO SỐ ĐƠN HOÀN THÀNH
  checkLevelProgress() {
    const orders = this.state.completedOrdersCount;
    let newLevel = 1;

    if (orders >= 18) newLevel = 5;
    else if (orders >= 12) newLevel = 4;
    else if (orders >= 7) newLevel = 3;
    else if (orders >= 3) newLevel = 2;

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      window.soundMgr.playLevelUp();
      this.showToast(`🎉 CHÚC MỪNG! Danh tiếng Tiệm Hoa đã lên CẤP ${this.state.level}! Khách sẽ đặt những bó hoa đa dạng hơn.`);
      this.updateHUD();
    }
  }

  // 10. HỆ THỐNG NÂNG CẤP ĐA CẤP ĐỘ & CHỢ SỈ
  renderUpgradesList() {
    const container = document.getElementById('upgrade-items-container');
    if (!container) return;
    container.innerHTML = '';

    const goldEl = document.getElementById('upg-modal-gold');
    const progEl = document.getElementById('upg-modal-progress');
    let totalLevel = 0;
    let totalMax = 0;

    UPGRADES_DATA.forEach(upg => {
      const curLvl = this.getUpgradeLevel(upg.id);
      totalLevel += curLvl;
      totalMax += upg.maxLevel;
      const isMax = curLvl >= upg.maxLevel;
      const curSpec = curLvl > 0 ? upg.levels[curLvl - 1] : null;
      const nextSpec = !isMax ? upg.levels[curLvl] : null;
      const canAfford = nextSpec ? this.state.gold >= nextSpec.cost : false;

      let pipsHtml = '';
      for (let i = 1; i <= upg.maxLevel; i++) {
        pipsHtml += `<span class="upg-pip ${i <= curLvl ? 'active' : ''}" title="Cấp ${i}"></span>`;
      }

      const card = document.createElement('div');
      card.className = `upgrade-card ${isMax ? 'purchased' : ''}`;
      card.innerHTML = `
        <div class="upg-icon-box">
          <span class="upg-icon">${upg.icon}</span>
        </div>
        <div class="upg-info">
          <div class="upg-title-row">
            <span class="upg-name">${upg.name}</span>
            <span class="upg-level-badge ${isMax ? 'maxed' : ''}">Cấp ${curLvl}/${upg.maxLevel}</span>
          </div>
          <div class="upg-pips-row">${pipsHtml}<span class="upg-cat-tag">${upg.category}</span></div>
          <div class="upg-desc">${upg.desc}</div>
          <div class="upg-effects-box">
            <div class="upg-eff-line current">
              <strong>Hiện tại:</strong> ${curSpec ? curSpec.effectLabel : 'Chưa nâng cấp'}
            </div>
            ${nextSpec ? `<div class="upg-eff-line next"><strong>Cấp ${nextSpec.level}:</strong> ${nextSpec.effectLabel}</div>` : `<div class="upg-eff-line maxed-note">🌟 Đã đạt cấp độ tối đa!</div>`}
          </div>
        </div>
        <div class="upg-action-col">
          <button class="upg-btn ${isMax ? 'maxed-btn' : (!canAfford ? 'insufficient' : '')}" ${isMax ? 'disabled' : ''}>
            ${isMax ? '✨ Tối Đa' : `<span class="upg-btn-label">Nâng Cấp</span><span class="upg-btn-cost">${nextSpec.cost} 🪙</span>`}
          </button>
        </div>
      `;

      if (!isMax) {
        card.querySelector('.upg-btn').addEventListener('click', () => {
          this.purchaseUpgrade(upg);
        });
      }
      container.appendChild(card);
    });

    if (goldEl) goldEl.textContent = `${this.state.gold} 🪙`;
    if (progEl) progEl.textContent = `${totalLevel} / ${totalMax} Cấp`;

    this.renderAtmosphereItemsList();
    this.renderUpgradeFlowersList();
  }

  renderAtmosphereItemsList() {
    const container = document.getElementById('upgrade-atmosphere-container');
    if (!container || typeof ATMOSPHERE_ITEMS_DATA === 'undefined') return;
    container.innerHTML = '';

    ATMOSPHERE_ITEMS_DATA.forEach(item => {
      const owned = !!(this.state.atmosphereItems && this.state.atmosphereItems[item.id]);
      const canAfford = this.state.gold >= item.cost;
      const card = document.createElement('div');
      card.className = `atmo-card ${owned ? 'owned' : ''}`;
      card.innerHTML = `
        <div>
          <div class="atmo-top">
            <div class="atmo-icon">${item.icon}</div>
            <div>
              <div class="atmo-title">${item.name}</div>
              <div class="atmo-desc">${item.desc}</div>
            </div>
          </div>
          <div class="atmo-effect" style="margin-top: 6px;">✨ ${item.effectLabel}</div>
        </div>
        <div>
          ${owned
            ? '<div class="atmo-owned-badge">✅ Đã trưng bày tại quầy tiệm</div>'
            : `<button class="atmo-buy-btn ${!canAfford ? 'insufficient' : ''}">🛋️ Mua & Trang Trí (${item.cost} 🪙)</button>`
          }
        </div>
      `;
      const btn = card.querySelector('.atmo-buy-btn');
      if (btn) {
        btn.addEventListener('click', () => this.purchaseAtmosphereItem(item));
      }
      container.appendChild(card);
    });
  }

  purchaseAtmosphereItem(item) {
    if (this.state.atmosphereItems && this.state.atmosphereItems[item.id]) {
      this.showToast(`${item.name} đã có trong tiệm rồi!`);
      return;
    }
    if (this.state.gold < item.cost) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Chưa đủ xu! Cần ${item.cost} 🪙 để mua ${item.name}.`);
      return;
    }
    this.state.gold -= item.cost;
    if (!this.state.atmosphereItems) this.state.atmosphereItems = {};
    this.state.atmosphereItems[item.id] = true;

    if (item.id === 'lofi_radio' && !window.soundMgr.musicEnabled) {
      window.soundMgr.toggleMusic();
      const topMusicBtn = document.getElementById('btn-music-toggle');
      if (topMusicBtn) {
        topMusicBtn.querySelector('.icon').textContent = '🎵';
        topMusicBtn.style.color = '#2d6a4f';
      }
    }

    window.soundMgr.playLevelUp();
    this.renderShopDecorVisual();
    this.renderUpgradesList();
    this.updateHUD();
    this.saveGameData();
    this.showToast(`${item.icon} Đã trang trí ${item.name}! Khách sẽ kiên nhẫn chờ lâu hơn.`);
  }

  // CHIA SẺ HÀM VẼ BÓ HOA THU GỌN CHO MINI-GAME THẮT NƠ & XƯỞNG SÁNG TẠO DIY
  renderCompactBouquetSvg(containerEl, spec) {
    if (!containerEl) return;
    const { containerType, flowers, innerPaper, paper, ribbon } = spec;
    const isBox = containerType === 'box';
    const isBasket = containerType === 'basket';
    const innerObj = DECOR_DATA.innerPapers.find(p => p.id === innerPaper);
    const paperObj = DECOR_DATA.papers.find(p => p.id === paper);
    const ribbonObj = DECOR_DATA.ribbons.find(r => r.id === ribbon);

    let backSvg = '';
    if (isBasket) {
      backSvg += `<path d="M68,158 C68,40 192,40 192,158" fill="none" stroke="#8b5a2b" stroke-width="8" stroke-linecap="round"/>`;
      backSvg += `<ellipse cx="130" cy="158" rx="68" ry="12" fill="#7c4d25"/>`;
      if (innerObj) {
        backSvg += `<path d="M64,158 Q80,126 98,142 Q114,122 130,138 Q146,122 162,142 Q180,126 196,158 L184,170 L76,170 Z" fill="${innerObj.color}" stroke="${innerObj.border}" stroke-width="1.6"/>`;
      }
    } else if (isBox) {
      if (paperObj) backSvg += `<ellipse cx="130" cy="148" rx="68" ry="12" fill="${paperObj.border}"/>`;
      if (innerObj) {
        backSvg += `<path d="M62,150 Q78,120 96,136 Q114,116 130,134 Q146,116 164,136 Q182,120 198,150 L186,162 L74,162 Z" fill="${innerObj.color}" stroke="${innerObj.border}" stroke-width="1.6"/>`;
      }
    } else {
      if (paperObj) {
        backSvg += `<polygon points="130,242 46,112 130,28 214,112" fill="${paperObj.innerFold || '#f8fafc'}"/>`;
      }
      if (innerObj) {
        backSvg += `<path d="M130,238 L60,118 Q76,74 96,86 Q112,56 130,74 Q148,56 164,86 Q184,74 200,118 Z" fill="${innerObj.color}" stroke="${innerObj.border}" stroke-width="1.6"/>`;
      }
    }

    let frontSvg = '';
    if (isBasket) {
      frontSvg = `
        <path d="M62,158 L76,254 Q130,270 184,254 L198,158 Q130,174 62,158 Z" fill="#d9a066" stroke="#7c4d25" stroke-width="2.4"/>
        <rect x="60" y="152" width="140" height="12" rx="6" fill="#c68b59" stroke="#7c4d25" stroke-width="2"/>
      `;
      if (paperObj) {
        frontSvg += `<path d="M65,172 Q130,188 195,172 L193,186 Q130,202 67,186 Z" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="1.4" opacity="0.92"/>`;
      }
    } else if (isBox && paperObj) {
      frontSvg = `
        <path d="M62,150 Q130,164 198,150 L194,252 Q130,270 66,252 Z" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="2"/>
        <ellipse cx="130" cy="150" rx="68" ry="10" fill="none" stroke="${paperObj.border}" stroke-width="2"/>
      `;
    } else if (paperObj) {
      frontSvg = `
        <polygon points="130,244 46,112 130,148" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="1.8"/>
        <polygon points="130,244 214,112 130,148" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="1.8"/>
        <polygon points="130,244 106,274 154,274" fill="${paperObj.color}" stroke="${paperObj.border}" stroke-width="1.8"/>
      `;
    }

    let ribbonSvg = '';
    if (ribbonObj) {
      if (isBox || isBasket) {
        const yBar = isBasket ? 198 : 196;
        ribbonSvg = `
          <path d="M66,${yBar} Q130,${yBar + 14} 194,${yBar} L194,${yBar + 14} Q130,${yBar + 28} 66,${yBar + 14} Z" fill="${ribbonObj.color}"/>
          <circle cx="130" cy="${yBar + 12}" r="6" fill="${ribbonObj.accentColor || ribbonObj.color}"/>
        `;
      } else {
        ribbonSvg = `
          <rect x="116" y="236" width="28" height="7" rx="3.5" fill="${ribbonObj.color}"/>
          <path d="M130,239 C112,226 108,246 126,242 Z" fill="${ribbonObj.color}"/>
          <path d="M130,239 C148,226 152,246 134,242 Z" fill="${ribbonObj.color}"/>
          <circle cx="130" cy="240" r="4.5" fill="${ribbonObj.accentColor || ribbonObj.color}"/>
        `;
      }
    }

    const spreadAngles = [0, -15, 15, -26, 26, -8, 8, -21, 21, 0];
    let flowersHtml = '';
    (flowers || []).slice(0, 10).forEach((fId, idx) => {
      const flw = FLOWERS_DATA[fId];
      if (!flw) return;
      const ang = spreadAngles[idx % spreadAngles.length];
      const rad = (ang * Math.PI) / 180;
      const dx = Math.sin(rad) * 26;
      const dy = (1 - Math.cos(rad)) * 10 - (idx % 2 === 0 ? 4 : 0);
      flowersHtml += `
        <div style="position:absolute; left:calc(50% + ${dx}px); bottom:${(isBox || isBasket) ? 32 : 36}px; width:48px; height:64px; transform:translateX(-50%) translateY(${dy}px) rotate(${ang}deg); transform-origin:50% 90%; z-index:${12 + idx}; pointer-events:none;">
          ${flw.svg}
        </div>
      `;
    });

    containerEl.innerHTML = `
      <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; inset:0; z-index:5;">${backSvg}</svg>
      ${flowersHtml}
      <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; inset:0; z-index:25;">${frontSvg}${ribbonSvg}</svg>
    `;
  }

  // GÓC SÁNG TẠO & PHÁT MINH MẪU BÓ HOA ĐỘC QUYỀN (DIY WORKSHOP)
  openDiyWorkshop() {
    this.renderDiyWorkshop();
    this.openModal('modal-diy');
  }

  renderDiyWorkshop() {
    const flowersWrap = document.getElementById('diy-flowers-picker');
    const innerWrap = document.getElementById('diy-inner-list');
    const paperWrap = document.getElementById('diy-paper-list');
    const ribbonWrap = document.getElementById('diy-ribbon-list');
    if (!flowersWrap || !innerWrap || !paperWrap || !ribbonWrap) return;

    const available = Object.values(FLOWERS_DATA).filter(f => this.isFlowerUnlocked(f.id));
    flowersWrap.innerHTML = '';
    available.forEach(flower => {
      const qty = this.diyDraft.flowers[flower.id] || 0;
      const card = document.createElement('div');
      card.className = `diy-flower-card ${qty > 0 ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="diy-flw-svg">${flower.svg}</div>
        <div class="diy-flw-name">${flower.name}</div>
        <div class="diy-qty-ctrl">
          <button class="diy-qty-btn minus">-</button>
          <span class="diy-qty-val">${qty}</span>
          <button class="diy-qty-btn plus">+</button>
        </div>
      `;
      card.querySelector('.minus').addEventListener('click', () => {
        if ((this.diyDraft.flowers[flower.id] || 0) > 0) {
          this.diyDraft.flowers[flower.id]--;
          if (this.diyDraft.flowers[flower.id] <= 0) delete this.diyDraft.flowers[flower.id];
          this.renderDiyWorkshop();
        }
      });
      card.querySelector('.plus').addEventListener('click', () => {
        const curTypes = Object.keys(this.diyDraft.flowers).length;
        const totalStems = Object.values(this.diyDraft.flowers).reduce((s, n) => s + n, 0);
        if (!this.diyDraft.flowers[flower.id] && curTypes >= 3) {
          this.showToast('Mỗi mẫu sáng tạo tối đa kết hợp 3 loài hoa!');
          return;
        }
        if (totalStems >= 10) {
          this.showToast('Tối đa 10 cành hoa trong một mẫu bó!');
          return;
        }
        this.diyDraft.flowers[flower.id] = (this.diyDraft.flowers[flower.id] || 0) + 1;
        window.soundMgr.playPickFlower();
        this.renderDiyWorkshop();
      });
      flowersWrap.appendChild(card);
    });

    const renderChips = (el, items, currentVal, onSelect) => {
      el.innerHTML = '';
      items.forEach(it => {
        const chip = document.createElement('button');
        chip.className = `diy-chip ${currentVal === it.id ? 'active' : ''}`;
        chip.innerHTML = `<span class="diy-chip-dot" style="background:${it.color}"></span><span>${it.name}</span>`;
        chip.addEventListener('click', () => {
          onSelect(it.id);
          window.soundMgr.playWrapPaper();
          this.renderDiyWorkshop();
        });
        el.appendChild(chip);
      });
    };

    renderChips(innerWrap, DECOR_DATA.innerPapers, this.diyDraft.innerPaper, (id) => { this.diyDraft.innerPaper = id; });
    renderChips(paperWrap, DECOR_DATA.papers, this.diyDraft.paper, (id) => { this.diyDraft.paper = id; });
    renderChips(ribbonWrap, DECOR_DATA.ribbons, this.diyDraft.ribbon, (id) => { this.diyDraft.ribbon = id; });

    this.renderDiyPreview();
    this.renderDiyMenuList();
  }

  renderDiyPreview() {
    const stage = document.getElementById('diy-preview-stage');
    const harmonyEl = document.getElementById('diy-harmony-status');
    const priceEl = document.getElementById('diy-est-price');
    const expandedFlowers = [];
    let baseCost = 0;

    Object.keys(this.diyDraft.flowers).forEach(fId => {
      const cnt = this.diyDraft.flowers[fId];
      const fMeta = FLOWERS_DATA[fId];
      for (let i = 0; i < cnt; i++) {
        expandedFlowers.push(fId);
        if (fMeta) baseCost += fMeta.basePrice;
      }
    });

    if (stage) {
      if (expandedFlowers.length === 0) {
        stage.innerHTML = '<div style="font-size:11.5px; color:#64748b; font-weight:800; text-align:center; padding:10px;">Hãy chọn ít nhất 1 cành hoa bên trái để tạo mẫu bó độc quyền!</div>';
      } else {
        this.renderCompactBouquetSvg(stage, {
          containerType: this.diyDraft.containerType,
          flowers: expandedFlowers,
          innerPaper: this.diyDraft.innerPaper,
          paper: this.diyDraft.paper,
          ribbon: this.diyDraft.ribbon
        });
      }
    }

    const harmony = this.evaluateColorHarmony(
      expandedFlowers,
      this.diyDraft.innerPaper,
      this.diyDraft.paper,
      this.diyDraft.ribbon
    );
    if (harmonyEl) {
      if (expandedFlowers.length === 0) {
        harmonyEl.textContent = '🎨 Chọn hoa và giấy gói để phân tích phối màu';
        harmonyEl.className = 'diy-harmony-pill';
      } else {
        harmonyEl.textContent = harmony.label;
        harmonyEl.className = `diy-harmony-pill ${harmony.level === 'good' ? 'good' : ''}`;
      }
    }

    const diyMult = harmony.level === 'good' ? 1.45 : 1.35;
    const estPrice = expandedFlowers.length > 0 ? Math.round((baseCost + 18) * diyMult) : 0;
    if (priceEl) priceEl.textContent = `${estPrice} 🪙`;
    return { estPrice, harmony, expandedFlowers };
  }

  saveDiyRecipe() {
    if ((this.state.customRecipes || []).length >= 6) {
      this.showToast('Menu Độc Quyền tối đa 6 mẫu! Hãy xóa bớt mẫu cũ nếu muốn thêm mới.');
      return;
    }

    const { estPrice, harmony, expandedFlowers } = this.renderDiyPreview();
    if (expandedFlowers.length === 0) {
      this.showToast('Hãy chọn ít nhất 1 bông hoa trước khi thêm vào Menu!');
      return;
    }

    const nameInput = document.getElementById('diy-recipe-name');
    const rawName = nameInput ? nameInput.value.trim() : '';
    const recipeName = rawName || `Bó Độc Quyền #${(this.state.customRecipes || []).length + 1}`;

    const signatureKey = JSON.stringify({
      f: Object.keys(this.diyDraft.flowers).sort().map(k => `${k}:${this.diyDraft.flowers[k]}`),
      c: this.diyDraft.containerType,
      i: this.diyDraft.innerPaper,
      p: this.diyDraft.paper,
      r: this.diyDraft.ribbon
    });

    const isDuplicate = (this.state.customRecipes || []).some(r => r.signatureKey === signatureKey);
    if (isDuplicate) {
      this.showToast('Công thức kết hợp này đã có trong Menu rồi! Hãy thử biến tấu khác nhé.');
      return;
    }

    if (!this.state.customRecipes) this.state.customRecipes = [];
    this.state.customRecipes.push({
      id: 'diy_' + Date.now(),
      name: recipeName,
      signatureKey: signatureKey,
      containerType: this.diyDraft.containerType,
      flowers: { ...this.diyDraft.flowers },
      innerPaper: this.diyDraft.innerPaper,
      paper: this.diyDraft.paper,
      ribbon: this.diyDraft.ribbon,
      toneId: harmony.toneId || null,
      price: estPrice
    });

    if (nameInput) nameInput.value = '';
    window.soundMgr.playDiscovery();
    this.saveGameData();
    this.renderDiyMenuList();
    this.showToast(`💡 Đã phát minh mẫu "${recipeName}" (${estPrice} 🪙) & thêm vào Menu bán hàng!`);
  }

  renderDiyMenuList() {
    const listEl = document.getElementById('diy-menu-list');
    const countEl = document.getElementById('diy-menu-count');
    const recipes = this.state.customRecipes || [];
    if (countEl) countEl.textContent = recipes.length;
    if (!listEl) return;

    if (recipes.length === 0) {
      listEl.innerHTML = '<div style="font-size:11px; color:#64748b; text-align:center; padding:8px;">Chưa có mẫu độc quyền nào. Hãy tự tay phối hoa và đặt tên!</div>';
      return;
    }

    listEl.innerHTML = '';
    recipes.forEach((rec, idx) => {
      const flwText = Object.keys(rec.flowers).map(id => `${FLOWERS_DATA[id]?.name || id} x${rec.flowers[id]}`).join(', ');
      const item = document.createElement('div');
      item.className = 'diy-menu-item';
      item.innerHTML = `
        <div class="diy-menu-info">
          <strong>🌟 ${rec.name}</strong>
          <small>${flwText}</small>
        </div>
        <div class="diy-menu-actions">
          <span class="diy-menu-price">${rec.price} 🪙</span>
          <button class="diy-del-btn" title="Xóa khỏi Menu">Xóa</button>
        </div>
      `;
      item.querySelector('.diy-del-btn').addEventListener('click', () => {
        this.state.customRecipes.splice(idx, 1);
        this.saveGameData();
        this.renderDiyMenuList();
        this.showToast(`Đã gỡ "${rec.name}" khỏi Menu.`);
      });
      listEl.appendChild(item);
    });
  }

  renderUpgradeFlowersList() {
    const flwContainer = document.getElementById('upgrade-flowers-container');
    if (!flwContainer) return;
    flwContainer.innerHTML = '';

    const premiumFlowers = Object.values(FLOWERS_DATA).filter(f => f.unlockMode === 'purchase');
    premiumFlowers.forEach(flower => {
      const isUnlocked = this.isFlowerUnlocked(flower.id);
      const canBuy = this.canPurchaseUnlock(flower.id);
      const canAfford = this.state.gold >= flower.unlockCost;
      const card = document.createElement('div');
      card.className = `upg-flower-card ${isUnlocked ? 'unlocked' : (canBuy ? 'unlockable' : 'locked')}`;
      card.innerHTML = `
        <div class="upg-flw-art">${flower.svg}</div>
        <div class="upg-flw-name">${flower.name}</div>
        <div class="upg-flw-meta">Giá bán: ${flower.basePrice} 🪙/cành</div>
        <div class="upg-flw-status">
          ${isUnlocked
            ? '<span class="flw-unlocked-tag">✅ Đã mở khóa</span>'
            : canBuy
              ? `<button class="upg-flw-buy-btn ${!canAfford ? 'insufficient' : ''}">🔓 Mở Khóa (${flower.unlockCost} 🪙)</button>`
              : `<span class="flw-day-tag">🔒 Mở chợ từ Ngày ${flower.unlockedAtDay}</span>`
          }
        </div>
      `;
      const btn = card.querySelector('.upg-flw-buy-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          this.unlockFlowerWithGold(flower.id);
        });
      }
      flwContainer.appendChild(card);
    });
  }

  purchaseUpgrade(upg) {
    const curLvl = this.getUpgradeLevel(upg.id);
    if (curLvl >= upg.maxLevel) {
      this.showToast(`${upg.name} đã đạt cấp tối đa!`);
      return;
    }

    const nextSpec = upg.levels[curLvl];
    if (this.state.gold < nextSpec.cost) {
      window.soundMgr.playCustomerSad();
      this.showToast(`Chưa đủ xu! Cần ${nextSpec.cost} 🪙 để nâng ${upg.name} lên Cấp ${nextSpec.level}.`);
      return;
    }

    this.state.gold -= nextSpec.cost;
    this.state.upgrades[upg.id] = nextSpec.level;

    // Áp dụng ngay hiệu ứng mới lên hệ thống
    this.maxQueueLength = this.getMaxQueueLength();
    this.applyCraftSpeedStyle();
    if (upg.id === 'vip_signboard') {
      this.restartCustomerSpawnTimer();
    }
    if (upg.id === 'shop_decor') {
      this.renderShopDecorVisual();
    }

    window.soundMgr.playLevelUp();
    this.showToast(`✨ Đã nâng ${upg.name} lên Cấp ${nextSpec.level}: ${nextSpec.effectLabel}`);
    this.renderUpgradesList();
    this.renderRestockGrid();
    this.renderMorningStockGrid();
    this.updateHUD();
    this.saveGameData();
  }

  renderRestockGrid() {
    const container = document.getElementById('restock-items-container');
    container.innerHTML = '';

    Object.values(FLOWERS_DATA).forEach(flower => {
      const stock = this.state.flowerStocks[flower.id] ?? 0;
      const maxCap = this.getFlowerMaxStock(flower);
      const unitCost = this.getFlowerRestockUnitCost(flower);
      const packCost = unitCost * 5;
      const isUnlocked = this.isFlowerUnlocked(flower.id);
      const isPurchasableNow = this.canPurchaseUnlock(flower.id);
      const item = document.createElement('div');

      if (isUnlocked) {
        item.className = 'restock-item';
        item.innerHTML = `
          <div class="restock-art">${flower.svg}</div>
          <div class="restock-name">${flower.name}</div>
          <div class="restock-stock">Còn: ${stock}/${maxCap}</div>
          <button class="restock-btn">+5 cành (${packCost} 🪙)</button>
        `;
        item.querySelector('.restock-btn').addEventListener('click', () => {
          this.buyFlowerStock(flower.id, 5, packCost);
        });
      } else if (isPurchasableNow) {
        item.className = 'restock-item unlockable-item';
        item.innerHTML = `
          <div class="restock-art">${flower.svg}</div>
          <div class="restock-name">${flower.name}</div>
          <div class="restock-stock unlockable-tag">✨ Sẵn sàng mở (+${flower.defaultStock} bông)</div>
          <button class="restock-btn restock-unlock-btn">🔓 Mở Khóa (${flower.unlockCost} 🪙)</button>
        `;
        item.querySelector('.restock-unlock-btn').addEventListener('click', () => {
          this.unlockFlowerWithGold(flower.id);
        });
      } else {
        item.className = 'restock-item locked-restock-item';
        item.innerHTML = `
          <div class="restock-art locked-art">${flower.svg}</div>
          <div class="restock-name">${flower.name}</div>
          <div class="restock-stock">🔒 Mở khóa vào Ngày ${flower.unlockedAtDay}</div>
          <button class="restock-btn" disabled>Ngày ${flower.unlockedAtDay}</button>
        `;
      }

      container.appendChild(item);
    });
  }

  buyFlowerStock(flowerId, amount, cost) {
    if (this.state.gold < cost) {
      this.showToast(`Không đủ tiền! Cần ${cost} 🪙.`);
      return;
    }

    const flower = FLOWERS_DATA[flowerId];
    const cur = this.state.flowerStocks[flowerId] ?? 0;
    const maxCap = this.getFlowerMaxStock(flower);
    if (cur + amount > maxCap) {
      this.showToast(`Xô hoa ${flower.name} đã đạt sức chứa tối đa (${maxCap} bông)! Hãy nâng cấp Kệ Mát để mở rộng.`);
      return;
    }

    this.state.gold -= cost;
    this.state.flowerStocks[flowerId] = cur + amount;
    window.soundMgr.playCoinChime();
    this.showToast(`📦 Đã nhập thêm +${amount} bông ${flower.name}!`);
    this.updateFlowerStockBadges();
    this.renderRestockGrid();
    this.renderMorningStockGrid();
    this.updateHUD();
    this.saveGameData();
  }

  restockAllFlowers() {
    let totalCost = 0;
    Object.values(FLOWERS_DATA).forEach(flower => {
      if (this.isFlowerUnlocked(flower.id)) {
        const cur = this.state.flowerStocks[flower.id] ?? 0;
        const need = Math.max(0, flower.defaultStock - cur);
        if (need > 0) totalCost += need * this.getFlowerRestockUnitCost(flower);
      }
    });

    const discounted = Math.round(totalCost * 0.9);
    if (discounted === 0) {
      this.showToast('Tất cả kệ hoa đã mở khóa đều đang đầy đủ!');
      return;
    }

    if (this.state.gold < discounted) {
      this.showToast(`Không đủ tiền! Cần ${discounted} 🪙.`);
      return;
    }

    this.state.gold -= discounted;
    Object.values(FLOWERS_DATA).forEach(flower => {
      if (this.isFlowerUnlocked(flower.id)) {
        const cur = this.state.flowerStocks[flower.id] ?? 0;
        if (cur < flower.defaultStock) {
          this.state.flowerStocks[flower.id] = flower.defaultStock;
        }
      }
    });

    window.soundMgr.playCoinChime();
    this.showToast(`📦 Đã nhập đầy tất cả các kệ hoa tươi (-${discounted} 🪙)!`);
    this.updateFlowerStockBadges();
    this.renderRestockGrid();
    this.renderMorningStockGrid();
    this.updateHUD();
    this.saveGameData();
  }

  // 11. HUD & TIỆN ÍCH
  updateHUD() {
    document.getElementById('gold-display').textContent = this.state.gold;
    document.getElementById('rep-display').textContent = this.state.reputation.toFixed(1);
    document.getElementById('completed-orders-count').textContent = this.state.completedOrdersCount;

    const titles = ['', 'Mới Mở', 'Khéo Tay', 'Có Tiếng', 'Đông Khách', 'Hoàng Gia'];
    document.getElementById('store-level-tag').textContent = `Cấp ${this.state.level} • ${titles[this.state.level] || 'Hoàng Gia'}`;

    const phaseLabels = {
      PREPARING: 'Soạn Đồ Buổi Sáng',
      OPEN: 'Đang Mở Bán Hoa',
      CLOSING: 'Phục Vụ Khách Cuối',
      CLOSED: 'Đã Đóng Cửa'
    };
    document.getElementById('hud-phase-badge').textContent = phaseLabels[this.state.phase] || 'Đang Mở Bán Hoa';

    this.updateHUDTime();
  }

  updateHUDTime() {
    const hh = String(this.state.hour).padStart(2, '0');
    const mm = String(this.state.minute).padStart(2, '0');
    document.getElementById('hud-day-text').textContent = `Ngày ${this.state.currentDay} - ${hh}:${mm}`;
    const rushHud = document.getElementById('hud-rush-badge');
    if (rushHud) {
      rushHud.style.display = this.state.isRushHour ? 'inline-flex' : 'none';
    }
  }

  togglePauseGame() {
    this.state.isPaused = !this.state.isPaused;
    const btn = document.getElementById('btn-pause-game');
    btn.querySelector('.icon').textContent = this.state.isPaused ? '▶️' : '⏸️';
    this.showToast(this.state.isPaused ? 'Đã tạm dừng' : 'Tiếp tục trò chơi');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modalId === 'modal-upgrade') this.renderUpgradesList();
      if (modalId === 'modal-restock') this.renderRestockGrid();
      modal.classList.add('active');
      window.soundMgr.playPickFlower();
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message) {
    const toast = document.getElementById('game-toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.flowerGame = new FlowerShopGame();
});
