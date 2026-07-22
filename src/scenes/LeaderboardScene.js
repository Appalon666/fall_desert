// Leaderboard — таблица рекордов (по убийствам). На Яндексе тянет реальные
// записи, локально показывает твой рекорд и подсказку.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, panel } from '../ui/scenery.js'
import { Platform } from '../platform/yandex.js'
import { t } from '../i18n.js'
import { fmt } from '../util/format.js'

export default class LeaderboardScene extends Phaser.Scene {
  constructor() { super(SCENES.LEADERBOARD) }

  create() {
    buildBackground(this, { sky: 0x241d15, ground: 0x322516, accent: 0xc9a76a }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 50, t('🏆 РЕКОРДЫ'), { size: 36 })
    this.add.text(GAME.WIDTH / 2, 96, t('Твой рекорд: {n} убийств', { n: fmt(State.bestScore) }), { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 44, { label: t('⟵ В лагерь'), width: 300, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    this.status = this.add.text(GAME.WIDTH / 2, 150, t('Загрузка таблицы…'), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#ddd2b4' }).setOrigin(0.5)
    this.loadBoard()
  }

  async loadBoard() {
    let res = null
    try { res = await Platform.getEntries() } catch (e) { res = null }
    if (!this.scene.isActive()) return
    if (!res || !res.entries || !res.entries.length) {
      this.status.setText(t('Онлайн-таблица доступна в версии на Яндекс.Играх.\nЗдесь — твой личный рекорд.')).setAlign('center')
      return
    }
    this.status.destroy()
    const cx = GAME.WIDTH / 2
    let y = 150
    res.entries.slice(0, 10).forEach((e) => {
      const me = e.player && e.player.uniqueID && res.userRank && e.rank === res.userRank
      panel(this, cx - 320, y, 640, 46, { radius: 8, fill: me ? 0x3a2c16 : COLORS.steelDark, border: me ? COLORS.cap : COLORS.ink })
      this.add.text(cx - 300, y + 23, `#${e.rank}`, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
      const name = (e.player && e.player.publicName) || t('Аноним')
      this.add.text(cx - 240, y + 23, name, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0, 0.5)
      this.add.text(cx + 300, y + 23, t('{n} убийств', { n: fmt(e.score) }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(1, 0.5)
      y += 52
    })
  }
}
