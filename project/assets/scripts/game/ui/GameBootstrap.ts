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
import { GameFlowController, GameSnapshot } from '../flow/GameFlowController';

const { ccclass } = _decorator;

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const CONTENT_WIDTH = 710;
const MAIN_GRID_CENTER_Y = 155;
const BUTTON_Y = -610;
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
  private readonly controller = new GameFlowController();
  private boardRoot: Node | null = null;
  private titleLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private unsubscribe: (() => void) | null = null;

  protected start(): void {
    view.setDesignResolutionSize(
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      ResolutionPolicy.FIXED_WIDTH
    );

    this.ensureCanvasSize();
    this.createBackground();
    this.titleLabel = this.createLabelNode(
      this.node,
      '货架整理达人',
      42,
      new Color(48, 54, 58, 255),
      CONTENT_WIDTH,
      60,
      0,
      610
    );
    this.statusLabel = this.createLabelNode(
      this.node,
      '',
      22,
      new Color(82, 88, 91, 255),
      CONTENT_WIDTH,
      62,
      0,
      557
    );

    this.boardRoot = this.createNode(
      this.node,
      'BoardRoot',
      CONTENT_WIDTH,
      1040,
      0,
      0
    );

    this.createActionButton('加货架', -255, () => {
      this.controller.unlockBufferShelf();
    });
    this.createActionButton('撤回', -85, () => {
      this.controller.undo();
    });
    this.createActionButton('打乱', 85, () => {
      this.controller.shuffle();
    });
    this.createActionButton('重开', 255, () => {
      this.controller.restart();
    });

    this.unsubscribe = this.controller.subscribe((snapshot) => {
      this.render(snapshot);
    });
  }

  protected onDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
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
    if (!this.boardRoot) {
      return;
    }

    if (this.titleLabel) {
      this.titleLabel.string = `${snapshot.levelTitle}`;
    }
    if (this.statusLabel) {
      const completion = snapshot.isWon ? ' | 已完成' : '';
      this.statusLabel.string = `${snapshot.message}${completion}`;
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
    const shelfHeight = itemSize * 2;
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
    text: string,
    x: number,
    onClick: () => void
  ): void {
    const button = this.createNode(
      this.node,
      `Button-${text}`,
      150,
      70,
      x,
      BUTTON_Y
    );
    this.drawPanel(
      button,
      150,
      70,
      new Color(72, 128, 173, 255),
      new Color(40, 83, 116, 255),
      2,
      8
    );
    this.createLabelNode(
      button,
      text,
      24,
      new Color(255, 255, 255, 255),
      150,
      70,
      0,
      0
    );
    button.on(Node.EventType.TOUCH_END, onClick, this);
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
