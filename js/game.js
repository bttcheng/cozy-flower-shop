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

  renderShopDecorVisual() {
    const decorEl = document.getElementById('shop-interior-decor');
    const custArea = document.getElementById('customer-area');
    const lvl = this.getUpgradeLevel('shop_decor');
    if (custArea) {
      custArea.classList.remove('decor-lvl-1', 'decor-lvl-2', 'decor-lvl-3');
      if (lvl > 0) custArea.classList.add(`decor-lvl-${lvl}`);
    }
    if (!decorEl) return;
    if (lvl <= 0) {
      decorEl.innerHTML = '';
      return;
    }
    let html = `
      <div class="decor-fairy-lights" aria-hidden="true">
        <span class="bulb b1"></span><span class="bulb b2"></span><span class="bulb b3"></span>
        <span class="bulb b4"></span><span class="bulb b5"></span><span class="bulb b6"></span>
        <span class="bulb b7"></span><span class="bulb b8"></span>
      </div>
    `;
    if (lvl >= 2) {
      html += `
        <div class="decor-hanging-plant left">🌿</div>
        <div class="decor-hanging-plant right">🪴</div>
      `;
    }
    if (lvl >= 3) {
      html += `<div class="decor-boutique-garland">✨🌸 Boutique Tiệm Hoa Nhỏ 🌸✨</div>`;
    }
    decorEl.innerHTML = html;
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
      upgrades: { ...this.state.upgrades }
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
    } else {
      if (prepScreen) prepScreen.style.display = 'none';
      if (playfield) playfield.style.display = 'grid';
      if (workbench) workbench.style.display = 'grid';
    }
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
      const targetW = 1400;
      const targetH = 788;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const scaleX = vw / targetW;
      const scaleY = vh / targetH;
      // Tự động scale vừa khít khung màn hình điện thoại (cả ngang lẫn dọc)
      const scale = Math.min(scaleX, scaleY);
      container.style.transform = `scale(${scale})`;

      // Cảnh báo xoay màn hình ngang khi ở chế độ dọc (portrait) trên điện thoại
      const isPortrait = vh > vw && vw < 860;
      let rotNotice = document.getElementById('phone-rotate-notice');
      if (isPortrait) {
        if (!rotNotice) {
          rotNotice = document.createElement('div');
          rotNotice.id = 'phone-rotate-notice';
          rotNotice.innerHTML = `
            <div class="rotate-card">
              <span class="rotate-icon">🔄📱</span>
              <strong>Xoay ngang màn hình</strong>
              <small>Hãy xoay ngang điện thoại để có trải nghiệm cắm hoa và quản lý tiệm trọn vẹn nhất nhé!</small>
            </div>
          `;
          document.body.appendChild(rotNotice);
        }
        rotNotice.style.display = 'flex';
      } else if (rotNotice) {
        rotNotice.style.display = 'none';
      }
    };

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeHandler, 200);
    });
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', () => {
        setTimeout(resizeHandler, 200);
      });
    }
    resizeHandler();
  }

  bindEvents() {
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
      this.showToast(enabled ? 'Đã bật nhạc Lofi Cozy' : 'Đã tắt nhạc nền');
    });

    // Modal HUD
    document.getElementById('btn-quick-shop').addEventListener('click', () => this.openModal('modal-restock'));
    document.getElementById('btn-inventory-restock').addEventListener('click', () => this.openModal('modal-restock'));
    document.getElementById('btn-upgrade-shop').addEventListener('click', () => this.openModal('modal-upgrade'));
    document.getElementById('btn-tutorial-open').addEventListener('click', () => this.openModal('modal-tutorial'));
    document.getElementById('btn-pause-game').addEventListener('click', () => this.togglePauseGame());

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

    // Chuyển tab trong Modal Nâng Cấp (Nội Thất vs Giống Hoa Cao Cấp)
    document.querySelectorAll('.upgrade-modal-tabs .upg-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.upgTab;
        document.querySelectorAll('.upgrade-modal-tabs .upg-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const upgList = document.getElementById('upgrade-items-container');
        const flwList = document.getElementById('upgrade-flowers-container');
        if (upgList) upgList.style.display = tab === 'furniture' ? 'flex' : 'none';
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

    // Chuyển kiểu gói: Bó Hình Nón / Hộp Quà Tròn
    document.querySelectorAll('#container-style-switcher .style-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const style = e.currentTarget.dataset.style;
        this.state.workbench.containerType = style;
        document.querySelectorAll('#container-style-switcher .style-pill-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        window.soundMgr.playWrapPaper();
        this.showToast(style === 'box' ? '🎁 Đã đổi sang kiểu Hộp Quà Tròn!' : '💐 Đã đổi sang kiểu Bó Giấy Hình Nón!');
        this.renderBouquetVisual();
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
  }

  setupSmoothPointerDrag() {
    const positionGhost = (ghost, clientX, clientY) => {
      const container = document.getElementById('game-container');
      const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: 1400 };
      const scale = rect.width ? rect.width / 1400 : 1;
      const gx = (clientX - rect.left) / scale;
      const gy = (clientY - rect.top) / scale;
      ghost.style.left = `${gx}px`;
      ghost.style.top = `${gy}px`;
    };

    const isOverWorkspace = (clientX, clientY) => {
      const ws = document.getElementById('bouquet-workspace');
      if (!ws) return false;
      const r = ws.getBoundingClientRect();
      const pad = 18;
      return clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad;
    };

    document.addEventListener('pointermove', (e) => {
      if (!this.dragState) return;
      const ds = this.dragState;
      const dist = Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY);
      const ghost = document.getElementById('drag-flower-ghost');
      const ws = document.getElementById('bouquet-workspace');
      const ring = document.getElementById('workspace-snap-ring');

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

      if (ds.active && ghost) {
        positionGhost(ghost, e.clientX, e.clientY);
        const over = isOverWorkspace(e.clientX, e.clientY);
        ghost.classList.toggle('snap-ready', over);
        if (ws) ws.classList.toggle('drag-over', over);
        if (ring) ring.classList.toggle('visible', over);
      }
    });

    const endDrag = (e) => {
      if (!this.dragState) return;
      const ds = this.dragState;
      this.dragState = null;

      const ghost = document.getElementById('drag-flower-ghost');
      const ws = document.getElementById('bouquet-workspace');
      const ring = document.getElementById('workspace-snap-ring');

      if (ds.slotEl) ds.slotEl.classList.remove('is-dragging');
      if (ghost) {
        ghost.style.display = 'none';
        ghost.classList.remove('snap-ready');
      }
      if (ws) ws.classList.remove('drag-over');
      if (ring) ring.classList.remove('visible');

      if (ds.active) {
        this.suppressNextBucketClick = true;
        setTimeout(() => { this.suppressNextBucketClick = false; }, 80);

        if (isOverWorkspace(e.clientX, e.clientY)) {
          this.pickFlowerToWorkbench(ds.flowerId, {
            type: 'drop',
            clientX: e.clientX,
            clientY: e.clientY
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

    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
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

        slot.addEventListener('pointerdown', (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          if (this.state.phase !== 'OPEN' && this.state.phase !== 'CLOSING') return;
          this.dragState = {
            flowerId: flower.id,
            slotEl: slot,
            startX: e.clientX,
            startY: e.clientY,
            active: false
          };
        });

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
    const isBox = this.state.workbench.containerType === 'box';
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
      hint.querySelector('.hint-sub').textContent = 'Kéo hoặc nhấp hoa từ kệ, rồi tự tay chọn giấy lót trong, giấy ngoài & ruy băng!';
      chipsContainer.innerHTML = '<span class="empty-note">Chưa cắm cành hoa nào (kéo hoặc nhấp hoa trên kệ)</span>';
    } else if (count === 0) {
      hint.style.display = 'flex';
      hint.querySelector('.hint-text').textContent = 'Đã chọn vật liệu gói';
      hint.querySelector('.hint-sub').textContent = 'Hãy kéo hoặc nhấp cành hoa từ kệ vào đây!';
      chipsContainer.innerHTML = '<span class="empty-note">Chưa cắm cành hoa nào</span>';
    } else {
      hint.style.display = 'none';
    }

    // 1. LỚP LƯNG SAU (VẼ GIẤY NGOÀI &/HOẶC GIẤY LÓT LỤA BÊN TRONG KHI ĐÃ CHỌN)
    if (paperObj || innerPaperObj) {
      if (isBox) {
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
      const baseY = isBox ? 162 : 168;
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
      const xOffset = Math.sin((item.angle * Math.PI) / 180) * (isBox ? 64 : 56);
      const yOffset = (isBox ? -10 : -22) - Math.abs(Math.cos((item.angle * Math.PI) / 180) * 18) - rowLift;
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

    // 3. MẶT TRƯỚC GIẤY GÓI NGOÀI & VIỀN LÓT TRONG (CHỈ VẼ KHI ĐÃ CHỌN)
    if (paperObj || innerPaperObj) {
      if (isBox) {
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
      if (isBox && paperObj) {
        ribbonLayer.innerHTML = `
          <svg viewBox="0 0 260 280" preserveAspectRatio="xMidYMax meet" style="width:100%; height:100%; position:absolute; bottom:0;">
            <path d="M62,196 Q130,210 198,196 L198,212 Q130,226 62,212 Z" fill="${ribbonObj.color}"/>
            <path d="M130,210 C106,192 98,218 125,215 Z" fill="${ribbonObj.color}"/>
            <path d="M130,210 C154,192 162,218 135,215 Z" fill="${ribbonObj.color}"/>
            <path d="M130,210 C110,198 104,214 125,213 Z" fill="#ffffff" opacity="0.25"/>
            <path d="M130,210 C150,198 156,214 135,213 Z" fill="#ffffff" opacity="0.25"/>
            <circle cx="130" cy="211" r="6.5" fill="${ribbonObj.accentColor || ribbonObj.color}"/>
            <path d="M126,216 L116,232 L123,234 L129,218 Z" fill="${ribbonObj.color}"/>
            <path d="M134,216 L144,232 L137,234 L131,218 Z" fill="${ribbonObj.color}"/>
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

  // 6. HỆ THỐNG KHÁCH HÀNG & BẢNG KẸP ĐƠN HÀNG CỐ ĐỊNH
  spawnCustomer() {
    if (this.state.phase !== 'OPEN' || this.state.isPaused) return;
    if (this.state.hour >= 21 || (this.state.hour === 20 && this.state.minute >= 40)) return;
    if (this.state.customersQueue.length >= this.maxQueueLength) return;

    const customerMeta = CUSTOMERS_DATA[Math.floor(Math.random() * CUSTOMERS_DATA.length)];
    const vipBonus = this.getUpgradeBonus('vip_signboard');
    const isVip = Math.random() < (vipBonus.vipChance || 0.05);
    const order = this.generateVisualOrder(this.state.level, isVip);

    const patienceBonus = this.getUpgradeBonus('fast_hands').patienceBonus || 0;
    const totalStems = Object.values(order.flowers).reduce((sum, n) => sum + n, 0);
    const complexityBonus = totalStems >= 5 ? 18 : (Object.keys(order.flowers).length >= 2 ? 12 : 0);
    const basePatience = Math.round((115 + complexityBonus) * (1 + patienceBonus));

    const newCustomer = {
      id: 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      meta: customerMeta,
      isVip: isVip,
      order: order,
      maxPatience: basePatience,
      patience: basePatience,
      createdAt: Date.now()
    };

    this.state.customersQueue.push(newCustomer);
    this.renderCustomerQueue();
    this.updateActiveOrderClipboard();
    this.updateScoringChecklist();
  }

  generateVisualOrder(level, isVip = false) {
    // CHỈ CHỌN NHỮNG HOA ĐÃ ĐƯỢC MỞ KHÓA THEO NGÀY HIỆN TẠI!
    const available = Object.values(FLOWERS_DATA).filter(f => this.isFlowerUnlocked(f.id));
    const reqFlowers = {};
    let totalPrice = 0;

    const numTypes = (available.length >= 2 && (this.state.currentDay >= 2 || level >= 2) && Math.random() > 0.4) ? 2 : 1;
    const shuffled = [...available].sort(() => 0.5 - Math.random());

    for (let i = 0; i < numTypes; i++) {
      const f = shuffled[i];
      if (!f) break;
      const count = 2 + Math.floor(Math.random() * (level >= 3 ? 4 : 3));
      reqFlowers[f.id] = count;
      totalPrice += f.basePrice * count;
    }

    const reqInnerPaper = DECOR_DATA.innerPapers[Math.floor(Math.random() * DECOR_DATA.innerPapers.length)].id;
    const reqPaper = DECOR_DATA.papers[Math.floor(Math.random() * DECOR_DATA.papers.length)].id;
    const reqRibbon = DECOR_DATA.ribbons[Math.floor(Math.random() * DECOR_DATA.ribbons.length)].id;

    let reqCard = null;
    let cardMsg = '';
    if (Math.random() > 0.4) {
      const cardObj = DECOR_DATA.cards[Math.floor(Math.random() * DECOR_DATA.cards.length)];
      reqCard = cardObj.id;
      cardMsg = cardObj.sampleMsg;
      totalPrice += 8;
    }

    totalPrice += 14;

    // Áp dụng nâng cấp Kéo Tỉa Mạ Vàng (tăng giá bán) & Khách VIP
    const priceBonus = this.getUpgradeBonus('golden_shears').priceBonus || 0;
    const vipMult = isVip ? (this.getUpgradeBonus('vip_signboard').vipPriceMult || 1.3) : 1;
    totalPrice = Math.round(totalPrice * (1 + priceBonus) * vipMult);

    return {
      flowers: reqFlowers,
      innerPaper: reqInnerPaper,
      paper: reqPaper,
      ribbon: reqRibbon,
      card: reqCard,
      cardMsg: cardMsg,
      price: totalPrice
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

      stand.className = `chibi-customer-stand pos-${index} ${cust.isVip ? 'is-vip-customer' : ''} ${isSelected ? 'is-active-customer' : ''} ${pct < 25 ? 'is-impatient' : ''}`;
      stand.id = `cust-stand-${cust.id}`;

      let mood = 'Đang chờ';
      if (isSelected) mood = cust.isVip ? '👑 Đang phục vụ VIP' : '💬 Đang phục vụ';
      else if (pct < 25) mood = '💢 Sắp bỏ đi!';
      else if (index === 0) mood = cust.isVip ? '👑 Khách VIP' : '🌸 Đứng quầy';
      else mood = cust.isVip ? '👑 VIP Chờ' : '👀 Đang chờ';

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
      if (moodEl && index !== this.state.activeCustomerIdx && pct < 25) {
        moodEl.textContent = '💢 Sắp bỏ đi!';
      }
    });
  }

  updateActiveOrderClipboard() {
    if (this.state.phase !== 'OPEN' && this.state.phase !== 'CLOSING') return;

    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    const orderView = document.getElementById('clipboard-active-order-view');
    const waitingView = document.getElementById('clipboard-waiting-view');

    if (!cust) {
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

    document.getElementById('ticket-cust-name').textContent = (cust.isVip ? '👑 ' : '') + cust.meta.name;
    const styleEl = document.getElementById('ticket-cust-style');
    styleEl.textContent = cust.isVip ? `VIP • ${cust.meta.stylePref}` : cust.meta.stylePref;
    styleEl.className = `ticket-style-pill ${cust.isVip ? 'vip-pill' : ''}`;
    document.getElementById('ticket-order-price').textContent = `${cust.order.price} 🪙`;

    const pct = Math.max(0, Math.min(100, (cust.patience / cust.maxPatience) * 100));
    const decorMult = this.getUpgradeBonus('shop_decor').patienceDecayMult || 1;
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
  }

  // 7. CƠ CHẾ CHẤM ĐIỂM 6 TIÊU CHÍ (30đ - 20đ - 15đ - 15đ - 10đ - 10đ)
  updateScoringChecklist() {
    const cust = this.state.customersQueue[this.state.activeCustomerIdx];
    const scoreBadge = document.getElementById('order-score-badge');
    const feedbackText = document.getElementById('order-feedback-text');
    const estPriceEl = document.getElementById('order-est-price');

    if (!cust) {
      scoreBadge.textContent = '0%';
      feedbackText.textContent = this.state.phase === 'PREPARING' ? 'Đang chuẩn bị mở bán' : 'Chưa có đơn hàng';
      estPriceEl.textContent = '0 🪙';
      return;
    }

    let flowerScore = 0;
    let qtyScore = 0;
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

    // 1. Loại hoa (30đ)
    let correctTypes = 0;
    reqKeys.forEach(k => {
      if ((currentCounts[k] || 0) > 0) correctTypes++;
      else missingNotes.push(`Chưa có ${FLOWERS_DATA[k].name}`);
    });
    flowerScore = Math.round((correctTypes / reqKeys.length) * 30);

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

    // 3. Giấy lót bên trong (15đ)
    if (this.state.workbench.innerPaper === cust.order.innerPaper) innerPaperScore = 15;
    else {
      const ipObj = DECOR_DATA.innerPapers.find(p => p.id === cust.order.innerPaper);
      missingNotes.push(`Cần lót ${ipObj ? ipObj.name : ''}`);
    }

    // 4. Giấy gói bên ngoài (15đ)
    if (this.state.workbench.paper === cust.order.paper) paperScore = 15;
    else {
      const pObj = DECOR_DATA.papers.find(p => p.id === cust.order.paper);
      missingNotes.push(`Cần giấy ngoài ${pObj ? pObj.name : ''}`);
    }

    // 5. Ruy băng (10đ)
    if (this.state.workbench.ribbon === cust.order.ribbon) ribbonScore = 10;
    else {
      const rObj = DECOR_DATA.ribbons.find(r => r.id === cust.order.ribbon);
      missingNotes.push(`Cần nơ ${rObj ? rObj.name : ''}`);
    }

    // 6. Thiệp (10đ)
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

    updateRow('chk-flower-types', flowerScore, 30);
    updateRow('chk-flower-counts', qtyScore, 20);
    updateRow('chk-inner-paper', innerPaperScore, 15);
    updateRow('chk-paper', paperScore, 15);
    updateRow('chk-ribbon', ribbonScore, 10);
    updateRow('chk-card', cardScore, 10);

    const totalScore = flowerScore + qtyScore + innerPaperScore + paperScore + ribbonScore + cardScore;
    scoreBadge.textContent = `${totalScore}%`;
    scoreBadge.style.color = totalScore >= 85 ? '#166534' : (totalScore >= 55 ? '#b45309' : '#e11d48');

    if (totalScore >= 95) {
      feedbackText.textContent = '✨ Bó hoa hoàn hảo từng chi tiết! Khách sẽ cực kỳ ưng ý!';
    } else if (missingNotes.length > 0) {
      feedbackText.textContent = `⚠️ Lưu ý: ${missingNotes.slice(0, 2).join(' • ')}`;
    } else {
      feedbackText.textContent = 'Bó hoa đã tương đối chuẩn yêu cầu';
    }

    const trimBadge = document.getElementById('trim-bonus-badge');
    if (trimBadge) {
      trimBadge.style.display = this.state.workbench.trimmed ? 'inline-block' : 'none';
    }

    const estPrice = Math.round((cust.order.price * totalScore) / 100);
    estPriceEl.textContent = `${estPrice} 🪙`;

    return { totalScore, estPrice };
  }

  // 8. GIAO HOA & THU TIỀN
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

    const { totalScore, estPrice } = this.updateScoringChecklist();

    if (totalScore < 50) {
      window.soundMgr.playCustomerSad();
      this.showToast('Bó hoa chưa đạt yêu cầu! Khách lắc đầu chưa muốn nhận.');
      return;
    }

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

    let bonusTip = 0;
    const decorTipRate = this.getUpgradeBonus('shop_decor').tipBonus || 0;
    const rushBonus = this.state.isRushHour ? 6 : 0;
    if (totalScore >= 85) {
      bonusTip = Math.round(estPrice * 0.3) + 6;
      const tipBonusRate = this.getUpgradeBonus('golden_shears').tipBonus || 0;
      if (tipBonusRate > 0) bonusTip += Math.round(estPrice * tipBonusRate);
      if (decorTipRate > 0) bonusTip += Math.round(estPrice * decorTipRate);
      if (cust.isVip) bonusTip += 10;
      if (this.state.workbench.trimmed) bonusTip += 5;
      bonusTip += rushBonus;
      window.soundMgr.playCustomerHappy();
      this.spawnHeartParticles();
    } else {
      if (decorTipRate > 0) bonusTip += Math.round(estPrice * decorTipRate);
      if (this.state.workbench.trimmed) bonusTip += 5;
      bonusTip += rushBonus;
      window.soundMgr.playCoinChime();
    }

    const totalEarned = estPrice + bonusTip;
    this.state.gold += totalEarned;
    this.state.completedOrdersCount++;
    this.state.dayStats.orders++;
    this.state.dayStats.revenue += estPrice;
    this.state.dayStats.tips += bonusTip;

    const starRating = (totalScore / 100) * 5;
    this.state.dayStats.ratings.push(starRating);
    this.state.reputation = parseFloat(((this.state.reputation * 0.8) + (starRating * 0.2)).toFixed(1));

    this.spawnCoinParticles();
    const rushNote = rushBonus > 0 ? ` (🔥 +${rushBonus}🪙 Giờ Cao Điểm)` : '';
    this.showToast(`+${totalEarned} 🪙${rushNote}! ${cust.meta.name}: "${cust.meta.dialogue}"`);

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
    const decorMult = this.getUpgradeBonus('shop_decor').patienceDecayMult || 1;
    const decayPerTick = 1.2 * decorMult;
    let queueChanged = false;

    for (let i = this.state.customersQueue.length - 1; i >= 0; i--) {
      const cust = this.state.customersQueue[i];
      cust.patience -= decayPerTick;

      if (cust.patience <= 0) {
        window.soundMgr.playCustomerSad();
        this.spawnAngryParticles();
        this.showToast(`💢 ${cust.meta.name} đợi quá lâu nên giận dỗi bỏ đi! (-0.3 ⭐)`);
        this.state.reputation = Math.max(1.0, parseFloat((this.state.reputation - 0.3).toFixed(1)));
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

    this.renderUpgradeFlowersList();
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
