const state = {
  role: 'participant',
  tab: 'home',
  balance: 0,
  frozen: 0,
  paidOut: 0,
  sunshine: 0,
  fruits: 0,
  streak: 0,
  totalCheckins: 0,
  maxStreak: 0,
  pendingCheckin: null,
  checkins: [],
  redemptions: [],
  badges: new Set(),
  adventure: {
    currentLevel: 0,
    levelProgress: 0,
    totalSteps: 0,
    completedAt: null,
    postCompletionSteps: 0
  }
};

const levels = [
  { name: '初入森林', steps: 7, reward: 20, color: '#7dbb73' },
  { name: '穿越平原', steps: 10, reward: 30, color: '#f0c86c' },
  { name: '攀登山丘', steps: 14, reward: 50, color: '#e98b70' },
  { name: '渡过湖泊', steps: 14, reward: 50, color: '#7db9d8' },
  { name: '登顶山峰', steps: 21, reward: 100, color: '#9d8bd8' }
];

const rewards = [
  { id: 'tea', name: '快乐奶茶券', price: 15, type: '食', color: '#f7d7c7', desc: '运动后的快乐可以很小，但必须认真兑现。' },
  { id: 'movie', name: '电影约会券', price: 60, type: '约', color: '#cce7f4', desc: '你选电影，我负责票和爆米花。' },
  { id: 'massage', name: '认真按摩券', price: 30, type: '心', color: '#d9efd1', desc: '一次不敷衍的肩颈按摩服务。' },
  { id: 'gift', name: '小礼物心愿券', price: 120, type: '礼', color: '#f8d4df', desc: '攒到以后挑一件最近真的喜欢的小东西。' }
];

const view = document.querySelector('#view');
const toast = document.querySelector('#toast');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function currentLevel() {
  return levels[state.adventure.currentLevel] || levels[levels.length - 1];
}

function levelPercent() {
  const level = currentLevel();
  return Math.min(100, Math.round((state.adventure.levelProgress / level.steps) * 100));
}

function treeScale() {
  return Math.min(1.12, 0.72 + state.sunshine / 260);
}

function submitCheckin() {
  if (state.pendingCheckin) {
    showToast('今天已经有一条待审核打卡啦');
    return;
  }
  state.pendingCheckin = {
    reward: 5,
    note: '今天也有认真动一动'
  };
  showToast('已收到打卡，先放一张待确认 +5 能量币卡');
  render();
}

function approveCheckin() {
  if (!state.pendingCheckin) {
    showToast('没有待审核打卡');
    return;
  }
  let reward = state.pendingCheckin.reward;
  state.pendingCheckin = null;
  state.totalCheckins += 1;
  state.streak += 1;
  state.maxStreak = Math.max(state.maxStreak, state.streak);
  state.sunshine += state.streak % 7 === 0 ? 18 : 12;
  state.fruits = Math.floor(state.sunshine / 36);

  const level = currentLevel();
  const isFinalCompleted = state.adventure.currentLevel === levels.length - 1 && state.adventure.levelProgress >= level.steps;
  state.adventure.totalSteps += 1;
  if (isFinalCompleted) {
    state.adventure.postCompletionSteps += 1;
  } else {
    state.adventure.levelProgress += 1;
    if (state.adventure.levelProgress >= level.steps) {
      reward += level.reward;
      state.badges.add(state.adventure.currentLevel === 0 ? '首关通过' : `${level.name}通关`);
      if (state.adventure.currentLevel < levels.length - 1) {
        state.adventure.currentLevel += 1;
        state.adventure.levelProgress = 0;
      } else {
        state.adventure.completedAt = state.adventure.completedAt || new Date().toISOString();
      }
    }
  }

  if (state.totalCheckins === 1) state.badges.add('第一次出发');
  if (state.streak >= 7) state.badges.add('坚持一周');
  if (state.totalCheckins >= 15) state.badges.add('半月达人');
  state.balance += reward;
  state.checkins.unshift({ reward, day: state.totalCheckins });
  showToast(`审核通过，正式入账 ${money(reward)} 能量币`);
  render();
}

function rejectCheckin() {
  if (!state.pendingCheckin) {
    showToast('没有待审核打卡');
    return;
  }
  state.pendingCheckin = null;
  showToast('已温柔退回，可以重新提交清晰照片');
  render();
}

function redeem(id) {
  const item = rewards.find((reward) => reward.id === id);
  if (!item) return;
  if (state.balance < item.price) {
    showToast('能量币还不够，再攒几天就能换啦');
    return;
  }
  state.balance -= item.price;
  state.redemptions.unshift({ id: crypto.randomUUID(), rewardId: id, name: item.name, cost: item.price, status: 'pending' });
  showToast(`兑换成功：${item.name}`);
  render();
}

function requestCancel(id) {
  const item = state.redemptions.find((redemption) => redemption.id === id);
  if (!item || item.status !== 'pending') return;
  item.status = 'cancel_requested';
  showToast('已申请取消，等待赞助者确认');
  render();
}

function approveCancel(id) {
  const item = state.redemptions.find((redemption) => redemption.id === id);
  if (!item || item.status !== 'cancel_requested') return;
  item.status = 'cancelled_refunded';
  state.balance += item.cost;
  showToast('已确认取消并退款');
  render();
}

function verifyRedemption(id) {
  const item = state.redemptions.find((redemption) => redemption.id === id);
  if (!item || item.status !== 'pending') return;
  item.status = 'used';
  showToast('兑换券已核销');
  render();
}

function renderHome() {
  const level = currentLevel();
  return `
    <section class="hero-scene">
      <div class="sky">
        <div class="sun-pill">阳光 ${state.sunshine}</div>
        <div class="tree" style="--tree-scale:${treeScale()}">
          <div class="leaf left"></div>
          <div class="leaf main"></div>
          <div class="leaf right"></div>
          <div class="trunk"></div>
          <div class="ground"></div>
        </div>
      </div>
      <div class="hero-info">
        <div class="row">
          <div>
            <p class="title">小树 ${state.sunshine >= 75 ? '枝叶' : state.sunshine >= 30 ? '舒展' : '发芽'}</p>
            <p class="muted small">连续 ${state.streak} 天 · 心愿果 ${state.fruits} 颗</p>
          </div>
          <div class="money">${money(state.balance)}币</div>
        </div>
        <div class="progress"><div class="bar" style="width:${Math.min(100, state.sunshine / 1.4)}%"></div></div>
      </div>
    </section>

    <section class="grid">
      <button class="action" onclick="submitCheckin()">＋ 今日打卡</button>
      <button class="action secondary" onclick="setTab('shop')">奖励商店</button>
      <button class="action ghost" onclick="setTab('map')">能量地图</button>
      <button class="action ghost" onclick="setTab('profile')">我的成就</button>
    </section>

    <section class="panel">
      <div class="row">
        <div>
          <p class="section-title">今日状态</p>
          <p class="muted small">${state.pendingCheckin ? '等待赞助者审核' : state.checkins.length ? '今天已经有正式奖励啦' : '还没有打卡，动一点点也算数'}</p>
        </div>
        <span class="pill">${state.pendingCheckin ? '待审核' : state.checkins.length ? '已入账' : '未开始'}</span>
      </div>
      ${state.pendingCheckin ? '<div class="pending"><strong>+5.00</strong><span class="muted small">待确认能量币，审核通过后正式入账</span></div>' : ''}
    </section>

    <section class="panel">
      <div class="row">
        <div>
          <p class="section-title">能量大冒险</p>
          <p class="muted small">${level.name} · 还差 ${Math.max(0, level.steps - state.adventure.levelProgress)} 步通关</p>
        </div>
        <span class="pill">${levelPercent()}%</span>
      </div>
      <div class="progress"><div class="bar blue" style="width:${levelPercent()}%"></div></div>
    </section>

    ${state.role === 'sponsor' ? `
      <section class="panel">
        <p class="section-title">男友审核台</p>
        <p class="muted small">这里模拟云端权限：只有赞助者视角能审核和兑现。</p>
        <div class="grid">
          <button class="action" onclick="approveCheckin()" ${state.pendingCheckin ? '' : 'disabled'}>通过并入账</button>
          <button class="action danger" onclick="rejectCheckin()" ${state.pendingCheckin ? '' : 'disabled'}>温柔退回</button>
        </div>
      </section>
    ` : ''}
  `;
}

function renderMap() {
  const level = currentLevel();
  return `
    <section class="panel">
      <p class="eyebrow">当前关卡</p>
      <p class="title">${level.name}</p>
      <p class="muted">每次审核通过，角色前进一步。最终关奖励只发一次。</p>
      <div class="progress"><div class="bar" style="width:${levelPercent()}%"></div></div>
      <p class="muted small">已走 ${state.adventure.levelProgress} / ${level.steps} 步 · 总步数 ${state.adventure.totalSteps}</p>
    </section>
    <section class="map-scroll">
      <div class="map-road">
        ${levels.map((item, index) => {
          const done = index < state.adventure.currentLevel || (index === levels.length - 1 && state.adventure.completedAt);
          const current = index === state.adventure.currentLevel && !state.adventure.completedAt;
          return `
            <div class="node ${done ? 'done' : current ? 'current' : 'locked'}">
              <div class="dot" style="background:${item.color}">${index + 1}</div>
              <div class="node-text">
                <strong>${item.name}</strong>
                <p class="muted small">${done ? '已通关' : current ? '进行中' : '未解锁'}</p>
                <p class="price">+${money(item.reward)}币</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderShop() {
  return `
    <section class="panel row">
      <div>
        <p class="muted small">我的能量币</p>
        <p class="money">${money(state.balance)}币</p>
      </div>
      <button class="action secondary" onclick="setTab('profile')">兑换记录</button>
    </section>
    <section class="shop-grid">
      ${rewards.map((item) => `
        <article class="reward">
          <div class="reward-art" style="background:${item.color}">${item.type}</div>
          <div class="reward-body">
            <strong>${item.name}</strong>
            <p class="muted small">${item.desc}</p>
            <div class="row">
              <span class="price">${money(item.price)}币</span>
              <button class="action secondary" onclick="redeem('${item.id}')">兑换</button>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderProfile() {
  const badges = ['第一次出发', '坚持一周', '首关通过', '半月达人', '百币达成', '全程登顶'];
  const redemptions = state.redemptions.length ? state.redemptions.map((item) => `
    <div class="panel">
      <div class="row">
        <div>
          <p class="section-title">${item.name}</p>
          <p class="muted small">消耗 ${money(item.cost)} 能量币 · ${statusText(item.status)}</p>
        </div>
        <span class="pill">${statusText(item.status)}</span>
      </div>
      ${state.role === 'participant' && item.status === 'pending' ? `<button class="action secondary" onclick="requestCancel('${item.id}')">申请取消</button>` : ''}
      ${state.role === 'sponsor' && item.status === 'pending' ? `<button class="action" onclick="verifyRedemption('${item.id}')">确认已兑现</button>` : ''}
      ${state.role === 'sponsor' && item.status === 'cancel_requested' ? `<button class="action" onclick="approveCancel('${item.id}')">同意取消并退款</button>` : ''}
    </div>
  `).join('') : '<section class="panel muted">还没有兑换记录。</section>';

  return `
    <section class="stat-grid">
      <div class="stat"><div class="stat-number">${state.streak}</div><div class="muted small">当前连续</div></div>
      <div class="stat"><div class="stat-number">${state.maxStreak}</div><div class="muted small">最长连续</div></div>
      <div class="stat"><div class="stat-number">${state.totalCheckins}</div><div class="muted small">累计打卡</div></div>
      <div class="stat"><div class="stat-number">${state.badges.size}</div><div class="muted small">已解锁徽章</div></div>
    </section>
    <section class="panel">
      <p class="section-title">这个月的打卡</p>
      <div class="calendar">${Array.from({ length: 31 }).map((_, i) => `<div class="day ${i < state.totalCheckins ? 'done' : ''}">${i + 1}</div>`).join('')}</div>
    </section>
    <section class="badge-grid">
      ${badges.map((badge) => `<div class="badge ${state.badges.has(badge) ? '' : 'locked'}"><div class="badge-icon">${badge.slice(0, 2)}</div><strong>${badge}</strong><p class="muted small">${state.badges.has(badge) ? '已经点亮' : '继续运动解锁'}</p></div>`).join('')}
    </section>
    <p class="section-title">兑换记录</p>
    ${redemptions}
  `;
}

function statusText(status) {
  return {
    pending: '待使用',
    used: '已核销',
    cancel_requested: '申请取消中',
    cancelled_refunded: '已取消退款'
  }[status] || status;
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function setRole(role) {
  state.role = role;
  render();
}

function render() {
  document.querySelector('#roleLabel').textContent = state.role === 'sponsor' ? '赞助者视角' : '打卡者视角';
  document.querySelectorAll('.seg').forEach((button) => button.classList.toggle('active', button.dataset.role === state.role));
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.tab));
  view.classList.toggle('full', state.tab !== 'home');
  view.innerHTML = {
    home: renderHome,
    map: renderMap,
    shop: renderShop,
    profile: renderProfile
  }[state.tab]();
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
document.querySelectorAll('.seg').forEach((button) => button.addEventListener('click', () => setRole(button.dataset.role)));

window.setTab = setTab;
window.submitCheckin = submitCheckin;
window.approveCheckin = approveCheckin;
window.rejectCheckin = rejectCheckin;
window.redeem = redeem;
window.requestCancel = requestCancel;
window.approveCancel = approveCancel;
window.verifyRedemption = verifyRedemption;

render();
