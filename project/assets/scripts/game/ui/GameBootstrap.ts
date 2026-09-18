import {
  _decorator,
  Color,
  Component,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  UITransform,
  Vec3,
  VerticalTextAlignment,
  view
} from 'cc';
import { BoardState, ShelfState, SlotContent } from '../domain/BoardTypes';
import { MVP_LEVELS } from '../domain/LevelConfig';
import { GameFlowController, GameSnapshot } from '../flow/GameFlowController';
import { MockRewardAdPort } from '../../services/ads/MockRewardAdPort';
import { LocalStorageSavePort } from '../../services/save/LocalStorageSavePort';

const { ccclass } = _decorator;

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const CONTENT_WIDTH = 710;
const MAIN_GRID_CENTER_Y = 155;
const BUTTON_Y = -610;
const BUTTON_WIDTH = 132;
const MAX_MAIN_CELL = 105;

const ITEM_COLORS: Readonly<Record<string, Color>> = {
  apple: new Color(225, 73, 76, 255),
  milk: new Color(238, 238, 230, 255),
  cookie: new Color(197, 137, 73, 255),
  juice: new Color(246, 166, 48, 255)
};

const ITEM_LABELS: Readonly<Record<string, string>> = {
  apple: 'A',
  milk: 'M',
  cookie: 'C',
  juice: 'J'
};

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private readonly savePort = new LocalStorageSavePort();
  private readonly rewardAdPort = new MockRewardAdPort();
  private readonly controller = new GameFlowController(
    MVP_LEVELS,
    this.savePort,
    this.rewardAdPort
  );
  private homeRoot: Node | null = null;
  private gameRoot: Node | null = null;
  private settingsRoot: Node | null = null;
  private boardRoot: Node | null = null;
  private homeLevelLabel: Label | null = null;
  private titleLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private settingsLevelLabel: Label | null = null;
  private soundToggleButton: Node | null = null;
  private musicToggleButton: Node | null = null;
  private nextLevelButton: Node | null = null;
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;

  protected start(): void {
    view.setDesignResolutionSize(
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      ResolutionPolicy.FIXED_WIDTH
    );

    this.ensureCanvasSize();
    this.createBackground();
    this.homeRoot = this.createNode(
      this.node,
      'HomeRoot',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      0,
      0
    );
    this.gameRoot = this.createNode(
      this.node,
      'GameRoot',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      0,
      0
    );
    this.settingsRoot = this.createNode(
      this.node,
      'SettingsRoot',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      0,
      0
    );

    this.createHomeUi(this.homeRoot);
    this.createGameUi(this.gameRoot);
    this.createSettingsUi(this.settingsRoot);

    this.unsubscribe = this.controller.subscribe((snapshot) => {
      this.render(snapshot);
    });
    void this.loadSaveData();
  }

  protected onDestroy(): void {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async loadSaveData(): Promise<void> {
    try {
      const result = await this.savePort.load(this.controller.getLevelCount());
      if (!this.destroyed) {
        this.controller.restoreSaveData(result);
      }
    } catch {
      // Keep the in-memory defaults when storage is unavailable.
    }
  }

  private createHomeUi(root: Node): void {
    this.createBackgroundPanel(root, 650, 700, 0, 80);
    this.createLabelNode(
      root,
      '货架整理达人',
      58,
      new Color(48, 54, 58, 255),
      620,
      90,
      0,
      310
    );
    this.homeLevelLabel = this.createLabelNode(
      root,
      '',
      30,
      new Color(82, 88, 91, 255),
      560,
      52,
      0,
      185
    );
    this.createButton(
      root,
      '开始游戏',
      0,
      -40,
      290,
      88,
      30,
      () => {
        this.controller.startCurrentLevel();
      }
    );
  }

  private createGameUi(root: Node): void {
    this.titleLabel = this.createLabelNode(
      root,
      '货架整理达人',
      42,
      new Color(48, 54, 58, 255),
      CONTENT_WIDTH,
      60,
      0,
      610
    );
    this.statusLabel = this.createLabelNode(
      root,
      '',
      22,
      new Color(82, 88, 91, 255),
      CONTENT_WIDTH,
      62,
      0,
      557
    );

    this.boardRoot = this.createNode(
      root,
      'BoardRoot',
      CONTENT_WIDTH,
      1040,
      0,
      0
    );

    this.createActionButton(root, '加货架', -280, () => {
      void this.controller.unlockBufferShelf();
    });
    this.createActionButton(root, '撤回', -140, () => {
      void this.controller.undo();
    });
    this.createActionButton(root, '打乱', 140, () => {
      void this.controller.shuffle();
    });
    this.createActionButton(root, '重开', 280, () => {
      this.controller.restart();
    });
    this.nextLevelButton = this.createActionButton(root, '下一关', 0, () => {
      this.controller.nextLevel();
    });
    this.createButton(
      root,
      '设置',
      300,
      610,
      120,
      60,
      22,
      () => {
        this.controller.openSettings();
      },
      new Color(83, 98, 105, 255),
      new Color(51, 65, 71, 255)
    );
  }

  private createSettingsUi(root: Node): void {
    const backdrop = this.createNode(
      root,
      'SettingsBackdrop',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      0,
      0
    );
    const graphics = backdrop.addComponent(Graphics);
    graphics.fillColor = new Color(34, 42, 45, 170);
    graphics.rect(
      -DESIGN_WIDTH / 2,
      -DESIGN_HEIGHT / 2,
      DESIGN_WIDTH,
      DESIGN_HEIGHT
    );
    graphics.fill();
    root.on(Node.EventType.TOUCH_END, () => undefined, this);

    this.createBackgroundPanel(root, 540, 670, 0, 0);
    this.createLabelNode(
      root,
      '设置',
      44,
      new Color(48, 54, 58, 255),
      420,
      70,
      0,
      210
    );
    this.settingsLevelLabel = this.createLabelNode(
      root,
      '',
      28,
      new Color(82, 88, 91, 255),
      460,
      48,
      0,
      140
    );
    this.soundToggleButton = this.createButton(
      root,
      '音效：开',
      0,
      45,
      280,
      78,
      28,
      () => {
        this.controller.toggleSound();
      }
    );
    this.musicToggleButton = this.createButton(
      root,
      '音乐：开',
      0,
      -45,
      280,
      78,
      28,
      () => {
        this.controller.toggleMusic();
      }
    );
    this.createButton(
      root,
      '继续游戏',
      0,
      -145,
      280,
      78,
      28,
      () => {
        this.controller.closeSettings();
      }
    );
    this.createButton(
      root,
      '返回首页',
      0,
      -245,
      280,
      78,
      28,
      () => {
        this.controller.goHome();
      }
    );
  }

  private ensureCanvasSize(): void {
    const transform =
      this.node.getComponent(UITransform) ??
      this.node.addComponent(UITransform);
    transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
  }

  private createBackground(): void {
    const background = this.createNode(
      this.node,
      'Background',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      0,
      0
    );
    const graphics = background.addComponent(Graphics);
    graphics.fillColor = new Color(242, 239, 229, 255);
    graphics.rect(
      -DESIGN_WIDTH / 2,
      -DESIGN_HEIGHT / 2,
      DESIGN_WIDTH,
      DESIGN_HEIGHT
    );
    graphics.fill();

    graphics.fillColor = new Color(255, 252, 244, 255);
    graphics.roundRect(-365, -555, 730, 1110, 8);
    graphics.fill();
  }

  private render(snapshot: GameSnapshot): void {
    const showHome = snapshot.flowState === 'home';

    if (this.homeRoot) {
      this.homeRoot.active = showHome;
    }
    if (this.gameRoot) {
      this.gameRoot.active = !showHome && !snapshot.isSettingsOpen;
    }
    if (this.settingsRoot) {
      this.settingsRoot.active = snapshot.isSettingsOpen;
    }
    if (this.homeLevelLabel) {
      this.homeLevelLabel.string = `当前关卡：${snapshot.selectedLevelTitle}`;
    }
    if (this.settingsLevelLabel) {
      this.settingsLevelLabel.string = snapshot.levelTitle;
    }
    this.setButtonText(
      this.soundToggleButton,
      `音效：${snapshot.soundEnabled ? '开' : '关'}`
    );
    this.setButtonText(
      this.musicToggleButton,
      `音乐：${snapshot.musicEnabled ? '开' : '关'}`
    );

    if (!this.boardRoot || !this.gameRoot?.active) {
      return;
    }

    if (this.titleLabel) {
      this.titleLabel.string = `${snapshot.levelTitle}`;
    }
    if (this.statusLabel) {
      const completion = snapshot.isWon ? ' | 已完成' : '';
      const rewardBusy = snapshot.isRewardAdBusy ? ' | 广告中' : '';
      this.statusLabel.string = `${snapshot.message}${completion}${rewardBusy}`;
    }
    if (this.nextLevelButton) {
      this.nextLevelButton.active = snapshot.flowState === 'levelComplete';
    }

    this.clearChildren(this.boardRoot);

    const mainShelves = snapshot.board.shelves.filter(
      (shelf) => shelf.kind === 'main'
    );
    const bufferShelves = snapshot.board.shelves.filter(
      (shelf) => shelf.kind === 'buffer'
    );

    this.renderMainShelves(
      snapshot.board,
      mainShelves,
      snapshot.selectedShelfId
    );
    this.renderBufferShelves(snapshot.board, bufferShelves);
  }

  private renderMainShelves(
    board: BoardState,
    shelves: readonly ShelfState[],
    selectedShelfId: string | null
  ): void {
    if (!this.boardRoot || shelves.length === 0) {
      return;
    }

    const capacity = shelves[0]?.capacity ?? 1;
    const availableHeight = 810;
    const estimatedCellByWidth =
      (CONTENT_WIDTH - (shelves.length + 1) * 8) /
      shelves.length /
      0.78;
    const estimatedCellByHeight = availableHeight / capacity;
    const cell = Math.max(
      28,
      Math.min(MAX_MAIN_CELL, estimatedCellByWidth, estimatedCellByHeight)
    );
    const shelfWidth = cell * 0.78;
    const gap =
      (CONTENT_WIDTH - shelves.length * shelfWidth) /
      Math.max(1, shelves.length + 1);
    const startX =
      -CONTENT_WIDTH / 2 + gap + shelfWidth / 2;
    const shelfHeight = capacity * cell;

    shelves.forEach((shelf, shelfIndex) => {
      const x = startX + shelfIndex * (shelfWidth + gap);
      const shelfNode = this.createNode(
        this.boardRoot as Node,
        `Shelf-${shelf.id}`,
        shelfWidth,
        shelfHeight,
        x,
        MAIN_GRID_CENTER_Y
      );
      const selected = shelf.id === selectedShelfId;
      this.drawPanel(
        shelfNode,
        shelfWidth,
        shelfHeight,
        new Color(224, 220, 207, 255),
        selected ? new Color(244, 174, 51, 255) : new Color(145, 139, 126, 255),
        selected ? 5 : 2,
        7
      );

      shelfNode.on(
        Node.EventType.TOUCH_END,
        () => {
          this.controller.tapShelf(shelf.id);
        },
        this
      );

      for (let index = 0; index < shelf.slots.length; index += 1) {
        const content = shelf.slots[index];
        if (!content) {
          continue;
        }
        const itemY = -shelfHeight / 2 + cell / 2 + index * cell;
        this.createItemNode(
          shelfNode,
          content,
          cell * 0.68,
          itemY
        );
      }
    });
  }

  private renderBufferShelves(
    board: BoardState,
    shelves: readonly ShelfState[]
  ): void {
    if (!this.boardRoot || shelves.length === 0) {
      return;
    }

    const itemSize = Math.max(
      24,
      Math.min(46, (CONTENT_WIDTH - (shelves.length + 1) * 8) / shelves.length / 2)
    );
    const shelfWidth = itemSize * 1.15;
    const gap =
      (CONTENT_WIDTH - shelves.length * shelfWidth) /
      Math.max(1, shelves.length + 1);
    const startX = -CONTENT_WIDTH / 2 + gap + shelfWidth / 2;
    const shelfHeight =
      itemSize * Math.max(...shelves.map((shelf) => shelf.capacity), 1);
    const centerY = -365;

    shelves.forEach((shelf, shelfIndex) => {
      const x = startX + shelfIndex * (shelfWidth + gap);
      const shelfNode = this.createNode(
        this.boardRoot as Node,
        `Shelf-${shelf.id}`,
        shelfWidth,
        shelfHeight,
        x,
        centerY
      );
      this.drawPanel(
        shelfNode,
        shelfWidth,
        shelfHeight,
        new Color(232, 226, 208, 255),
        new Color(161, 149, 125, 255),
        2,
        6
      );

      shelfNode.on(
        Node.EventType.TOUCH_END,
        () => {
          this.controller.tapShelf(shelf.id);
        },
        this
      );

      for (let index = 0; index < shelf.slots.length; index += 1) {
        const content = shelf.slots[index];
        if (!content) {
          continue;
        }
        const itemY = -shelfHeight / 2 + itemSize / 2 + index * itemSize;
        this.createItemNode(
          shelfNode,
          content,
          itemSize * 0.78,
          itemY
        );
      }
    });

    const label = this.createLabelNode(
      this.boardRoot,
      `缓冲货架 ${shelves.length}/${8}`,
      20,
      new Color(95, 91, 82, 255),
      300,
      32,
      0,
      centerY - 66
    );
    label.node.setSiblingIndex(this.boardRoot.children.length - 1);
  }

  private createItemNode(
    parent: Node,
    content: SlotContent,
    size: number,
    y: number
  ): void {
    const itemNode = this.createNode(
      parent,
      content.hidden ? 'Box' : `Item-${content.itemTypeId}`,
      size,
      size,
      0,
      y
    );

    const color = content.hidden
      ? new Color(139, 94, 55, 255)
      : ITEM_COLORS[content.itemTypeId] ?? new Color(120, 176, 194, 255);
    this.drawPanel(
      itemNode,
      size,
      size,
      color,
      new Color(74, 70, 64, 180),
      2,
      5
    );

    const labelColor =
      content.itemTypeId === 'milk'
        ? new Color(64, 62, 55, 255)
        : new Color(255, 255, 255, 255);
    this.createLabelNode(
      itemNode,
      content.hidden ? '?' : (ITEM_LABELS[content.itemTypeId] ?? '?'),
      Math.max(14, Math.floor(size * 0.62)),
      labelColor,
      size,
      size,
      0,
      0
    );
  }

  private createActionButton(
    root: Node,
    text: string,
    x: number,
    onClick: () => void
  ): Node {
    return this.createButton(
      root,
      text,
      x,
      BUTTON_Y,
      BUTTON_WIDTH,
      70,
      24,
      onClick
    );
  }

  private createButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    onClick: () => void,
    fillColor = new Color(72, 128, 173, 255),
    strokeColor = new Color(40, 83, 116, 255)
  ): Node {
    const button = this.createNode(
      parent,
      `Button-${text}`,
      width,
      height,
      x,
      y
    );
    this.drawPanel(
      button,
      width,
      height,
      fillColor,
      strokeColor,
      2,
      8
    );
    this.createLabelNode(
      button,
      text,
      fontSize,
      new Color(255, 255, 255, 255),
      width,
      height,
      0,
      0
    );
    button.on(Node.EventType.TOUCH_END, onClick, this);
    return button;
  }

  private createBackgroundPanel(
    parent: Node,
    width: number,
    height: number,
    x: number,
    y: number
  ): Node {
    const panel = this.createNode(
      parent,
      'Panel',
      width,
      height,
      x,
      y
    );
    this.drawPanel(
      panel,
      width,
      height,
      new Color(255, 252, 244, 255),
      new Color(198, 191, 175, 255),
      2,
      8
    );
    return panel;
  }

  private setButtonText(button: Node | null, text: string): void {
    const label = button
      ?.getChildByName('Label')
      ?.getComponent(Label);
    if (label) {
      label.string = text;
    }
  }

  private createNode(
    parent: Node,
    name: string,
    width: number,
    height: number,
    x: number,
    y: number
  ): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(new Vec3(x, y, 0));
    parent.addChild(node);
    return node;
  }

  private createLabelNode(
    parent: Node,
    text: string,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
    x: number,
    y: number
  ): Label {
    const node = this.createNode(parent, 'Label', width, height, x, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.ceil(fontSize * 1.2);
    label.color = color;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return label;
  }

  private drawPanel(
    node: Node,
    width: number,
    height: number,
    fillColor: Color,
    strokeColor: Color,
    lineWidth: number,
    radius: number
  ): void {
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fillColor;
    graphics.strokeColor = strokeColor;
    graphics.lineWidth = lineWidth;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    graphics.stroke();
  }

  private clearChildren(node: Node): void {
    for (const child of [...node.children]) {
      child.destroy();
    }
    node.removeAllChildren();
  }
}
