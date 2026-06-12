import type { ConfigSchema } from '../../.cursor/skills/config-editor/tool/types';

/**
 * 配置编辑器 Schema 定义（对应 src/config/data/*.json）。
 * 覆盖 吞噬进化岛 3D 全部可调参数：玩家/相机/战斗/成长/敌人/竞技场/进化/终局/版本/特效/音效。
 * 颜色字段使用 "0xRRGGBB" 字符串。
 */
export const schemas: ConfigSchema[] = [
  {
    file: 'player.json',
    label: '玩家',
    icon: '🐲',
    fields: [
      {
        path: 'sizeByLevel', label: '体型曲线（按等级）', type: 'array',
        columns: [
          { path: 'level', label: '等级', type: 'int', min: 1, max: 405 },
          { path: 'scale', label: '体型', type: 'float', min: 0.5, max: 30, step: 0.1 },
        ],
      },
      {
        path: 'moveSpeedByLevel', label: '移动速度（按等级）', type: 'array',
        columns: [
          { path: 'level', label: '等级', type: 'int', min: 1, max: 405 },
          { path: 'speed', label: '速度', type: 'float', min: 1, max: 60, step: 0.5, unit: 'u/s' },
        ],
      },
      {
        label: '摇杆', type: 'group',
        fields: [
          { path: 'joystick.radius', label: '最大半径', type: 'int', min: 20, max: 160, unit: 'px' },
          { path: 'joystick.deadZone', label: '死区', type: 'int', min: 0, max: 40, unit: 'px' },
        ],
      },
    ],
  },
  {
    file: 'camera.json',
    label: '相机',
    icon: '🎥',
    fields: [
      {
        path: 'byLevel', label: '拉远曲线（按等级）', type: 'array',
        columns: [
          { path: 'level', label: '等级', type: 'int', min: 1, max: 405 },
          { path: 'distance', label: '水平距离', type: 'float', min: 4, max: 200, step: 0.5 },
          { path: 'height', label: '高度', type: 'float', min: 4, max: 260, step: 0.5 },
        ],
      },
      {
        label: '跟随/平滑', type: 'group',
        fields: [
          { path: 'rig.followLerp', label: '跟随平滑', type: 'float', min: 1, max: 20, step: 0.5 },
          { path: 'rig.zoomLerp', label: '拉远平滑', type: 'float', min: 0.5, max: 10, step: 0.1 },
          { path: 'rig.pixelRatioCap', label: '像素比上限', type: 'float', min: 1, max: 3, step: 0.5 },
        ],
      },
    ],
  },
  {
    file: 'combat.json',
    label: '战斗',
    icon: '⚔️',
    fields: [
      { path: 'executeDelta', label: '处决等级差', type: 'int', min: 0, max: 10 },
      { path: 'hopelessDelta', label: '绝望等级差', type: 'int', min: -10, max: 0 },
      { path: 'contactCooldown', label: '接触结算冷却', type: 'float', min: 0.05, max: 2, step: 0.01, unit: 's' },
      {
        label: '玩家伤害比例（×目标maxHp）', type: 'group',
        fields: [
          { path: 'playerDamageFractions.dominant', label: '压制', type: 'float', min: 0, max: 1, step: 0.01 },
          { path: 'playerDamageFractions.advantage', label: '优势', type: 'float', min: 0, max: 1, step: 0.01 },
          { path: 'playerDamageFractions.even', label: '均势', type: 'float', min: 0, max: 1, step: 0.01 },
          { path: 'playerDamageFractions.disadvantage', label: '劣势', type: 'float', min: 0, max: 1, step: 0.01 },
          { path: 'playerDamageFractions.hopeless', label: '绝望', type: 'float', min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        label: '敌人反伤系数', type: 'group',
        fields: [
          { path: 'counterDamageFactors.dominant', label: '压制', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'counterDamageFactors.advantage', label: '优势', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'counterDamageFactors.even', label: '均势', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'counterDamageFactors.disadvantage', label: '劣势', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'counterDamageFactors.hopeless', label: '绝望', type: 'float', min: 0, max: 2, step: 0.05 },
        ],
      },
      {
        label: 'relation 颜色', type: 'group',
        fields: [
          { path: 'relationColors.dominant', label: '压制', type: 'color' },
          { path: 'relationColors.advantage', label: '优势', type: 'color' },
          { path: 'relationColors.even', label: '均势', type: 'color' },
          { path: 'relationColors.disadvantage', label: '劣势', type: 'color' },
          { path: 'relationColors.hopeless', label: '绝望', type: 'color' },
        ],
      },
    ],
  },
  {
    file: 'progression.json',
    label: '成长曲线',
    icon: '📈',
    fields: [
      { path: 'minLevel', label: '最小等级', type: 'int', min: 1, max: 10 },
      { path: 'maxLevel', label: '最大等级', type: 'int', min: 10, max: 1000 },
      {
        label: '升级经验', type: 'group',
        fields: [
          { path: 'expToNext.base', label: '基础', type: 'float', min: 0, max: 50, step: 0.5 },
          { path: 'expToNext.perLevel', label: '每级增量', type: 'float', min: 0, max: 10, step: 0.1 },
        ],
      },
      {
        label: '吞噬奖励', type: 'group',
        fields: [
          { path: 'expReward.base', label: '基础', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'expReward.perEnemyLevel', label: '每敌等级', type: 'float', min: 0, max: 5, step: 0.05 },
          { path: 'expReward.highBonusPerDiff', label: '高级加成/差', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'expReward.lowPenaltyPerDiff', label: '低级惩罚/差', type: 'float', min: 0, max: 2, step: 0.05 },
          { path: 'expReward.minLowFactor', label: '最低系数', type: 'float', min: 0, max: 1, step: 0.05 },
        ],
      },
      {
        label: '生命/伤害', type: 'group',
        fields: [
          { path: 'playerHp.base', label: '玩家HP基础', type: 'int', min: 1, max: 500 },
          { path: 'playerHp.perLevel', label: '玩家HP/级', type: 'float', min: 0, max: 50, step: 0.5 },
          { path: 'enemyHp.base', label: '敌HP基础', type: 'int', min: 1, max: 500 },
          { path: 'enemyHp.perLevel', label: '敌HP/级', type: 'float', min: 0, max: 50, step: 0.5 },
          { path: 'enemyContactDamage.base', label: '敌伤基础', type: 'float', min: 0, max: 100, step: 0.5 },
          { path: 'enemyContactDamage.perLevel', label: '敌伤/级', type: 'float', min: 0, max: 20, step: 0.1 },
        ],
      },
    ],
  },
  {
    file: 'enemies.json',
    label: '敌人',
    icon: '👾',
    fields: [
      { path: 'chaseGiveUp', label: '追逐放弃距离', type: 'float', min: 5, max: 120, step: 1 },
      {
        label: '相对体型钳制', type: 'group',
        fields: [
          { path: 'size.sameOrLowerMaxRatio', label: '同/低级最大比', type: 'float', min: 0.1, max: 1, step: 0.05 },
          { path: 'size.higherMinRatio', label: '高级最小比', type: 'float', min: 1, max: 3, step: 0.05 },
        ],
      },
      {
        path: 'size.scaleByDiff', label: '等级差→体型', type: 'array',
        columns: [
          { path: 'diff', label: '等级差', type: 'int', min: -10, max: 10 },
          { path: 'scale', label: '体型比', type: 'float', min: 0.05, max: 4, step: 0.05 },
        ],
      },
      {
        label: '种类 · blob', type: 'group',
        fields: [
          { path: 'kinds.blob.body', label: '主色', type: 'color' },
          { path: 'kinds.blob.accent', label: '点缀', type: 'color' },
          { path: 'kinds.blob.sizeFactor', label: '体型微调', type: 'float', min: 0.5, max: 2, step: 0.05 },
          { path: 'kinds.blob.speed', label: '速度', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'kinds.blob.aggro', label: '仇恨半径', type: 'float', min: 0, max: 50, step: 1 },
        ],
      },
      {
        label: '种类 · critter', type: 'group',
        fields: [
          { path: 'kinds.critter.body', label: '主色', type: 'color' },
          { path: 'kinds.critter.accent', label: '点缀', type: 'color' },
          { path: 'kinds.critter.sizeFactor', label: '体型微调', type: 'float', min: 0.5, max: 2, step: 0.05 },
          { path: 'kinds.critter.speed', label: '速度', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'kinds.critter.aggro', label: '仇恨半径', type: 'float', min: 0, max: 50, step: 1 },
        ],
      },
      {
        label: '种类 · beast', type: 'group',
        fields: [
          { path: 'kinds.beast.body', label: '主色', type: 'color' },
          { path: 'kinds.beast.accent', label: '点缀', type: 'color' },
          { path: 'kinds.beast.sizeFactor', label: '体型微调', type: 'float', min: 0.5, max: 2, step: 0.05 },
          { path: 'kinds.beast.speed', label: '速度', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'kinds.beast.aggro', label: '仇恨半径', type: 'float', min: 0, max: 50, step: 1 },
        ],
      },
      {
        label: '种类 · brute', type: 'group',
        fields: [
          { path: 'kinds.brute.body', label: '主色', type: 'color' },
          { path: 'kinds.brute.accent', label: '点缀', type: 'color' },
          { path: 'kinds.brute.sizeFactor', label: '体型微调', type: 'float', min: 0.5, max: 2, step: 0.05 },
          { path: 'kinds.brute.speed', label: '速度', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'kinds.brute.aggro', label: '仇恨半径', type: 'float', min: 0, max: 50, step: 1 },
        ],
      },
      {
        label: '种类 · wyrm', type: 'group',
        fields: [
          { path: 'kinds.wyrm.body', label: '主色', type: 'color' },
          { path: 'kinds.wyrm.accent', label: '点缀', type: 'color' },
          { path: 'kinds.wyrm.sizeFactor', label: '体型微调', type: 'float', min: 0.5, max: 2, step: 0.05 },
          { path: 'kinds.wyrm.speed', label: '速度', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'kinds.wyrm.aggro', label: '仇恨半径', type: 'float', min: 0, max: 50, step: 1 },
        ],
      },
    ],
  },
  {
    file: 'arena.json',
    label: '竞技场',
    icon: '🏝️',
    fields: [
      {
        label: '岛屿', type: 'group',
        fields: [
          { path: 'arena.islandRadius', label: '岛半径', type: 'float', min: 40, max: 300, step: 5 },
          { path: 'arena.coreRadius', label: '核心区半径', type: 'float', min: 10, max: 150, step: 1 },
          { path: 'arena.midRadius', label: '中圈半径', type: 'float', min: 20, max: 250, step: 1 },
          { path: 'arena.difficulty.edgeLevel', label: '边缘等级', type: 'int', min: 1, max: 50 },
          { path: 'arena.difficulty.centerLevel', label: '中心等级', type: 'int', min: 1, max: 100 },
          { path: 'arena.difficulty.jitter', label: '等级抖动', type: 'int', min: 0, max: 5 },
        ],
      },
      {
        label: '刷怪', type: 'group',
        fields: [
          { path: 'spawn.maxAlive', label: '最大存活', type: 'int', min: 4, max: 80 },
          { path: 'spawn.spawnRadiusMin', label: '刷怪近半径', type: 'float', min: 4, max: 60, step: 1 },
          { path: 'spawn.spawnRadiusMax', label: '刷怪远半径', type: 'float', min: 10, max: 150, step: 1 },
          { path: 'spawn.recycleRadius', label: '回收半径', type: 'float', min: 20, max: 200, step: 1 },
          { path: 'spawn.centerLeadMax', label: '中心加成上限', type: 'int', min: 0, max: 10 },
          { path: 'spawn.maxLeadAbovePlayer', label: '高于玩家上限', type: 'int', min: 0, max: 10 },
        ],
      },
      {
        path: 'spawn.levelWeights', label: '等级偏移权重', type: 'array',
        columns: [
          { path: 'offset', label: '偏移', type: 'int', min: -10, max: 10 },
          { path: 'weight', label: '权重', type: 'float', min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        label: '开局猎物', type: 'group',
        fields: [
          { path: 'spawn.starterPrey.count', label: '数量', type: 'int', min: 0, max: 20 },
          { path: 'spawn.starterPrey.spread', label: '散布', type: 'float', min: 2, max: 40, step: 1 },
          { path: 'spawn.starterPrey.minRadius', label: '最小半径', type: 'float', min: 1, max: 30, step: 1 },
        ],
      },
      {
        label: '宝箱', type: 'group',
        fields: [
          { path: 'chests.count', label: '数量', type: 'int', min: 0, max: 20 },
          { path: 'chests.radius', label: '拾取半径', type: 'float', min: 0.5, max: 10, step: 0.1 },
          { path: 'chests.baseExp', label: '基础经验', type: 'int', min: 0, max: 100 },
          { path: 'chests.centerBonusExp', label: '中心额外经验', type: 'int', min: 0, max: 200 },
          { path: 'chests.respawnDelayMs', label: '重生延迟', type: 'int', min: 0, max: 60000, step: 500, unit: 'ms' },
          { path: 'chests.channelMs', label: '开箱读条', type: 'int', min: 0, max: 10000, step: 100, unit: 'ms' },
        ],
      },
      {
        label: '环境', type: 'group',
        fields: [
          { path: 'env.trees', label: '树木数', type: 'int', min: 0, max: 400 },
          { path: 'env.rocks', label: '岩石数', type: 'int', min: 0, max: 200 },
          { path: 'env.mountains', label: '环岛山数', type: 'int', min: 0, max: 80 },
        ],
      },
    ],
  },
  {
    file: 'evolution.json',
    label: '形态进化',
    icon: '🧬',
    fields: [
      {
        path: 'forms', label: '形态阶段', type: 'array',
        columns: [
          { path: 'level', label: '解锁等级', type: 'int', min: 1, max: 405 },
          { path: 'name', label: '名称', type: 'string' },
          { path: 'body', label: '主色', type: 'color' },
          { path: 'accent', label: '点缀', type: 'color' },
          { path: 'tier', label: '造型档位', type: 'int', min: 0, max: 6 },
        ],
      },
    ],
  },
  {
    file: 'endgame.json',
    label: '终局/泰坦',
    icon: '👑',
    fields: [
      { path: 'triggerLevel', label: '触发等级', type: 'int', min: 2, max: 405 },
      {
        label: '登场演出', type: 'group',
        fields: [
          { path: 'intro.title', label: '标题', type: 'string' },
          { path: 'intro.subtitleDelayMs', label: '字幕延迟', type: 'int', min: 0, max: 5000, step: 100, unit: 'ms' },
          { path: 'intro.othersShrinkRatio', label: '其他怪缩小比', type: 'float', min: 0.1, max: 1, step: 0.05 },
          { path: 'intro.panDurationMs', label: '运镜时长', type: 'int', min: 200, max: 6000, step: 100, unit: 'ms' },
        ],
      },
      {
        label: '接触', type: 'group',
        fields: [
          { path: 'contact.range', label: '范围', type: 'float', min: 1, max: 10, step: 0.1 },
          { path: 'contact.intervalSec', label: '间隔', type: 'float', min: 0.1, max: 2, step: 0.05, unit: 's' },
          { path: 'contact.knockback', label: '击退', type: 'float', min: 0, max: 20, step: 0.5 },
        ],
      },
      {
        path: 'titans', label: '双子泰坦', type: 'array',
        columns: [
          { path: 'id', label: 'ID', type: 'string' },
          { path: 'name', label: '名称', type: 'string' },
          { path: 'body', label: '主色', type: 'color' },
          { path: 'accent', label: '点缀', type: 'color' },
          { path: 'scale', label: '体型', type: 'float', min: 1, max: 12, step: 0.1 },
        ],
      },
    ],
  },
  {
    file: 'variants.json',
    label: '投放版本',
    icon: '🎯',
    fields: [
      {
        path: 'default', label: '默认版本', type: 'select',
        options: [
          { value: 'win', label: '胜利版' },
          { value: 'lose', label: '失败版' },
        ],
      },
      {
        label: '胜利版 · Boss', type: 'group',
        fields: [
          { path: 'variants.win.boss.maxHp', label: '血量', type: 'int', min: 1, max: 500 },
          { path: 'variants.win.boss.contactPlayerDamage', label: '对玩家伤害', type: 'int', min: 0, max: 200 },
          { path: 'variants.win.boss.contactBossDamage', label: '玩家对其伤害', type: 'int', min: 0, max: 200 },
          { path: 'variants.win.end.title', label: '结算标题', type: 'string' },
          { path: 'variants.win.end.subtitle', label: '结算副标题', type: 'string' },
          { path: 'variants.win.end.buttonLabel', label: 'CTA按钮', type: 'string' },
        ],
      },
      {
        label: '失败版 · Boss', type: 'group',
        fields: [
          { path: 'variants.lose.boss.maxHp', label: '血量', type: 'int', min: 1, max: 500 },
          { path: 'variants.lose.boss.contactPlayerDamage', label: '对玩家伤害', type: 'int', min: 0, max: 200 },
          { path: 'variants.lose.boss.contactBossDamage', label: '玩家对其伤害', type: 'int', min: 0, max: 200 },
          { path: 'variants.lose.end.title', label: '结算标题', type: 'string' },
          { path: 'variants.lose.end.subtitle', label: '结算副标题', type: 'string' },
          { path: 'variants.lose.end.buttonLabel', label: 'CTA按钮', type: 'string' },
        ],
      },
    ],
  },
  {
    file: 'fx.json',
    label: '特效',
    icon: '✨',
    fields: [
      {
        label: '吞噬肉块', type: 'group',
        fields: [
          { path: 'devour.chunkCount', label: '肉块数', type: 'int', min: 0, max: 30 },
          { path: 'devour.burstSpeed', label: '迸射初速', type: 'float', min: 0, max: 20, step: 0.5 },
          { path: 'devour.burstHold', label: '迸射停留', type: 'float', min: 0, max: 1, step: 0.02, unit: 's' },
          { path: 'devour.homeSpeed', label: '吸入速度', type: 'float', min: 1, max: 40, step: 0.5 },
          { path: 'devour.pulseScale', label: '吸收脉冲', type: 'float', min: 0, max: 1, step: 0.02 },
          { path: 'devour.chunkColor', label: '肉块颜色', type: 'color' },
        ],
      },
      {
        label: '进化金环', type: 'group',
        fields: [
          { path: 'evolution.ringColor', label: '金环颜色', type: 'color' },
          { path: 'evolution.ringDuration', label: '扩散时长', type: 'float', min: 0.1, max: 3, step: 0.1, unit: 's' },
          { path: 'evolution.ringMaxRadius', label: '最大半径×', type: 'float', min: 1, max: 12, step: 0.5 },
          { path: 'evolution.punchScale', label: '体型punch', type: 'float', min: 0, max: 1, step: 0.05 },
        ],
      },
    ],
  },
  {
    file: 'audio.json',
    label: '音效',
    icon: '🔊',
    fields: [
      { path: 'masterVolume', label: '主音量', type: 'float', min: 0, max: 1, step: 0.05 },
    ],
  },
];
